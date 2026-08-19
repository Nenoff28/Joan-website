import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const sourcePage = "https://joan.bg/special";
const assetDir = "/home/ubuntu/webdev-static-assets";
const searchTerms = ["инструмент", "градина", "дом", "баня", "осветление", "кабел", "плочка", "ламинат", "тръба", "кран", "врата", "винт", "боя", "мазилка", "цимент", "изолация", "обувки", "каска", "ръкавици"];
const headers = { "user-agent": "Mozilla/5.0" };

function collectImages(html, baseUrl) {
  return [...html.matchAll(/(?:src|data-src)=["']([^"']*image\/cache\/catalog\/[^"']+)["']/gi)]
    .map((match) => match[1].replace(/&amp;/g, "&"))
    .map((src) => new URL(src, baseUrl).href)
    .filter((src) => /300x300/i.test(src))
    .filter((src) => !/logo|vector|45x45|90x90|categorrr|категории/i.test(src));
}

const urls = [sourcePage, ...searchTerms.map((term) => `https://joan.bg/index.php?route=product/search&search=${encodeURIComponent(term)}`)];
const imageCandidates = [];

for (const url of urls) {
  const response = await fetch(url, { headers });
  if (!response.ok) continue;
  imageCandidates.push(...collectImages(await response.text(), url));
}

const chosen = [...new Set(imageCandidates)].slice(0, 55);
if (chosen.length < 55) throw new Error(`Only ${chosen.length} usable Joan product images were found`);

await mkdir(assetDir, { recursive: true });
const manifest = [];

for (const [index, src] of chosen.entries()) {
  const image = await fetch(src, { headers });
  if (!image.ok) continue;
  const contentType = image.headers.get("content-type") || "image/jpeg";
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const fileName = `joan-live-product-${String(index + 1).padStart(2, "0")}.${extension}`;
  await writeFile(join(assetDir, fileName), Buffer.from(await image.arrayBuffer()));
  manifest.push({ fileName, src });
}

const aboutImage = await fetch("https://joan.bg/image/catalog/joan-about.jpg", { headers });
if (!aboutImage.ok) throw new Error(`Could not read About image: ${aboutImage.status}`);
await writeFile(join(assetDir, "joan-original-about.jpg"), Buffer.from(await aboutImage.arrayBuffer()));
await writeFile(join(assetDir, "joan-live-product-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ downloadedProducts: manifest.length, aboutImage: "joan-original-about.jpg" }));
