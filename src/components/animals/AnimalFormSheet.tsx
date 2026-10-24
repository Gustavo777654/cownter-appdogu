"use client";

import { useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { atualizarAnimal, criarAnimal } from "@/lib/animals";
import { useLotes } from "@/lib/hooks";
import {
  STATUS_LIST,
  type Animal,
  type AnimalInput,
  type Sexo,
  type VacinaFeita,
} from "@/lib/types";
import { cn, hoje } from "@/lib/utils";
import { VacinasEditor } from "./VacinasEditor";

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

interface AnimalFormSheetProps {
  open: boolean;
  /** Quando informado, o formulário edita este animal; senão cadastra um novo. */
  animal?: Animal | null;
  onClose: () => void;
}

interface FormState {
  brinco: string;
  nome: string;
  sexo: Sexo;
  raca: string;
  status: AnimalInput["status"];
  loteId: string; // "" = sem pasto
  vacinas: VacinaFeita[];
  peso: string;
  dataNascimento: string;
  mae: string;
  pai: string;
  observacoes: string;
}

const VAZIO: FormState = {
  brinco: "",
  nome: "",
  sexo: "Fêmea",
  raca: "",
  status: "Saudável",
  loteId: "",
  vacinas: [],
  peso: "",
  dataNascimento: "",
  mae: "",
  pai: "",
  observacoes: "",
};

function doAnimal(a: Animal): FormState {
  return {
    brinco: a.brinco,
    nome: a.nome,
    sexo: a.sexo,
    raca: a.raca,
    status: a.status,
    loteId: a.loteId ?? "",
    vacinas: a.vacinas.map((v) => ({ ...v })),
    peso: a.pesoKg !== null ? String(a.pesoKg).replace(".", ",") : "",
    dataNascimento: a.dataNascimento,
    mae: a.mae,
    pai: a.pai,
    observacoes: a.observacoes,
  };
}

export function AnimalFormSheet({ open, animal, onClose }: AnimalFormSheetProps) {
  const editando = !!animal;
  const lotes = useLotes();
  const [form, setForm] = useState<FormState>(VAZIO);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Ao abrir, carrega os dados do animal (edição) ou limpa o formulário (novo).
  useEffect(() => {
    if (open) {
      setForm(animal ? doAnimal(animal) : VAZIO);
      setErro("");
      setSalvando(false);
    }
  }, [open, animal]);

  const alterar = <K extends keyof FormState>(campo: K, valor: FormState[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    let pesoKg: number | null = null;
    if (form.peso.trim()) {
      pesoKg = Number(form.peso.replace(",", "."));
      if (!Number.isFinite(pesoKg) || pesoKg <= 0 || pesoKg > 2000) {
        setErro("Peso inválido. Use um valor em kg, por exemplo 480 ou 320,5.");
        return;
      }
    }
    if (form.dataNascimento && form.dataNascimento > hoje()) {
      setErro("A data de nascimento não pode estar no futuro.");
      return;
    }

    const dados: AnimalInput = {
      brinco: form.brinco,
      nome: form.nome,
      sexo: form.sexo,
      raca: form.raca,
      status: form.status,
      pesoKg,
      dataNascimento: form.dataNascimento,
      mae: form.mae,
      pai: form.pai,
      observacoes: form.observacoes,
      loteId: form.loteId || null,
      vacinas: form.vacinas,
    };

    setSalvando(true);
    try {
      if (animal) await atualizarAnimal(animal.id, dados);
      else await criarAnimal(dados);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editando ? "Editar animal" : "Novo animal"}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            type="submit"
            form="form-animal"
            disabled={salvando}
            className="btn-primary flex-1"
          >
            {salvando ? "Salvando..." : editando ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      }
    >
      <form id="form-animal" onSubmit={salvar} className="space-y-4 pt-1">
        {erro && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700"
          >
            <Warning size={20} weight="fill" className="mt-0.5 shrink-0" />
            {erro}
          </div>
        )}

        <div>
          <label htmlFor="brinco" className="field-label">
            Brinco <span className="text-red-600">*</span>
          </label>
          <input
            id="brinco"
            className="field uppercase"
            value={form.brinco}
            onChange={(e) => alterar("brinco", e.target.value)}
            placeholder="Ex: BR-001"
            autoCapitalize="characters"
            autoComplete="off"
            required
          />
        </div>

        <div>
          <label htmlFor="nome" className="field-label">
            Nome (opcional)
          </label>
          <input
            id="nome"
            className="field"
            value={form.nome}
            onChange={(e) => alterar("nome", e.target.value)}
            placeholder="Ex: Margarida"
            autoComplete="off"
          />
        </div>

        <fieldset>
          <legend className="field-label">Sexo</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["Fêmea", "Macho"] as Sexo[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => alterar("sexo", s)}
                aria-pressed={form.sexo === s}
                className={cn(
                  "h-12 rounded-xl border text-base font-semibold transition-colors",
                  form.sexo === s
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-brand-200 bg-white text-dark/70"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="lote" className="field-label">
            Pasto (lote)
          </label>
          <select
            id="lote"
            className="field"
            value={form.loteId}
            onChange={(e) => alterar("loteId", e.target.value)}
          >
            <option value="">Sem pasto</option>
            {lotes?.map((l) => (
              // Pasto reservado (descansando) não recebe animais; só aparece se o animal já está nele.
              <option
                key={l.id}
                value={l.id}
                disabled={l.situacao === "Reservado" && l.id !== animal?.loteId}
              >
                {l.nome}
                {l.situacao === "Reservado" ? " (reservado)" : ""}
              </option>
            ))}
          </select>
          {lotes && lotes.length === 0 && (
            <p className="mt-1.5 text-xs text-dark/55">
              Você ainda não criou nenhum pasto. Crie na aba Lotes.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="status" className="field-label">
            Situação
          </label>
          <select
            id="status"
            className="field"
            value={form.status}
            onChange={(e) => alterar("status", e.target.value as FormState["status"])}
          >
            {STATUS_LIST.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <section aria-labelledby="titulo-vacinas">
          <h3 id="titulo-vacinas" className="field-label">
            Vacinas já aplicadas
          </h3>
          <VacinasEditor vacinas={form.vacinas} onChange={(v) => alterar("vacinas", v)} />
        </section>

        <details className="rounded-xl border border-brand-100 bg-brand-50/40 p-3" open={editando}>
          <summary className="cursor-pointer select-none text-sm font-semibold text-brand-800">
            Mais detalhes (opcional)
          </summary>
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="raca" className="field-label">
                Raça
              </label>
              <input
                id="raca"
                className="field"
                list="racas-lista"
                value={form.raca}
                onChange={(e) => alterar("raca", e.target.value)}
                placeholder="Ex: Nelore"
                autoComplete="off"
              />
              <datalist id="racas-lista">
                {RACAS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="peso" className="field-label">
                  Peso (kg)
                </label>
                <input
                  id="peso"
                  className="field"
                  inputMode="decimal"
                  value={form.peso}
                  onChange={(e) => alterar("peso", e.target.value)}
                  placeholder="Ex: 480"
                />
              </div>
              <div>
                <label htmlFor="nascimento" className="field-label">
                  Nascimento
                </label>
                <input
                  id="nascimento"
                  type="date"
                  className="field"
                  value={form.dataNascimento}
                  max={hoje()}
                  onChange={(e) => alterar("dataNascimento", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mae" className="field-label">
                  Mãe
                </label>
                <input
                  id="mae"
                  className="field"
                  value={form.mae}
                  onChange={(e) => alterar("mae", e.target.value)}
                  placeholder="Nome ou brinco"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="pai" className="field-label">
                  Pai
                </label>
                <input
                  id="pai"
                  className="field"
                  value={form.pai}
                  onChange={(e) => alterar("pai", e.target.value)}
                  placeholder="Nome ou brinco"
                  autoComplete="off"
                />
              </div>
            </div>

            <div>
              <label htmlFor="obs" className="field-label">
                Observações
              </label>
              <textarea
                id="obs"
                rows={3}
                className="field h-auto py-3"
                value={form.observacoes}
                onChange={(e) => alterar("observacoes", e.target.value)}
                placeholder="Anotações sobre o animal"
              />
            </div>
          </div>
        </details>
      </form>
    </BottomSheet>
  );
}
