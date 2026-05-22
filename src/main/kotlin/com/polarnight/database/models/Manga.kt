package com.polarnight.database.models

import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.javatime.datetime
import java.time.LocalDateTime

object Mangas : IntIdTable() {
    val title = varchar("title", 255)
    val artist = reference("artist_id", Artists).nullable()
    val folderPath = varchar("folder_path", 1024).uniqueIndex()
    val coverImage = varchar("cover_image", 1024).nullable()
    val status = varchar("status", 50).default("PENDING") // PENDING or CONFIRMED
    val sequel = reference("sequel_id", Mangas).nullable()
    val createdAt = datetime("created_at").clientDefault { LocalDateTime.now() }
}

class Manga(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<Manga>(Mangas)

    var title by Mangas.title
    var artist by Artist optionalReferencedOn Mangas.artist
    var folderPath by Mangas.folderPath
    var coverImage by Mangas.coverImage
    var status by Mangas.status
    var sequel by Manga optionalReferencedOn Mangas.sequel
    var createdAt by Mangas.createdAt
    
    var tags by Tag via MangaTags
}
