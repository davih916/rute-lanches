"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PrintControllerProps {
  orderId: string;
}

/** Controla a impressão automática (ao mudar Recebido → Preparando) e o botão de reimprimir. */
export function PrintController({ orderId }: PrintControllerProps) {
  const searchParams = useSearchParams();
  const autoprint = searchParams.get("autoprint") === "1";
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!autoprint || hasTriggered.current) return;
    hasTriggered.current = true;

    fetch(`/api/orders/${orderId}/print`, { method: "POST" }).catch(() => {});

    const timer = setTimeout(() => {
      window.print();
    }, 350);

    function handleAfterPrint() {
      if (window.opener) {
        window.close();
      }
    }
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [autoprint, orderId]);

  return (
    <div className="no-print flex justify-center gap-2 p-4">
      <Link href="/admin/dashboard">
        <Button variant="outline">
          <ArrowLeft className="size-4" />
          Voltar ao painel
        </Button>
      </Link>
      <Button onClick={() => window.print()}>
        <Printer className="size-4" />
        Reimprimir
      </Button>
    </div>
  );
}
