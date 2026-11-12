"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowsClockwise, Bell, CloudArrowUp, Copy, SignOut, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DESMAMA_MESES_PADRAO,
  ALUGUEL_DIAS_PADRAO,
  OPCOES_ALUGUEL_DIAS,
  ESTOQUE_DIAS_PADRAO,
  OPCOES_ESTOQUE_DIAS,
  lerConfiguracao,
  OPCOES_APAGAR_TAREFAS,
  OPCOES_DESMAMA_MESES,
  OPCOES_NOTIFICACAO_HORA,
  NOTIFICACAO_HORA_PADRAO,
  salvarConfiguracao,
} from "@/lib/config";
import { apagarTarefasFeitasAntigas } from "@/lib/pastos";
import {
  ehAppNativo,
  notificacaoDeTeste,
  pedirPermissaoDeNotificacoes,
  permissaoDeNotificacoes,
  reagendarNotificacoes,
} from "@/lib/notificacoes";
import { useOnline, usePendentesSync } from "@/lib/hooks";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { supabase } from "@/lib/supabase";
import { assinarEstadoSync, estadoSync, sincronizar, traduzirErro } from "@/lib/sync";
import { useSyncExternalStore } from "react";
import type { Fazenda } from "@/lib/types";

export default function PerfilPage() {
  const { user, logout, nuvem, atualizarFazenda } = useAuth();
  const router = useRouter();
  const online = useOnline();
  const pendentes = usePendentesSync();
  const [apagarDias, setApagarDias] = useState<number | null>(null);
  const [desmamaMeses, setDesmamaMeses] = useState<number>(DESMAMA_MESES_PADRAO);
  const [estoqueDias, setEstoqueDias] = useState<number>(ESTOQUE_DIAS_PADRAO);
  const [aluguelDias, setAluguelDias] = useState<number>(ALUGUEL_DIAS_PADRAO);
  const [nativo, setNativo] = useState(false);
  const [notifAtivas, setNotifAtivas] = useState(true);
  const [notifHora, setNotifHora] = useState<number>(NOTIFICACAO_HORA_PADRAO);
  const [notifPermissao, setNotifPermissao] = useState<"granted" | "denied" | "prompt">("prompt");
  const [msgNotif, setMsgNotif] = useState("");
  const sync = useSyncExternalStore(assinarEstadoSync, estadoSync, estadoSync);
  const [saindo, setSaindo] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [membros, setMembros] = useState<{ nome: string | null; papel: string }[]>([]);
  const [msgConta, setMsgConta] = useState("");

  useEffect(() => {
    const cfg = lerConfiguracao();
    setApagarDias(cfg.apagarTarefasFeitasDias);
    setDesmamaMeses(cfg.desmamaMeses);
    setEstoqueDias(cfg.estoqueDiasAviso);
    setAluguelDias(cfg.aluguelDiasAviso);
    setNotifAtivas(cfg.notificacoesAtivas);
    setNotifHora(cfg.notificacaoHora);
    if (ehAppNativo()) {
      setNativo(true);
      permissaoDeNotificacoes().then(setNotifPermissao).catch(() => undefined);
    }
  }, []);

  async function trocarNotifAtivas(ativas: boolean) {
    setNotifAtivas(ativas);
    salvarConfiguracao({ notificacoesAtivas: ativas });
    if (ativas && notifPermissao !== "granted") {
      const ok = await pedirPermissaoDeNotificacoes().catch(() => false);
      setNotifPermissao(ok ? "granted" : "denied");
    }
    reagendarNotificacoes().catch(() => undefined);
  }

  function trocarNotifHora(valor: string) {
    const hora = Number(valor);
    setNotifHora(hora);
    salvarConfiguracao({ notificacaoHora: hora });
    reagendarNotificacoes().catch(() => undefined);
  }

  async function testarNotificacao() {
    setMsgNotif("");
    const ok = notifPermissao === "granted" || (await pedirPermissaoDeNotificacoes().catch(() => false));
    setNotifPermissao(ok ? "granted" : "denied");
    if (!ok) {
      setMsgNotif("O Android bloqueou as notificações. Ative em Configurações do celular → Apps → Cownter → Notificações.");
      return;
    }
    await notificacaoDeTeste().catch(() => undefined);
    setMsgNotif("Pronto! Em alguns segundos a notificação de teste aparece (pode sair do app para ver).");
  }

  async function trocarApagar(valor: string) {
    const dias = valor === "" ? null : Number(valor);
    setApagarDias(dias);
    salvarConfiguracao({ apagarTarefasFeitasDias: dias });
    await apagarTarefasFeitasAntigas(dias);
  }

  function trocarDesmama(valor: string) {
    const meses = Number(valor);
    setDesmamaMeses(meses);
    salvarConfiguracao({ desmamaMeses: meses });
  }

  function trocarEstoque(valor: string) {
    const dias = Number(valor);
    setEstoqueDias(dias);
    salvarConfiguracao({ estoqueDiasAviso: dias });
  }

  function trocarAluguel(valor: string) {
    const dias = Number(valor);
    setAluguelDias(dias);
    salvarConfiguracao({ aluguelDiasAviso: dias });
  }

  async function sair() {
    await logout();
    router.replace("/login");
  }

  // Código de convite e participantes (precisa de internet; sem ela mostra o que já sabe).
  useEffect(() => {
    if (!nuvem || !online) return;
    let ativo = true;
    (async () => {
      try {
        const { data: f } = await supabase().rpc("minha_fazenda");
        const fz = Array.isArray(f) ? (f[0] as Fazenda | undefined) : undefined;
        if (ativo && fz) {
          setCodigo(fz.codigo);
          atualizarFazenda(fz);
        }
        const { data: m } = await supabase().from("membros").select("nome,papel").order("entrou_em", { ascending: true });
        if (ativo && m) setMembros(m as { nome: string | null; papel: string }[]);
      } catch {
        /* sem conexão: mantém o que já está na tela */
      }
    })();
    return () => {
      ativo = false;
    };
  }, [nuvem, online]); // eslint-disable-line react-hooks/exhaustive-deps

  async function copiarCodigo() {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setMsgConta("Código copiado.");
    } catch {
      setMsgConta("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }

  async function novoCodigo() {
    setMsgConta("");
    try {
      const { data, error } = await supabase().rpc("gerar_novo_codigo");
      if (error) throw error;
      setCodigo(String(data));
      setMsgConta("Novo código gerado. O anterior não vale mais.");
    } catch (e) {
      setMsgConta(traduzirErro(e));
    }
  }

  return (
    <>
      <header className="flex items-center gap-2 px-4 pb-3 pt-4">
        <Link
          prefetch={false}
          href="/inicio"
          aria-label="Voltar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-dark/70 hover:bg-dark/5"
        >
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold leading-tight text-dark">Perfil</h1>
      </header>

      <div className="space-y-4 px-4">
        <div className="card">
          <p className="text-xs text-dark/55">Produtor</p>
          <p className="text-lg font-bold text-dark">{user?.name}</p>
          <p className="text-sm text-dark/60">{user?.farm}</p>
          <p className="mt-1 text-sm text-dark/60">{user?.email}</p>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                online ? "bg-brand-100 text-brand-700" : "bg-earth-100 text-earth-800"
              }`}
            >
              {online ? <WifiHigh size={22} /> : <WifiSlash size={22} />}
            </div>
            <div>
              <p className="font-semibold text-dark">{online ? "Com internet" : "Sem internet"}</p>
              <p className="text-sm text-dark/60">
                {online
                  ? "O app funciona normalmente."
                  : "O app continua funcionando, os dados ficam no aparelho."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <CloudArrowUp size={22} />
            </div>
            <div>
              <p className="font-semibold text-dark">
                {nuvem
                  ? `${pendentes ?? 0} ${pendentes === 1 ? "registro aguardando envio" : "registros aguardando envio"}`
                  : `${pendentes ?? 0} ${pendentes === 1 ? "registro" : "registros"} no aparelho`}
              </p>
              <p className="text-sm text-dark/60">
                {nuvem
                  ? pendentes
                    ? "Aguardando envio para a nuvem."
                    : "Tudo enviado para a nuvem."
                  : "Entre com uma conta para enviar à nuvem."}
              </p>
            </div>
          </div>
        </div>

        {nuvem && (
          <div className="card space-y-3">
            <p className="text-xs text-dark/55">Fazenda e sincronização</p>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 text-sm text-dark/70">
                <p>
                  {sync.rodando
                    ? "Sincronizando..."
                    : sync.ultima
                      ? `Última sincronização às ${new Date(sync.ultima).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                      : "Ainda não sincronizou neste acesso."}
                </p>
              </div>
              <button
                type="button"
                id="btn-sincronizar"
                disabled={!online || sync.rodando || !user?.fazendaId}
                onClick={() => user?.fazendaId && void sincronizar(user.fazendaId)}
                className="btn-secondary min-h-11 shrink-0 px-3 text-sm"
              >
                <ArrowsClockwise size={18} />
                Sincronizar agora
              </button>
            </div>
            {sync.erro && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
                {sync.erro}
              </p>
            )}

            {membros.length > 0 && (
              <div>
                <p className="field-label">Quem participa</p>
                <ul className="text-sm text-dark/80">
                  {membros.map((m, i) => (
                    <li key={i}>
                      {m.nome || "Sem nome"} <span className="text-dark/50">· {m.papel === "dono" ? "dono" : "membro"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {user?.papel === "dono" && (
              <div>
                <p className="field-label">Código de convite</p>
                {codigo ? (
                  <div className="flex items-center gap-2">
                    <span id="codigo-convite" className="flex-1 rounded-xl bg-brand-50 px-3 py-3 text-center font-mono text-lg font-bold tracking-widest text-brand-900">
                      {codigo}
                    </span>
                    <button type="button" onClick={copiarCodigo} className="btn-secondary min-h-11 px-3" aria-label="Copiar código">
                      <Copy size={20} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-dark/60">{online ? "Carregando..." : "Conecte-se à internet para ver o código."}</p>
                )}
                <p className="mt-1.5 text-xs text-dark/55">Quem criar uma conta e digitar este código entra na sua fazenda.</p>
                <button type="button" onClick={novoCodigo} disabled={!online} className="btn-ghost mt-1 px-0 text-sm">
                  Gerar novo código
                </button>
              </div>
            )}
            {msgConta && <p className="text-sm text-dark/70">{msgConta}</p>}
          </div>
        )}

        <div className="card">
          <p className="text-xs text-dark/55">Configurações</p>
          <label htmlFor="cfg-apagar" className="mt-1 block font-semibold text-dark">
            Apagar tarefas feitas sozinhas
          </label>
          <select
            id="cfg-apagar"
            className="field mt-2"
            value={apagarDias === null ? "" : String(apagarDias)}
            onChange={(e) => trocarApagar(e.target.value)}
          >
            {OPCOES_APAGAR_TAREFAS.map((o) => (
              <option key={o.rotulo} value={o.dias === null ? "" : String(o.dias)}>
                {o.rotulo}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-dark/55">
            As tarefas feitas ficam guardadas em cada pasto, na lista &quot;Tarefas feitas&quot;, até serem apagadas.
          </p>

          <label htmlFor="cfg-desmama" className="mt-4 block font-semibold text-dark">
            Desmamar o bezerro com
          </label>
          <select
            id="cfg-desmama"
            className="field mt-2"
            value={String(desmamaMeses)}
            onChange={(e) => trocarDesmama(e.target.value)}
          >
            {OPCOES_DESMAMA_MESES.map((m) => (
              <option key={m} value={m}>
                {m} meses
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-dark/55">
            O Início avisa quando os bezerros chegarem nessa idade (contada a partir do parto registrado).
          </p>

          <label htmlFor="cfg-estoque" className="mt-4 block font-semibold text-dark">
            Avisar estoque quando durar menos de
          </label>
          <select
            id="cfg-estoque"
            className="field mt-2"
            value={String(estoqueDias)}
            onChange={(e) => trocarEstoque(e.target.value)}
          >
            {OPCOES_ESTOQUE_DIAS.map((d) => (
              <option key={d} value={d}>
                {d} dias
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-dark/55">
            Calculado pelo consumo médio do sal e do remédio. O aviso pelo mínimo de sacos ou frascos é definido em cada item de Recursos.
          </p>

          <label htmlFor="cfg-aluguel" className="mt-4 block font-semibold text-dark">
            Avisar o fim do aluguel de pasto com
          </label>
          <select
            id="cfg-aluguel"
            className="field mt-2"
            value={String(aluguelDias)}
            onChange={(e) => trocarAluguel(e.target.value)}
          >
            {OPCOES_ALUGUEL_DIAS.map((d) => (
              <option key={d} value={d}>
                {d} dias de antecedência
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-dark/55">
            O Início avisa quando o aluguel de um pasto estiver para terminar e depois que vencer.
          </p>
        </div>

        {nativo && (
          <div className="card space-y-3 p-4" id="cartao-notificacoes">
            <p className="flex items-center gap-2 font-semibold text-dark">
              <Bell size={20} className="text-brand-600" />
              Notificações no celular
            </p>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-dark/80">Receber avisos (sal, remédio, desmama, estoque, aluguel e tarefas)</span>
              <input
                id="cfg-notif-ativas"
                type="checkbox"
                className="h-5 w-5 accent-brand-600"
                checked={notifAtivas}
                onChange={(e) => trocarNotifAtivas(e.target.checked)}
              />
            </label>
            {notifAtivas && (
              <>
                <label htmlFor="cfg-notif-hora" className="block text-sm font-semibold text-dark">
                  Horário do aviso diário
                </label>
                <select id="cfg-notif-hora" className="field" value={String(notifHora)} onChange={(e) => trocarNotifHora(e.target.value)}>
                  {OPCOES_NOTIFICACAO_HORA.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
                <p className="text-xs text-dark/55">
                  Um aviso por dia, só quando houver algo para fazer. Funciona sem internet e com o app fechado.
                </p>
              </>
            )}
            {notifPermissao === "denied" && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                As notificações estão bloqueadas no Android. Ative em Configurações do celular → Apps → Cownter → Notificações.
              </p>
            )}
            <button type="button" id="btn-notif-teste" onClick={testarNotificacao} className="btn-secondary w-full">
              Enviar notificação de teste
            </button>
            {msgNotif && <p className="text-xs text-dark/70">{msgNotif}</p>}
          </div>
        )}

        <button type="button" onClick={() => setSaindo(true)} className="btn-secondary w-full">
          <SignOut size={20} />
          Sair da conta
        </button>

        <p className="pt-2 text-center text-xs text-dark/40">Cownter · protótipo v0.1.0</p>

        <ConfirmSheet open={saindo} title="Sair da conta?" confirmLabel="Sair" onClose={() => setSaindo(false)} onConfirm={sair}>
          <p className="text-sm text-dark/70">
            Os dados deste aparelho serão apagados e baixados de novo quando você entrar.
            {nuvem && (pendentes ?? 0) > 0 && (
              <strong className="mt-2 block text-red-700">
                Atenção: {pendentes} {pendentes === 1 ? "registro ainda não foi enviado" : "registros ainda não foram enviados"} para a nuvem e {pendentes === 1 ? "será perdido" : "serão perdidos"}. Conecte-se à internet e sincronize antes de sair.
              </strong>
            )}
            {!nuvem && " Como não há conta, esses dados não estão na nuvem e serão perdidos."}
          </p>
        </ConfirmSheet>
      </div>
    </>
  );
}
