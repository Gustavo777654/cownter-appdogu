"use client";

import { useEffect, useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { RecursoFormSheet } from "@/components/recursos/RecursoFormSheet";
import { lerNumero } from "@/components/recursos/campos";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { marcarRotinaFeita } from "@/lib/pastos";
import { useRecursos } from "@/lib/hooks";
import { formatarUnidades, RECURSO_DA_ROTINA, registrarUsoRotina, UNIDADE } from "@/lib/recursos";
import type { TipoRotina } from "@/lib/rotinas";
import type { Pasto } from "@/lib/types";

interface Linha {
  recursoId: string;
  qtd: string;
}

/** Ao marcar o sal ou o remédio como feito: escolhe o que saiu do estoque e quanto (decimal). */
export function UsoRotinaSheet({
  open,
  pasto,
  tipo,
  onClose,
}: {
  open: boolean;
  pasto: Pasto;
  tipo: TipoRotina;
  onClose: () => void;
}) {
  const tipoRecurso = RECURSO_DA_ROTINA[tipo];
  const un = UNIDADE[tipoRecurso];
  const recursos = useRecursos(tipoRecurso);
  const [linhas, setLinhas] = useState<Linha[]>([{ recursoId: "", qtd: "" }]);
  const [cadastrando, setCadastrando] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLinhas([{ recursoId: "", qtd: "" }]);
    setCadastrando(null);
    setErro("");
    setSalvando(false);
  }, [open]);

  const nomeRotina = tipo === "sal" ? "Sal" : "Remédio";

  function mudar(i: number, campo: Partial<Linha>) {
    setLinhas((l) => l.map((x, k) => (k === i ? { ...x, ...campo } : x)));
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const usos = [];
    for (const l of linhas) {
      const q = lerNumero(l.qtd);
      if (!l.recursoId || q === null || Number.isNaN(q)) {
        setErro(`Escolha o item e informe a quantidade de ${un.plural} usada em cada linha.`);
        return;
      }
      usos.push({ recursoId: l.recursoId, quantidade: q });
    }
    setSalvando(true);
    try {
      await registrarUsoRotina(pasto.id, tipo, usos);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível registrar.");
      setSalvando(false);
    }
  }

  async function semEstoque() {
    setErro("");
    setSalvando(true);
    try {
      await marcarRotinaFeita(pasto.id, tipo);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível registrar.");
      setSalvando(false);
    }
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={`${nomeRotina} feito em ${pasto.nome}`}
        footer={
          <div className="space-y-2">
            <button type="submit" form="form-uso-rotina" disabled={salvando} className="btn-primary w-full">
              {salvando ? "Salvando..." : "Marcar como feito"}
            </button>
            <button type="button" onClick={semEstoque} disabled={salvando} className="btn-ghost w-full text-sm">
              Marcar sem baixar do estoque
            </button>
          </div>
        }
      >
        <form id="form-uso-rotina" noValidate onSubmit={confirmar} className="space-y-4 pt-1">
          <Erro texto={erro} />
          <p className="text-sm text-dark/70">
            Escolha {tipo === "sal" ? "o sal" : "o remédio"} que foi usado e quantos {un.plural} saíram do estoque. Pode usar
            decimal (ex.: 1,5).
          </p>

          {recursos !== undefined && recursos.length === 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Você ainda não tem {tipo === "sal" ? "suplemento" : "remédio"} cadastrado no estoque.
            </p>
          )}

          <ul className="space-y-3">
            {linhas.map((l, i) => {
              const sel = recursos?.find((r) => r.id === l.recursoId);
              return (
                <li key={i} className="space-y-2 rounded-xl border border-brand-200 bg-white p-3">
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`uso-item-${i}`} className="field-label">
                        {tipo === "sal" ? "Suplemento" : "Remédio"}
                      </label>
                      <select
                        id={`uso-item-${i}`}
                        className="field"
                        value={l.recursoId}
                        onChange={(e) => mudar(i, { recursoId: e.target.value })}
                      >
                        <option value="">Escolha</option>
                        {recursos?.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nome} ({formatarUnidades(r.estoque, r.tipo)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24 shrink-0">
                      <label htmlFor={`uso-qtd-${i}`} className="field-label">
                        {un.plural}
                      </label>
                      <input
                        id={`uso-qtd-${i}`}
                        className="field text-center"
                        inputMode="decimal"
                        placeholder="0"
                        value={l.qtd}
                        onChange={(e) => mudar(i, { qtd: e.target.value })}
                      />
                    </div>
                    {linhas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLinhas((a) => a.filter((_, k) => k !== i))}
                        aria-label="Tirar esta linha"
                        className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-dark/40 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash size={18} />
                      </button>
                    )}
                  </div>
                  {sel && <p className="text-xs text-dark/55">Em estoque: {formatarUnidades(sel.estoque, sel.tipo)}</p>}
                </li>
              );
            })}
          </ul>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLinhas((a) => [...a, { recursoId: "", qtd: "" }])}
              className="btn-secondary min-h-11 flex-1 px-3 text-sm"
            >
              <Plus size={16} weight="bold" />
              Outro item
            </button>
            <button type="button" onClick={() => setCadastrando(linhas.length > 0 ? linhas.length - 1 : 0)} className="btn-secondary min-h-11 flex-1 px-3 text-sm">
              <Plus size={16} weight="bold" />
              Cadastrar novo
            </button>
          </div>
        </form>
      </BottomSheet>

      <RecursoFormSheet
        open={cadastrando !== null}
        tipo={tipoRecurso}
        onClose={() => setCadastrando(null)}
        onCreated={(r) => {
          // O item recém-cadastrado já fica escolhido na primeira linha ainda sem item.
          setLinhas((a) => {
            const vazia = a.findIndex((l) => !l.recursoId);
            const alvo = vazia >= 0 ? vazia : a.length - 1;
            return a.map((l, k) => (k === alvo ? { ...l, recursoId: r.id } : l));
          });
        }}
      />
    </>
  );
}
