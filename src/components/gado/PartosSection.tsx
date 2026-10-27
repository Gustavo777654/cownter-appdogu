"use client";

import { useEffect, useMemo, useState } from "react";
import { Baby, Trash } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { Segmented } from "@/components/ui/Segmented";
import { dataDesmama } from "@/lib/desmama";
import { desmamar, excluirParto, registrarParto, type DestinoDesmama } from "@/lib/partos";
import { diasEntre, descreverPrazo } from "@/lib/rotinas";
import { useCabecas, useConfiguracao, useLotesGado, usePartosDoLote } from "@/lib/hooks";
import { SEXOS, type LoteGado, type Parto, type Sexo } from "@/lib/types";
import { cn, formatDataBR, hoje } from "@/lib/utils";

const temVaca = (lote: LoteGado) => lote.composicao.some((l) => l.sexo === "Fêmea" && l.categoria.startsWith("Vaca"));

/** Partos e desmama do lote: registra o nascimento e depois leva o bezerro para outro lote. */
export function PartosSection({ lote }: { lote: LoteGado }) {
  const partos = usePartosDoLote(lote.id);
  const config = useConfiguracao();
  const [registrando, setRegistrando] = useState(false);
  const [desmamando, setDesmamando] = useState(false);
  const [erro, setErro] = useState("");

  const mamando = useMemo(() => (partos ?? []).filter((p) => !p.desmamado), [partos]);
  const desmamados = (partos ?? []).length - mamando.length;

  if (!temVaca(lote) && (partos ?? []).length === 0) return null;
  const meses = config?.desmamaMeses ?? 7;

  async function apagar(p: Parto) {
    setErro("");
    try {
      await excluirParto(p.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-dark">Partos e desmama</h2>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="card p-3">
          <p className="text-2xl font-bold text-dark">{mamando.length}</p>
          <p className="text-sm text-dark/60">{mamando.length === 1 ? "bezerro mamando" : "bezerros mamando"}</p>
        </div>
        <div className="card p-3">
          <p className="text-2xl font-bold text-dark">{desmamados}</p>
          <p className="text-sm text-dark/60">{desmamados === 1 ? "bezerro desmamado" : "bezerros desmamados"}</p>
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => setRegistrando(true)} className="btn-secondary min-h-11 flex-1 px-3 text-sm">
          <Baby size={18} />
          Registrar parto
        </button>
        <button
          type="button"
          onClick={() => setDesmamando(true)}
          disabled={mamando.length === 0}
          className="btn-secondary min-h-11 flex-1 px-3 text-sm"
        >
          Desmamar
        </button>
      </div>

      <Erro texto={erro} />

      {mamando.length > 0 && (
        <ul className="space-y-2">
          {mamando.map((p) => {
            const data = dataDesmama(p.data, meses);
            const dias = data ? diasEntre(hoje(), data) : null;
            return (
              <li key={p.id} className="card p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-dark">
                      {p.sexoBezerro === "Fêmea" ? "Bezerra" : "Bezerro"}
                      {p.vaca ? ` · mãe ${p.vaca}` : ""}
                    </p>
                    <p className="text-sm text-dark/60">Nasceu em {formatDataBR(p.data)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => apagar(p)}
                    aria-label={`Excluir registro de parto de ${formatDataBR(p.data)}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-dark/40 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash size={18} />
                  </button>
                </div>
                {data && dias !== null && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-dark/60">
                    <span>Desmama em {formatDataBR(data)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        dias < 0 ? "bg-red-100 text-red-700" : dias <= 7 ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-800"
                      )}
                    >
                      {descreverPrazo(dias)}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-dark/50">
        A desmama é avisada com {meses} meses de idade. Você muda isso em Perfil.
      </p>

      <RegistrarPartoSheet open={registrando} lote={lote} onClose={() => setRegistrando(false)} />
      <DesmamarSheet open={desmamando} lote={lote} abertos={mamando} onClose={() => setDesmamando(false)} />
    </section>
  );
}

const SEM_VACA = "";
const NOVA_VACA = "__nova__";

function RegistrarPartoSheet({ open, lote, onClose }: { open: boolean; lote: LoteGado; onClose: () => void }) {
  const cabecas = useCabecas(open ? lote.id : null);
  const [data, setData] = useState(hoje());
  const [sexo, setSexo] = useState<Sexo>("Fêmea");
  const [vacaSel, setVacaSel] = useState(SEM_VACA);
  const [brinco, setBrinco] = useState("");
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("");
  const [raca, setRaca] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setData(hoje());
    setSexo("Fêmea");
    setVacaSel(SEM_VACA);
    setBrinco("");
    setNome("");
    setCor("");
    setRaca(lote.raca);
    setErro("");
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const femeas = (cabecas ?? []).filter((c) => c.sexo === "Fêmea");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await registrarParto(lote.id, {
        data,
        sexoBezerro: sexo,
        vaca:
          vacaSel === NOVA_VACA
            ? { brinco, nome, cor, raca }
            : vacaSel === SEM_VACA
              ? {}
              : { cabecaId: vacaSel },
      });
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível registrar.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Registrar parto"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-parto" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : "Registrar"}
          </button>
        </div>
      }
    >
      <form id="form-parto" onSubmit={salvar} className="space-y-5 pt-1">
        <Erro texto={erro} />
        <Segmented label="O bezerro nasceu" value={sexo} options={SEXOS} onChange={setSexo} />
        <div>
          <label htmlFor="parto-data" className="field-label">
            Data do nascimento
          </label>
          <input
            id="parto-data"
            type="date"
            className="field"
            value={data}
            max={hoje()}
            onChange={(e) => setData(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="parto-vaca" className="field-label">
            Mãe do bezerro
          </label>
          <select id="parto-vaca" className="field" value={vacaSel} onChange={(e) => setVacaSel(e.target.value)}>
            <option value={SEM_VACA}>Não informar</option>
            {femeas.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.brinco, c.nome, c.cor].filter(Boolean).join(" · ")}
              </option>
            ))}
            <option value={NOVA_VACA}>Cadastrar a vaca agora</option>
          </select>
        </div>

        {vacaSel === NOVA_VACA && (
          <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
            <p className="text-sm text-dark/70">
              A vaca fica cadastrada como cabeça deste lote. Informe pelo menos o brinco, a cor ou o nome.
            </p>
            <div>
              <label htmlFor="parto-brinco" className="field-label">
                Brinco
              </label>
              <input id="parto-brinco" className="field" value={brinco} onChange={(e) => setBrinco(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="parto-nome" className="field-label">
                Nome
              </label>
              <input id="parto-nome" className="field" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="parto-cor" className="field-label">
                Cor
              </label>
              <input id="parto-cor" className="field" value={cor} onChange={(e) => setCor(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="parto-raca" className="field-label">
                Raça
              </label>
              <input id="parto-raca" className="field" value={raca} onChange={(e) => setRaca(e.target.value)} autoComplete="off" />
            </div>
          </div>
        )}

        <p className="text-sm text-dark/60">
          O bezerro entra neste lote e uma vaca mojando (ou atrasada) passa a ser vaca parida.
        </p>
      </form>
    </BottomSheet>
  );
}

function DesmamarSheet({
  open,
  lote,
  abertos,
  onClose,
}: {
  open: boolean;
  lote: LoteGado;
  abertos: Parto[];
  onClose: () => void;
}) {
  const lotes = useLotesGado();
  const outros = (lotes ?? []).filter((l) => l.id !== lote.id);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [modo, setModo] = useState<"Lote novo" | "Lote existente">("Lote novo");
  const [nome, setNome] = useState("");
  const [loteId, setLoteId] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEscolhidos(new Set(abertos.map((p) => p.id)));
    setModo("Lote novo");
    setNome("");
    setLoteId("");
    setErro("");
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function alternar(id: string) {
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const destino: DestinoDesmama =
      modo === "Lote novo" ? { tipo: "novo", nome } : { tipo: "lote", loteId };
    if (modo === "Lote existente" && !loteId) {
      setErro("Escolha o lote para onde os bezerros vão.");
      return;
    }
    setSalvando(true);
    try {
      await desmamar(lote.id, Array.from(escolhidos), destino);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível desmamar.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Desmamar bezerros"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            type="submit"
            form="form-desmama"
            disabled={salvando || escolhidos.size === 0}
            className="btn-primary flex-1"
          >
            {salvando ? "Salvando..." : `Desmamar ${escolhidos.size}`}
          </button>
        </div>
      }
    >
      <form id="form-desmama" onSubmit={confirmar} className="space-y-5 pt-1">
        <Erro texto={erro} />

        <fieldset>
          <legend className="field-label">Quais bezerros vão sair</legend>
          <ul className="space-y-2">
            {abertos.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-brand-200 bg-white p-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand-600"
                    checked={escolhidos.has(p.id)}
                    onChange={() => alternar(p.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-dark">
                      {p.sexoBezerro === "Fêmea" ? "Bezerra" : "Bezerro"}
                      {p.vaca ? ` · mãe ${p.vaca}` : ""}
                    </span>
                    <span className="block text-xs text-dark/55">Nasceu em {formatDataBR(p.data)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <Segmented
          label="Para onde eles vão"
          value={modo}
          options={["Lote novo", "Lote existente"] as const}
          onChange={setModo}
        />

        {modo === "Lote novo" ? (
          <div>
            <label htmlFor="desm-nome" className="field-label">
              Nome do novo lote
            </label>
            <input
              id="desm-nome"
              className="field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Desmamados de outubro"
              autoComplete="off"
            />
            <p className="mt-1.5 text-xs text-dark/55">O lote novo fica no mesmo pasto deste lote.</p>
          </div>
        ) : (
          <div>
            <label htmlFor="desm-lote" className="field-label">
              Lote de destino
            </label>
            <select id="desm-lote" className="field" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              <option value="">Escolha um lote</option>
              {outros.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-sm text-dark/60">As mães dos bezerros desmamados voltam a ser vaca atrasada.</p>
      </form>
    </BottomSheet>
  );
}
