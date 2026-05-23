package com.polarnight.services

import com.polarnight.database.DatabaseFactory.dbQuery
import com.polarnight.database.models.Manga
import com.polarnight.database.models.Artist
import com.polarnight.database.models.Artists
import java.io.File

object MigrationService {
    
    suspend fun runMassMigration(pipelineDir: String, finalDir: String): Map<String, Any> {
        val pipeline = File(pipelineDir)
        if (!pipeline.exists() || !pipeline.isDirectory) {
            return mapOf("status" to "error", "message" to "Pipeline directory not found.")
        }

        val folders = pipeline.listFiles { file -> file.isDirectory } ?: emptyArray()
        var successCount = 0
        val failedFolders = mutableListOf<String>()

        folders.forEach { folder ->
            val parsed = FolderParser.parse(folder.name)
            
            if (parsed.artist != null && parsed.title.isNotBlank()) {
                val destFolder = File(finalDir, folder.name)
                destFolder.parentFile?.mkdirs()
                
                var moved = false
                try {
                    java.nio.file.Files.move(folder.toPath(), destFolder.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING)
                    moved = true
                } catch (e: Exception) {
                    e.printStackTrace()
                    moved = false
                }
                
                // Move folder physically
                if (moved) {
                    // Save to DB
                    dbQuery {
                        // Create or find artist
                        val artistEntity = Artist.find { Artists.primaryName eq parsed.artist }.firstOrNull() 
                            ?: Artist.new { primaryName = parsed.artist }
                            
                        val manga = Manga.new {
                            title = parsed.title
                            artist = artistEntity
                            folderPath = destFolder.absolutePath
                            status = "CONFIRMED"
                        }
                        
                        // Generate Thumbnails
                        val validExtensions = listOf("jpg", "jpeg", "png", "webp")
                        val cover = destFolder.listFiles { file -> 
                            file.isFile && validExtensions.any { file.extension.equals(it, ignoreCase = true) } 
                        }?.sortedBy { it.name }?.firstOrNull()
                        
                        if (cover != null) {
                            val thumbnailDir = System.getenv("THUMBNAIL_DIR") ?: "/app/data/thumbnails"
                            ThumbnailService.generateThumbnails(manga.id.value, cover.absolutePath, thumbnailDir)
                            manga.coverImage = cover.name
                        }
                    }
                    successCount++
                } else {
                    failedFolders.add(folder.name)
                }
            } else {
                failedFolders.add(folder.name)
            }
        }
        
        return mapOf(
            "status" to "success",
            "migrated" to successCount,
            "failed" to failedFolders
        )
    }
}
