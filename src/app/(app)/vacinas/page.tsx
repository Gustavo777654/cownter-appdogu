import { CalendarCheck, Syringe } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";

export default function VacinasPage() {
  return (
    <>
      <PageHeader title="Vacinas" subtitle="Calendário e histórico de vacinação" />

      <div className="px-4">
        <div className="card flex flex-col items-center py-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Syringe size={36} weight="duotone" className="text-amber-700" />
          </div>
          <h2 className="text-xl font-bold text-dark">Em construção</h2>
          <p className="mt-1 max-w-xs text-sm text-dark/60">
            Na próxima etapa, aqui você vai registrar as vacinas aplicadas, ver os próximos
            vencimentos e vacinar vários animais de uma vez.
          </p>
          <div className="mt-5 flex items-center gap-2 text-sm font-medium text-brand-700">
            <CalendarCheck size={20} weight="duotone" />
            Funcionará offline, como o resto do app
          </div>
        </div>
      </div>
    </>
  );
}
