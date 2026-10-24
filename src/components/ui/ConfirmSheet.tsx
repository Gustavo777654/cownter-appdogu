"use client";

import { useState, type ReactNode } from "react";
import { BottomSheet } from "./BottomSheet";

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  perigoso?: boolean;
}

/** Pergunta de confirmação em painel, para ações que não dá para desfazer. */
export function ConfirmSheet({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  perigoso = true,
}: ConfirmSheetProps) {
  const [executando, setExecutando] = useState(false);

  async function confirmar() {
    setExecutando(true);
    try {
      await onConfirm();
    } finally {
      setExecutando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={executando}
            className={perigoso ? "btn-danger flex-1" : "btn-primary flex-1"}
          >
            {executando ? "Aguarde..." : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="pt-1 text-base text-dark/80">{children}</div>
    </BottomSheet>
  );
}
