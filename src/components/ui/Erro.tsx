import { Warning } from "@phosphor-icons/react";

/** Faixa vermelha de erro de formulário ou de ação. */
export function Erro({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700"
    >
      <Warning size={20} weight="fill" className="mt-0.5 shrink-0" />
      {texto}
    </div>
  );
}
