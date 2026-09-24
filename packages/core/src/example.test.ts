import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  ACTIVITY_KINDS,
  COMMUNITY_STATUSES,
  parishSchema,
  type Parish,
} from './schema.ts';

/**
 * `examples/parish-complete.json` é o arquivo de referência do schema.
 *
 * Estes testes existem para que ele não apodreça: se o schema ganhar um `kind`,
 * um `status` ou uma ação nova, o exemplo falha até cobrir. Exemplo desatualizado
 * é pior que exemplo nenhum — ensina errado com ar de autoridade.
 */
const EXEMPLO = new URL('../examples/parish-complete.json', import.meta.url);
const bruto: unknown = JSON.parse(readFileSync(EXEMPLO, 'utf8'));

let parsed: Parish;

describe('exemplo de referência', () => {
  test('valida contra o schema', () => {
    const r = parishSchema.safeParse(bruto);
    if (!r.success) {
      throw new Error(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    }
    parsed = r.data;
  });

  test('cobre todos os tipos de atividade', () => {
    const usados = new Set(parsed.communities.flatMap((c) => c.activities.map((a) => a.kind)));
    expect([...ACTIVITY_KINDS].filter((k) => !usados.has(k))).toEqual([]);
  });

  test('cobre todos os estados de comunidade (D19)', () => {
    const usados = new Set(parsed.communities.map((c) => c.status));
    expect([...COMMUNITY_STATUSES].filter((s) => !usados.has(s))).toEqual([]);
  });

  test('cobre os quatro tipos de recorrência (D17 + `described`)', () => {
    const usados = new Set(parsed.communities.flatMap((c) => c.activities.map((a) => a.recurrence.type)));
    expect([...usados].sort()).toEqual(['described', 'monthly-day', 'monthly-ordinal', 'weekly']);
  });

  test('cobre `day` singular e em array, e o ordinal `last`', () => {
    const rec = parsed.communities.flatMap((c) => c.activities.map((a) => a.recurrence));
    const semanais = rec.filter((r) => r.type === 'weekly');
    expect(semanais.some((r) => r.day.length === 1)).toBe(true);
    expect(semanais.some((r) => r.day.length > 1)).toBe(true);
    expect(rec.some((r) => r.type === 'monthly-ordinal' && r.ordinal === 'last')).toBe(true);
  });

  test('cobre atividade com faixa de horário e atividade sem horário', () => {
    const ats = parsed.communities.flatMap((c) => c.activities);
    expect(ats.some((a) => a.endsAt !== undefined)).toBe(true);
    expect(ats.some((a) => a.startsAt === undefined)).toBe(true);
  });

  test('cobre as quatro ações de exceção', () => {
    const acoes = new Set(parsed.exceptions.map((e) => e.action));
    expect([...acoes].sort()).toEqual(['add', 'cancel', 'cancel-all', 'move']);
  });

  test('toda atividade tem id semântico e único na paróquia', () => {
    const ids = parsed.communities.flatMap((c) => c.activities.map((a) => a.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('matriz-mass-lastsat-0800');
    expect(ids).toContain('matriz-mass-d19-2000');
  });

  test('cobre exceção com e sem motivo (D27)', () => {
    expect(parsed.exceptions.some((e) => e.reason !== undefined)).toBe(true);
    expect(parsed.exceptions.some((e) => e.reason === undefined)).toBe(true);
  });

  test('cobre mover várias de uma vez e mover uma com horário novo', () => {
    const moves = parsed.exceptions.filter((e) => e.action === 'move');
    expect(moves.some((m) => m.activityIds.length > 1 && m.to.startsAt === undefined)).toBe(true);
    expect(moves.some((m) => m.activityIds.length === 1 && m.to.startsAt !== undefined)).toBe(true);
  });

  test('cobre cancel-all com e sem except', () => {
    const todos = parsed.exceptions.filter((e) => e.action === 'cancel-all');
    expect(todos.some((e) => e.except.length > 0)).toBe(true);
    expect(todos.some((e) => e.except.length === 0)).toBe(true);
  });

  test('cobre a fila de escalonamento com papéis distintos (D9)', () => {
    expect(parsed.escalation.length).toBeGreaterThanOrEqual(2);
    expect(new Set(parsed.escalation.map((c) => c.role)).size).toBe(parsed.escalation.length);
    expect(parsed.escalation[0]?.role).toBe('secretary');
  });

  test('cobre geolocalização e comunidade sem coordenada', () => {
    expect(parsed.communities.some((c) => c.location !== undefined)).toBe(true);
    expect(parsed.communities.some((c) => c.location === undefined)).toBe(true);
    const m = parsed.communities.find((c) => c.isMain);
    expect(m?.location?.lat).toBeLessThan(0); // hemisfério sul
  });

  test('padroeiro e festa são um dado só', () => {
    // Dois padroeiros: o exemplo cobre o caso que custou a mudança de schema (D50).
    expect(parsed.patrons).toHaveLength(2);
    expect(parsed.patrons?.every((p) => p.name)).toBe(true);
    expect(parsed.patrons?.[0]?.feast).toMatchObject({ day: 29, month: 6 });
  });

  test('não é confundível com paróquia real', () => {
    expect(parsed.name).toMatch(/exemplo/i);
  });
});
