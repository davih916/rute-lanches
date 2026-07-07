/** Formata um valor em centavos para "R$ 12,90". */
export function formatCentsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Converte um valor em reais (ex: "12.90", "12,90" ou "1.234,56") para centavos.
 * O último separador (vírgula ou ponto) é tratado como decimal; os demais,
 * como separadores de milhar — assim aceita tanto "5.00" (toFixed) quanto
 * "5,00" (formato brasileiro) sem ambiguidade.
 */
export function reaisToCents(value: string | number): number {
  if (typeof value === "number") return Math.round(value * 100);

  const cleaned = value.trim().replace(/[^0-9,.-]/g, "");
  if (!cleaned) return 0;

  const lastSeparator = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  const normalized =
    lastSeparator === -1
      ? cleaned
      : `${cleaned.slice(0, lastSeparator).replace(/[,.]/g, "")}.${cleaned
          .slice(lastSeparator + 1)
          .replace(/[,.]/g, "")}`;

  const parsed = parseFloat(normalized);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}
