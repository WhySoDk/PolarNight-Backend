package com.polarnight.services

import java.io.File

object ArchiveExtractor {
    
    fun extract(archivePath: String, destDir: String): Boolean {
        val file = File(archivePath)
        if (!file.exists()) return false

        val dest = File(destDir)
        if (!dest.exists()) dest.mkdirs()

        val extension = file.extension.lowercase()
        
        val processBuilder = ProcessBuilder()
        processBuilder.directory(dest)

        when (extension) {
            "rar" -> {
                // unrar x <archive> <dest>
                processBuilder.command("unrar", "x", "-y", file.absolutePath, dest.absolutePath)
            }
            "zip", "cbz" -> {
                // unzip <archive> -d <dest>
                processBuilder.command("unzip", "-o", file.absolutePath, "-d", dest.absolutePath)
            }
            "7z" -> {
                // 7z x <archive> -o<dest>
                processBuilder.command("7z", "x", "-y", file.absolutePath, "-o${dest.absolutePath}")
            }
            else -> return false
        }

        return try {
            val process = processBuilder.start()
            val exitCode = process.waitFor()
            exitCode == 0
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
