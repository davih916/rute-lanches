"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ClientLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(null); setLoading(true);
    try {
      const response = await fetch("/api/client/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível entrar agora."); return; }
      const from = searchParams.get("from");
      router.replace(from?.startsWith("/cliente") ? from : "/cliente/painel"); router.refresh();
    } catch { setError("Falha de conexão. Tente novamente."); } finally { setLoading(false); }
  }

  return <form onSubmit={submit} className="space-y-5" noValidate>
    <div className="space-y-2"><label htmlFor="email" className="text-sm font-semibold text-neutral-700">E-mail</label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-3 size-5 text-neutral-400"/><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="voce@empresa.com" className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-11 pr-3 text-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/10" /></div></div>
    <div className="space-y-2"><div className="flex items-center justify-between"><label htmlFor="password" className="text-sm font-semibold text-neutral-700">Senha</label><Link href="/cliente/esqueci-senha" className="text-sm font-medium text-[var(--brand-primary)] hover:underline">Esqueci minha senha</Link></div><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-3 size-5 text-neutral-400"/><input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Sua senha" className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-11 pr-11 text-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/10"/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700">{showPassword ? <EyeOff className="size-5"/> : <Eye className="size-5"/>}</button></div></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
    <Button type="submit" size="lg" loading={loading} className="w-full rounded-xl">Entrar</Button>
  </form>;
}
