"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Warning } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/ui/Logo";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/inicio");
  }, [isAuthenticated, isLoading, router]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      await login(email, senha);
      router.replace("/inicio");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
      setEntrando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-10 flex flex-col items-center text-center">
        <Logo size="lg" className="flex-col" />
        <p className="mt-3 text-base text-dark/60">
          O organizador do seu rebanho, mesmo sem internet.
        </p>
      </div>

      <form onSubmit={entrar} className="space-y-4">
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
          <label htmlFor="email" className="field-label">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />
        </div>

        <div>
          <label htmlFor="senha" className="field-label">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            className="field"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
            required
          />
        </div>

        <button type="submit" disabled={entrando} className="btn-primary w-full">
          {entrando ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
        <p className="font-semibold">Conta de demonstração</p>
        <p className="mt-1">
          E-mail: <span className="font-mono">demo@cownter.com</span>
        </p>
        <p>
          Senha: <span className="font-mono">demo123</span>
        </p>
      </div>
    </main>
  );
}
