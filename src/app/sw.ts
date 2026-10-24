import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Service worker do Cownter: guarda o app (páginas, scripts, fontes e ícones)
// no aparelho para que ele abra e funcione sem internet.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // A tela de um pasto é "/lote?id=...". Sem isto, cada pasto seria uma página diferente
  // para o cache e só abriria offline se já tivesse sido visitado online antes.
  // Ignorando o "?...", qualquer pasto abre a partir da página guardada.
  precacheOptions: { ignoreURLParametersMatching: [/.*/] },
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
