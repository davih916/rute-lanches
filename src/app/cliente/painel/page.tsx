import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getClientProfile } from "@/lib/services/client-service";
import { ClientDashboard } from "@/components/client/client-dashboard";

export const metadata = { title: "Painel do cliente" };
export default async function ClientPanelPage() { const session = await getClientSession(); if (!session) redirect("/cliente/login"); const profile = await getClientProfile(session.clienteId); if (!profile) redirect("/cliente/login"); return <ClientDashboard mustChangePassword={session.mustChangePassword} profile={{ ...profile, proximoVencimento: profile.proximoVencimento?.toISOString() ?? null }} />; }
