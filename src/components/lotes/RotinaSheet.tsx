"use client";

import { useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { configurarRotina } from "@/lib/lotes";
import { proximaData, rotinaDoLote, ROTINAS, type TipoRotina } from "@/lib/rotinas";
import type { Lote } from "@/lib/types";
import { formatDataBR, hoje } from "@/lib/utils";

interface RotinaSheetProps {
  open: boolean;
  lote: Lote;
  tipo: TipoRotina;
  onClose: () => void;
}

export function RotinaSheet({ open, lote, tipo, onClose }: RotinaSheetProps) {
  const regra = ROTINAS[tipo];
  const [ultima, setUltima] = useState("");
  const [intervalo, setIntervalo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const atual = rotinaDoLote(lote, tipo);
    setUltima(atual.ultima);
    setIntervalo(atual.intervalo !== null ? String(atual.intervalo) : "");
    setErro("");
    setSalvando(false);
    // Só recarrega ao abrir ou trocar de rotina; digitar não deve ser sobrescrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipo, lote.id]);

  const numero = intervalo.trim() ? Number(intervalo) : null;
  const previa =
    numero !== null && Number.isInteger(numero) && numero >= 1
      ? proximaData(ultima, tipo, numero)
      : null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (numero !== null && !Number.isInteger(numero)) {
      setErro("Use um número inteiro no intervalo.");
      return;
    }
    setSalvando(true);
    try {
      await configurarRotina(lote.id, tipo, { ultimaData: ultima, intervalo: numero });
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  const rotuloUltima =
    tipo === "remedio" ? "Última vez que deu remédio" : "Última vez que levou sal";
  const rotuloIntervalo =
    tipo === "remedio" ? "Repetir a cada quantos meses?" : "Repetir a cada quantos dias?";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`${regra.nome} · ${lote.nome}`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-rotina" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      <form id="form-rotina" onSubmit={salvar} className="space-y-4 pt-1">
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
          <label htmlFor="rotina-ultima" className="field-label">
            {rotuloUltima}
          </label>
          <input
            id="rotina-ultima"
            type="date"
            className="field"
            value={ultima}
            max={hoje()}
            onChange={(e) => setUltima(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="rotina-intervalo" className="field-label">
            {rotuloIntervalo}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="rotina-intervalo"
              className="field"
              inputMode="numeric"
              value={intervalo}
              onChange={(e) => setIntervalo(e.target.value.replace(/\D/g, ""))}
              placeholder={tipo === "remedio" ? "Ex: 6" : "Ex: 30"}
            />
            <span className="shrink-0 text-base font-medium text-dark/70">{regra.unidade}</span>
          </div>
        </div>

        <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          {previa ? (
            <>
              Próxima vez: <strong>{formatDataBR(previa)}</strong>
            </>
          ) : (
            "Preencha a última data e o intervalo para o app calcular a próxima vez e avisar."
          )}
        </div>
      </form>
    </BottomSheet>
  );
}
