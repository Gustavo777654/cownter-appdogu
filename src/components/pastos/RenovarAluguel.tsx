"use client";

import { useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { renovarAluguelPasto } from "@/lib/pastos";
import { diasEntre } from "@/lib/rotinas";
import { fimDoAluguel } from "@/lib/aluguel";
import { useConfiguracao } from "@/lib/hooks";
import { formatDataBR, hoje } from "@/lib/utils";
import type { Pasto } from "@/lib/types";
import { BottomSheet } from "@/components/ui/BottomSheet";

/** Perto do fim (ou depois dele), avisa e pergunta se quer renovar o aluguel e por quantos meses. */
export function RenovarAluguel({ pasto }: { pasto: Pasto }) {
  const config = useConfiguracao();
  const [aberto, setAberto] = useState(false);
  const [meses, setMeses] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  if (!pasto.aluguel || !config) return null;
  const fim = fimDoAluguel(pasto.aluguel);
  const dias = fim ? diasEntre(hoje(), fim) : null;
  if (!fim || dias === null || dias > config.aluguelDiasAviso) return null;

  async function confirmar() {
    setErro("");
    const n = Number(meses.trim());
    if (!meses.trim() || !Number.isInteger(n) || n < 1) {
      setErro("Informe por quantos meses (número inteiro, 1 ou mais).");
      return;
    }
    setOcupado(true);
    try {
      await renovarAluguelPasto(pasto.id, n);
      setAberto(false);
      setMeses("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível renovar.");
    }
    setOcupado(false);
  }

  return (
    <>
      <div id="renovar-aluguel" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
        <p className="font-bold text-amber-900">
          {dias < 0 ? `O prazo do aluguel venceu em ${formatDataBR(fim)}.` : `O aluguel termina em ${formatDataBR(fim)}.`}
        </p>
        <p className="text-sm text-amber-900/80">Você quer renovar?</p>
        <button type="button" id="btn-renovar" onClick={() => { setErro(""); setAberto(true); }} className="btn-primary mt-2 min-h-11 w-full text-sm">
          <ArrowsClockwise size={18} weight="bold" />
          Renovar aluguel
        </button>
      </div>

      <BottomSheet
        open={aberto}
        onClose={() => setAberto(false)}
        title="Renovar aluguel"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setAberto(false)} className="btn-secondary flex-1">
              Agora não
            </button>
            <button type="button" id="btn-confirmar-renovacao" onClick={confirmar} disabled={ocupado} className="btn-primary flex-1">
              {ocupado ? "Salvando..." : "Renovar"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 pt-1">
          <p className="text-sm text-dark/70">
            Os meses novos continuam logo depois de <strong>{formatDataBR(fim)}</strong>. As parcelas e os pagamentos que já existem não mudam.
          </p>
          <div>
            <label htmlFor="renovar-meses" className="field-label">
              Por quantos meses?
            </label>
            <input id="renovar-meses" className="field" inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value.replace(/\D/g, ""))} placeholder="Ex: 12" />
          </div>
          {erro && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
              {erro}
            </p>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
