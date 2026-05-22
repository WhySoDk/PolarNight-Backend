package com.polarnight.routes

import com.polarnight.database.DatabaseFactory.dbQuery
import com.polarnight.database.models.*
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.update

@Serializable
data class TagRequest(val name: String)

@Serializable
data class VariantRequest(val name: String)

fun Route.managementRoutes() {
    route("/api/management") {
        
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

        post("/artists/{id}/variants") {
            val artistId = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest)
            val req = call.receive<VariantRequest>()
            val variant = dbQuery {
                val artist = Artist.findById(artistId) ?: return@dbQuery null
                ArtistVariant.new {
                    this.artist = artist
                    this.variantName = req.name
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
