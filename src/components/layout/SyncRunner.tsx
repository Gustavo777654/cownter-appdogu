"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnline, usePendentesSync } from "@/lib/hooks";
import { sincronizar } from "@/lib/sync";

const INTERVALO_MS = 60_000;
const ESPERA_APOS_MUDANCA_MS = 2_000;

/** Mantém o aparelho sincronizado com a nuvem enquanto o app está aberto e há internet. */
export function SyncRunner() {
  const { user, nuvem } = useAuth();
  const online = useOnline();
  const pendentes = usePendentesSync();
  const fazendaId = user?.fazendaId;
  const ativo = nuvem && online && !!fazendaId;
  const idRef = useRef(fazendaId);
  idRef.current = fazendaId;

  // Ao abrir, ao voltar a internet, ao voltar para o app e a cada minuto.
  useEffect(() => {
    if (!ativo) return;
    const rodar = () => {
      if (idRef.current) void sincronizar(idRef.current);
    };
    rodar();
    const timer = window.setInterval(rodar, INTERVALO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") rodar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [ativo]);

  // Logo depois de qualquer alteração feita no aparelho.
  useEffect(() => {
    if (!ativo || !pendentes) return;
    const t = window.setTimeout(() => {
      if (idRef.current) void sincronizar(idRef.current);
    }, ESPERA_APOS_MUDANCA_MS);
    return () => window.clearTimeout(t);
  }, [ativo, pendentes]);

  return null;
}
