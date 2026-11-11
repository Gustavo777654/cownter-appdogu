// Testes da sincronização com um servidor de mentira (mesmas regras do supabase/schema.sql).
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { db } from "./db";
import { criarPasto, atualizarPasto, excluirPasto } from "./pastos";
import { baixarMudancas, contarRegistrosLocais, enviarPendentes, limparDadosLocais, prepararAparelho, sincronizar, type Remoto, type RegistroNuvem } from "./sync";

const memoria = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, v),
  removeItem: (k: string) => void memoria.delete(k),
  clear: () => memoria.clear(),
  key: (i: number) => Array.from(memoria.keys())[i] ?? null,
  get length() {
    return memoria.size;
  },
} as Storage;
Object.defineProperty(globalThis.localStorage, "keys", { value: () => Array.from(memoria.keys()) });
// Object.keys(localStorage) precisa enxergar as chaves.
(globalThis as unknown as { localStorage: Storage }).localStorage = new Proxy(globalThis.localStorage, {
  ownKeys: () => Array.from(memoria.keys()),
  getOwnPropertyDescriptor: (_t, k) => (memoria.has(String(k)) ? { enumerable: true, configurable: true, value: memoria.get(String(k)) } : undefined),
});

/** Servidor falso: guarda registros e aplica a regra "último a salvar vale; excluído não volta". */
class ServidorFalso implements Remoto {
  linhas = new Map<string, RegistroNuvem & { excluido: boolean }>();
  relogio = 0;
  enviosFeitos = 0;
  falhar = false;
  async enviar(registros: RegistroNuvem[]) {
    if (this.falhar) throw new Error("Failed to fetch");
    this.enviosFeitos++;
    for (const r of registros) {
      const chave = `${r.tabela}/${r.id}`;
      const atual = this.linhas.get(chave);
      const excluido = r.dados.deletedAt != null;
      if (atual && !(r.atualizadoEm >= atual.atualizadoEm && (excluido || !atual.excluido))) continue;
      this.linhas.set(chave, { ...r, excluido, servidorEm: new Date(Date.UTC(2026, 10, 10, 12, 0, this.relogio++)).toISOString() });
    }
  }
  async buscar(desde: string | null, limite: number) {
    if (this.falhar) throw new Error("Failed to fetch");
    return Array.from(this.linhas.values())
      .filter((l) => !desde || l.servidorEm! > desde)
      .sort((a, b) => a.servidorEm!.localeCompare(b.servidorEm!))
      .slice(0, limite);
  }
}

/** Dois aparelhos com bancos separados: troca o banco "ativo" do Dexie apagando e restaurando. */
async function limpar() {
  await limparDadosLocais();
  memoria.clear();
}

beforeEach(limpar);

