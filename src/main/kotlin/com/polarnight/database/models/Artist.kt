package com.polarnight.database.models

import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable

object ArtistGroups : IntIdTable() {
    val name = varchar("name", 255).uniqueIndex()
}

class ArtistGroup(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<ArtistGroup>(ArtistGroups)
    var name by ArtistGroups.name
}

object Artists : IntIdTable() {
    // Explicitly mentioning UTF-8 compatibility contextually, Exposed handles strings as UTF-8 by default.
    val primaryName = varchar("primary_name", 255).uniqueIndex()
    val group = reference("group_id", ArtistGroups).nullable()
}

class Artist(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<Artist>(Artists)

    var primaryName by Artists.primaryName
    var group by ArtistGroup optionalReferencedOn Artists.group
    val variants by ArtistVariant referrersOn ArtistVariants.artist
}

object ArtistVariants : IntIdTable() {
    val artist = reference("artist_id", Artists)
    val variantName = varchar("variant_name", 255).uniqueIndex()
}

class ArtistVariant(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<ArtistVariant>(ArtistVariants)

    var artist by Artist referencedOn ArtistVariants.artist
    var variantName by ArtistVariants.variantName
}
