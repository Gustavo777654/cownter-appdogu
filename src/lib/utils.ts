export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Gera um UUID v4. crypto.randomUUID só existe em contexto seguro (HTTPS ou
 * localhost); ao testar no celular pela rede local (HTTP) ele não está
 * disponível, por isso o plano B com getRandomValues.
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h
    .slice(6, 8)
    .join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
}

/** Data de hoje no fuso local, no formato YYYY-MM-DD. */
export function hoje(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "2024-02-10" -> "10/02/2024" */
export function formatDataBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

/** Idade legível a partir da data de nascimento. */
export function formatIdade(dataNascimento: string, ref: Date = new Date()): string {
  if (!dataNascimento) return "—";
  const [y, m, d] = dataNascimento.split("-").map(Number);
  if (!y || !m || !d) return "—";

  let meses =
    (ref.getFullYear() - y) * 12 + (ref.getMonth() + 1 - m) - (ref.getDate() < d ? 1 : 0);
  if (meses < 0) return "—";
  if (meses < 1) return "menos de 1 mês";
  if (meses < 24) return meses === 1 ? "1 mês" : `${meses} meses`;

  const anos = Math.floor(meses / 12);
  meses = meses % 12;
  const a = anos === 1 ? "1 ano" : `${anos} anos`;
  if (meses === 0) return a;
  return `${a} e ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

export function formatPeso(pesoKg: number | null): string {
  if (pesoKg === null || Number.isNaN(pesoKg)) return "—";
  return `${pesoKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
}

/** "há 3 dias", "hoje", "ontem" a partir de uma data YYYY-MM-DD. */
export function formatDesde(iso: string, ref: string = hoje()): string {
  if (!iso) return "—";
  const [y1, m1, d1] = iso.split("-").map(Number);
  const [y2, m2, d2] = ref.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return "—";
  const dias = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}
