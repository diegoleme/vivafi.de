import { describe, expect, test } from 'vitest';
import { describeRecurrence } from './describe.ts';

describe('recorrência em português', () => {
  test('semanal, um dia só — plural, que já implica recorrência', () => {
    expect(describeRecurrence({ type: 'weekly', day: ['sunday'] })).toBe('domingos');
    expect(describeRecurrence({ type: 'weekly', day: ['saturday'] })).toBe('sábados');
    expect(describeRecurrence({ type: 'weekly', day: ['friday'] })).toBe('sextas');
    expect(describeRecurrence({ type: 'weekly', day: ['monday'] })).toBe('segundas');
  });

  test('a mesma recorrência produz o mesmo texto na grade e na lista', () => {
    // era o defeito: a grade escrevia "quinta", a lista "toda quinta-feira"
    expect(describeRecurrence({ type: 'weekly', day: ['thursday'] })).toBe('quintas');
  });

  test('semanal, dias soltos', () => {
    expect(describeRecurrence({ type: 'weekly', day: ['friday', 'saturday'] })).toBe('sextas e sábados');
    expect(describeRecurrence({ type: 'weekly', day: ['monday', 'wednesday', 'friday'] })).toBe(
      'segundas, quartas e sextas',
    );
  });

  test('semanal, sequência corrida vira intervalo', () => {
    expect(
      describeRecurrence({ type: 'weekly', day: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] }),
    ).toBe('segunda a sexta');
  });

  test('ordem do array não muda o texto', () => {
    expect(describeRecurrence({ type: 'weekly', day: ['saturday', 'friday'] })).toBe('sextas e sábados');
  });

  test('mensal ordinal — o caso que motivou o projeto', () => {
    expect(describeRecurrence({ type: 'monthly-ordinal', ordinal: 1, day: 'friday' })).toBe(
      '1ª sexta-feira do mês',
    );
    expect(describeRecurrence({ type: 'monthly-ordinal', ordinal: 4, day: 'thursday' })).toBe(
      '4ª quinta-feira do mês',
    );
    expect(describeRecurrence({ type: 'monthly-ordinal', ordinal: 1, day: 'saturday' })).toBe(
      '1º sábado do mês',
    );
    expect(describeRecurrence({ type: 'monthly-ordinal', ordinal: 'last', day: 'saturday' })).toBe(
      'último sábado do mês',
    );
    expect(describeRecurrence({ type: 'monthly-ordinal', ordinal: 'last', day: 'friday' })).toBe(
      'última sexta-feira do mês',
    );
  });

  test('dia fixo e texto livre', () => {
    expect(describeRecurrence({ type: 'monthly-day', dayOfMonth: 19 })).toBe('todo dia 19');
    expect(describeRecurrence({ type: 'described', text: 'Antes das Santas Missas' })).toBe(
      'Antes das Santas Missas',
    );
  });
});
