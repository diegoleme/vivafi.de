import { describe, expect, test } from 'vitest';
import { addDays, dayOfMonthOf, weekdayOf, type IsoDate } from './calendar.ts';
import { nextOccurrence, occursOn } from './recurrence.ts';
import type { Recurrence } from './schema.ts';

/** Todas as datas de 2026 em que a recorrência ocorre. */
function datasEm2026(r: Recurrence): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d: IsoDate = '2026-01-01'; d <= '2026-12-31'; d = addDays(d, 1)) {
    if (occursOn(r, d)) out.push(d);
  }
  return out;
}

describe('casos reais extraídos da Diocese de Campo Limpo', () => {
  test('"1ª Sexta-feira do mês às 19h30" — 12 vezes no ano, sempre sexta, sempre no dia 1–7', () => {
    const datas = datasEm2026({ type: 'monthly-ordinal', ordinal: 1, day: 'friday' });
    expect(datas).toHaveLength(12);
    expect(datas.every((d) => weekdayOf(d) === 'friday')).toBe(true);
    expect(datas.every((d) => dayOfMonthOf(d) <= 7)).toBe(true);
    expect(datas[0]).toBe('2026-01-02');
    expect(datas).toContain('2026-05-01');
  });

  test('"1º, 3º e 5º Domingo às 11h" — o 5º só cai em mês que tem cinco domingos', () => {
    const quinto = datasEm2026({ type: 'monthly-ordinal', ordinal: 5, day: 'sunday' });
    expect(quinto.every((d) => weekdayOf(d) === 'sunday')).toBe(true);
    expect(quinto.every((d) => dayOfMonthOf(d) >= 29)).toBe(true);
    // Menos de 12: em mês de quatro domingos a missa simplesmente não acontece.
    expect(quinto.length).toBeLessThan(12);
    expect(quinto.length).toBeGreaterThan(0);
  });

  test('5º não é "último": em mês de quatro domingos, "último" celebra e "5º" não', () => {
    const quinto = datasEm2026({ type: 'monthly-ordinal', ordinal: 5, day: 'sunday' });
    const ultimo = datasEm2026({ type: 'monthly-ordinal', ordinal: 'last', day: 'sunday' });
    expect(ultimo).toHaveLength(12);
    // Todo 5º domingo é também o último; o contrário é falso.
    expect(quinto.every((d) => ultimo.includes(d))).toBe(true);
    expect(ultimo.some((d) => !quinto.includes(d))).toBe(true);
  });

  test('`nextOccurrence` alcança o próximo 5º domingo — o vão chega a 119 dias', () => {
    // 31/01/2021 → 30/05/2021 é o pior intervalo entre dois 5º <dia> (2020–2060).
    expect(nextOccurrence({ type: 'monthly-ordinal', ordinal: 5, day: 'sunday' }, '2021-02-01'))
      .toBe('2021-05-30');
  });

  test('"3º Domingo às 17h" — 12 vezes, sempre domingo, sempre no dia 15–21', () => {
    const datas = datasEm2026({ type: 'monthly-ordinal', ordinal: 3, day: 'sunday' });
    expect(datas).toHaveLength(12);
    expect(datas.every((d) => weekdayOf(d) === 'sunday')).toBe(true);
    expect(datas.every((d) => dayOfMonthOf(d) >= 15 && dayOfMonthOf(d) <= 21)).toBe(true);
  });

  test('"4º Sábado do mês às 18h" — 12 vezes, e nunca no 5º sábado', () => {
    const datas = datasEm2026({ type: 'monthly-ordinal', ordinal: 4, day: 'saturday' });
    expect(datas).toHaveLength(12);
    expect(datas.every((d) => dayOfMonthOf(d) >= 22 && dayOfMonthOf(d) <= 28)).toBe(true);
  });

  test('"Todo dia 19 do mês às 20h" — 12 vezes, sempre no dia 19', () => {
    const datas = datasEm2026({ type: 'monthly-day', dayOfMonth: 19 });
    expect(datas).toHaveLength(12);
    expect(datas.every((d) => dayOfMonthOf(d) === 19)).toBe(true);
  });

  test('"Todo dia 28" ocorre também em fevereiro', () => {
    expect(datasEm2026({ type: 'monthly-day', dayOfMonth: 28 })).toContain('2026-02-28');
  });

  test('missa de semana com vários dias — 5 por semana', () => {
    const datas = datasEm2026({
      type: 'weekly',
      day: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    });
    expect(datas).toHaveLength(261); // 2026 tem 261 dias úteis
    expect(datas).not.toContain('2026-01-03'); // sábado
  });
});

