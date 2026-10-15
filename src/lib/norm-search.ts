/** Normalises English/Arabic text so hamza, ta marbuta, diacritics and case never block a match. */
export function normSearch(text: string) {
  return text.toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[-'.]/g, "").replace(/\s+/g, " ").trim();
}
