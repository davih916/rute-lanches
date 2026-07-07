import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/services/settings-service";
import { Sidebar } from "@/components/admin/sidebar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    // Defensivo: o middleware já bloqueia isso, mas evita renderizar sem sessão.
    redirect("/admin/login");
  }

  const settings = await getSettings();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar adminName={session.name || session.email} storeName={settings.storeName} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
