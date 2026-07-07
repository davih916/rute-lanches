"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Não foi possível entrar.");
        setSubmitting(false);
        return;
      }

      const from = searchParams.get("from");
      router.replace(from && from.startsWith("/admin") ? from : "/admin/dashboard");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        name="password"
        label="Senha"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
        Entrar
      </Button>
    </form>
  );
}
