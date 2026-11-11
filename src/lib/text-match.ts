/** Minuscules sans accents, pour comparer des textes multilingues. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Correspondance sur mots entiers (« shop » ne correspond pas à « workshop »). Le texte doit être normalisé. */
export function containsKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((kw) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(normalizeText(kw))}([^\\p{L}\\p{N}]|$)`, "u").test(text)
  );
}
