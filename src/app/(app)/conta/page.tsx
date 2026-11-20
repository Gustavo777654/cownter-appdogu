"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash, UserMinus } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { useAuth, type Membro } from "@/contexts/AuthContext";
import { useOnline } from "@/lib/hooks";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";

type Msg = { tipo: "ok" | "erro"; texto: string } | null;

export default function ContaPage() {
  const { user, nuvem, atualizarNome, renomearFazenda, trocarSenha, listarMembros, removerMembro, excluirConta } = useAuth();
  const router = useRouter();
  const online = useOnline();
  const dono = user?.papel === "dono";

  const [nome, setNome] = useState("");
  const [fazenda, setFazenda] = useState("");
  const [msgNome, setMsgNome] = useState<Msg>(null);
  const [msgFazenda, setMsgFazenda] = useState<Msg>(null);

  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [nova2, setNova2] = useState("");
  const [msgSenha, setMsgSenha] = useState<Msg>(null);

  const [membros, setMembros] = useState<Membro[]>([]);
  const [msgMembros, setMsgMembros] = useState<Msg>(null);
  const [remover, setRemover] = useState<Membro | null>(null);

  const [excluindo, setExcluindo] = useState(false);
  const [senhaExcluir, setSenhaExcluir] = useState("");
  const [erroExcluir, setErroExcluir] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setNome(user?.name ?? "");
    setFazenda(user?.farm ?? "");
  }, [user?.name, user?.farm]);

  const carregarMembros = useCallback(async () => {
    try {
      setMembros(await listarMembros());
    } catch {
      /* sem conexão: mantém a lista que já está na tela */
    }
  }, [listarMembros]);

  useEffect(() => {
    if (nuvem && online) void carregarMembros();
  }, [nuvem, online, carregarMembros]);

  const erroDe = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

  async function salvarNome(e: React.FormEvent) {
    e.preventDefault();
    setMsgNome(null);
    setOcupado(true);
    try {
      await atualizarNome(nome);
      setMsgNome({ tipo: "ok", texto: "Nome atualizado." });
      void carregarMembros();
    } catch (err) {
      setMsgNome({ tipo: "erro", texto: erroDe(err) });
    }
    setOcupado(false);
  }

  async function salvarFazenda(e: React.FormEvent) {
    e.preventDefault();
    setMsgFazenda(null);
    setOcupado(true);
    try {
      await renomearFazenda(fazenda);
      setMsgFazenda({ tipo: "ok", texto: "Nome da fazenda atualizado." });
    } catch (err) {
      setMsgFazenda({ tipo: "erro", texto: erroDe(err) });
    }
    setOcupado(false);
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault();
    setMsgSenha(null);
    if (nova !== nova2) {
      setMsgSenha({ tipo: "erro", texto: "As duas senhas novas não são iguais." });
      return;
    }
    setOcupado(true);
    try {
      await trocarSenha(atual, nova);
      setAtual("");
      setNova("");
      setNova2("");
      setMsgSenha({ tipo: "ok", texto: "Senha alterada." });
    } catch (err) {
      setMsgSenha({ tipo: "erro", texto: erroDe(err) });
    }
    setOcupado(false);
  }

  async function confirmarRemocao() {
    if (!remover) return;
    try {
      await removerMembro(remover.user_id);
      setMsgMembros({ tipo: "ok", texto: `${remover.nome || "A pessoa"} foi removida da fazenda.` });
      setRemover(null);
      await carregarMembros();
    } catch (err) {
      setMsgMembros({ tipo: "erro", texto: erroDe(err) });
      setRemover(null);
    }
  }

  async function confirmarExclusao() {
    setErroExcluir("");
    try {
      await excluirConta(senhaExcluir);
      router.replace("/login");
    } catch (err) {
      setErroExcluir(erroDe(err));
    }
  }

  return (
    <>
      <header className="flex items-center gap-2 px-4 pb-3 pt-4">
        <Link prefetch={false} href="/perfil" aria-label="Voltar" className="flex h-10 w-10 items-center justify-center rounded-full text-dark/70 hover:bg-dark/5">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold leading-tight text-dark">Minha conta</h1>
      </header>

      <div className="space-y-4 px-4">
        {!nuvem ? (
          <div className="card">
            <p className="text-sm text-dark/70">Você está usando o app sem conta. Saia e entre com uma conta para gerenciar nome, senha e fazenda.</p>
          </div>
        ) : (
          <>
            {!online && (
              <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">
                Sem internet. Para alterar dados da conta é preciso estar online.
              </p>
            )}

            <form onSubmit={salvarNome} className="card space-y-3">
              <p className="text-xs text-dark/55">Meus dados</p>
              <div>
                <label htmlFor="conta-email" className="field-label">
                  E-mail
                </label>
                <input id="conta-email" className="field bg-dark/5" value={user?.email ?? ""} readOnly />
              </div>
              <div>
                <label htmlFor="conta-nome" className="field-label">
                  Seu nome
                </label>
                <input id="conta-nome" className="field" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
              </div>
              <Aviso msg={msgNome} />
              <button type="submit" disabled={!online || ocupado || nome.trim() === (user?.name ?? "")} className="btn-primary w-full">
                Salvar nome
              </button>
            </form>

            <form onSubmit={salvarFazenda} className="card space-y-3">
              <p className="text-xs text-dark/55">Fazenda</p>
              <div>
                <label htmlFor="conta-fazenda" className="field-label">
                  Nome da fazenda
                </label>
                <input id="conta-fazenda" className="field" value={fazenda} onChange={(e) => setFazenda(e.target.value)} readOnly={!dono} required />
                {!dono && <p className="mt-1.5 text-xs text-dark/55">Só o dono da fazenda pode trocar o nome.</p>}
              </div>
              <Aviso msg={msgFazenda} />
              {dono && (
                <button type="submit" disabled={!online || ocupado || fazenda.trim() === (user?.farm ?? "")} className="btn-primary w-full">
                  Salvar nome da fazenda
                </button>
              )}
            </form>

            <form onSubmit={salvarSenha} className="card space-y-3">
              <p className="text-xs text-dark/55">Trocar senha</p>
              <div>
                <label htmlFor="senha-atual" className="field-label">
                  Senha atual
                </label>
                <input id="senha-atual" type="password" autoComplete="current-password" className="field" value={atual} onChange={(e) => setAtual(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="senha-nova" className="field-label">
                  Senha nova
                </label>
                <input id="senha-nova" type="password" autoComplete="new-password" className="field" value={nova} onChange={(e) => setNova(e.target.value)} minLength={6} placeholder="Mínimo de 6 caracteres" required />
              </div>
              <div>
                <label htmlFor="senha-nova2" className="field-label">
                  Repita a senha nova
                </label>
                <input id="senha-nova2" type="password" autoComplete="new-password" className="field" value={nova2} onChange={(e) => setNova2(e.target.value)} minLength={6} required />
              </div>
              <Aviso msg={msgSenha} />
              <button type="submit" disabled={!online || ocupado} className="btn-primary w-full">
                Trocar senha
              </button>
              <p className="text-xs text-dark/55">Esqueceu a senha atual? Saia da conta e use &ldquo;Esqueci minha senha&rdquo; na tela de entrada.</p>
            </form>

            <div className="card space-y-3">
              <p className="text-xs text-dark/55">Quem participa da fazenda</p>
              {membros.length === 0 ? (
                <p className="text-sm text-dark/60">{online ? "Carregando..." : "Conecte-se à internet para ver."}</p>
              ) : (
                <ul className="divide-y divide-dark/10">
                  {membros.map((m) => (
                    <li key={m.user_id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-dark">
                          {m.nome || "Sem nome"}
                          {m.voce && <span className="font-normal text-dark/50"> (você)</span>}
                        </p>
                        <p className="text-sm text-dark/55">{m.papel === "dono" ? "Dono" : "Membro"}</p>
                      </div>
                      {dono && !m.voce && m.papel !== "dono" && (
                        <button type="button" onClick={() => setRemover(m)} disabled={!online} className="btn-secondary min-h-11 shrink-0 px-3 text-sm" aria-label={`Remover ${m.nome || "pessoa"}`}>
                          <UserMinus size={18} />
                          Remover
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Aviso msg={msgMembros} />
              {dono && <p className="text-xs text-dark/55">Quem for removido perde o acesso aos dados da fazenda, mas pode voltar se receber o código de convite de novo.</p>}
            </div>

            {dono && (
              <div className="card space-y-3 border-red-200">
                <p className="text-xs text-red-700">Zona de perigo</p>
                <p className="text-sm text-dark/70">Excluir a conta apaga a fazenda com todos os dados (rebanho, pastos, finanças) para todos os participantes. Não dá para desfazer.</p>
                <button
                  type="button"
                  id="btn-excluir-conta"
                  onClick={() => {
                    setSenhaExcluir("");
                    setErroExcluir("");
                    setExcluindo(true);
                  }}
                  disabled={!online}
                  className="btn-danger w-full"
                >
                  <Trash size={20} />
                  Excluir minha conta e a fazenda
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmSheet open={!!remover} title="Remover da fazenda?" confirmLabel="Remover" onClose={() => setRemover(null)} onConfirm={confirmarRemocao}>
        <p className="text-sm text-dark/70">
          <strong>{remover?.nome || "Esta pessoa"}</strong> deixa de ver os dados da fazenda e os dados guardados no celular dela são apagados na próxima vez que ela abrir o app com internet.
        </p>
      </ConfirmSheet>

      <ConfirmSheet open={excluindo} title="Excluir conta e fazenda?" confirmLabel="Excluir para sempre" onClose={() => setExcluindo(false)} onConfirm={confirmarExclusao}>
        <p className="text-sm text-dark/70">
          Todos os dados da fazenda <strong>{user?.farm}</strong> serão apagados da nuvem e deste aparelho, e a sua conta deixa de existir. Digite a sua senha para confirmar.
        </p>
        <label htmlFor="senha-excluir" className="field-label mt-3 block">
          Sua senha
        </label>
        <input id="senha-excluir" type="password" autoComplete="current-password" className="field" value={senhaExcluir} onChange={(e) => setSenhaExcluir(e.target.value)} />
        {erroExcluir && (
          <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
            {erroExcluir}
          </p>
        )}
      </ConfirmSheet>
    </>
  );
}

function Aviso({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.tipo === "erro" ? "alert" : "status"} className={`rounded-xl p-3 text-sm font-medium ${msg.tipo === "erro" ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-900"}`}>
      {msg.texto}
    </p>
  );
}
