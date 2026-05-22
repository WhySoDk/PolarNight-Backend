package com.polarnight.services

import java.io.File

object PageNormalizer {
    
    fun normalizePages(folderPath: String): Int {
        val folder = File(folderPath)
        if (!folder.exists() || !folder.isDirectory) return 0
        
        val validExtensions = listOf("jpg", "jpeg", "png", "webp")
        val images = folder.listFiles { file ->
            file.isFile && validExtensions.any { file.extension.equals(it, ignoreCase = true) }
        }?.sortedBy { it.name } ?: return 0

        var count = 0
        images.forEachIndexed { index, file ->
            val extension = file.extension.lowercase()
            // Format to 4 digits: 0001.jpg, 0002.jpg
            val newName = String.format("%04d.%s", index + 1, extension)
            val newFile = File(folder, newName)
            
            // Only rename if it's different to avoid unnecessary I/O
            if (file.name != newName && !newFile.exists()) {
                file.renameTo(newFile)
                count++
            }
        }
        return count
    }
}
