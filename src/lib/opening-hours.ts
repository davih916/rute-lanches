export const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  dom: "Domingo",
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
};

export interface DaySchedule {
  enabled: boolean;
  open: string; // "HH:mm"
  close: string; // "HH:mm"
}

export type WeeklySchedule = Record<Weekday, DaySchedule>;

// Fuso fixo da loja — evita depender do TZ do servidor onde a aplicação roda.
const STORE_TIMEZONE = "America/Sao_Paulo";

const EN_WEEKDAY_TO_KEY: Record<string, Weekday> = {
  Sun: "dom",
  Mon: "seg",
  Tue: "ter",
  Wed: "qua",
  Thu: "qui",
  Fri: "sex",
  Sat: "sab",
};

export function defaultDaySchedule(): DaySchedule {
  return { enabled: true, open: "18:00", close: "23:00" };
}

export function defaultWeeklySchedule(): WeeklySchedule {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, defaultDaySchedule()])) as WeeklySchedule;
}

/**
 * `Settings.openingHours` é `"{}"` até o admin configurar horários pela primeira vez —
 * nesse caso não há restrição de horário (só o toggle manual `storeOpen` vale).
 */
export function parseWeeklySchedule(raw: string): WeeklySchedule | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0) return null;
    return parsed as WeeklySchedule;
  } catch {
    return null;
  }
}

function getNowInStoreTimezone(): { weekday: Weekday; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

  return { weekday: EN_WEEKDAY_TO_KEY[weekdayShort] ?? "dom", time: `${hour}:${minute}` };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Verifica só o horário configurado (ignora o toggle manual `storeOpen`). */
export function isWithinOpeningHours(openingHoursJson: string): boolean {
  const schedule = parseWeeklySchedule(openingHoursJson);
  if (!schedule) return true; // sem horário configurado — não restringe

  const { weekday, time } = getNowInStoreTimezone();
  const day = schedule[weekday];
  if (!day || !day.enabled) return false;

  const nowMinutes = timeToMinutes(time);
  const openMinutes = timeToMinutes(day.open);
  const closeMinutes = timeToMinutes(day.close);

  if (closeMinutes > openMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }
  // Horário que passa da meia-noite (ex: 18:00–02:00).
  return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
}

/** Estado real da loja: toggle manual (pausa imediata) + horário de funcionamento configurado. */
export function isStoreOpenNow(settings: { storeOpen: boolean; openingHours: string }): boolean {
  if (!settings.storeOpen) return false;
  return isWithinOpeningHours(settings.openingHours);
}
