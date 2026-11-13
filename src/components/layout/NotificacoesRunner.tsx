"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/db";
import { ehAppNativo, pedirPermissaoDeNotificacoes, permissaoDeNotificacoes, reagendarNotificacoes } from "@/lib/notificacoes";

const ESPERA_MS = 3000;

/** No app Android: pede permissão uma vez, agenda os avisos e abre o Início ao tocar neles. */
export function NotificacoesRunner() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Muda quando qualquer dado que gera aviso muda (conta, assim, itens e datas).
  const assinatura = useLiveQuery(async () => {
    const [p, t, pa, l, r, u] = await Promise.all([db.pastos.count(), db.tarefas.count(), db.partos.count(), db.lotesGado.count(), db.recursos.count(), db.usosRecurso.count()]);
    const ult = async (tabela: "pastos" | "tarefas" | "partos" | "lotesGado" | "recursos" | "usosRecurso") =>
      (await db.table(tabela).orderBy("updatedAt").last())?.updatedAt ?? "";
    return [p, t, pa, l, r, u, await ult("pastos"), await ult("tarefas"), await ult("partos"), await ult("lotesGado"), await ult("recursos"), await ult("usosRecurso")].join("|");
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !ehAppNativo()) return;
    let ativo = true;
    (async () => {
      try {
        if ((await permissaoDeNotificacoes()) === "prompt" && !localStorage.getItem("cownter.notif.pedida")) {
          localStorage.setItem("cownter.notif.pedida", "1");
          await pedirPermissaoDeNotificacoes();
        }
      } catch {
        /* sem permissão: segue sem notificações */
      }
      if (!ativo) return;
    })();
    return () => {
      ativo = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !ehAppNativo() || assinatura === undefined) return;
    const t = window.setTimeout(() => {
      reagendarNotificacoes().catch(() => undefined);
    }, ESPERA_MS);
    return () => window.clearTimeout(t);
  }, [isAuthenticated, assinatura]);

  useEffect(() => {
    if (!ehAppNativo()) return;
    let remover: (() => void) | undefined;
    LocalNotifications.addListener("localNotificationActionPerformed", () => router.push("/inicio"))
      .then((h) => {
        remover = () => void h.remove();
      })
      .catch(() => undefined);
    return () => remover?.();
  }, [router]);

  return null;
}
