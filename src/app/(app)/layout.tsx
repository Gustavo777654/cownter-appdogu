import { AuthGuard } from "@/components/layout/AuthGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { ManutencaoAutomatica } from "@/components/layout/ManutencaoAutomatica";
import { OfflineBanner } from "@/components/layout/OfflineBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ManutencaoAutomatica />
      <div className="mx-auto min-h-dvh max-w-lg">
        <OfflineBanner />
        {/* Espaço reservado para a barra inferior */}
        <main className="pb-28">{children}</main>
      </div>
      <BottomNav />
    </AuthGuard>
  );
}
