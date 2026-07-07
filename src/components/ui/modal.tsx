"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Alinha o conteúdo na base da tela (estilo drawer), útil para mobile. */
  align?: "center" | "bottom";
}

export function Modal({ open, onClose, children, className, align = "center" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-black/50 animate-fade-in",
        align === "center" ? "items-center justify-center p-4" : "items-end justify-center sm:items-center sm:p-4"
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "relative w-full bg-white shadow-xl",
          align === "bottom"
            ? "animate-slide-up rounded-t-2xl sm:max-w-lg sm:rounded-2xl sm:animate-fade-in"
            : "max-w-lg rounded-2xl",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 rounded-full bg-neutral-100 p-1.5 text-neutral-600 hover:bg-neutral-200"
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
