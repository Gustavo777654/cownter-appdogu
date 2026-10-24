import { descreverPrazo, JANELA_ALERTA_DIAS } from "@/lib/rotinas";
import { cn } from "@/lib/utils";

/** Selo com a situação de um prazo: atrasado (vermelho), hoje/próximo (âmbar) ou em dia (verde). */
export function PrazoBadge({ dias, className }: { dias: number | null; className?: string }) {
  let texto = "Não configurado";
  let estilo = "bg-dark/5 text-dark/60";

  if (dias !== null) {
    texto = descreverPrazo(dias);
    if (dias < 0) estilo = "bg-red-100 text-red-700";
    else if (dias <= JANELA_ALERTA_DIAS) estilo = "bg-amber-100 text-amber-800";
    else estilo = "bg-brand-100 text-brand-800";
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        estilo,
        className
      )}
    >
      {texto}
    </span>
  );
}
