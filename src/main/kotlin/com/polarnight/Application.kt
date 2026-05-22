package com.polarnight

import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import kotlinx.serialization.json.Json
import com.polarnight.routes.*
import io.ktor.server.http.content.*
import com.polarnight.database.DatabaseFactory

fun main() {
    embeddedServer(Netty, port = 8080, host = "0.0.0.0", module = Application::module)
        .start(wait = true)
}

fun Application.module() {
    val dbPath = System.getenv("DB_PATH") ?: "data/manga.db"
    DatabaseFactory.init(dbPath)

    install(CORS) {
        anyHost() // Allows access from Tailscale IP, Local IP, and localhost
        allowHeader(HttpHeaders.ContentType)
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Patch)
    }

    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
        })
    }

    routing {
        uploadRoutes()
        autocompleteRoutes()
        mangaRoutes()
        managementRoutes()
        
        // Serve the Admin Web UI
        staticResources("/", "static")
    }
}
