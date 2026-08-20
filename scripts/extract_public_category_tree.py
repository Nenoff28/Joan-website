from __future__ import annotations

import json
import sys
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


SOURCE_URL = "https://joan.bg/%D1%81%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%BD%D0%B8-%D0%BC%D0%B0%D1%82%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%D0%B8/instrumenti"


def clean_text(value: str) -> str:
    return " ".join(value.split())


def public_path(href: str | None) -> str | None:
    if not href:
        return None
    parsed = urlparse(href)
    if parsed.netloc not in {"", "joan.bg", "www.joan.bg"}:
        return None
    return parsed.path.rstrip("/") or "/"


def extract_tree(html: str) -> list[dict[str, object]]:
    soup = BeautifulSoup(html, "html.parser")
    tree: list[dict[str, object]] = []

    for top_anchor in soup.select("a.dropdown-toggle"):
        top_name = clean_text(top_anchor.get_text(" ", strip=True)).replace("+", "").strip()
        top_path = public_path(top_anchor.get("href"))
        menu = top_anchor.find_next_sibling("div", class_="dropdown-menu")
        if not top_name or not top_path or menu is None:
            continue

        groups: list[dict[str, object]] = []
        for group_anchor in menu.select("a.catalog-title"):
            group_name = clean_text(group_anchor.get_text(" ", strip=True))
            group_path = public_path(group_anchor.get("href"))
            if not group_name or not group_path:
                continue

            container = group_anchor.find_parent(class_="module-item")
            children: list[dict[str, str]] = []
            if container:
                for child_anchor in container.select(".subitems .subitem a"):
                    child_name = clean_text(child_anchor.get_text(" ", strip=True))
                    child_path = public_path(child_anchor.get("href"))
                    if child_name and child_path:
                        children.append({"name": child_name, "path": child_path})

            groups.append({"name": group_name, "path": group_path, "children": children})

        if groups:
            tree.append({"name": top_name, "path": top_path, "children": groups})

    return tree


def to_bulgarian_outline(categories: list[dict[str, object]]) -> str:
    lines = ["# Joan.bg public category hierarchy", "", "Generated from public menu names and paths only.", ""]
    for top in categories:
        top_name = str(top["name"])
        lines.append(f"## {top_name}")
        for group in top["children"]:  # type: ignore[index]
            group_name = str(group["name"])
            children = group["children"]  # type: ignore[index]
            if children:
                child_names = "; ".join(str(child["name"]) for child in children)
                lines.append(f"- **{group_name}:** {child_names}")
            else:
                lines.append(f"- **{group_name}**")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    response = requests.get(SOURCE_URL, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    payload = {
        "source": SOURCE_URL,
        "scope": "public category-navigation names and paths only",
        "categories": extract_tree(response.text),
    }
    if "--outline" in sys.argv:
        print(to_bulgarian_outline(payload["categories"]))
    else:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
