fun main() {
    val files = listOf(
        "1 - 50YCL8c.png",
        "10 - PeA2zGE.png",
        "11 - HVSTyE8.png",
        "2 - uOKV5oE.png",
        "12 - rSlc5so.png"
    )
    val regex = "(?<=\\D)(?=\\d)|(?<=\\d)(?=\\D)".toRegex()
    val naturalSortComparator = Comparator<String> { s1, s2 ->
        val split1 = s1.split(regex)
        val split2 = s2.split(regex)
        val len = minOf(split1.size, split2.size)
        for (i in 0 until len) {
            val p1 = split1[i]
            val p2 = split2[i]
            if (p1 == p2) continue
            val num1 = p1.toLongOrNull()
            val num2 = p2.toLongOrNull()
            if (num1 != null && num2 != null) {
                return@Comparator num1.compareTo(num2)
            }
            return@Comparator p1.compareTo(p2, ignoreCase = true)
        }
        split1.size.compareTo(split2.size)
    }
    val sorted = files.sortedWith(naturalSortComparator)
    sorted.forEach { println(it) }
}