describe('o que não pode acontecer', () => {
  test('"último sábado" nunca coincide com o 4º quando existe um 5º', () => {
    const ultimo = datasEm2026({ type: 'monthly-ordinal', ordinal: 'last', day: 'saturday' });
    const quarto = datasEm2026({ type: 'monthly-ordinal', ordinal: 4, day: 'saturday' });
    expect(ultimo).toHaveLength(12);

    // Em meses com 5 sábados, "último" e "4º" caem em datas diferentes.
    const cincoSabados = ultimo.filter((d) => dayOfMonthOf(d) >= 29);
    expect(cincoSabados.length).toBeGreaterThan(0);
    for (const d of cincoSabados) expect(quarto).not.toContain(d);
  });

  test('"todo dia 31" simplesmente não ocorre em fevereiro — não é empurrado para o dia 28', () => {
    const datas = datasEm2026({ type: 'monthly-day', dayOfMonth: 31 });
    expect(datas.every((d) => d.slice(5, 7) !== '02')).toBe(true);
    expect(datas).toHaveLength(7); // jan, mar, mai, jul, ago, out, dez
  });

  test('"described" nunca é agendada — é texto, não horário', () => {
    expect(datasEm2026({ type: 'described', text: 'Antes das Santas Missas' })).toEqual([]);
  });

  test('nenhuma recorrência mensal dispara mais de uma vez no mesmo mês', () => {
    for (const r of [
      { type: 'monthly-ordinal', ordinal: 2, day: 'thursday' },
      { type: 'monthly-ordinal', ordinal: 'last', day: 'friday' },
      { type: 'monthly-day', dayOfMonth: 19 },
    ] as const) {
      const meses = datasEm2026(r).map((d) => d.slice(0, 7));
      expect(new Set(meses).size).toBe(meses.length);
    }
  });
});

describe('próxima ocorrência', () => {
  test('acha o dia certo para cada tipo', () => {
    // 2026-09-22 é uma terça-feira
    expect(nextOccurrence({ type: 'weekly', day: ['sunday'] }, '2026-09-22')).toBe('2026-09-27');
    expect(nextOccurrence({ type: 'monthly-ordinal', ordinal: 4, day: 'thursday' }, '2026-09-22')).toBe('2026-09-24');
    expect(nextOccurrence({ type: 'monthly-ordinal', ordinal: 1, day: 'friday' }, '2026-09-22')).toBe('2026-10-02');
    expect(nextOccurrence({ type: 'monthly-day', dayOfMonth: 19 }, '2026-09-22')).toBe('2026-10-19');
  });

  test('inclui o próprio dia quando ele já serve', () => {
    expect(nextOccurrence({ type: 'weekly', day: ['tuesday'] }, '2026-09-22')).toBe('2026-09-22');
  });

  test('"todo dia 31" atravessa fevereiro sem se perder', () => {
    expect(nextOccurrence({ type: 'monthly-day', dayOfMonth: 31 }, '2026-02-01')).toBe('2026-03-31');
  });

  test('"described" não tem próxima data', () => {
    expect(nextOccurrence({ type: 'described', text: 'Antes das missas' }, '2026-09-22')).toBeNull();
  });
});
