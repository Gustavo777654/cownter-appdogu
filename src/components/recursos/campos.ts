/** Lê um número digitado ("1,5" ou "1.5"); vazio = null; inválido = NaN. */
export const lerNumero = (texto: string): number | null =>
  texto.trim() === "" ? null : Number(texto.trim().replace(",", "."));

export const textoNumero = (n: number | null | undefined): string =>
  n === null || n === undefined ? "" : String(n).replace(".", ",");

/** Valor em reais digitado como "1.234,56", "1234,56" ou "1234.56"; vazio = null; inválido = NaN. */
export function lerReais(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/, "");
  if (t === "") return null;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}
