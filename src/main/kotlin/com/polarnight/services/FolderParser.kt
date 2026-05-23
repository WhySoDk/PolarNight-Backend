package com.polarnight.services

data class ParsedFolder(val artist: String?, val title: String, val tags: List<String>)

object FolderParser {
    fun parse(folderName: String): ParsedFolder {
        // Matches any content inside [], {}, or ()
        val tagPattern = Regex("""[\[{(](.*?)[\]})]""")
        val matches = tagPattern.findAll(folderName).toList()
        
        var artist: String? = null
        val tags = mutableListOf<String>()
        
        // If the string starts with a bracket block, assume it is the Artist
        if (matches.isNotEmpty() && folderName.trimStart().startsWith(matches[0].value)) {
            artist = matches[0].groupValues[1].trim()
            tags.addAll(matches.drop(1).map { it.groupValues[1].trim() })
        } else {
            tags.addAll(matches.map { it.groupValues[1].trim() })
        }
        
        // The title is whatever remains after removing all bracketed groups
        var title = folderName
        matches.forEach { match ->
            title = title.replace(match.value, "")
        }
        title = title.trim()
        
        // Fallback if title is empty
        if (title.isEmpty()) {
            title = folderName
        }
        
        val translatedTags = tags.filter { it.isNotBlank() }.map { rawTag ->
            when (rawTag.lowercase()) {
                "th", "thai", "ไทย" -> "TH"
                "en", "english" -> "EN"
                "jp", "jpn", "japan" -> "JP"
                "cn", "china" -> "CN"
                "kr", "kn", "korean" -> "KR"
                else -> rawTag
            }
        }
        
        return ParsedFolder(artist, title, translatedTags)
    }
}
