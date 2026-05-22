package com.polarnight.routes

import com.polarnight.database.DatabaseFactory.dbQuery
import com.polarnight.database.models.Manga
import com.polarnight.services.ThumbnailService
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.io.File

fun Route.mangaRoutes() {
    
    route("/api/mangas") {
        get {
            val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
            val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 24
            
            val includeAll = call.request.queryParameters["includeAll"]?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
            val includeAny = call.request.queryParameters["includeAny"]?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
            val exclude = call.request.queryParameters["exclude"]?.split(",")?.filter { it.isNotBlank() } ?: emptyList()

            val response = dbQuery {
                var query = Manga.all()
                
                // Note: Exposed doesn't perfectly handle complex M2M boolean filtering fluently without raw SQL,
                // so we will filter in memory for now. For massive DBs, this should be optimized with raw SQL subqueries.
                var mangas = query.toList()
                
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

        get("/{id}/pages") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest)
            val manga = dbQuery { Manga.findById(id) } ?: return@get call.respond(HttpStatusCode.NotFound)
            
            val folder = File(manga.folderPath)
            if (!folder.exists() || !folder.isDirectory) {
                return@get call.respond(HttpStatusCode.NotFound, "Folder not found")
            }
            
            val validExtensions = listOf("jpg", "jpeg", "png", "webp")
            val images = folder.listFiles { file ->
                file.isFile && validExtensions.any { file.extension.equals(it, ignoreCase = true) }
            }?.sortedBy { it.name }?.map { it.name } ?: emptyList()
            
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
    }

    // Related Books API
    get("/api/mangas/{id}/related") {
        val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest)
        
        val result = dbQuery {
            val manga = Manga.findById(id) ?: return@dbQuery null
            
            val sequel = manga.sequel?.let {
                mapOf("id" to it.id.value, "title" to it.title, "cover" to it.coverImage)
            }
            
            val artistId = manga.artist?.id?.value
            val otherWorks = if (artistId != null) {
                Manga.find { com.polarnight.database.models.Mangas.artist eq artistId }
                    .filter { it.id.value != id && it.id.value != manga.sequel?.id?.value }
                    .take(10)
                    .map { mapOf("id" to it.id.value, "title" to it.title, "cover" to it.coverImage) }
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
