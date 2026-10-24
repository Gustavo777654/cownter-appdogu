"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Painel que sobe da parte de baixo da tela: o padrão de formulário no celular. */
export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-dark/50"
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg animate-sheet-up flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-dark/15" />
        <header className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-xl font-bold text-dark">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-dark/60 hover:bg-dark/5"
          >
            <X size={22} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-brand-100 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
