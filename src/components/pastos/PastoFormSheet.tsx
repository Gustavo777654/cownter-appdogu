"use client";

import { useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
import { lerNumero, lerReais, textoNumero } from "@/components/recursos/campos";
import { atualizarPasto, criarPasto } from "@/lib/pastos";
import { hoje } from "@/lib/utils";
import { reajustarAluguel, valorDaParcela } from "@/lib/aluguel";
import { NIVEIS_PASTO, type AluguelPasto, type Pasto, type NivelPasto } from "@/lib/types";
import { COR_NIVEL_SELECIONADO } from "./nivel";

interface PastoFormSheetProps {
  open: boolean;
  /** Quando informado, edita este pasto; senão cria um novo. */
  pasto?: Pasto | null;
  onClose: () => void;
  /** Chamado depois de criar um pasto novo, com o pasto criado. */
  onCreated?: (pasto: Pasto) => void;
}

export function PastoFormSheet({ open, pasto, onClose, onCreated }: PastoFormSheetProps) {
  const editando = !!pasto;
  const [nome, setNome] = useState("");
  const [area, setArea] = useState("");
  const [nivel, setNivel] = useState<NivelPasto>("Alto");
  const [alugado, setAlugado] = useState(false);
  const [valorAluguel, setValorAluguel] = useState("");
  const [inicioAluguel, setInicioAluguel] = useState(hoje());
  const [mesesAluguel, setMesesAluguel] = useState("");
  const [aplicar, setAplicar] = useState<"inicio" | "data">("data");
  const [desdeReajuste, setDesdeReajuste] = useState(hoje());
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(pasto?.nome ?? "");
    setArea(pasto?.areaHa != null ? String(pasto.areaHa).replace(".", ",") : "");
    setNivel(pasto?.nivelPasto ?? "Alto");
    setAlugado(!!pasto?.aluguel);
    setValorAluguel(pasto?.aluguel ? String(valorDaParcela(pasto.aluguel, hoje())).replace(".", ",") : "");
    setAplicar("data");
    setDesdeReajuste(hoje());
    setInicioAluguel(pasto?.aluguel?.inicio ?? hoje());
    setMesesAluguel(textoNumero(pasto?.aluguel?.meses));
    setErro("");
    setSalvando(false);
  }, [open, pasto]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    let areaHa: number | null = null;
    if (area.trim()) {
      areaHa = Number(area.replace(",", "."));
      if (!Number.isFinite(areaHa) || areaHa <= 0) {
        setErro("Área inválida. Use um valor em hectares, por exemplo 15,5.");
        return;
      }
    }

    let aluguel: AluguelPasto | null = null;
    if (alugado) {
      const valor = lerReais(valorAluguel);
      if (valor === null || !Number.isFinite(valor) || valor <= 0) {
        setErro("Informe o valor do aluguel por mês, por exemplo 1.500,00.");
        return;
      }
      if (!inicioAluguel) {
        setErro("Informe a data de início do aluguel.");
        return;
      }
      const meses = lerNumero(mesesAluguel);
      if (meses !== null && (!Number.isInteger(meses) || meses < 1 || meses > 120)) {
        setErro("Meses do aluguel: use um número inteiro ou deixe em branco.");
        return;
      }
      const antigo = pasto?.aluguel;
      if (!antigo) {
        aluguel = { valorMensal: valor, inicio: inicioAluguel, meses, reajustes: [] };
      } else {
        aluguel = { ...antigo, inicio: inicioAluguel, meses };
        if (valor !== valorDaParcela(antigo, hoje())) {
          if (aplicar === "data" && !desdeReajuste) {
            setErro("Informe a partir de que data o novo valor vale.");
            return;
          }
          aluguel = reajustarAluguel(aluguel, valor, aplicar === "inicio" ? "inicio" : { desde: desdeReajuste });
        }
      }
    }

    setSalvando(true);
    try {
      const dados = { nome, areaHa, nivelPasto: nivel, aluguel };
      if (pasto) {
        await atualizarPasto(pasto.id, dados);
        onClose();
      } else {
        const criado = await criarPasto(dados);
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
      title={editando ? "Editar pasto" : "Novo pasto"}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-pasto" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : editando ? "Salvar" : "Criar pasto"}
          </button>
        </div>
      }
    >
      <form id="form-pasto" onSubmit={salvar} className="space-y-4 pt-1">
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
          <label htmlFor="pasto-nome" className="field-label">
            Nome do pasto <span className="text-red-600">*</span>
          </label>
          <input
            id="pasto-nome"
            className="field"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Pasto Norte"
            autoComplete="off"
            required
          />
        </div>

        <div>
          <label htmlFor="pasto-area" className="field-label">
            Área em hectares (opcional)
          </label>
          <input
            id="pasto-area"
            className="field"
            inputMode="decimal"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Ex: 15,5"
          />
        </div>

        <div>
          <Segmented
            label="Nível do pasto (quantidade de capim)"
            value={nivel}
            options={NIVEIS_PASTO}
            onChange={setNivel}
            cores={COR_NIVEL_SELECIONADO}
          />
          <p className="mt-1.5 text-xs text-dark/55">
            Alto: muito capim. Médio: capim razoável. Baixo: pouco capim, precisa descansar.
          </p>
        </div>

        <div className="rounded-xl border border-brand-100 p-3">
          <label className="flex items-center gap-3 font-semibold text-dark">
            <input
              id="pasto-alugado"
              type="checkbox"
              className="h-5 w-5 accent-brand-600"
              checked={alugado}
              onChange={(e) => setAlugado(e.target.checked)}
            />
            Pasto alugado
          </label>
          {alugado && (
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="pasto-aluguel-valor" className="field-label">
                  Valor por mês (R$) <span className="text-red-600">*</span>
                </label>
                <input
                  id="pasto-aluguel-valor"
                  className="field"
                  inputMode="decimal"
                  value={valorAluguel}
                  onChange={(e) => setValorAluguel(e.target.value)}
                  placeholder="Ex: 1.500,00"
                />
              </div>
              {pasto?.aluguel && lerReais(valorAluguel) !== valorDaParcela(pasto.aluguel, hoje()) && (
                <fieldset className="space-y-2 rounded-xl bg-brand-50 p-3 text-sm">
                  <legend className="px-1 font-semibold text-dark">Novo valor vale</legend>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="aluguel-aplicar" checked={aplicar === "data"} onChange={() => setAplicar("data")} className="accent-brand-600" />
                    A partir de uma data (meses anteriores não mudam)
                  </label>
                  {aplicar === "data" && (
                    <input
                      id="pasto-aluguel-desde"
                      type="date"
                      aria-label="Novo valor vale a partir de"
                      className="field"
                      value={desdeReajuste}
                      onChange={(e) => setDesdeReajuste(e.target.value)}
                    />
                  )}
                  <label className="flex items-center gap-2">
                    <input type="radio" name="aluguel-aplicar" checked={aplicar === "inicio"} onChange={() => setAplicar("inicio")} className="accent-brand-600" />
                    Desde o início do aluguel (muda todos os meses)
                  </label>
                </fieldset>
              )}
              <div>
                <label htmlFor="pasto-aluguel-inicio" className="field-label">
                  Início do aluguel
                </label>
                <input
                  id="pasto-aluguel-inicio"
                  type="date"
                  className="field"
                  value={inicioAluguel}
                  onChange={(e) => setInicioAluguel(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="pasto-aluguel-meses" className="field-label">
                  Por quantos meses (opcional)
                </label>
                <input
                  id="pasto-aluguel-meses"
                  className="field"
                  inputMode="numeric"
                  value={mesesAluguel}
                  onChange={(e) => setMesesAluguel(e.target.value)}
                  placeholder="Em branco = 1 mês"
                />
              </div>
              <p className="text-xs text-dark/55">
                Cada mês do aluguel vira uma despesa em Finanças. O app avisa no Início 7 dias antes de terminar.
              </p>
            </div>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}
