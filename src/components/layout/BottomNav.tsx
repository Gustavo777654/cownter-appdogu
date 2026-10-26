"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CurrencyCircleDollar, Cow, House, Package, Plant } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const ITENS = [
  { href: "/inicio", label: "Início", Icon: House, tambem: [] as string[] },
  // A tela de um lote de gado (/lote) também conta como "Gado".
  { href: "/gado", label: "Gado", Icon: Cow, tambem: ["/lote"] },
  // A tela de um pasto (/pasto) também conta como "Pastos".
  { href: "/pastos", label: "Pastos", Icon: Plant, tambem: ["/pasto"] },
  { href: "/recursos", label: "Recursos", Icon: Package, tambem: [] as string[] },
  { href: "/financas", label: "Finanças", Icon: CurrencyCircleDollar, tambem: [] as string[] },
];

/** Navegação principal: fica na base da tela, ao alcance do polegar. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITENS.map(({ href, label, Icon, tambem }) => {
          const ativo = [href, ...tambem].some((r) => pathname === r || pathname.startsWith(`${r}/`));
          return (
            <li key={href} className="flex-1">
              <Link prefetch={false}
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  ativo ? "text-brand-700" : "text-dark/50 hover:text-dark/80"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    ativo && "bg-brand-100"
                  )}
                >
                  <Icon size={24} weight={ativo ? "fill" : "regular"} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
