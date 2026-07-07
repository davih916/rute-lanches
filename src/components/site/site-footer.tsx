import Link from "next/link";

interface SiteFooterProps {
  storeName: string;
  address?: string | null;
  whatsapp?: string | null;
}

export function SiteFooter({ storeName, address, whatsapp }: SiteFooterProps) {
  return (
    <footer className="mt-auto border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-neutral-500">
        <p className="font-semibold text-neutral-700">{storeName}</p>
        {address && <p>{address}</p>}
        {whatsapp && <p>{whatsapp}</p>}
        <p className="mt-2">
          © {new Date().getFullYear()} {storeName}. Todos os direitos reservados.
        </p>
        <Link
          href="/admin/login"
          className="mt-4 text-xs text-neutral-300 transition-colors hover:text-neutral-400"
        >
          Admin
        </Link>
      </div>
    </footer>
  );
}
