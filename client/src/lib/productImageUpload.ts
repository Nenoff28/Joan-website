export type UploadedProductImage = { url: string; key?: string };
const MAX_BYTES = 10 * 1024 * 1024;
export function productImageType(file: Pick<File, "name" | "type" | "size">): string {
  const extensions: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const inferred = extensions[file.name.split(".").pop()?.toLowerCase() ?? ""];
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type || inferred;
  if (!type || !/^image\/(jpeg|png|webp)$/.test(type)) throw new Error(`„${file.name}“: използвайте JPG, PNG или WEBP.`);
  if (!file.size || file.size > MAX_BYTES) throw new Error(`„${file.name}“: снимката трябва да е до 10 MB и да не е празна.`);
  return type;
}
export function readProductImage(file: File): Promise<string> {
  const type = productImageType(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Не успяхме да прочетем „${file.name}“. Изберете снимката отново.`));
    reader.onload = () => {
      const encoded = String(reader.result).split(",")[1];
      if (!encoded) return reject(new Error(`Не успяхме да прочетем „${file.name}“.`));
      resolve(`data:${type};base64,${encoded}`);
    };
    reader.readAsDataURL(file);
  });
}
export async function uploadProductImagesSequentially(
  files: File[],
  existingCount: number,
  upload: (input: { dataUrl: string; fileName: string }) => Promise<UploadedProductImage>,
  onUploaded: (image: UploadedProductImage, file: File) => void,
  onProgress: (current: number, total: number) => void,
) {
  if (files.length > 10 || files.length + existingCount > 10) throw new Error("Галерията може да съдържа най-много 10 снимки. Премахнете снимка преди добавяне на нова.");
  files.forEach(productImageType);
  let uploaded = 0;
  for (const file of files) {
    onProgress(uploaded + 1, files.length);
    try {
      const image = await upload({ dataUrl: await readProductImage(file), fileName: file.name.slice(0, 160) });
      if (!image.url) throw new Error("Липсва адрес на качената снимка.");
      onUploaded(image, file);
      uploaded += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Опитайте отново.";
      throw new Error(`Не успяхме да качим „${file.name}“. ${reason} ${uploaded ? `Успешно качените ${uploaded} снимки са запазени в галерията.` : ""}`.trim());
    }
  }
  return uploaded;
}
