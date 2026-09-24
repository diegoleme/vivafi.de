import { describe, expect, test } from 'vitest';
import {
  addDays, dayOfMonthOf, daysInMonthOf, isLastWeekdayInMonth,
  ordinalInMonth, timeNowIn, todayIn, weekdayOf,
} from './calendar.ts';

describe('aritmética de calendário', () => {
  test('dia da semana', () => {
    expect(weekdayOf('2026-01-01')).toBe('thursday');
    expect(weekdayOf('2026-09-22')).toBe('tuesday');
    expect(weekdayOf('2026-04-03')).toBe('friday'); // Sexta-feira Santa
  });

  test('ordinal do dia da semana dentro do mês', () => {
    expect(ordinalInMonth('2026-01-02')).toBe(1);
    expect(ordinalInMonth('2026-01-09')).toBe(2);
    expect(ordinalInMonth('2026-01-29')).toBe(5);
  });

  test('última ocorrência do dia da semana no mês', () => {
    expect(isLastWeekdayInMonth('2026-01-29')).toBe(true);
    expect(isLastWeekdayInMonth('2026-01-22')).toBe(false);
    expect(isLastWeekdayInMonth('2026-02-28')).toBe(true);
  });

  test('dias no mês, incluindo fevereiro bissexto', () => {
    expect(daysInMonthOf('2026-02-10')).toBe(28);
    expect(daysInMonthOf('2028-02-10')).toBe(29);
    expect(daysInMonthOf('2026-04-10')).toBe(30);
  });

  test('somar dias atravessa mês e ano', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('data malformada falha alto, em vez de silenciosamente', () => {
    expect(() => dayOfMonthOf('22/09/2026')).toThrow(/data inválida/);
  });
});

/**
 * O risco Alto do plano, em teste.
 *
 * Instante: 2026-09-23T02:30:00Z. Em São Paulo (UTC-3) ainda é **22 de setembro,
 * 23h30**. Um build que usasse `Date` local publicaria a missa do dia 23.
 */
describe('fuso — o dia do calendário é o da paróquia, não o do build', () => {
  const quaseMeiaNoiteEmSP = new Date('2026-09-23T02:30:00Z');

  test('23h30 em São Paulo ainda é o dia 22, mesmo já sendo dia 23 em UTC', () => {
    expect(todayIn('America/Sao_Paulo', quaseMeiaNoiteEmSP)).toBe('2026-09-22');
    expect(todayIn('UTC', quaseMeiaNoiteEmSP)).toBe('2026-09-23');
  });

  test('a hora também é a da paróquia', () => {
    expect(timeNowIn('America/Sao_Paulo', quaseMeiaNoiteEmSP)).toBe('23:30');
    expect(timeNowIn('UTC', quaseMeiaNoiteEmSP)).toBe('02:30');
  });

  test('meia-noite exata não vira 24:00', () => {
    expect(timeNowIn('America/Sao_Paulo', new Date('2026-09-23T03:00:00Z'))).toBe('00:00');
  });

  test('o resultado não depende do TZ do processo', () => {
    // `pnpm test` roda a suíte inteira sob UTC, Kiritimati (+14) e São Paulo (-3).
    // Se algo lesse o fuso do sistema, este valor mudaria entre as execuções.
    expect(todayIn('America/Sao_Paulo', quaseMeiaNoiteEmSP)).toBe('2026-09-22');
    expect(weekdayOf('2026-09-22')).toBe('tuesday');
  });
});
