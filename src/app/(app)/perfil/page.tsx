"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CloudArrowUp, SignOut, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DESMAMA_MESES_PADRAO,
  ESTOQUE_DIAS_PADRAO,
  OPCOES_ESTOQUE_DIAS,
  lerConfiguracao,
  OPCOES_APAGAR_TAREFAS,
  OPCOES_DESMAMA_MESES,
  salvarConfiguracao,
} from "@/lib/config";
import { apagarTarefasFeitasAntigas } from "@/lib/pastos";
import { useOnline, usePendentesSync } from "@/lib/hooks";

export default function PerfilPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const online = useOnline();
  const pendentes = usePendentesSync();
  const [apagarDias, setApagarDias] = useState<number | null>(null);
  const [desmamaMeses, setDesmamaMeses] = useState<number>(DESMAMA_MESES_PADRAO);
  const [estoqueDias, setEstoqueDias] = useState<number>(ESTOQUE_DIAS_PADRAO);

  useEffect(() => {
    const cfg = lerConfiguracao();
    setApagarDias(cfg.apagarTarefasFeitasDias);
    setDesmamaMeses(cfg.desmamaMeses);
    setEstoqueDias(cfg.estoqueDiasAviso);
  }, []);

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

  function sair() {
    logout();
    router.replace("/login");
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
                {pendentes ?? 0} {pendentes === 1 ? "registro" : "registros"} no aparelho
              </p>
              <p className="text-sm text-dark/60">
                O envio para a nuvem será ativado em uma próxima etapa.
              </p>
            </div>
          </div>
        </div>

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
        </div>

        <button type="button" onClick={sair} className="btn-secondary w-full">
          <SignOut size={20} />
          Sair da conta
        </button>

        <p className="pt-2 text-center text-xs text-dark/40">Cownter · protótipo v0.1.0</p>
      </div>
    </>
  );
}
