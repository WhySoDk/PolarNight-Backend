import java.util.regex.Pattern

fun main() {
    val folderName = "[Canyne Khai] Artist Galleries"
    val tagPattern = Regex("""\[\[\{\(\](.*?)\[\]\}\)\]""")
    val matches = tagPattern.findAll(folderName).toList()
    println("TagPattern 1: ${matches.size}")

    val tagPattern2 = Regex("""[\[{(](.*?)[\]})]""")
    val matches2 = tagPattern2.findAll(folderName).toList()
    println("TagPattern 2: ${matches2.size}")
}
