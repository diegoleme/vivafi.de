import type { Activity, Recurrence } from './schema.ts';

/**
 * Sugere um ID semântico e determinístico para uma atividade.
 *
 * Determinístico de propósito: o conversor da T11 vai gerar IDs para as 113
 * paróquias da diocese, e rodar de novo precisa produzir exatamente os mesmos
 * IDs — senão toda reimportação quebraria as exceções existentes.
 *
 * Formato: `<comunidade>-<tipo>-<quando>-<hora>` — ex.: `matriz-mass-sun-0830`.
 */

const ABREV_DIA = {
  sunday: 'sun', monday: 'mon', tuesday: 'tue', wednesday: 'wed',
  thursday: 'thu', friday: 'fri', saturday: 'sat',
} as const;

function quando(r: Recurrence): string {
  switch (r.type) {
    case 'weekly':
      return r.day.map((d) => ABREV_DIA[d]).join('-');
    case 'monthly-ordinal':
      return `${r.ordinal === 'last' ? 'last' : r.ordinal}${ABREV_DIA[r.day]}`;
    case 'monthly-day':
      return `d${r.dayOfMonth}`;
    case 'described':
      return 'desc';
  }
}

export function suggestActivityId(
  communityId: string,
  activity: Pick<Activity, 'kind' | 'recurrence' | 'startsAt'>,
): string {
  const hora = activity.startsAt?.replace(':', '') ?? '';
  return [communityId, activity.kind, quando(activity.recurrence), hora].filter(Boolean).join('-');
}

/** Resolve colisões acrescentando sufixo numérico, preservando a ordem de entrada. */
export function uniqueActivityIds(sugestoes: string[]): string[] {
  const usados = new Map<string, number>();
  return sugestoes.map((base) => {
    const n = usados.get(base) ?? 0;
    usados.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  });
}
