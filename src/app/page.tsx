"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/** Entrada do app: encaminha para o login ou para o início, conforme a sessão. */
export default function Entrada() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(isAuthenticated ? "/inicio" : "/login");
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand-600" />
    </div>
  );
}
