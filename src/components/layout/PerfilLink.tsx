"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

/** Ícone de perfil no topo das telas principais: abre os dados da conta e as configurações. */
export function PerfilLink() {
  const { user } = useAuth();
  const inicial = user?.name.trim().charAt(0).toUpperCase() || "P";

  return (
    <Link
      prefetch={false}
      href="/perfil"
      aria-label="Perfil e configurações"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white shadow-md shadow-brand-600/20 active:scale-95"
    >
      {inicial}
    </Link>
  );
}
