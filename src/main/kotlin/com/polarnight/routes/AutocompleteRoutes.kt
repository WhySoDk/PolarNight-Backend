package com.polarnight.routes

import com.polarnight.database.DatabaseFactory.dbQuery
import com.polarnight.database.models.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.jetbrains.exposed.sql.select
import org.jetbrains.exposed.sql.selectAll

fun Route.autocompleteRoutes() {
    route("/api/autocomplete") {
        
        get("/artists") {
            val query = call.request.queryParameters["q"] ?: ""
            val results = dbQuery {
                if (query.isBlank()) {
                    Artist.all().limit(20).map { mapOf("id" to it.id.value, "name" to it.primaryName) }
                } else {
                    // Search in both primary names and variants
                    val matchedArtists = Artist.find { Artists.primaryName like "%$query%" }.toList()
                    val matchedVariants = ArtistVariant.find { ArtistVariants.variantName like "%$query%" }.map { it.artist }
                    
                    (matchedArtists + matchedVariants).distinctBy { it.id.value }
                        .take(20)
                        .map { mapOf("id" to it.id.value, "name" to it.primaryName) }
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
