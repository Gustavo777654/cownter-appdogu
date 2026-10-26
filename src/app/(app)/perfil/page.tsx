"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CloudArrowUp, SignOut, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnline, usePendentesSync } from "@/lib/hooks";

export default function PerfilPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const online = useOnline();
  const pendentes = usePendentesSync();

  function sair() {
    logout();
    router.replace("/login");
  }

  return (
    <>
      <header className="flex items-center gap-2 px-4 pb-3 pt-4">
        <Link
          prefetch={false}
          href="/inicio"
          aria-label="Voltar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-dark/70 hover:bg-dark/5"
        >
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold leading-tight text-dark">Perfil</h1>
      </header>

      <div className="space-y-4 px-4">
        <div className="card">
          <p className="text-xs text-dark/55">Produtor</p>
          <p className="text-lg font-bold text-dark">{user?.name}</p>
          <p className="text-sm text-dark/60">{user?.farm}</p>
          <p className="mt-1 text-sm text-dark/60">{user?.email}</p>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                online ? "bg-brand-100 text-brand-700" : "bg-earth-100 text-earth-800"
              }`}
            >
              {online ? <WifiHigh size={22} /> : <WifiSlash size={22} />}
            </div>
            <div>
              <p className="font-semibold text-dark">{online ? "Com internet" : "Sem internet"}</p>
              <p className="text-sm text-dark/60">
                {online
                  ? "O app funciona normalmente."
                  : "O app continua funcionando, os dados ficam no aparelho."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <CloudArrowUp size={22} />
            </div>
            <div>
              <p className="font-semibold text-dark">
                {pendentes ?? 0} {pendentes === 1 ? "registro" : "registros"} no aparelho
              </p>
              <p className="text-sm text-dark/60">
                O envio para a nuvem será ativado em uma próxima etapa.
              </p>
            </div>
          </div>
        </div>

        <button type="button" onClick={sair} className="btn-secondary w-full">
          <SignOut size={20} />
          Sair da conta
        </button>

        <p className="pt-2 text-center text-xs text-dark/40">Cownter · protótipo v0.1.0</p>
      </div>
    </>
  );
}
