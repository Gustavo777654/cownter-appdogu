"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Warning } from "@phosphor-icons/react";
import { PrecisaCodigoErro, useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/ui/Logo";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { contarRegistrosLocais, fazendaDoAparelho } from "@/lib/sync";
import type { Fazenda } from "@/lib/types";

type Passo = "conta" | "codigo" | "fazenda";
type Modo = "entrar" | "criar";
type FazendaModo = "nova" | "codigo";

export default function LoginPage() {
  const { entrar, criarConta, confirmarCodigo, reenviarCodigo, criarFazenda, entrarComCodigo, concluir, sessaoAberta, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>("conta");
  const [modo, setModo] = useState<Modo>("entrar");
  const [fazModo, setFazModo] = useState<FazendaModo>("nova");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nomeFazenda, setNomeFazenda] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoEmail, setCodigoEmail] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [pendente, setPendente] = useState<{ fazenda: Fazenda; nome: string; email: string } | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/inicio");
  }, [isAuthenticated, isLoading, router]);

  // Voltou ao app com a conta aberta, mas sem ter escolhido a fazenda: continua de onde parou.
  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    sessaoAberta().then((s) => {
      if (s) {
        setEmail(s.email);
        setNome(s.nome);
        setPasso("fazenda");
      }
    });
  }, [isLoading, isAuthenticated, sessaoAberta]);

  async function finalizar(fazenda: Fazenda, nomeUsuario: string, emailUsuario: string) {
    // Dados de teste ou de outra fazenda neste aparelho serão apagados: pede confirmação.
    const temDados = (await contarRegistrosLocais()) > 0;
    if (temDados && fazendaDoAparelho() !== fazenda.id) {
      setPendente({ fazenda, nome: nomeUsuario, email: emailUsuario });
      setOcupado(false);
      return;
    }
    await concluir(fazenda, nomeUsuario, emailUsuario);
    router.replace("/inicio");
  }

  async function enviarConta(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    setOcupado(true);
    try {
      const r = modo === "entrar" ? await entrar(email, senha) : await criarConta(nome, email, senha);
      setNome(r.nome);
      if (r.fazenda) await finalizar(r.fazenda, r.nome, email.trim());
      else {
        setPasso("fazenda");
        setOcupado(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível continuar.";
      if (err instanceof PrecisaCodigoErro) {
        setAviso(msg);
        setCodigoEmail("");
        setPasso("codigo");
      } else setErro(msg);
      setOcupado(false);
    }
  }

  async function enviarCodigoEmail(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    try {
      const r = await confirmarCodigo(email, codigoEmail);
      setNome(r.nome);
      setAviso("");
      if (r.fazenda) await finalizar(r.fazenda, r.nome, email.trim());
      else {
        setPasso("fazenda");
        setOcupado(false);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível confirmar.");
      setOcupado(false);
    }
  }

  async function pedirNovoCodigo() {
    setErro("");
    try {
      await reenviarCodigo(email);
      setAviso("Enviamos um novo código. O anterior deixou de valer.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível reenviar.");
    }
  }

  async function enviarFazenda(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    try {
      const f = fazModo === "nova" ? await criarFazenda(nomeFazenda, nome) : await entrarComCodigo(codigo, nome);
      await finalizar(f, nome, email.trim());
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível continuar.");
      setOcupado(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size="lg" className="flex-col" />
        <p className="mt-3 text-base text-dark/60">O organizador do seu rebanho, mesmo sem internet.</p>
      </div>

      {passo === "conta" ? (
        <form onSubmit={enviarConta} className="space-y-4">
          <Abas
            rotulo="Entrar ou criar conta"
            value={modo}
            onChange={(v) => {
              setModo(v);
              setErro("");
              setAviso("");
            }}
            options={[
              { value: "entrar", label: "Entrar" },
              { value: "criar", label: "Criar conta" },
            ]}
          />

          {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
          {aviso && <Mensagem tipo="aviso">{aviso}</Mensagem>}

          {modo === "criar" && (
            <div>
              <label htmlFor="nome" className="field-label">
                Seu nome
              </label>
              <input id="nome" className="field" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Gustavo" required />
            </div>
          )}

          <div>
            <label htmlFor="email" className="field-label">
              E-mail
            </label>
            <input id="email" type="email" inputMode="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>

          <div>
            <label htmlFor="senha" className="field-label">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              className="field"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={modo === "entrar" ? "Sua senha" : "Mínimo de 6 caracteres"}
              minLength={modo === "criar" ? 6 : undefined}
              required
            />
          </div>

          <button type="submit" disabled={ocupado} className="btn-primary w-full">
            {ocupado ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
          <p className="text-center text-xs text-dark/50">Na primeira vez é preciso internet. Depois o app abre e funciona sem sinal.</p>
        </form>
      ) : passo === "codigo" ? (
        <form onSubmit={enviarCodigoEmail} className="space-y-4">
          <p className="text-center text-base font-semibold text-dark">Confirme seu e-mail</p>
          {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
          {aviso && <Mensagem tipo="aviso">{aviso}</Mensagem>}
          <div>
            <label htmlFor="codigo-email" className="field-label">
              Código de 6 dígitos enviado para {email}
            </label>
            <input
              id="codigo-email"
              className="field text-center font-mono text-2xl tracking-[0.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={codigoEmail}
              onChange={(e) => setCodigoEmail(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="000000"
              required
            />
          </div>
          <button type="submit" disabled={ocupado || codigoEmail.length < 6} className="btn-primary w-full">
            {ocupado ? "Aguarde..." : "Confirmar"}
          </button>
          <button type="button" onClick={pedirNovoCodigo} className="btn-ghost w-full text-sm">
            Enviar um novo código
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPasso("conta");
              setErro("");
              setAviso("");
            }}
            className="btn-ghost w-full text-sm"
          >
            Voltar
          </button>
        </form>
      ) : (
        <form onSubmit={enviarFazenda} className="space-y-4">
          <p className="text-center text-base font-semibold text-dark">Olá, {nome || "produtor"}! Agora a fazenda.</p>
          <Abas
            rotulo="Criar fazenda ou entrar com código"
            value={fazModo}
            onChange={(v) => {
              setFazModo(v);
              setErro("");
            }}
            options={[
              { value: "nova", label: "Criar minha fazenda" },
              { value: "codigo", label: "Tenho um código" },
            ]}
          />

          {erro && <Mensagem tipo="erro">{erro}</Mensagem>}

          {fazModo === "nova" ? (
            <div>
              <label htmlFor="fazenda-nome" className="field-label">
                Nome da fazenda
              </label>
              <input id="fazenda-nome" className="field" value={nomeFazenda} onChange={(e) => setNomeFazenda(e.target.value)} placeholder="Ex: Fazenda Boa Vista" required />
              <p className="mt-1.5 text-xs text-dark/55">Depois você gera um código no Perfil para outras pessoas entrarem na mesma fazenda.</p>
            </div>
          ) : (
            <div>
              <label htmlFor="fazenda-codigo" className="field-label">
                Código de convite
              </label>
              <input id="fazenda-codigo" className="field font-mono uppercase tracking-widest" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex: A1B2C3D4" autoCapitalize="characters" autoComplete="off" required />
              <p className="mt-1.5 text-xs text-dark/55">Peça o código a quem criou a fazenda (fica em Perfil, na conta dele).</p>
            </div>
          )}

          <button type="submit" disabled={ocupado} className="btn-primary w-full">
            {ocupado ? "Aguarde..." : fazModo === "nova" ? "Criar fazenda" : "Entrar na fazenda"}
          </button>
        </form>
      )}

      <ConfirmSheet
        open={!!pendente}
        title="Apagar os dados deste aparelho?"
        confirmLabel="Apagar e continuar"
        onClose={() => setPendente(null)}
        onConfirm={async () => {
          if (!pendente) return;
          await concluir(pendente.fazenda, pendente.nome, pendente.email);
          setPendente(null);
          router.replace("/inicio");
        }}
      >
        <p className="text-sm text-dark/70">
          Este aparelho tem dados que não pertencem à fazenda <strong>{pendente?.fazenda.nome}</strong> (por exemplo, dados de teste). Para a fazenda começar limpa, eles serão apagados daqui. Os dados que já estão na nuvem desta fazenda serão baixados.
        </p>
      </ConfirmSheet>
    </main>
  );
}

function Mensagem({ tipo, children }: { tipo: "erro" | "aviso"; children: React.ReactNode }) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl p-3 text-sm font-medium ${tipo === "erro" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
    >
      <Warning size={20} weight="fill" className="mt-0.5 shrink-0" />
      {children}
    </div>
  );
}

function Abas<T extends string>({
  rotulo,
  value,
  onChange,
  options,
}: {
  rotulo: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="group" aria-label={rotulo} className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`h-12 rounded-xl border text-base font-semibold transition-colors ${
            o.value === value ? "border-brand-600 bg-brand-600 text-white" : "border-brand-200 bg-white text-dark/70"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
