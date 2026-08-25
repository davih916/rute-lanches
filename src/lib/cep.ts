/** Só os dígitos do CEP, sem hífen/espaço. */
export function sanitizeCep(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

/** "00000-000" a partir dos dígitos — usado só pra exibição/máscara no input. */
export function formatCep(digits: string): string {
  const clean = sanitizeCep(digits);
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
}

export function isValidCep(digits: string): boolean {
  return /^\d{8}$/.test(digits);
}
