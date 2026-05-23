package com.polarnight.routes

import com.polarnight.database.DatabaseFactory.dbQuery
import com.polarnight.database.models.*
import com.polarnight.services.ThumbnailService
import com.polarnight.services.PageNormalizer
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.io.File
import java.util.UUID
import org.jetbrains.exposed.sql.SizedCollection

data class MangaUpdateRequest(val title: String, val artist: String?, val tags: List<String>)
data class PageReorderRequest(val newOrder: List<String>)

fun Route.mangaRoutes() {
    
    route("/api/mangas") {
        get {
            val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
            val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 24
            
            val includeAll = call.request.queryParameters["includeAll"]?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
            val includeAny = call.request.queryParameters["includeAny"]?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
            val exclude = call.request.queryParameters["exclude"]?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
            val artistIdFilter = call.request.queryParameters["artistId"]?.toIntOrNull()

            val response = dbQuery {
                var query = Manga.all()
                
                var mangas = query.toList()
                
                if (artistIdFilter != null) {
                    mangas = mangas.filter { it.artist?.id?.value == artistIdFilter }
                }

                if (includeAll.isNotEmpty() || includeAny.isNotEmpty() || exclude.isNotEmpty()) {
                    mangas = mangas.filter { manga ->
                        val mangaTags = manga.tags.map { it.name.lowercase() }
                        
                        val hasAll = includeAll.isEmpty() || includeAll.all { it.lowercase() in mangaTags }
                        val hasAny = includeAny.isEmpty() || includeAny.any { it.lowercase() in mangaTags }
                        val hasNone = exclude.isEmpty() || exclude.none { it.lowercase() in mangaTags }
                        
                        hasAll && hasAny && hasNone
                    }
                }
                
                val totalItems = mangas.size
                val totalPages = Math.ceil(totalItems.toDouble() / limit).toInt()
                val paginatedMangas = mangas.drop((page - 1) * limit).take(limit)

                mapOf(
                    "page" to page,
                    "totalPages" to totalPages,
                    "totalItems" to totalItems,
                    "data" to paginatedMangas.map { 
                        mapOf(
                            "id" to it.id.value,
                            "title" to it.title,
                            "artist" to it.artist?.primaryName,
                            "status" to it.status
                        )
                    }
                )
            }
            call.respond(response)
        }

        get("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest)
            val mangaDetails = dbQuery {
                val manga = Manga.findById(id) ?: return@dbQuery null
                mapOf(
                    "id" to manga.id.value,
                    "title" to manga.title,
                    "artist" to manga.artist?.primaryName,
                    "tags" to manga.tags.map { it.name }
                )
            } ?: return@get call.respond(HttpStatusCode.NotFound)
            call.respond(mangaDetails)
        }

        get("/{id}/pages") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest)
            val manga = dbQuery { Manga.findById(id) } ?: return@get call.respond(HttpStatusCode.NotFound)
            
            val folder = File(manga.folderPath)
            if (!folder.exists() || !folder.isDirectory) {
                return@get call.respond(HttpStatusCode.NotFound, "Folder not found")
            }
            
            val validExtensions = listOf("jpg", "jpeg", "png", "webp")
            
            val regex = "(?<=\\D)(?=\\d)|(?<=\\d)(?=\\D)".toRegex()
            val naturalSortComparator = Comparator<String> { s1, s2 ->
                val split1 = s1.split(regex)
                val split2 = s2.split(regex)
                val len = minOf(split1.size, split2.size)
                for (i in 0 until len) {
                    val p1 = split1[i]
                    val p2 = split2[i]
                    if (p1 == p2) continue
                    val num1 = p1.toLongOrNull()
                    val num2 = p2.toLongOrNull()
                    if (num1 != null && num2 != null) {
                        return@Comparator num1.compareTo(num2)
                    }
                    return@Comparator p1.compareTo(p2, ignoreCase = true)
                }
                split1.size.compareTo(split2.size)
            }

            val images = folder.listFiles { file ->
                file.isFile && validExtensions.any { file.extension.equals(it, ignoreCase = true) }
            }?.map { it.name }?.sortedWith(naturalSortComparator) ?: emptyList()
            
            call.respond(images)
        }

        get("/{id}/thumbnail") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest)
            val type = call.request.queryParameters["type"] ?: "web" // "web" or "eink"
            
            val thumbnailDir = System.getenv("THUMBNAIL_DIR") ?: "/app/data/thumbnails"
            val file = ThumbnailService.getThumbnailFile(id, type, thumbnailDir)
            
            if (file != null && file.exists()) {
                call.respondFile(file)
            } else {
                call.respond(HttpStatusCode.NotFound)
            }
        }

        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@put call.respond(HttpStatusCode.BadRequest)
            val req = call.receive<MangaUpdateRequest>()
            dbQuery {
                val manga = Manga.findById(id) ?: return@dbQuery
                
                var resolvedArtist: Artist? = null
                if (!req.artist.isNullOrBlank()) {
                    val name = req.artist.trim()
                    resolvedArtist = Artist.find { Artists.primaryName eq name }.firstOrNull()
                    if (resolvedArtist == null) {
                        val variant = ArtistVariant.find { ArtistVariants.variantName eq name }.firstOrNull()
                        resolvedArtist = variant?.artist ?: Artist.new { primaryName = name }
                    }
                }

                val resolvedTags = req.tags.map { tagName ->
                    val name = tagName.trim()
                    Tag.find { Tags.name eq name }.firstOrNull() ?: Tag.new { this.name = name }
                }

                manga.title = req.title.trim()
                manga.artist = resolvedArtist
                manga.tags = SizedCollection(resolvedTags)
            }
            call.respond(HttpStatusCode.OK)
        }

        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@delete call.respond(HttpStatusCode.BadRequest)
            dbQuery {
                val manga = Manga.findById(id) ?: return@dbQuery
                val folder = File(manga.folderPath)
                if (folder.exists()) {
                    folder.deleteRecursively()
                }
                manga.delete()
            }
            call.respond(HttpStatusCode.OK)
        }

        post("/{id}/pages/normalize") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest)
            val mangaFolderPath = dbQuery { Manga.findById(id)?.folderPath } ?: return@post call.respond(HttpStatusCode.NotFound)
            val count = PageNormalizer.normalizePages(mangaFolderPath)
            call.respond(mapOf("status" to "success", "count" to count))
        }

        post("/{id}/pages/reorder") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest)
            val req = call.receive<PageReorderRequest>()
            val mangaFolderPath = dbQuery { Manga.findById(id)?.folderPath } ?: return@post call.respond(HttpStatusCode.NotFound)
            
            val folder = File(mangaFolderPath)
            if (!folder.exists() || !folder.isDirectory) {
                return@post call.respond(HttpStatusCode.NotFound)
            }

            // Temp rename to avoid collision
            val tempMapping = req.newOrder.mapIndexed { index, oldName ->
                val ext = File(oldName).extension
                val tempFile = File(folder, "temp_${UUID.randomUUID()}.$ext")
                val originalFile = File(folder, oldName)
                if (originalFile.exists()) {
                    originalFile.renameTo(tempFile)
                }
                Pair(tempFile, index + 1)
            }

            // Final rename to 0001.jpg etc
            tempMapping.forEach { (tempFile, newIndex) ->
                if (tempFile.exists()) {
                    val newName = String.format("%04d.%s", newIndex, tempFile.extension)
                    tempFile.renameTo(File(folder, newName))
                }
            }

            call.respond(HttpStatusCode.OK)
        }
    }

    // Related Books API
    get("/api/mangas/{id}/related") {
        val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest)
        
        val result = dbQuery {
            val manga = Manga.findById(id) ?: return@dbQuery null
            
            val sequel = manga.sequel?.let {
                mapOf("id" to it.id.value, "title" to it.title, "cover" to it.coverImage, "artist" to it.artist?.primaryName)
            }
            
            val otherWorksLimit = if (sequel != null) 4 else 5
            val artistId = manga.artist?.id?.value
            val otherWorks = if (artistId != null) {
                Manga.find { com.polarnight.database.models.Mangas.artist eq artistId }
                    .filter { it.id.value != id && it.id.value != manga.sequel?.id?.value }
                    .take(otherWorksLimit)
                    .map { mapOf("id" to it.id.value, "title" to it.title, "cover" to it.coverImage, "artist" to it.artist?.primaryName) }
            } else {
                emptyList()
            }
            
            mapOf("sequel" to sequel, "otherWorks" to otherWorks)
        }
        
        if (result != null) {
            call.respond(result)
        } else {
            call.respond(HttpStatusCode.NotFound)
        }
    }

    // Direct streaming for the E-Ink Client / Reader
    get("/stream/{mangaId}/{filename}") {
        val id = call.parameters["mangaId"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest)
        val filename = call.parameters["filename"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        
        val manga = dbQuery { Manga.findById(id) } ?: return@get call.respond(HttpStatusCode.NotFound)
        val file = File(manga.folderPath, filename)
        
        if (file.exists() && file.isFile) {
            call.respondFile(file)
        } else {
            call.respond(HttpStatusCode.NotFound)
        }
    }
}
