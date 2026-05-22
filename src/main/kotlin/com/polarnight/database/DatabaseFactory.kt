package com.polarnight.database

import com.polarnight.database.models.MangaTags
import com.polarnight.database.models.Mangas
import com.polarnight.database.models.Tags
import kotlinx.coroutines.Dispatchers
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.transactions.transaction
import java.io.File

object DatabaseFactory {
    fun init(dbPath: String) {
        val file = File(dbPath)
        val parent = file.parentFile
        if (parent != null && !parent.exists()) {
            parent.mkdirs()
        }

        // Setup WAL mode for better concurrency in SQLite
        val url = "jdbc:sqlite:$dbPath?journal_mode=WAL&synchronous=NORMAL"
        val database = Database.connect(url, "org.sqlite.JDBC")

        transaction(database) {
            SchemaUtils.create(Artists, ArtistVariants, Mangas, Tags, MangaTags)
        }
    }

    suspend fun <T> dbQuery(block: suspend () -> T): T =
        newSuspendedTransaction(Dispatchers.IO) { block() }
}
