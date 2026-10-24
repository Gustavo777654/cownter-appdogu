import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (valor: T) => void;
  /** Classes de cor do botão selecionado, por opção. */
  cores?: Partial<Record<T, string>>;
}

/** Grupo de botões de escolha única (uma opção sempre selecionada). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  cores,
}: SegmentedProps<T>) {
  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((op) => {
          const ativo = op === value;
          return (
            <button
              key={op}
              type="button"
              onClick={() => onChange(op)}
              aria-pressed={ativo}
              className={cn(
                "h-12 rounded-xl border text-base font-semibold transition-colors",
                ativo
                  ? (cores?.[op] ?? "border-brand-600 bg-brand-600 text-white")
                  : "border-brand-200 bg-white text-dark/70"
              )}
            >
              {op}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
