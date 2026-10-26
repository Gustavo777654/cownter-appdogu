import withSerwistInit from "@serwist/next";
import { randomUUID } from "node:crypto";

// Cada build gera uma nova "revisão" para as páginas pré-armazenadas em cache,
// assim o app instalado atualiza o conteúdo quando uma nova versão é publicada.
const revision = randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // O service worker só roda no build de produção (npm run build && npm start).
  disable: process.env.NODE_ENV === "development",
  // Por padrão o Serwist recarrega a página quando a internet volta. Para o produtor isso é
  // ruim: se o sinal voltar no meio do cadastro de um animal, a página recarregaria e ele
  // perderia o que digitou. Como tudo já é guardado no aparelho, não há por que recarregar.
  reloadOnOnline: false,
  // Páginas do app disponíveis offline desde a primeira visita.
  additionalPrecacheEntries: [
    { url: "/", revision },
    { url: "/login", revision },
    { url: "/inicio", revision },
    { url: "/gado", revision },
    { url: "/lote", revision },
    { url: "/pastos", revision },
    { url: "/pasto", revision },
    { url: "/recursos", revision },
    { url: "/financas", revision },
    { url: "/perfil", revision },
    { url: "/manifest.webmanifest", revision },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withSerwist(nextConfig);
