import { PageHeader } from "@/components/layout/PageHeader";
import { CurrencyCircleDollar } from "@phosphor-icons/react/dist/ssr";

export default function FinancasPage() {
  return (
    <>
      <PageHeader title="Finanças" subtitle="Gastos, compras e vendas" />
      <div className="px-4">
        <div className="card flex flex-col items-center py-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
            <CurrencyCircleDollar size={36} weight="duotone" className="text-brand-700" />
          </div>
          <h2 className="text-xl font-bold text-dark">Em construção</h2>
          <p className="mt-1 max-w-xs text-sm text-dark/60">
            Aqui você vai ver compras e vendas de gado, os gastos do mês e os gráficos por pasto.
          </p>
        </div>
      </div>
    </>
  );
}
