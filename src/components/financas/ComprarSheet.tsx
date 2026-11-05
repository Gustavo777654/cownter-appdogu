"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { Segmented } from "@/components/ui/Segmented";
import { ComposicaoEditor, LINHA_NOVA, linhasParaSalvar, type LinhaEditavel } from "@/components/gado/ComposicaoEditor";
import { totalCabecas } from "@/lib/composicao";
import { registrarCompra } from "@/lib/financas";
import { useLotesGado, usePastos } from "@/lib/hooks";
import { hoje } from "@/lib/utils";
import { ValorCampo, VALOR_VAZIO, lerValor, type ValorEstado } from "./ValorCampo";

const MODOS = ["Lote novo", "Lote existente"] as const;

export function ComprarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lotes = useLotesGado();
  const pastos = usePastos();
  const [modo, setModo] = useState<(typeof MODOS)[number]>("Lote novo");
  const [nome, setNome] = useState("");
  const [pastoId, setPastoId] = useState("");
  const [raca, setRaca] = useState("");
  const [loteId, setLoteId] = useState("");
  const [linhas, setLinhas] = useState<LinhaEditavel[]>([{ ...LINHA_NOVA }]);
  const [valor, setValor] = useState<ValorEstado>(VALOR_VAZIO);
  const [vendedor, setVendedor] = useState("");
  const [data, setData] = useState(hoje());
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setModo("Lote novo");
    setNome("");
    setPastoId("");
    setRaca("");
    setLoteId("");
    setLinhas([{ ...LINHA_NOVA }]);
    setValor(VALOR_VAZIO);
    setVendedor("");
    setData(hoje());
    setErro("");
    setSalvando(false);
  }, [open]);

  const itens = linhasParaSalvar(linhas).filter((l) => Number.isInteger(l.quantidade));
  const comprados = totalCabecas(itens);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const v = lerValor(valor);
    if (typeof v === "string") {
      setErro(v);
      return;
    }
    if (modo === "Lote existente" && !loteId) {
      setErro("Escolha o lote que recebe as cabeças.");
      return;
    }
    if (modo === "Lote novo" && !nome.trim()) {
      setErro("Informe o nome do lote novo.");
      return;
    }
    setSalvando(true);
    try {
      await registrarCompra({
        destino: modo === "Lote novo" ? { tipo: "novo", nome, pastoId: pastoId || null, raca } : { tipo: "lote", loteId },
        itens: linhasParaSalvar(linhas),
        data,
        valor: v,
        vendedor,
        observacoes: "",
      });
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível registrar.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Registrar compra de gado"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-compra" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : "Registrar compra"}
          </button>
        </div>
      }
    >
      <form id="form-compra" noValidate onSubmit={salvar} className="space-y-5 pt-1">
        <Erro texto={erro} />

        <div>
          <p className="field-label">Quantas cabeças e de que tipo</p>
          <ComposicaoEditor linhas={linhas} onChange={setLinhas} />
        </div>

        <Segmented label="Onde entram" value={modo} options={MODOS} onChange={setModo} />

        {modo === "Lote novo" ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="cp-nome" className="field-label">
                Nome do lote novo
              </label>
              <input id="cp-nome" className="field" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" placeholder="Ex: Garrotes comprados" />
            </div>
            <div>
              <label htmlFor="cp-pasto" className="field-label">
                Pasto (opcional)
              </label>
              <select id="cp-pasto" className="field" value={pastoId} onChange={(e) => setPastoId(e.target.value)}>
                <option value="">Sem pasto</option>
                {pastos?.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.situacao === "Reservado"}>
                    {p.nome}
                    {p.situacao === "Reservado" ? " (descansando)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cp-raca" className="field-label">
                Raça (opcional)
              </label>
              <input id="cp-raca" className="field" value={raca} onChange={(e) => setRaca(e.target.value)} autoComplete="off" />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="cp-lote" className="field-label">
              Lote que recebe
            </label>
            <select id="cp-lote" className="field" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              <option value="">Escolha o lote</option>
              {lotes?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <ValorCampo valor={valor} onChange={setValor} cabecas={comprados} idBase="cp-valor" />

        <div>
          <label htmlFor="cp-vendedor" className="field-label">
            Vendedor (opcional)
          </label>
          <input id="cp-vendedor" className="field" value={vendedor} onChange={(e) => setVendedor(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="cp-data" className="field-label">
            Data da compra
          </label>
          <input id="cp-data" type="date" className="field" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
        </div>
      </form>
    </BottomSheet>
  );
}
