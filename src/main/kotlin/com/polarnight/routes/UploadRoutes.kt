package com.polarnight.routes

import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.io.File
import java.util.UUID
import com.polarnight.database.DatabaseFactory.dbQuery
import com.polarnight.database.models.Artist
import com.polarnight.database.models.ArtistVariant
import com.polarnight.database.models.ArtistVariants
import com.polarnight.database.models.Artists
import com.polarnight.database.models.Manga
import com.polarnight.database.models.Tag
import com.polarnight.database.models.Tags
import com.polarnight.services.ThumbnailService
import org.jetbrains.exposed.sql.SizedCollection
import com.google.gson.Gson

data class UploadMetadataRequest(val title: String, val artist: String?, val tags: List<String>)

fun Route.uploadRoutes() {
    route("/api/upload") {
        
        // Method A: .rar / .zip Archive Upload
        post("/archive") {
            val multipart = call.receiveMultipart()
            val tempDir = File("/app/data/temp/${UUID.randomUUID()}")
            tempDir.mkdirs()
            
            var archiveFile: File? = null
            var req: UploadMetadataRequest? = null
            
            multipart.forEachPart { part ->
                if (part is PartData.FormItem && part.name == "metadata") {
                    req = Gson().fromJson(part.value, UploadMetadataRequest::class.java)
                } else if (part is PartData.FileItem) {
                    val ext = File(part.originalFileName ?: "").extension
                    archiveFile = File(tempDir, "upload.$ext")
                    part.streamProvider().use { input ->
                        archiveFile?.outputStream()?.buffered()?.use { output ->
                            input.copyTo(output)
                        }
                    }
                }
                part.dispose()
            }
            
            val destDir = File("/app/manga/${UUID.randomUUID()}")
            if (archiveFile != null && archiveFile!!.exists()) {
                val success = com.polarnight.services.ArchiveExtractor.extract(archiveFile!!.absolutePath, destDir.absolutePath)
                if (success) {
                    dbQuery {
                        var resolvedArtist: Artist? = null
                        if (req?.artist?.isNotBlank() == true) {
                            val name = req!!.artist!!.trim()
                            resolvedArtist = Artist.find { Artists.primaryName eq name }.firstOrNull()
                            if (resolvedArtist == null) {
                                val variant = ArtistVariant.find { ArtistVariants.variantName eq name }.firstOrNull()
                                resolvedArtist = variant?.artist ?: Artist.new { primaryName = name }
                            }
                        }
                        
                        val resolvedTags = req?.tags?.map { tagName ->
                            val name = tagName.trim()
                            Tag.find { Tags.name eq name }.firstOrNull() ?: Tag.new { this.name = name }
                        } ?: emptyList()

                        val newManga = Manga.new {
                            this.title = req?.title?.takeIf { it.isNotBlank() } ?: "Unknown Archive"
                            this.artist = resolvedArtist
                            this.folderPath = destDir.absolutePath
                            this.status = "CONFIRMED"
                        }
                        newManga.tags = SizedCollection(resolvedTags)

                        val validExtensions = listOf("jpg", "jpeg", "png", "webp")
                        val cover = destDir.listFiles { f -> 
                            f.isFile && validExtensions.any { f.extension.equals(it, ignoreCase = true) } 
                        }?.sortedBy { it.name }?.firstOrNull()

                        if (cover != null) {
                            val thumbnailDir = System.getenv("THUMBNAIL_DIR") ?: "/app/data/thumbnails"
                            ThumbnailService.generateThumbnails(newManga.id.value, cover.absolutePath, thumbnailDir)
                            newManga.coverImage = cover.name
                        }
                    }
                    archiveFile?.delete()
                    call.respond(mapOf("status" to "success", "message" to "Archive imported successfully."))
                } else {
                    call.respond(io.ktor.http.HttpStatusCode.InternalServerError, "Failed to extract archive")
                }
            } else {
                call.respond(io.ktor.http.HttpStatusCode.BadRequest, "No archive file found")
            }
        }

        // Method B: Mass Image Upload
        post("/images") {
            val multipart = call.receiveMultipart()
            var req: UploadMetadataRequest? = null

            val mangaIdStr = UUID.randomUUID().toString()
            val finalDir = File("/app/manga/$mangaIdStr")
            if (!finalDir.exists()) finalDir.mkdirs()

            multipart.forEachPart { part ->
                if (part is PartData.FormItem && part.name == "metadata") {
                    req = Gson().fromJson(part.value, UploadMetadataRequest::class.java)
                } else if (part is PartData.FileItem) {
                    val name = part.originalFileName ?: ""
                    if (name.isNotBlank()) {
                        val file = File(finalDir, name)
                        part.streamProvider().use { input ->
                            file.outputStream().buffered().use { output ->
                                input.copyTo(output)
                            }
                        }
                    }
                }
                part.dispose()
            }

            if (req == null) {
                return@post call.respond(io.ktor.http.HttpStatusCode.BadRequest, "Missing metadata")
            }

            val validExtensions = listOf("jpg", "jpeg", "png", "webp")
            val cover = finalDir.listFiles { f -> 
                f.isFile && validExtensions.any { f.extension.equals(it, ignoreCase = true) } 
            }?.sortedBy { it.name }?.firstOrNull()
            
            dbQuery {
                var resolvedArtist: Artist? = null
                if (!req!!.artist.isNullOrBlank()) {
                    val name = req!!.artist!!.trim()
                    resolvedArtist = Artist.find { Artists.primaryName eq name }.firstOrNull()
                    if (resolvedArtist == null) {
                        val variant = ArtistVariant.find { ArtistVariants.variantName eq name }.firstOrNull()
                        resolvedArtist = variant?.artist ?: Artist.new { primaryName = name }
                    }
                }

                val resolvedTags = req!!.tags.map { tagName ->
                    val name = tagName.trim()
                    Tag.find { Tags.name eq name }.firstOrNull() ?: Tag.new { this.name = name }
                }

                val newManga = Manga.new {
                    this.title = req!!.title.trim()
                    this.artist = resolvedArtist
                    this.folderPath = finalDir.absolutePath
                    this.status = "CONFIRMED"
                }

                newManga.tags = SizedCollection(resolvedTags)

                if (cover != null) {
                    val thumbnailDir = System.getenv("THUMBNAIL_DIR") ?: "/app/data/thumbnails"
                    ThumbnailService.generateThumbnails(newManga.id.value, cover.absolutePath, thumbnailDir)
                    newManga.coverImage = cover.name
                }
            }

            call.respond(mapOf("status" to "success", "message" to "Images uploaded successfully."))
        }
    }
}
