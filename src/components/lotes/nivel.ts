import type { NivelPasto } from "@/lib/types";

/** Alto = muito capim (verde), Médio = atenção (âmbar), Baixo = pouco capim (vermelho). */
export const COR_NIVEL_SELECIONADO: Record<NivelPasto, string> = {
  Alto: "border-brand-600 bg-brand-600 text-white",
  Médio: "border-amber-500 bg-amber-500 text-white",
  Baixo: "border-red-600 bg-red-600 text-white",
};

export const COR_NIVEL_SELO: Record<NivelPasto, string> = {
  Alto: "bg-brand-100 text-brand-800",
  Médio: "bg-amber-100 text-amber-800",
  Baixo: "bg-red-100 text-red-700",
};
