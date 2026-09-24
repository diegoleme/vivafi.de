import { WEEKDAYS, type Weekday } from './schema.ts';

/**
 * Data de calendário como `AAAA-MM-DD`.
 *
 * O risco Alto do plano é publicar missa no dia errado. A origem desse risco é
 * misturar "instante no tempo" com "dia do calendário": o build roda em UTC no
 * Cloudflare, e às 23h de São Paulo o `Date` local já virou o dia seguinte.
 *
 * A defesa aqui é estrutural, não é cuidado: **nada neste módulo lê o fuso do
 * sistema**. Recorrência é sobre dia do calendário, e dia do calendário é uma
 * string. O fuso só entra em `todayIn` e `timeNowIn`, onde é passado explicitamente.
 */
export type IsoDate = string;

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

function partes(date: IsoDate): [number, number, number] {
  const m = FORMATO.exec(date);
  if (!m) throw new Error(`data inválida: "${date}" (esperado AAAA-MM-DD)`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** UTC de propósito: é só aritmética de calendário, sem instante real envolvido. */
function utc(date: IsoDate): Date {
  const [y, m, d] = partes(date);
  return new Date(Date.UTC(y, m - 1, d));
}

export function weekdayOf(date: IsoDate): Weekday {
  return WEEKDAYS[utc(date).getUTCDay()]!;
}

export function dayOfMonthOf(date: IsoDate): number {
  return partes(date)[2];
}

export function daysInMonthOf(date: IsoDate): number {
  const [y, m] = partes(date);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 1 para o primeiro sábado do mês, 2 para o segundo, e assim por diante. */
export function ordinalInMonth(date: IsoDate): number {
  return Math.floor((dayOfMonthOf(date) - 1) / 7) + 1;
}

/** Verdadeiro quando não há outra ocorrência do mesmo dia da semana no mês. */
export function isLastWeekdayInMonth(date: IsoDate): boolean {
  return dayOfMonthOf(date) + 7 > daysInMonthOf(date);
}

export function addDays(date: IsoDate, n: number): IsoDate {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function parte(partes: Intl.DateTimeFormatPart[], tipo: Intl.DateTimeFormatPartTypes): string {
  const p = partes.find((x) => x.type === tipo);
  if (!p) throw new Error(`Intl não devolveu "${tipo}"`);
  return p.value;
}

/** O dia do calendário **na paróquia**, independente de onde o build rodou. */
export function todayIn(timezone: string, now: Date = new Date()): IsoDate {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return `${parte(p, 'year')}-${parte(p, 'month')}-${parte(p, 'day')}`;
}

/** A hora **na paróquia**, como `HH:MM`, comparável com `startsAt`. */
export function timeNowIn(timezone: string, now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return `${parte(p, 'hour')}:${parte(p, 'minute')}`;
}
