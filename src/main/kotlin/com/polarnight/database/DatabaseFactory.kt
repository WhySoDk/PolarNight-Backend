package com.polarnight.database

import com.polarnight.database.models.MangaTags
import com.polarnight.database.models.Mangas
import com.polarnight.database.models.Tags
import com.polarnight.database.models.Artists
import com.polarnight.database.models.ArtistVariants
import com.polarnight.database.models.ArtistGroups
import com.polarnight.database.models.ArtistGroup
import com.polarnight.database.models.Artist
import com.polarnight.database.models.ArtistVariant
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
            SchemaUtils.create(ArtistGroups, Artists, ArtistVariants, Mangas, Tags, MangaTags)
            
            // Migrate variants to groups if any exist
            val existingVariants = ArtistVariant.all().toList()
            if (existingVariants.isNotEmpty()) {
                val processedArtists = mutableSetOf<Int>()
                for (variant in existingVariants) {
                    val mainArtist = variant.artist
                    if (mainArtist.id.value !in processedArtists) {
                        // Ensure no group with this name exists first
                        var group = ArtistGroup.find { ArtistGroups.name eq mainArtist.primaryName }.firstOrNull()
                        if (group == null) {
                            group = ArtistGroup.new { name = mainArtist.primaryName }
                        }
                        mainArtist.group = group
                        processedArtists.add(mainArtist.id.value)
                    }
                    
                    var newArtist = Artist.find { Artists.primaryName eq variant.variantName }.firstOrNull()
                    if (newArtist == null) {
                        newArtist = Artist.new { primaryName = variant.variantName }
                    }
                    newArtist.group = mainArtist.group
                    
                    // Delete the variant record
                    variant.delete()
                }
                // Optionally drop table ArtistVariants here, but leaving it empty is safe too.
            }
        }
    }

    suspend fun <T> dbQuery(block: suspend () -> T): T =
        newSuspendedTransaction(Dispatchers.IO) { block() }
}
