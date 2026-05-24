import { todayIsoDate } from "./date";

export function exportFilename(
  prompt: string,
  ext: "md" | "txt" | "docx" | "pdf",
): string {
  const slug = slugify(prompt) || "cfde-atlas-export";
  return `${todayIsoDate()}-${slug}.${ext}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
