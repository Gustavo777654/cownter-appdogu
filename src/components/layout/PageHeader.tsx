import type { ReactNode } from "react";
import { PerfilLink } from "./PerfilLink";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="px-4 pb-3 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold leading-tight text-dark">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-dark/60">{subtitle}</p>}
        </div>
        <PerfilLink />
      </div>
      {children}
    </header>
  );
}
