import { PageHeader } from "@/components/layout/PageHeader";
import { Package } from "@phosphor-icons/react/dist/ssr";

export default function RecursosPage() {
  return (
    <>
      <PageHeader title="Recursos" subtitle="Estoque de suplementos e remédios" />
      <div className="px-4">
        <div className="card flex flex-col items-center py-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
            <Package size={36} weight="duotone" className="text-brand-700" />
          </div>
          <h2 className="text-xl font-bold text-dark">Em construção</h2>
          <p className="mt-1 max-w-xs text-sm text-dark/60">
            Aqui você vai controlar o estoque de sal, suplementos e remédios, com o consumo por pasto.
          </p>
        </div>
      </div>
    </>
  );
}
