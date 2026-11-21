"use client";

import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { desmarcarAluguelPago, marcarAluguelPago } from "@/lib/pastos";
import { parcelasDoAluguel, type StatusParcela } from "@/lib/aluguel";
import { formatarReais } from "@/lib/recursos";
import { formatDataBR, hoje } from "@/lib/utils";
import type { Pasto } from "@/lib/types";
import { BottomSheet } from "@/components/ui/BottomSheet";

/** Lista mês a mês do aluguel do pasto, para marcar cada parcela como paga (com a data). */
export function AluguelParcelas({ pasto }: { pasto: Pasto }) {
  const [pagando, setPagando] = useState<StatusParcela | null>(null);
  const [data, setData] = useState(hoje());
  const [erro, setErro] = useState("");
  const [todas, setTodas] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  if (!pasto.aluguel) return null;
  const hojeIso = hoje();
  const parcelas = parcelasDoAluguel(pasto.aluguel);
  // Por padrão mostra as já vencidas e a próxima; "Ver todas" abre o resto.
  const proxima = parcelas.find((p) => p.vencimento > hojeIso);
  const recolhidas = parcelas.filter((p) => p.vencimento <= hojeIso || p === proxima);
  const visiveis = todas ? parcelas : recolhidas;
  const escondidas = parcelas.length - recolhidas.length;

  function abrir(p: StatusParcela) {
    setErro("");
    setData(hoje());
    setPagando(p);
  }

  async function confirmar() {
    if (!pagando) return;
    setErro("");
    setOcupado(true);
    try {
      await marcarAluguelPago(pasto.id, pagando.indice, data);
      setPagando(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
    setOcupado(false);
  }

  async function desfazer(p: StatusParcela) {
    try {
      await desmarcarAluguelPago(pasto.id, p.indice);
    } catch {
      /* a lista mostra o estado real na próxima atualização */
    }
  }

  return (
    <div className="mt-3 border-t border-dark/10 pt-3" id="aluguel-parcelas">
      <p className="font-bold text-dark">Pagamentos</p>
      <ul className="divide-y divide-dark/10">
        {visiveis.map((p) => {
          const atrasada = !p.pagoEm && p.vencimento < hojeIso;
          return (
            <li key={p.indice} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold text-dark">
                  {formatDataBR(p.vencimento)} · {formatarReais(p.valor)}
                </p>
                {p.pagoEm ? (
                  <p className="flex items-center gap-1 text-xs font-semibold text-brand-700">
                    <CheckCircle size={14} weight="fill" /> Pago em {formatDataBR(p.pagoEm)}
                  </p>
                ) : (
                  <p className={`text-xs font-semibold ${atrasada ? "text-red-700" : "text-dark/55"}`}>
                    {atrasada ? "Em atraso" : p.vencimento === hojeIso ? "Vence hoje" : "A vencer"}
                  </p>
                )}
              </div>
              {p.pagoEm ? (
                <button type="button" onClick={() => desfazer(p)} className="btn-ghost min-h-11 shrink-0 px-2 text-sm" aria-label={`Desfazer pagamento de ${formatDataBR(p.vencimento)}`}>
                  Desfazer
                </button>
              ) : (
                <button type="button" onClick={() => abrir(p)} className="btn-secondary min-h-11 shrink-0 px-3 text-sm" aria-label={`Marcar como pago o aluguel de ${formatDataBR(p.vencimento)}`}>
                  Marcar como pago
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {escondidas > 0 && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="btn-ghost mt-1 px-0 text-sm">
          {todas ? "Ver menos" : `Ver todas as parcelas (+${escondidas})`}
        </button>
      )}

      <BottomSheet
        open={!!pagando}
        onClose={() => setPagando(null)}
        title="Marcar aluguel como pago"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setPagando(null)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="button" id="btn-confirmar-pagamento" onClick={confirmar} disabled={ocupado} className="btn-primary flex-1">
              {ocupado ? "Salvando..." : "Salvar"}
            </button>
          </div>
        }
      >
        {pagando && (
          <div className="space-y-3 pt-1">
            <p className="text-sm text-dark/70">
              Parcela de <strong>{formatDataBR(pagando.vencimento)}</strong> · {formatarReais(pagando.valor)}
            </p>
            <div>
              <label htmlFor="aluguel-data-pagamento" className="field-label">
                Data do pagamento
              </label>
              <input id="aluguel-data-pagamento" type="date" className="field" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
            </div>
            {erro && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
                {erro}
              </p>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
