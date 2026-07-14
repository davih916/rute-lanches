import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { getSettingsSafe } from "@/lib/services/settings-service";

// Sem isso, Next renderiza a árvore inteira como estática no build,
// congelando dados mutáveis (loja aberta/fechada, cores, cardápio).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsSafe();
  return {
    title: settings.storeName,
    description: `Peça online na ${settings.storeName}`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSettingsSafe();

  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <style
          // Cores da marca vêm do banco (Settings) para que o mesmo código
          // sirva qualquer lanchonete apenas trocando esses valores.
          dangerouslySetInnerHTML={{
            __html: `:root { --brand-primary: ${settings.primaryColor}; --brand-secondary: ${settings.secondaryColor}; }`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
