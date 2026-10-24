import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="px-4 pb-3 pt-6">
      <h1 className="text-3xl font-bold leading-tight text-dark">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-dark/60">{subtitle}</p>}
      {children}
    </header>
  );
}
