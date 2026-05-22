package com.polarnight.services

import net.coobird.thumbnailator.Thumbnails
import java.io.File

object ThumbnailService {
    
    fun generateThumbnails(mangaId: Int, coverImagePath: String, thumbnailDir: String) {
        val sourceFile = File(coverImagePath)
        if (!sourceFile.exists()) return

        val outDir = File(thumbnailDir, mangaId.toString())
        if (!outDir.exists()) outDir.mkdirs()

        val webThumb = File(outDir, "web.jpg")
        val einkThumb = File(outDir, "eink.jpg")

        // Generate High-Quality Web Thumbnail
        if (!webThumb.exists()) {
            Thumbnails.of(sourceFile)
                .size(400, 600)
                .outputFormat("jpg")
                .outputQuality(0.9)
                .toFile(webThumb)
        }

        // Generate Heavily Compressed E-Ink Thumbnail
        if (!einkThumb.exists()) {
            Thumbnails.of(sourceFile)
                .size(300, 450)
                .outputFormat("jpg")
                .outputQuality(0.3) // Heavy compression for E-Ink
                .toFile(einkThumb)
        }
    }
    
    fun getThumbnailFile(mangaId: Int, type: String, thumbnailDir: String): File? {
        val fileName = if (type == "eink") "eink.jpg" else "web.jpg"
        val file = File(thumbnailDir, "$mangaId/$fileName")
        return if (file.exists()) file else null
    }
}
