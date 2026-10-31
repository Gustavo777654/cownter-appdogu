"use client";

import { useState } from "react";
import { CheckCircle, Drop, GearSix, Pill } from "@phosphor-icons/react";
import {
  diasParaVencer,
  proximaData,
  rotinaDoPasto,
  ROTINAS,
  type TipoRotina,
} from "@/lib/rotinas";
import type { Pasto } from "@/lib/types";
import { formatDataBR, formatDesde, hoje } from "@/lib/utils";
import { PrazoBadge } from "@/components/ui/PrazoBadge";
import { RotinaSheet } from "./RotinaSheet";
import { UsoRotinaSheet } from "./UsoRotinaSheet";

export function RotinaCard({ pasto, tipo }: { pasto: Pasto; tipo: TipoRotina }) {
  const [editando, setEditando] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const regra = ROTINAS[tipo];
  const { ultima, intervalo } = rotinaDoPasto(pasto, tipo);
  const proxima = proximaData(ultima, tipo, intervalo);
  const dias = proxima ? diasParaVencer(proxima, hoje()) : null;
  const Icone = tipo === "remedio" ? Pill : Drop;
  const configurada = !!ultima && intervalo !== null;
  const feitoHoje = ultima === hoje();

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Icone size={24} weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-bold text-dark">{regra.nome}</p>
            <PrazoBadge dias={dias} />
          </div>

          {configurada ? (
            <dl className="mt-1 space-y-0.5 text-sm text-dark/70">
              <div className="flex gap-1">
                <dt>Última vez:</dt>
                <dd className="font-medium text-dark">
                  {formatDataBR(ultima)} ({formatDesde(ultima)})
                </dd>
              </div>
              <div className="flex gap-1">
                <dt>Repete a cada:</dt>
                <dd className="font-medium text-dark">
                  {intervalo} {regra.unidade}
                </dd>
              </div>
              {proxima && (
                <div className="flex gap-1">
                  <dt>Próxima:</dt>
                  <dd className="font-medium text-dark">{formatDataBR(proxima)}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-1 text-sm text-dark/60">
              {ultima
                ? `Última vez em ${formatDataBR(ultima)}. Defina o intervalo para receber o aviso.`
                : "Informe a última vez e de quanto em quanto tempo repete para receber o aviso."}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="btn-secondary min-h-11 flex-1 px-3 text-sm"
        >
          <GearSix size={18} />
          {configurada ? "Ajustar" : "Configurar"}
        </button>
        {configurada && (
          <button
            type="button"
            onClick={() => setMarcando(true)}
            disabled={feitoHoje}
            className="btn-primary min-h-11 flex-1 px-3 text-sm"
          >
            <CheckCircle size={18} weight="bold" />
            {feitoHoje ? "Registrado hoje" : "Feito hoje"}
          </button>
        )}
      </div>

      <UsoRotinaSheet open={marcando} pasto={pasto} tipo={tipo} onClose={() => setMarcando(false)} />
      <RotinaSheet open={editando} pasto={pasto} tipo={tipo} onClose={() => setEditando(false)} />
    </div>
  );
}
