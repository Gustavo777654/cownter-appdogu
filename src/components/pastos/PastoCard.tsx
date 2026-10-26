import Link from "next/link";
import { CaretRight, Cow, Moon, Plant } from "@phosphor-icons/react";
import { diasParaVencer, proximaData, rotinaDoPasto, ROTINAS, type TipoRotina } from "@/lib/rotinas";
import { descreverCabecas } from "@/lib/composicao";
import type { Pasto } from "@/lib/types";
import { cn, formatDesde, hoje } from "@/lib/utils";
import { PrazoBadge } from "@/components/ui/PrazoBadge";
import { COR_NIVEL_SELO } from "./nivel";

function DiasRotina({ pasto, tipo }: { pasto: Pasto; tipo: TipoRotina }) {
  const { ultima, intervalo } = rotinaDoPasto(pasto, tipo);
  const data = proximaData(ultima, tipo, intervalo);
  const dias = data ? diasParaVencer(data, hoje()) : null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-dark/70">{ROTINAS[tipo].nome}</span>
      <PrazoBadge dias={dias} />
    </div>
  );
}

export function PastoCard({
  pasto,
  qtdLotes,
  qtdCabecas,
}: {
  pasto: Pasto;
  qtdLotes: number;
  qtdCabecas: number;
}) {
  const reservado = pasto.situacao === "Reservado";

  return (
    <Link prefetch={false}
      href={`/pasto?id=${pasto.id}`}
      className={cn(
        "card block transition-all active:scale-[0.99] active:bg-brand-50",
        reservado && "border-earth-200 bg-earth-50"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            reservado ? "bg-earth-100 text-earth-700" : "bg-brand-100 text-brand-700"
          )}
        >
          {reservado ? <Moon size={26} weight="duotone" /> : <Plant size={26} weight="duotone" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-base font-bold text-dark">{pasto.nome}</p>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                COR_NIVEL_SELO[pasto.nivelPasto]
              )}
            >
              Capim {pasto.nivelPasto.toLowerCase()}
            </span>
          </div>

          <p className="mt-0.5 text-sm text-dark/60">
            {reservado ? "Descansando" : "Em uso"} {formatDesde(pasto.situacaoDesde)}
            {pasto.areaHa !== null && ` · ${pasto.areaHa.toLocaleString("pt-BR")} ha`}
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-dark/80">
            <Cow size={18} className="text-brand-700" />
            {qtdLotes === 0
              ? "Sem gado"
              : `${descreverCabecas(qtdCabecas)} · ${qtdLotes} ${qtdLotes === 1 ? "lote" : "lotes"}`}
          </p>
        </div>
        <CaretRight size={18} className="mt-3 shrink-0 text-dark/30" />
      </div>

      {!reservado && (
        <div className="mt-3 space-y-1.5 border-t border-brand-100 pt-3">
          <DiasRotina pasto={pasto} tipo="remedio" />
          <DiasRotina pasto={pasto} tipo="sal" />
        </div>
      )}
    </Link>
  );
}
