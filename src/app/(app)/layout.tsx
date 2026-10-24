import { AuthGuard } from "@/components/layout/AuthGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { OfflineBanner } from "@/components/layout/OfflineBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="mx-auto min-h-dvh max-w-lg">
        <OfflineBanner />
        {/* Espaço reservado para a barra inferior */}
        <main className="pb-28">{children}</main>
      </div>
      <BottomNav />
    </AuthGuard>
  );
}
