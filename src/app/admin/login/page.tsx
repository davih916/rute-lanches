import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";
import { getSettings } from "@/lib/services/settings-service";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--brand-primary)] text-lg font-bold text-white">
            {settings.storeName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-lg font-bold text-neutral-900">Painel administrativo</h1>
          <p className="mt-1 text-sm text-neutral-500">Acesso restrito à equipe</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
