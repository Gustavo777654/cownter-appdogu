import type { Pasto, Tarefa } from "./types";

// Funções puras (sem banco) para as datas das rotinas do pasto. Trabalham com
// datas no formato YYYY-MM-DD e usam UTC por dentro, para o horário de verão
// ou o fuso do aparelho nunca "empurrarem" um dia.

export type TipoRotina = "remedio" | "sal";

export const ROTINAS: Record<
  TipoRotina,
  { nome: string; unidade: "meses" | "dias"; maximo: number }
> = {
  remedio: { nome: "Remédio", unidade: "meses", maximo: 60 },
  sal: { nome: "Sal", unidade: "dias", maximo: 365 },
};

/** Quantos dias à frente o app considera "próximo" e mostra como alerta. */
export const JANELA_ALERTA_DIAS = 7;

const DIA_MS = 86_400_000;

function partes(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function paraIso(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

export function addDias(iso: string, dias: number): string | null {
  const p = partes(iso);
  if (!p) return null;
  return paraIso(Date.UTC(p[0], p[1] - 1, p[2] + dias));
}

/** Soma meses mantendo o dia; se o mês de destino for menor, usa o último dia (31/01 + 1 mês = 28/02). */
export function addMeses(iso: string, meses: number): string | null {
  const p = partes(iso);
  if (!p) return null;
  const total = p[1] - 1 + meses;
  const ano = p[0] + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return paraIso(Date.UTC(ano, mes, Math.min(p[2], ultimoDia)));
}

/** Dias de `de` até `ate` (positivo quando `ate` é depois). */
export function diasEntre(de: string, ate: string): number | null {
  const a = partes(de);
  const b = partes(ate);
  if (!a || !b) return null;
  return Math.round(
    (Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / DIA_MS
  );
}

export function rotinaDoPasto(
  pasto: Pasto,
  tipo: TipoRotina
): { ultima: string; intervalo: number | null } {
  return tipo === "remedio"
    ? { ultima: pasto.remedioUltimaData, intervalo: pasto.remedioIntervaloMeses }
    : { ultima: pasto.salUltimaData, intervalo: pasto.salIntervaloDias };
}

/** Data da próxima vez (null se faltar a última data ou o intervalo). */
export function proximaData(
  ultima: string,
  tipo: TipoRotina,
  intervalo: number | null
): string | null {
  if (!ultima || !intervalo || intervalo < 1) return null;
  return tipo === "remedio" ? addMeses(ultima, intervalo) : addDias(ultima, intervalo);
}

/** Dias que faltam para a data (negativo = atrasado, 0 = hoje). */
export function diasParaVencer(data: string, hojeIso: string): number | null {
  return diasEntre(hojeIso, data);
}

export function descreverPrazo(dias: number): string {
  if (dias < -1) return `Atrasado há ${-dias} dias`;
  if (dias === -1) return "Atrasado há 1 dia";
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  return `Em ${dias} dias`;
}

export interface Alerta {
  chave: string;
  tipo: "remedio" | "sal" | "tarefa";
  pastoId: string;
  pastoNome: string;
  titulo: string;
  data: string;
  dias: number;
}

/**
 * Tudo o que está atrasado, é para hoje ou vence nos próximos dias.
 * Considera as rotinas dos pastos e as tarefas com prazo ainda abertas.
 * Os pastos e tarefas excluídos devem ser filtrados antes de chamar.
 */
export function coletarAlertas(
  pastos: Pasto[],
  tarefas: Tarefa[],
  hojeIso: string,
  janela: number = JANELA_ALERTA_DIAS
): Alerta[] {
  const alertas: Alerta[] = [];
  const nomes = new Map(pastos.map((l) => [l.id, l.nome]));

  for (const pasto of pastos) {
    for (const tipo of ["remedio", "sal"] as TipoRotina[]) {
      const { ultima, intervalo } = rotinaDoPasto(pasto, tipo);
      const data = proximaData(ultima, tipo, intervalo);
      if (!data) continue;
      const dias = diasParaVencer(data, hojeIso);
      if (dias === null || dias > janela) continue;
      alertas.push({
        chave: `${pasto.id}:${tipo}`,
        tipo,
        pastoId: pasto.id,
        pastoNome: pasto.nome,
        titulo: tipo === "remedio" ? "Dar remédio" : "Levar sal",
        data,
        dias,
      });
    }
  }

  for (const t of tarefas) {
    if (t.feita || !t.prazo || !nomes.has(t.pastoId)) continue;
    const dias = diasParaVencer(t.prazo, hojeIso);
    if (dias === null || dias > janela) continue;
    alertas.push({
      chave: `tarefa:${t.id}`,
      tipo: "tarefa",
      pastoId: t.pastoId,
      pastoNome: nomes.get(t.pastoId)!,
      titulo: t.titulo,
      data: t.prazo,
      dias,
    });
  }

  return alertas.sort((a, b) => a.dias - b.dias || a.pastoNome.localeCompare(b.pastoNome, "pt-BR"));
}
