package com.polarnight.database.models

import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable

object TagGroups : IntIdTable() {
    val name = varchar("name", 255).uniqueIndex()
}

class TagGroup(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<TagGroup>(TagGroups)
    var name by TagGroups.name
}

object Tags : IntIdTable() {
    val name = varchar("name", 100).uniqueIndex()
    val group = reference("group_id", TagGroups).nullable()
}

class Tag(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<Tag>(Tags)

    var name by Tags.name
    var group by TagGroup optionalReferencedOn Tags.group
}

object MangaTags : IntIdTable() {
    val manga = reference("manga_id", Mangas)
    val tag = reference("tag_id", Tags)
}
