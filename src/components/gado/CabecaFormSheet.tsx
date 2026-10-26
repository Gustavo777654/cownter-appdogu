"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { atualizarCabeca, criarCabeca, excluirCabeca } from "@/lib/gado";
import { SEXOS, type Cabeca, type Sexo } from "@/lib/types";
import { cn, hoje } from "@/lib/utils";

interface CabecaFormSheetProps {
  open: boolean;
  loteGadoId: string;
  /** Quando informado, edita esta cabeça; senão cadastra uma nova. */
  cabeca?: Cabeca | null;
  /** Raça sugerida (a do lote). */
  racaSugerida?: string;
  onClose: () => void;
}

/** Cadastro de uma cabeça dentro do lote: basta o brinco, a cor ou o nome. */
export function CabecaFormSheet({ open, loteGadoId, cabeca, racaSugerida = "", onClose }: CabecaFormSheetProps) {
  const editando = !!cabeca;
  const [brinco, setBrinco] = useState("");
  const [cor, setCor] = useState("");
  const [nome, setNome] = useState("");
  const [sexo, setSexo] = useState<Sexo>("Fêmea");
  const [raca, setRaca] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [peso, setPeso] = useState("");
  const [mae, setMae] = useState("");
  const [pai, setPai] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBrinco(cabeca?.brinco ?? "");
    setCor(cabeca?.cor ?? "");
    setNome(cabeca?.nome ?? "");
    setSexo(cabeca?.sexo ?? "Fêmea");
    setRaca(cabeca?.raca ?? racaSugerida);
    setNascimento(cabeca?.dataNascimento ?? "");
    setPeso(cabeca?.pesoKg != null ? String(cabeca.pesoKg).replace(".", ",") : "");
    setMae(cabeca?.mae ?? "");
    setPai(cabeca?.pai ?? "");
    setObs(cabeca?.observacoes ?? "");
    setErro("");
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cabeca?.id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const pesoKg = peso.trim() === "" ? null : Number(peso.replace(",", "."));
    if (pesoKg !== null && !Number.isFinite(pesoKg)) {
      setErro("Peso inválido. Use um valor em kg, por exemplo 480 ou 320,5.");
      return;
    }

    setSalvando(true);
    try {
      const dados = {
        brinco,
        cor,
        nome,
        sexo,
        raca,
        dataNascimento: nascimento,
        pesoKg,
        mae,
        pai,
        observacoes: obs,
      };
      if (cabeca) await atualizarCabeca(cabeca.id, dados);
      else await criarCabeca(loteGadoId, dados);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  async function remover() {
    if (!cabeca) return;
    await excluirCabeca(cabeca.id);
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editando ? "Editar cabeça" : "Cadastrar cabeça"}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-cabeca" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      <form id="form-cabeca" onSubmit={salvar} className="space-y-4 pt-1">
        <Erro texto={erro} />
        <p className="text-sm text-dark/60">Informe pelo menos o brinco, a cor ou o nome.</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cb-brinco" className="field-label">
              Brinco
            </label>
            <input
              id="cb-brinco"
              className="field"
              value={brinco}
              onChange={(e) => setBrinco(e.target.value)}
              placeholder="Ex: 0421"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="cb-cor" className="field-label">
              Cor
            </label>
            <input
              id="cb-cor"
              className="field"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              placeholder="Ex: Malhada"
              autoComplete="off"
            />
          </div>
        </div>

        <div>
          <label htmlFor="cb-nome" className="field-label">
            Nome
          </label>
          <input
            id="cb-nome"
            className="field"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Estrela"
            autoComplete="off"
          />
        </div>

        <fieldset>
          <legend className="field-label">Sexo</legend>
          <div className="grid grid-cols-2 gap-2">
            {SEXOS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSexo(s)}
                aria-pressed={sexo === s}
                className={cn(
                  "h-12 rounded-xl border text-base font-semibold transition-colors",
                  sexo === s
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
          <label htmlFor="cb-raca" className="field-label">
            Raça
          </label>
          <input
            id="cb-raca"
            className="field"
            value={raca}
            onChange={(e) => setRaca(e.target.value)}
            placeholder="Ex: Nelore"
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cb-nasc" className="field-label">
              Nascimento
            </label>
            <input
              id="cb-nasc"
              type="date"
              className="field"
              value={nascimento}
              max={hoje()}
              onChange={(e) => setNascimento(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cb-peso" className="field-label">
              Peso (kg)
            </label>
            <input
              id="cb-peso"
              className="field"
              inputMode="decimal"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="Ex: 380"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cb-mae" className="field-label">
              Mãe
            </label>
            <input id="cb-mae" className="field" value={mae} onChange={(e) => setMae(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="cb-pai" className="field-label">
              Pai
            </label>
            <input id="cb-pai" className="field" value={pai} onChange={(e) => setPai(e.target.value)} autoComplete="off" />
          </div>
        </div>

        <div>
          <label htmlFor="cb-obs" className="field-label">
            Observações
          </label>
          <textarea
            id="cb-obs"
            className="field h-20 py-3"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </div>

        {editando && (
          <button
            type="button"
            onClick={remover}
            className="btn w-full border border-red-200 bg-white text-red-600 hover:bg-red-50"
          >
            Remover esta cabeça
          </button>
        )}
      </form>
    </BottomSheet>
  );
}
