"use client";

import { useEffect } from "react";
import { lerConfiguracao } from "@/lib/config";
import { apagarTarefasFeitasAntigas } from "@/lib/pastos";

/** Ao abrir o app, apaga as tarefas feitas que passaram do tempo escolhido no Perfil. */
export function ManutencaoAutomatica() {
  useEffect(() => {
    apagarTarefasFeitasAntigas(lerConfiguracao().apagarTarefasFeitasDias).catch(() => {
      // a limpeza é opcional: se falhar, tenta de novo na próxima vez que o app abrir
    });
  }, []);
  return null;
}
