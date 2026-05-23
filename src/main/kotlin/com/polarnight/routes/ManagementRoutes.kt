package com.polarnight.routes

import com.polarnight.database.DatabaseFactory.dbQuery
import com.polarnight.database.models.*
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.update
import com.polarnight.services.MigrationService

data class TagRequest(val name: String)

data class VariantRequest(val name: String)

fun Route.managementRoutes() {
    route("/api/management") {
        
        // Migration
        post("/migration/run") {
            val pipelineDir = System.getenv("PIPELINE_DIR") ?: "/app/pipeline"
            val finalDir = System.getenv("MANGA_DIR") ?: "/app/manga"
            val result = MigrationService.runMassMigration(pipelineDir, finalDir)
            call.respond(result)
        }

        // Tags
        get("/tags") {
            val tags = dbQuery { Tag.all().map { mapOf("id" to it.id.value, "name" to it.name) } }
            call.respond(tags)
        }

        post("/tags") {
            val req = call.receive<TagRequest>()
            val tag = dbQuery { Tag.new { name = req.name } }
            call.respond(mapOf("id" to tag.id.value, "name" to tag.name))
        }

        put("/tags/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@put call.respond(HttpStatusCode.BadRequest)
            val req = call.receive<TagRequest>()
            dbQuery {
                Tags.update({ Tags.id eq id }) { it[name] = req.name }
            }
            call.respond(HttpStatusCode.OK)
        }

        delete("/tags/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@delete call.respond(HttpStatusCode.BadRequest)
            dbQuery {
                MangaTags.deleteWhere { tag eq id }
                Tags.deleteWhere { Tags.id eq id }
            }
            call.respond(HttpStatusCode.OK)
        }

        // Artists
        get("/artists") {
            val artists = dbQuery {
                Artist.all().map { artist ->
                    mapOf(
                        "id" to artist.id.value,
                        "primaryName" to artist.primaryName,
                        "variants" to artist.variants.map { mapOf("id" to it.id.value, "name" to it.variantName) }
                    )
                }
            }
            call.respond(artists)
        }

        post("/artists") {
            val req = call.receive<VariantRequest>() // We can reuse VariantRequest for name
            val artist = dbQuery {
                val existing = Artist.find { Artists.primaryName eq req.name }.firstOrNull()
                if (existing != null) return@dbQuery existing
                Artist.new { primaryName = req.name }
            }
            call.respond(mapOf("id" to artist.id.value, "primaryName" to artist.primaryName, "variants" to emptyList<Any>()))
        }

        post("/artists/{id}/variants") {
            val artistId = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest)
            val req = call.receive<VariantRequest>()
            val variant = dbQuery {
                val mainArtist = Artist.findById(artistId) ?: return@dbQuery null
                
                // If the provided variant name matches an existing standalone artist, merge them
                val existingArtist = Artist.find { Artists.primaryName eq req.name }.firstOrNull()
                if (existingArtist != null) {
                    // Move all mangas from existingArtist to mainArtist
                    Manga.find { Mangas.artist eq existingArtist.id }.forEach {
                        it.artist = mainArtist
                    }
                    // Move their variants? Or just delete them?
                    // Let's delete old variants to avoid infinite recursion, or remap them to the new main artist
                    ArtistVariant.find { ArtistVariants.artist eq existingArtist.id }.forEach {
                        it.artist = mainArtist
                    }
                    existingArtist.delete()
                }

                // If this name is already a variant for another artist, maybe move it?
                val existingVariant = ArtistVariant.find { ArtistVariants.variantName eq req.name }.firstOrNull()
                if (existingVariant != null) {
                    existingVariant.artist = mainArtist
                    existingVariant
                } else {
                    ArtistVariant.new {
                        this.artist = mainArtist
                        this.variantName = req.name
                    }
                }
            }
            if (variant != null) call.respond(HttpStatusCode.OK) else call.respond(HttpStatusCode.NotFound)
        }

        delete("/artists/variants/{id}") {
            val variantId = call.parameters["id"]?.toIntOrNull() ?: return@delete call.respond(HttpStatusCode.BadRequest)
            dbQuery { ArtistVariants.deleteWhere { id eq variantId } }
            call.respond(HttpStatusCode.OK)
        }
    }
}
