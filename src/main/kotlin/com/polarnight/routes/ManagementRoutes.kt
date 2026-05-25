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

        // Fix Book Names
        post("/fix-book-names") {
            var fixedCount = 0
            dbQuery {
                Manga.all().forEach { manga ->
                    if (manga.title.startsWith("]")) {
                        manga.title = manga.title.removePrefix("]").trim()
                        fixedCount++
                    }
                }
            }
            call.respond(mapOf("fixed" to fixedCount, "message" to "Fixed $fixedCount book names."))
        }

        // Tags
        get("/tags") {
            val data = dbQuery {
                val allGroups = TagGroup.all().map { group ->
                    mapOf(
                        "id" to group.id.value,
                        "name" to group.name,
                        "tags" to Tag.find { Tags.group eq group.id }.map { 
                            mapOf("id" to it.id.value, "name" to it.name) 
                        }
                    )
                }
                val standalone = Tag.find { Tags.group.isNull() }.map { tag ->
                    mapOf("id" to tag.id.value, "name" to tag.name)
                }
                mapOf("groups" to allGroups, "standalone" to standalone)
            }
            call.respond(data)
        }

        post("/tag-groups") {
            val req = call.receive<TagRequest>()
            val group = dbQuery {
                val existing = TagGroup.find { TagGroups.name eq req.name }.firstOrNull()
                if (existing != null) return@dbQuery existing
                TagGroup.new { name = req.name }
            }
            call.respond(mapOf("id" to group.id.value, "name" to group.name))
        }

        delete("/tag-groups/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@delete call.respond(HttpStatusCode.BadRequest)
            dbQuery { 
                Tag.find { Tags.group eq id }.forEach { it.group = null }
                TagGroups.deleteWhere { TagGroups.id eq id }
            }
            call.respond(HttpStatusCode.OK)
        }

        put("/tags/{id}/group") {
            val tagId = call.parameters["id"]?.toIntOrNull() ?: return@put call.respond(HttpStatusCode.BadRequest)
            val req = call.receive<Map<String, Int?>>()
            val groupId = req["groupId"]
            dbQuery {
                val tag = Tag.findById(tagId) ?: return@dbQuery
                if (groupId == null) {
                    tag.group = null
                } else {
                    val group = TagGroup.findById(groupId) ?: return@dbQuery
                    tag.group = group
                }
            }
            call.respond(HttpStatusCode.OK)
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

        // Artists & Groups
        get("/artists") {
            val data = dbQuery {
                val allGroups = ArtistGroup.all().map { group ->
                    mapOf(
                        "id" to group.id.value,
                        "name" to group.name,
                        "artists" to Artist.find { Artists.group eq group.id }.map { 
                            mapOf("id" to it.id.value, "primaryName" to it.primaryName) 
                        }
                    )
                }
                val standalone = Artist.find { Artists.group.isNull() }.map { artist ->
                    mapOf("id" to artist.id.value, "primaryName" to artist.primaryName)
                }
                mapOf("groups" to allGroups, "standalone" to standalone)
            }
            call.respond(data)
        }

        post("/artists") {
            val req = call.receive<VariantRequest>()
            val artist = dbQuery {
                val existing = Artist.find { Artists.primaryName eq req.name }.firstOrNull()
                if (existing != null) return@dbQuery existing
                Artist.new { primaryName = req.name }
            }
            call.respond(mapOf("id" to artist.id.value, "primaryName" to artist.primaryName))
        }
        
        delete("/artists/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@delete call.respond(HttpStatusCode.BadRequest)
            dbQuery { Artists.deleteWhere { Artists.id eq id } }
            call.respond(HttpStatusCode.OK)
        }

        post("/artist-groups") {
            val req = call.receive<VariantRequest>()
            val group = dbQuery {
                val existing = ArtistGroup.find { ArtistGroups.name eq req.name }.firstOrNull()
                if (existing != null) return@dbQuery existing
                ArtistGroup.new { name = req.name }
            }
            call.respond(mapOf("id" to group.id.value, "name" to group.name))
        }
        
        delete("/artist-groups/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: return@delete call.respond(HttpStatusCode.BadRequest)
            dbQuery { 
                // Disassociate artists first
                Artist.find { Artists.group eq id }.forEach { it.group = null }
                ArtistGroups.deleteWhere { ArtistGroups.id eq id }
            }
            call.respond(HttpStatusCode.OK)
        }
        
        put("/artists/{id}/group") {
            val artistId = call.parameters["id"]?.toIntOrNull() ?: return@put call.respond(HttpStatusCode.BadRequest)
            val req = call.receive<Map<String, Int?>>()
            val groupId = req["groupId"]
            dbQuery {
                val artist = Artist.findById(artistId) ?: return@dbQuery
                if (groupId == null) {
                    artist.group = null
                } else {
                    val group = ArtistGroup.findById(groupId) ?: return@dbQuery
                    artist.group = group
                }
            }
            call.respond(HttpStatusCode.OK)
        }
    }
}
