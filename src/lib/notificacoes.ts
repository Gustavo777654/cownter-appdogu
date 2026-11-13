import { Capacitor } from "@capacitor/core";
import { coletarAlertasAluguel } from "./aluguel";
import { lerConfiguracao, type Configuracao } from "./config";
import { db } from "./db";
import { coletarAlertasDesmama } from "./desmama";
import { coletarAlertasEstoque } from "./estoque";
import { addDias, coletarAlertas, JANELA_ALERTA_DIAS } from "./rotinas";
import type { LoteGado, Parto, Pasto, Recurso, Tarefa, UsoRecurso } from "./types";
import { hoje } from "./utils";

// ---------------------------------------------------------------------------
// Notificações no celular (app Android).
//
// O app agenda no próprio aparelho (funciona sem internet e com o app fechado): um aviso por
// dia, no horário escolhido, para os próximos dias em que houver algo a fazer. Cada aviso
// resume o que estará pendente naquele dia. Toda vez que o app abre, ou os dados mudam,
// a agenda é refeita.
// ---------------------------------------------------------------------------

export const HORIZONTE_DIAS = 14;
const CANAL = "avisos";

export interface DadosAvisos {
  pastos: Pasto[];
  tarefas: Tarefa[];
  partos: Parto[];
  lotes: LoteGado[];
  recursos: Recurso[];
  usos: UsoRecurso[];
}

export interface NotificacaoPlanejada {
  id: number;
  quando: Date;
  titulo: string;
  corpo: string;
  corpoLongo: string;
}

/** O que estará pendente em um dia (uma linha de texto por aviso). */
export function linhasDeAvisos(dados: DadosAvisos, cfg: Configuracao, diaIso: string): string[] {
  const linhas: string[] = [];
  for (const a of coletarAlertasAluguel(dados.pastos, diaIso, cfg.aluguelDiasAviso)) {
    linhas.push(`${a.titulo}: ${a.pastoNome}`);
  }
  for (const a of coletarAlertas(dados.pastos, dados.tarefas, diaIso)) {
    linhas.push(`${a.titulo} · ${a.pastoNome}`);
  }
  for (const d of coletarAlertasDesmama(dados.partos, dados.lotes, diaIso, cfg.desmamaMeses, JANELA_ALERTA_DIAS)) {
    linhas.push(`Desmama: ${d.loteNome} (${d.quantidade} ${d.quantidade === 1 ? "bezerro" : "bezerros"})`);
  }
  for (const e of coletarAlertasEstoque(dados.recursos, dados.usos, diaIso, cfg.estoqueDiasAviso)) {
    linhas.push(e.titulo);
  }
  return linhas;
}