describe("sincronização", () => {
  it("envia o que está pendente e marca como enviado", async () => {
    const srv = new ServidorFalso();
    const p = await criarPasto({ nome: "Norte", areaHa: null, nivelPasto: "Alto" });
    assert.equal((await db.pastos.get(p.id))?.syncStatus, "pending");
    assert.equal(await enviarPendentes(srv), 1);
    assert.equal((await db.pastos.get(p.id))?.syncStatus, "synced");
    assert.equal(srv.linhas.size, 1);
    assert.equal("syncStatus" in (srv.linhas.get(`pastos/${p.id}`)!.dados), false, "syncStatus não vai para a nuvem");
    assert.equal(await enviarPendentes(srv), 0, "nada pendente, nada enviado");
  });

  it("um segundo aparelho baixa o que o primeiro enviou", async () => {
    const srv = new ServidorFalso();
    const p = await criarPasto({ nome: "Norte", areaHa: 12, nivelPasto: "Médio", aluguel: { valorMensal: 900, inicio: "2026-11-01", meses: 2 } });
    await enviarPendentes(srv);
    await limparDadosLocais(); // aparelho B vazio
    assert.equal(await baixarMudancas(srv, "faz"), 1);
    const b = await db.pastos.get(p.id);
    assert.equal(b?.nome, "Norte");
    assert.equal(b?.aluguel?.valorMensal, 900);
    assert.equal(b?.syncStatus, "synced");
    assert.equal(await baixarMudancas(srv, "faz"), 1, "o cursor volta 2 s por segurança (idempotente)");
  });

  it("edição local mais nova que a nuvem não é sobrescrita ao baixar", async () => {
    const srv = new ServidorFalso();
    const p = await criarPasto({ nome: "Norte", areaHa: null, nivelPasto: "Alto" });
    await enviarPendentes(srv);
    await baixarMudancas(srv, "faz");
    await atualizarPasto(p.id, { nome: "Norte editado", areaHa: null, nivelPasto: "Alto" });
    await baixarMudancas(srv, "faz");
    assert.equal((await db.pastos.get(p.id))?.nome, "Norte editado");
    assert.equal((await db.pastos.get(p.id))?.syncStatus, "pending");
    await enviarPendentes(srv);
    assert.equal(srv.linhas.get(`pastos/${p.id}`)!.dados.nome, "Norte editado");
  });

  it("último a salvar vale entre dois aparelhos", async () => {
    const srv = new ServidorFalso();
    const p = await criarPasto({ nome: "Norte", areaHa: null, nivelPasto: "Alto" });
    await enviarPendentes(srv);
    // Aparelho B edita depois (mais novo) e envia.
    const antigo = { ...(await db.pastos.get(p.id))! };
    await new Promise((r) => setTimeout(r, 5));
    await atualizarPasto(p.id, { nome: "Do aparelho B", areaHa: null, nivelPasto: "Alto" });
    await enviarPendentes(srv);
    // Aparelho A (que ficou offline) envia uma edição mais antiga que a do B.
    await srv.enviar([{ tabela: "pastos", id: p.id, dados: { ...antigo, nome: "Do aparelho A (antigo)" }, atualizadoEm: antigo.updatedAt }]);
    assert.equal(srv.linhas.get(`pastos/${p.id}`)!.dados.nome, "Do aparelho B");
  });

  it("exclusão sincroniza e não volta por edição de outro aparelho", async () => {
    const srv = new ServidorFalso();
    const p = await criarPasto({ nome: "Norte", areaHa: null, nivelPasto: "Alto" });
    await enviarPendentes(srv);
    const copiaB = { ...(await db.pastos.get(p.id))! };
    await new Promise((r) => setTimeout(r, 5));
    await excluirPasto(p.id);
    await enviarPendentes(srv);
    assert.ok(srv.linhas.get(`pastos/${p.id}`)!.dados.deletedAt);
    // O aparelho B edita (mais novo ainda) um registro que já foi excluído: continua excluído.
    await srv.enviar([{ tabela: "pastos", id: p.id, dados: { ...copiaB, nome: "ressuscitou", updatedAt: new Date(Date.now() + 1000).toISOString() }, atualizadoEm: new Date(Date.now() + 1000).toISOString() }]);
    assert.ok(srv.linhas.get(`pastos/${p.id}`)!.dados.deletedAt, "continua excluído");
    // O aparelho que tinha cópia antiga (não excluída) baixa a exclusão.
    await db.pastos.put({ ...copiaB, syncStatus: "synced" });
    await baixarMudancas(srv, "faz");
    assert.ok((await db.pastos.get(p.id))?.deletedAt);
  });

  it("sem internet: falha com mensagem amigável, mantém pendente e tenta de novo depois", async () => {
    const srv = new ServidorFalso();
    const p = await criarPasto({ nome: "Norte", areaHa: null, nivelPasto: "Alto" });
    srv.falhar = true;
    await sincronizar("faz", srv);
    const { estadoSync } = await import("./sync");
    assert.match(estadoSync().erro ?? "", /Sem conexão/);
    assert.equal((await db.pastos.get(p.id))?.syncStatus, "pending");
    srv.falhar = false;
    await sincronizar("faz", srv);
    assert.equal(estadoSync().erro, null);
    assert.equal((await db.pastos.get(p.id))?.syncStatus, "synced");
  });

  it("envia em lotes quando há muitos registros", async () => {
    const srv = new ServidorFalso();
    for (let i = 0; i < 5; i++) await criarPasto({ nome: `P${i}`, areaHa: null, nivelPasto: "Alto" });
    await enviarPendentes(srv);
    assert.equal(srv.linhas.size, 5);
  });

  it("ligar o aparelho a uma fazenda nova apaga os dados de teste; à mesma, não", async () => {
    await criarPasto({ nome: "Teste", areaHa: null, nivelPasto: "Alto" });
    assert.equal(await contarRegistrosLocais(), 1);
    await prepararAparelho("fazenda-1");
    assert.equal(await contarRegistrosLocais(), 0, "dados de teste apagados");
    await criarPasto({ nome: "Real", areaHa: null, nivelPasto: "Alto" });
    await prepararAparelho("fazenda-1");
    assert.equal(await contarRegistrosLocais(), 1, "mesma fazenda: mantém");
    await prepararAparelho("fazenda-2");
    assert.equal(await contarRegistrosLocais(), 0, "outra fazenda: apaga");
  });
});
