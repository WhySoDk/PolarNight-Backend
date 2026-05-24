val ktor_version: String by project
val kotlin_version: String by project
val logback_version: String by project
val exposed_version: String by project
val sqlite_version: String by project

plugins {
    kotlin("jvm") version "1.9.23"
    id("io.ktor.plugin") version "2.3.11"
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.23"
    application
}

group = "com.polarnight"
version = "1.0.0"

application {
    mainClass.set("com.polarnight.ApplicationKt")
    
    val isDevelopment: Boolean = project.ext.has("development")
    applicationDefaultJvmArgs = listOf("-Dio.ktor.development=$isDevelopment")
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("io.ktor:ktor-server-core-jvm:2.3.11")
    implementation("io.ktor:ktor-server-netty-jvm:2.3.11")
    implementation("io.ktor:ktor-server-cors-jvm:2.3.11")
    implementation("io.ktor:ktor-server-content-negotiation-jvm:2.3.11")
    implementation("io.ktor:ktor-serialization-gson-jvm:2.3.11")
    implementation("io.ktor:ktor-server-status-pages-jvm:2.3.11")
    
    // Logging
    implementation("ch.qos.logback:logback-classic:1.4.14")
    
    // DB
    implementation("org.jetbrains.exposed:exposed-core:0.50.0")
    implementation("org.jetbrains.exposed:exposed-dao:0.50.0")
    implementation("org.jetbrains.exposed:exposed-jdbc:0.50.0")
    implementation("org.jetbrains.exposed:exposed-java-time:0.50.0")
    implementation("org.xerial:sqlite-jdbc:3.45.3.0")
    
    // Thumbnails
    implementation("net.coobird:thumbnailator:0.4.20")
    implementation("org.sejda.imageio:webp-imageio:0.1.6") // Adds WebP support to standard Java ImageIO
}
