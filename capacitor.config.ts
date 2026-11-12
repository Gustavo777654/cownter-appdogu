import type { CapacitorConfig } from "@capacitor/cli";

// O app instalado (APK) abre o Cownter publicado na web: assim cada melhoria chega para todos
// sem precisar instalar um APK novo. Depois do primeiro acesso, o próprio app guarda tudo no
// aparelho e funciona sem internet. O endereço vem da variável COWNTER_URL (veja o workflow).
const url = process.env.COWNTER_URL?.replace(/\/+$/, "");

const config: CapacitorConfig = {
  appId: "br.com.cownter.app",
  appName: "Cownter",
  webDir: "capacitor-www",
  backgroundColor: "#faf7f2",
  ...(url ? { server: { url, cleartext: false, errorPath: "index.html" } } : {}),
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_cownter",
      iconColor: "#16a34a",
    },
  },
};

export default config;