/** Monta as notificações dos próximos dias (só dias com avisos e horário ainda no futuro). */
export function planejarNotificacoes(
  dados: DadosAvisos,
  cfg: Configuracao,
  agora: Date,
  horizonte: number = HORIZONTE_DIAS
): NotificacaoPlanejada[] {
  if (!cfg.notificacoesAtivas) return [];
  const diaDeHoje = isoLocal(agora);
  const lista: NotificacaoPlanejada[] = [];
  for (let k = 0; k < horizonte; k++) {
    const diaIso = addDias(diaDeHoje, k);
    if (!diaIso) continue;
    const [a, m, d] = diaIso.split("-").map(Number);
    const quando = new Date(a, m - 1, d, cfg.notificacaoHora, 0, 0);
    if (quando.getTime() <= agora.getTime() + 30_000) continue;
    const linhas = linhasDeAvisos(dados, cfg, diaIso);
    if (linhas.length === 0) continue;
    const resto = linhas.length - 3;
    lista.push({
      id: k + 1,
      quando,
      titulo: linhas.length === 1 ? "Cownter: 1 aviso" : `Cownter: ${linhas.length} avisos`,
      corpo: linhas.slice(0, 3).join(" · ") + (resto > 0 ? ` · e mais ${resto}` : ""),
      corpoLongo: linhas.join("\n"),
    });
  }
  return lista;
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Parte nativa (só roda no app Android; na web não faz nada)
// ---------------------------------------------------------------------------

export const ehAppNativo = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

export async function permissaoDeNotificacoes(): Promise<"granted" | "denied" | "prompt"> {
  if (!ehAppNativo()) return "denied";
  const p = await (await plugin()).checkPermissions();
  return p.display === "granted" ? "granted" : p.display === "denied" ? "denied" : "prompt";
}

export async function pedirPermissaoDeNotificacoes(): Promise<boolean> {
  if (!ehAppNativo()) return false;
  const p = await (await plugin()).requestPermissions();
  return p.display === "granted";
}

async function carregarDados(): Promise<DadosAvisos> {
  const [pastos, tarefas, partos, lotes, recursos, usos] = await Promise.all([
    db.pastos.filter((x) => !x.deletedAt).toArray(),
    db.tarefas.filter((x) => !x.deletedAt && !x.feita).toArray(),
    db.partos.filter((x) => !x.deletedAt && !x.desmamado).toArray(),
    db.lotesGado.filter((x) => !x.deletedAt).toArray(),
    db.recursos.filter((x) => !x.deletedAt).toArray(),
    db.usosRecurso.filter((x) => !x.deletedAt).toArray(),
  ]);
  return { pastos, tarefas, partos, lotes, recursos, usos };
}

/** Refaz a agenda de notificações do aparelho. Seguro de chamar várias vezes. */
export async function reagendarNotificacoes(): Promise<void> {
  if (!ehAppNativo()) return;
  const LN = await plugin();
  const pendentes = await LN.getPending();
  if (pendentes.notifications.length) await LN.cancel({ notifications: pendentes.notifications.map((n) => ({ id: n.id })) });

  const cfg = lerConfiguracao();
  if (!cfg.notificacoesAtivas) return;
  if ((await LN.checkPermissions()).display !== "granted") return;

  await LN.createChannel({ id: CANAL, name: "Avisos do rebanho", description: "Sal, remédio, desmama, estoque, aluguel e tarefas", importance: 4, visibility: 1 });
  const plano = planejarNotificacoes(await carregarDados(), cfg, new Date());
  if (plano.length === 0) return;
  await LN.schedule({
    notifications: plano.map((n) => ({
      id: n.id,
      title: n.titulo,
      body: n.corpo,
      largeBody: n.corpoLongo,
      schedule: { at: n.quando, allowWhileIdle: true },
      isExactNotification: false, // horário aproximado: não exige a permissão de "Alarmes e lembretes"
      channelId: CANAL,
      smallIcon: "ic_stat_cownter",
      extra: { rota: "/inicio" },
    })),
  });
}

function comLimite<T>(p: Promise<T>, passo: string, ms = 6000): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rejeitar) => window.setTimeout(() => rejeitar(new Error(`parou no passo "${passo}"`)), ms)),
  ]);
}

/** Notificação de teste, na hora (botão em Perfil). Conta cada passo para achar onde trava. */
export async function notificacaoDeTeste(avisar: (passo: string) => void = () => undefined): Promise<void> {
  if (!ehAppNativo()) throw new Error("não é o app Android");
  avisar("1/5 carregando o plugin");
  const LN = await comLimite(plugin(), "carregar o plugin");
  avisar("2/5 conferindo a permissão");
  const perm = await comLimite(LN.checkPermissions(), "conferir a permissão");
  if (perm.display !== "granted") {
    avisar("3/5 pedindo a permissão ao Android (toque em Permitir)");
    const r = await comLimite(LN.requestPermissions(), "pedir a permissão", 30000);
    if (r.display !== "granted") throw new Error("permissão negada");
  }
  avisar("4/5 criando o canal de avisos");
  await comLimite(LN.createChannel({ id: CANAL, name: "Avisos do rebanho", description: "Sal, remédio, desmama, estoque, aluguel e tarefas", importance: 4, visibility: 1 }), "criar o canal");
  avisar("5/5 mostrando a notificação");
  await comLimite(
    LN.schedule({
      notifications: [
        {
          id: 9000,
          title: "Cownter: notificação de teste",
          body: "Se você viu isto, os avisos do rebanho vão chegar assim.",
          channelId: CANAL,
          smallIcon: "ic_stat_cownter",
          extra: { rota: "/inicio" },
        },
      ],
    }),
    "mostrar a notificação"
  );
}
