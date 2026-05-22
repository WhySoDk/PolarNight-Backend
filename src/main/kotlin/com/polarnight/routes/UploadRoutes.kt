package com.polarnight.routes

import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.io.File
import java.util.UUID

fun Route.uploadRoutes() {
    route("/api/upload") {
        
        // Method A: .rar / .zip Archive Upload
        post("/archive") {
            val multipart = call.receiveMultipart()
            val tempDir = File("/app/data/temp/${UUID.randomUUID()}")
            tempDir.mkdirs()
            
            var archiveFile: File? = null
            
            multipart.forEachPart { part ->
                if (part is PartData.FileItem) {
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
            
            // Here we will call ArchiveExtractor and FolderParser
            // Returning the parsed guesses to the UI
            call.respond(mapOf("status" to "success", "message" to "Archive uploaded and extracted temporarily."))
        }

        // Method B: Mass Image Upload
        post("/images") {
            // Note: This endpoint will handle receiving an array of images 
            // and the JSON metadata (Artist, Title, Tags) confirmed by the user.
            call.respond(mapOf("status" to "success", "message" to "Images uploaded successfully."))
        }
    }
}
