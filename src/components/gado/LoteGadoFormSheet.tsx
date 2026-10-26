"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { Segmented } from "@/components/ui/Segmented";
import { atualizarLoteGado, criarLoteGado } from "@/lib/gado";
import { usePastos } from "@/lib/hooks";
import {
  SUGESTOES_ORIGEM,
  SITUACOES_LOTE_GADO,
  type LoteGado,
  type SituacaoLoteGado,
} from "@/lib/types";
import {
  ComposicaoEditor,
  LINHA_NOVA,
  linhasParaEditar,
  linhasParaSalvar,
  type LinhaEditavel,
} from "./ComposicaoEditor";
import { VacinasLoteEditor, type VacinaEditavel } from "./VacinasLoteEditor";

const RACAS = [
  "Nelore",
  "Angus",
  "Brahman",
  "Gir",
  "Girolando",
  "Holandês",
  "Guzerá",
  "Tabapuã",
  "Senepol",
  "Mestiço",
];

interface LoteGadoFormSheetProps {
  open: boolean;
  /** Quando informado, edita este lote; senão cadastra um novo. */
  lote?: LoteGado | null;
  /** Pasto já escolhido ao cadastrar um lote novo (ex.: a partir da tela do pasto). */
  pastoInicial?: string | null;
  onClose: () => void;
  onCreated?: (lote: LoteGado) => void;
}

const numeroOuNulo = (texto: string): number | null =>
  texto.trim() === "" ? null : Number(texto.replace(",", "."));

export function LoteGadoFormSheet({
  open,
  lote,
  pastoInicial = null,
  onClose,
  onCreated,
}: LoteGadoFormSheetProps) {
  const editando = !!lote;
  const pastos = usePastos();

  const [nome, setNome] = useState("");
  const [linhas, setLinhas] = useState<LinhaEditavel[]>([{ ...LINHA_NOVA }]);
  const [pastoId, setPastoId] = useState("");
  const [raca, setRaca] = useState("");
  const [peso, setPeso] = useState("");
  const [origem, setOrigem] = useState("");
  const [situacao, setSituacao] = useState<SituacaoLoteGado>("Normal");
  const [vacinas, setVacinas] = useState<VacinaEditavel[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(lote?.nome ?? "");
    setLinhas(lote ? linhasParaEditar(lote.composicao) : [{ ...LINHA_NOVA }]);
    setPastoId(lote ? (lote.pastoId ?? "") : (pastoInicial ?? ""));
    setRaca(lote?.raca ?? "");
    setPeso(lote?.pesoMedioKg != null ? String(lote.pesoMedioKg).replace(".", ",") : "");
    setOrigem(lote?.origem ?? "");
    setSituacao(lote?.situacao ?? "Normal");
    setVacinas(
      (lote?.vacinas ?? []).map((v) => ({
        nome: v.nome,
        aplicada: v.aplicada,
        faltam: v.faltam ? String(v.faltam) : "",
        data: v.data,
      }))
    );
    setObservacoes(lote?.observacoes ?? "");
    setErro("");
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lote?.id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const pesoMedioKg = numeroOuNulo(peso);
    if (pesoMedioKg !== null && !Number.isFinite(pesoMedioKg)) {
      setErro("Peso inválido. Use um valor em kg, por exemplo 480 ou 320,5.");
      return;
    }

    setSalvando(true);
    try {
      const dados = {
        nome,
        pastoId: pastoId || null,
        composicao: linhasParaSalvar(linhas),
        raca,
        pesoMedioKg,
        origem,
        situacao,
        vacinas: vacinas.map((v) => ({
          nome: v.nome,
          aplicada: v.aplicada,
          faltam: v.faltam.trim() === "" ? null : Number(v.faltam),
          data: v.data,
        })),
        observacoes,
      };
      if (lote) {
        await atualizarLoteGado(lote.id, dados);
        onClose();
      } else {
        const criado = await criarLoteGado(dados);
        onClose();
        onCreated?.(criado);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editando ? "Editar lote" : "Novo lote de gado"}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-lote-gado" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : editando ? "Salvar" : "Cadastrar lote"}
          </button>
        </div>
      }
    >
      <form id="form-lote-gado" onSubmit={salvar} className="space-y-5 pt-1">
        <Erro texto={erro} />

        <div>
          <label htmlFor="lg-nome" className="field-label">
            Nome do lote <span className="text-red-600">*</span>
          </label>
          <input
            id="lg-nome"
            className="field"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Lote A, Vacas de cria"
            autoComplete="off"
            required
          />
        </div>

        <div>
          <p className="field-label">
            Quantas cabeças e de que tipo <span className="text-red-600">*</span>
          </p>
          <ComposicaoEditor linhas={linhas} onChange={setLinhas} />
        </div>

        <div>
          <label htmlFor="lg-pasto" className="field-label">
            Pasto onde está
          </label>
          <select id="lg-pasto" className="field" value={pastoId} onChange={(e) => setPastoId(e.target.value)}>
            <option value="">Sem pasto</option>
            {pastos?.map((p) => (
              <option
                key={p.id}
                value={p.id}
                disabled={p.situacao === "Reservado" && p.id !== lote?.pastoId}
              >
                {p.nome}
                {p.situacao === "Reservado" ? " (descansando)" : ""}
              </option>
            ))}
          </select>
        </div>

        <Segmented
          label="Situação do lote"
          value={situacao}
          options={SITUACOES_LOTE_GADO}
          onChange={setSituacao}
          cores={{ "Separado para venda": "border-amber-500 bg-amber-500 text-white" }}
        />

        <details className="rounded-xl border border-brand-100 bg-brand-50/40 p-3" open={editando}>
          <summary className="cursor-pointer select-none text-sm font-semibold text-brand-800">
            Mais características (opcional)
          </summary>
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="lg-raca" className="field-label">
                Raça
              </label>
              <input
                id="lg-raca"
                className="field"
                list="lg-racas"
                value={raca}
                onChange={(e) => setRaca(e.target.value)}
                placeholder="Ex: Nelore"
                autoComplete="off"
              />
              <datalist id="lg-racas">
                {RACAS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="lg-peso" className="field-label">
                Peso médio (kg)
              </label>
              <input
                id="lg-peso"
                className="field"
                inputMode="decimal"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="Ex: 420"
              />
            </div>

            <div>
              <label htmlFor="lg-origem" className="field-label">
                Origem
              </label>
              <input
                id="lg-origem"
                className="field"
                list="lg-origens"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                placeholder="Ex: Comprado da Fazenda Boa Vista"
                maxLength={120}
                autoComplete="off"
              />
              <datalist id="lg-origens">
                {SUGESTOES_ORIGEM.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="lg-obs" className="field-label">
                Observações
              </label>
              <textarea
                id="lg-obs"
                className="field h-24 py-3"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Qualquer anotação sobre o lote"
              />
            </div>
          </div>
        </details>

        <div>
          <p className="field-label">Vacinas (opcional)</p>
          <VacinasLoteEditor vacinas={vacinas} onChange={setVacinas} />
        </div>
      </form>
    </BottomSheet>
  );
}
