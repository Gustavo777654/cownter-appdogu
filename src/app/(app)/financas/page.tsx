"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Receipt, Scales, Trash } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComprarSheet } from "@/components/financas/ComprarSheet";
import { DespesaSheet } from "@/components/financas/DespesaSheet";
import { VenderSheet } from "@/components/financas/VenderSheet";
import { BarrasHorizontais, GraficoMeses, MESES_ABREV } from "@/components/financas/graficos";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { excluirMovimentacao } from "@/lib/financas";
import { useDadosFinanceiros, usePastos } from "@/lib/hooks";
import { formatarReais } from "@/lib/recursos";
import { custoPorPasto, lancamentos, porMes, saidasPorCategoria, totais } from "@/lib/resumoFinanceiro";
import type { Movimentacao } from "@/lib/types";
import { cn, formatDataBR, hoje } from "@/lib/utils";

const MESES_EXTENSO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function FinancasPage() {
  const dados = useDadosFinanceiros();
  const pastos = usePastos();
  const anoAtual = Number(hoje().slice(0, 4));
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState<number | null>(null);
  const [pastoId, setPastoId] = useState("");
  const [novo, setNovo] = useState<"venda" | "compra" | "despesa" | null>(null);
  const [menu, setMenu] = useState(false);
  const [apagando, setApagando] = useState<Movimentacao | null>(null);

  const anos = useMemo(() => {
    const set = new Set<number>([anoAtual]);
    for (const m of dados?.movimentacoes ?? []) set.add(Number(m.data.slice(0, 4)));
    for (const c of dados?.comprasRecurso ?? []) set.add(Number(c.data.slice(0, 4)));
    return Array.from(set).sort((a, b) => b - a);
  }, [dados, anoAtual]);

  const nomesPastos = useMemo(() => new Map((pastos ?? []).map((p) => [p.id, p.nome])), [pastos]);

  const resumo = useMemo(() => {
    if (!dados) return null;
    const filtro = { ano, mes, pastoId: pastoId || null };
    const lista = lancamentos(dados, filtro);
    const meses = porMes(lancamentos(dados, { ano, mes: null, pastoId: pastoId || null }));
    return {
      totais: totais(lista),
      meses,
      categorias: saidasPorCategoria(lista),
      pastos: custoPorPasto(dados, { ano, mes }).map((p) => ({ rotulo: nomesPastos.get(p.pastoId) ?? "Pasto excluído", valor: p.valor })),
    };
  }, [dados, ano, mes, pastoId, nomesPastos]);

  // Histórico do período: lançamentos e compras de estoque (essas vêm de Recursos e não se apagam aqui).
  const historico = useMemo(() => {
    if (!dados) return [];
    const nomeRec = new Map(dados.recursos.map((r) => [r.id, r.nome]));
    const noPeriodo = (data: string) => Number(data.slice(0, 4)) === ano && (mes === null || Number(data.slice(5, 7)) === mes);
    const itens: { chave: string; data: string; criado: string; entrada: boolean; titulo: string; detalhe: string; valor: number; mov?: Movimentacao }[] = [];
    for (const m of dados.movimentacoes) {
      if (!noPeriodo(m.data) || (pastoId && m.pastoId !== pastoId)) continue;
      const pasto = m.pastoId ? nomesPastos.get(m.pastoId) : undefined;
      itens.push({
        chave: m.id,
        data: m.data,
        criado: m.createdAt,
        entrada: m.tipo === "Venda",
        titulo: m.tipo === "Despesa" ? m.descricao : `${m.tipo === "Venda" ? "Venda" : "Compra"} · ${m.cabecas} ${m.cabecas === 1 ? "cabeça" : "cabeças"}`,
        detalhe: [m.tipo === "Despesa" ? m.categoria : m.loteNome, m.contraparte, pasto].filter(Boolean).join(" · "),
        valor: m.valor,
        mov: m,
      });
    }
    if (!pastoId) {
      for (const c of dados.comprasRecurso) {
        if (c.total === null || !noPeriodo(c.data)) continue;
        itens.push({
          chave: `c-${c.recursoId}-${c.data}-${c.total}-${c.quantidade}`,
          data: c.data,
          criado: c.createdAt,
          entrada: false,
          titulo: `Estoque: ${nomeRec.get(c.recursoId) ?? "item"}`,
          detalhe: "Compra lançada em Recursos",
          valor: c.total,
        });
      }
    }
    return itens.sort((a, b) => b.data.localeCompare(a.data) || b.criado.localeCompare(a.criado));
  }, [dados, ano, mes, pastoId, nomesPastos]);

  const periodo = `${mes ? MESES_EXTENSO[mes - 1] + " de " : ""}${ano}`;
  const saldo = resumo?.totais.saldo ?? 0;

  return (
    <>
      <PageHeader title="Finanças" subtitle={`Resumo de ${periodo}`} />

      <div className="space-y-5 px-4">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="fl-ano" className="field-label">Ano</label>
            <select id="fl-ano" className="field px-3" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="fl-mes" className="field-label">Mês</label>
            <select id="fl-mes" className="field px-3" value={mes ?? ""} onChange={(e) => setMes(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Ano todo</option>
              {MESES_EXTENSO.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="fl-pasto" className="field-label">Pasto</label>
            <select id="fl-pasto" className="field px-3" value={pastoId} onChange={(e) => setPastoId(e.target.value)}>
              <option value="">Todos</option>
              {pastos?.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </div>

        {!resumo ? (
          <p className="py-10 text-center text-sm text-dark/50">Carregando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3">
                <p className="flex items-center gap-1.5 text-sm text-dark/60"><ArrowDown size={16} className="text-[#2a78d6]" /> Entrou</p>
                <p className="mt-1 text-xl font-bold text-dark">{formatarReais(resumo.totais.entradas)}</p>
              </div>
              <div className="card p-3">
                <p className="flex items-center gap-1.5 text-sm text-dark/60"><ArrowUp size={16} className="text-[#eb6834]" /> Saiu</p>
                <p className="mt-1 text-xl font-bold text-dark">{formatarReais(resumo.totais.saidas)}</p>
              </div>
              <div className="card col-span-2 p-3">
                <p className="flex items-center gap-1.5 text-sm text-dark/60"><Scales size={16} /> Saldo do período</p>
                <p className={cn("mt-1 text-2xl font-bold", saldo < 0 ? "text-red-700" : "text-dark")}>
                  {saldo < 0 ? "−" : ""}{formatarReais(Math.abs(saldo))}
                </p>
                {pastoId && <p className="mt-1 text-xs text-dark/55">Com um pasto escolhido, o sal e o remédio entram pelo que foi gasto nele.</p>}
              </div>
            </div>

            <section className="card">
              <h2 className="mb-3 text-lg font-bold text-dark">Entradas e saídas por mês · {ano}</h2>
              <GraficoMeses dados={resumo.meses} />
            </section>

            <section className="card">
              <h2 className="mb-3 text-lg font-bold text-dark">Onde o dinheiro saiu · {periodo}</h2>
              <BarrasHorizontais itens={resumo.categorias.map((c) => ({ rotulo: c.categoria, valor: c.valor }))} vazio="Nenhuma saída neste período." />
            </section>

            {!pastoId && (
              <section className="card">
                <h2 className="mb-1 text-lg font-bold text-dark">Custo por pasto · {periodo}</h2>
                <p className="mb-3 text-sm text-dark/60">Sal, remédio e despesas ligadas a cada pasto.</p>
                <BarrasHorizontais itens={resumo.pastos} vazio="Nenhum custo ligado a pasto neste período." />
              </section>
            )}

            <section>
              <h2 className="mb-3 text-xl font-bold text-dark">Lançamentos</h2>
              {historico.length === 0 ? (
                <div className="card text-sm text-dark/60">Nenhum lançamento neste período.</div>
              ) : (
                <ul className="space-y-2">
                  {historico.map((h) => (
                    <li key={h.chave} className="card flex items-center gap-3 p-3">
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", h.entrada ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700")}>
                        {h.entrada ? <ArrowDown size={20} /> : <ArrowUp size={20} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-dark">{h.titulo}</p>
                        <p className="truncate text-sm text-dark/60">{formatDataBR(h.data)}{h.detalhe ? ` · ${h.detalhe}` : ""}</p>
                      </div>
                      <p className="shrink-0 font-bold text-dark">{h.entrada ? "+" : "−"}{formatarReais(h.valor)}</p>
                      {h.mov && (
                        <button type="button" onClick={() => setApagando(h.mov!)} aria-label={`Excluir lançamento de ${formatDataBR(h.data)}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-dark/40 hover:bg-red-50 hover:text-red-600">
                          <Trash size={18} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      <button type="button" onClick={() => setMenu(true)} aria-label="Novo lançamento" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 transition-transform active:scale-95">
        <Plus size={28} weight="bold" />
      </button>

      <BottomSheet open={menu} onClose={() => setMenu(false)} title="Novo lançamento">
        <ul className="space-y-2 pt-1">
          {([["venda", "Registrar venda de gado", "As cabeças saem do lote"], ["compra", "Registrar compra de gado", "Cria um lote novo ou soma a um lote"], ["despesa", "Lançar despesa", "Veterinário, funcionário, cerca..."]] as const).map(([k, t, d]) => (
            <li key={k}>
              <button type="button" onClick={() => { setMenu(false); setNovo(k); }} className="card flex w-full items-center gap-3 p-4 text-left">
                <Receipt size={24} className="shrink-0 text-brand-700" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-dark">{t}</span>
                  <span className="block text-sm text-dark/60">{d}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <VenderSheet open={novo === "venda"} onClose={() => setNovo(null)} />
      <ComprarSheet open={novo === "compra"} onClose={() => setNovo(null)} />
      <DespesaSheet open={novo === "despesa"} onClose={() => setNovo(null)} />

      <ConfirmSheet
        open={!!apagando}
        title="Excluir lançamento?"
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (apagando) await excluirMovimentacao(apagando.id);
          setApagando(null);
        }}
        onClose={() => setApagando(null)}
      >
        <p>
          {apagando?.tipo === "Despesa" ? "A despesa" : `A ${apagando?.tipo === "Venda" ? "venda" : "compra"}`} de{" "}
          <strong>{apagando ? formatarReais(apagando.valor) : ""}</strong> sai de Finanças.
          {apagando && apagando.tipo !== "Despesa" && " As cabeças do lote não voltam sozinhas; ajuste o lote se precisar."}
        </p>
      </ConfirmSheet>
    </>
  );
}
