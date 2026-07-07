/** Converte texto livre em slug ("Pastéis de Brócolis" → "pasteis-de-brocolis"). */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** "PEDIDO #001" — sempre 3 dígitos, como impresso na comanda. */
export function formatOrderNumber(orderNumber: number): string {
  return `#${String(orderNumber).padStart(3, "0")}`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** "agora mesmo" / "há 5 minutos" / "há 2 horas" — para o painel da cozinha. */
export function formatRelativeTime(date: Date | string): string {
  const target = new Date(date).getTime();
  const diffMs = Date.now() - target;

  if (diffMs < MINUTE_MS) return "agora mesmo";

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return `há ${minutes} minuto${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(diffMs / HOUR_MS);
  return `há ${hours} hora${hours === 1 ? "" : "s"}`;
}
