from urllib.parse import urlencode
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

queries = {
    "instrumenti": "инструмент",
    "gradina": "градина",
    "za-doma": "уред",
    "banya": "смесител",
    "osvetlenie": "осветление",
    "podovi-i-stenni-pokritiya": "плочка",
    "v-i-k": "тръба",
    "vrati-obkov-krepezhi": "врата",
    "boi-lakove-mazilki": "боя",
    "stroitelstvo": "цимент",
    "rabotno-obleklo": "ръкавици",
}

headers = {"User-Agent": "Mozilla/5.0"}

for category, query in queries.items():
    url = f"https://joan.bg/index.php?route=product/search&{urlencode({'search': query})}"
    request = Request(url, headers=headers)
    with urlopen(request, timeout=30) as response:
        soup = BeautifulSoup(response.read(), "html.parser")
    seen = set()
    records = []
    for card in soup.select(".product-thumb, .product-layout"):
        title_anchor = card.select_one("h4 a, .name a, .caption h4 a")
        image = card.select_one(".image img, img")
        if not title_anchor or not image:
            continue
        name = title_anchor.get_text(" ", strip=True)
        source = image.get("data-src") or image.get("src")
        if not name or not source or title_anchor.get("href") in seen:
            continue
        seen.add(title_anchor.get("href"))
        records.append((name, source, title_anchor.get("href")))
    print(f"## {category}")
    for name, source, href in records[:5]:
        print(f"{name}\t{source}\t{href}")
