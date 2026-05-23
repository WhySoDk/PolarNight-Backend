package com.polarnight.routes

import com.polarnight.database.DatabaseFactory.dbQuery
import com.polarnight.database.models.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.jetbrains.exposed.sql.select
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.and

fun Route.autocompleteRoutes() {
    route("/api/autocomplete") {
        
        get("/artists") {
            val query = call.request.queryParameters["q"] ?: ""
            val filterMode = call.request.queryParameters["filterMode"] == "true"
            val results = dbQuery {
                if (filterMode) {
                    if (query.isBlank()) {
                        val groups = ArtistGroup.all().limit(10).map { mapOf("id" to it.id.value, "name" to it.name, "type" to "Group") }
                        val artists = Artist.find { Artists.group.isNull() }.limit(10).map { mapOf("id" to it.id.value, "name" to it.primaryName, "type" to "Artist") }
                        (groups + artists)
                    } else {
                        val matchedGroups = ArtistGroup.find { ArtistGroups.name like "%\$query%" }
                            .map { mapOf("id" to it.id.value, "name" to it.name, "type" to "Group") }
                        
                        val matchedArtists = Artist.find { (Artists.primaryName like "%\$query%") and Artists.group.isNull() }
                            .map { mapOf("id" to it.id.value, "name" to it.primaryName, "type" to "Artist") }
                        
                        (matchedGroups + matchedArtists).take(20)
                    }
                } else {
                    // Normal mode: return all artists (grouped and standalone)
                    if (query.isBlank()) {
                        Artist.all().limit(20).map { mapOf("id" to it.id.value, "name" to it.primaryName, "type" to "Artist") }
                    } else {
                        Artist.find { Artists.primaryName like "%\$query%" }
                            .take(20)
                            .map { mapOf("id" to it.id.value, "name" to it.primaryName, "type" to "Artist") }
                    }
                }
            }
            call.respond(results)
        }

        get("/tags") {
            val query = call.request.queryParameters["q"] ?: ""
            val results = dbQuery {
                if (query.isBlank()) {
                    Tag.all().limit(20).map { mapOf("id" to it.id.value, "name" to it.name) }
                } else {
                    Tag.find { Tags.name like "%$query%" }
                        .limit(20)
                        .map { mapOf("id" to it.id.value, "name" to it.name) }
                }
            }
            call.respond(results)
        }
    }
}
