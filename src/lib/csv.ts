/**
 * Échappe une cellule CSV et neutralise l'injection de formules
 * (une cellule commençant par = + - @ tabulation ou retour chariot est préfixée d'une apostrophe).
 */
export function csvEscape(value: string | null | undefined): string {
  let s = value ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV avec BOM UTF-8 (accents correctement lus par Excel). */
export function toCsv(headers: string[], rows: (string | null | undefined)[][]): string {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  return `﻿${lines.join("\r\n")}`;
}
