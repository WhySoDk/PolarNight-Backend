package com.polarnight.database.models

import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable

object Tags : IntIdTable() {
    val name = varchar("name", 100).uniqueIndex()
}

class Tag(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<Tag>(Tags)

    var name by Tags.name
}

object MangaTags : IntIdTable() {
    val manga = reference("manga_id", Mangas)
    val tag = reference("tag_id", Tags)
}
