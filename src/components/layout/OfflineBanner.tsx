"use client";

import { WifiSlash } from "@phosphor-icons/react";
import { useOnline } from "@/lib/hooks";

/** Avisa que o aparelho está sem internet, e que isso não impede o trabalho. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 bg-earth-100 px-4 py-2 text-sm font-medium text-earth-900"
    >
      <WifiSlash size={18} weight="bold" className="shrink-0" />
      Sem internet. Você pode continuar usando, tudo fica salvo no aparelho.
    </div>
  );
}
