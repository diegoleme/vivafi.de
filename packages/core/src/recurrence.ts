import { addDays, isLastWeekdayInMonth, ordinalInMonth, weekdayOf, dayOfMonthOf, type IsoDate } from './calendar.ts';
import type { Recurrence } from './schema.ts';

/**
 * A atividade acontece nesta data?
 *
 * `described` sempre devolve `false`: "Antes das Santas Missas" é exibido como
 * texto, nunca calculado. Fingir que dá para agendar seria mentir (D7).
 */
export function occursOn(recurrence: Recurrence, date: IsoDate): boolean {
  switch (recurrence.type) {
    case 'weekly':
      return recurrence.day.includes(weekdayOf(date));

    case 'monthly-ordinal': {
      if (recurrence.day !== weekdayOf(date)) return false;
      return recurrence.ordinal === 'last'
        ? isLastWeekdayInMonth(date)
        : ordinalInMonth(date) === recurrence.ordinal;
    }

    /**
     * Sem ajuste para mês curto: "todo dia 31" simplesmente não ocorre em
     * fevereiro. Empurrar para o dia 28 seria inventar uma missa que ninguém
     * marcou — e inventar é a única coisa que a D7 proíbe sem exceção.
     */
    case 'monthly-day':
      return dayOfMonthOf(date) === recurrence.dayOfMonth;

    case 'described':
      return false;
  }
}

/**
 * A próxima data, a partir de `from` (incluída), em que a recorrência ocorre.
 *
 * `maxDays` cobre o pior caso real com folga. O pior não é "todo dia 31" (62
 * dias): é o **5º dia da semana do mês**, que some em meses de 28 a 30 dias —
 * entre 31/01/2021 e 30/05/2021 passam-se **119 dias** sem nenhum 5º domingo.
 * Medido varrendo 2020–2060 nos sete dias da semana.
 *
 * Devolve `null` para `described`, que não tem data.
 */
export function nextOccurrence(recurrence: Recurrence, from: IsoDate, maxDays = 125): IsoDate | null {
  if (recurrence.type === 'described') return null;
  for (let i = 0; i <= maxDays; i++) {
    const date = addDays(from, i);
    if (occursOn(recurrence, date)) return date;
  }
  return null;
}
