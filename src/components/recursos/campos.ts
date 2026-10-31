/** Lê um número digitado ("1,5" ou "1.5"); vazio = null; inválido = NaN. */
export const lerNumero = (texto: string): number | null =>
  texto.trim() === "" ? null : Number(texto.trim().replace(",", "."));

export const textoNumero = (n: number | null | undefined): string =>
  n === null || n === undefined ? "" : String(n).replace(".", ",");
