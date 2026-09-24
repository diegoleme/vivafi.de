import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { activitiesOn, ineffectiveExceptions, splitByNow } from './schedule.ts';
import { parishSchema, type Parish } from './schema.ts';

const carregar = (rel: string): Parish =>
  parishSchema.parse(JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')));

const exemplo = carregar('../examples/parish-complete.json');
const real = carregar('../../data/catholic/br/campo-limpo/par.nsdasdores.json');

const ids = (as: { id: string }[]) => as.map((a) => a.id);
const status = (as: { id: string; status: string }[], id: string) => as.find((a) => a.id === id)?.status;

describe('dia comum', () => {
  test('domingo cruza as comunidades e ordena por horário', () => {
    // 2026-09-20 é o 3º domingo: Santa Clara celebra às 17h, além da matriz.
    const dom = activitiesOn(exemplo, '2026-09-20');
    const missas = dom.filter((a) => a.kind === 'mass');
    expect(ids(missas)).toEqual([
      'matriz-mass-sun-0700',
      'matriz-mass-sun-0930',
      'santa-clara-mass-3sun-1700',
    ]);
    expect(missas.every((m) => m.status === 'scheduled')).toBe(true);
    expect(new Set(missas.map((m) => m.communityId)).size).toBe(2);
  });

  test('atividade "described" não entra no dia — não tem data', () => {
    const dia = activitiesOn(exemplo, '2026-09-20');
    expect(ids(dia)).not.toContain('matriz-confession-desc');
  });

  test('a paróquia real: 3ª quinta traz as duas comunidades que celebram nela', () => {
    const dia = activitiesOn(real, '2026-09-17'); // 3ª quinta de setembro
    // Propriedade, não id literal: duas comunidades distintas celebram no mesmo horário.
    expect(dia).toHaveLength(2);
    expect(new Set(dia.map((a) => a.communityId)).size).toBe(2);
    expect(new Set(dia.map((a) => a.startsAt))).toEqual(new Set(['19:30']));
  });
});

describe('cancel-all — Sexta-feira Santa', () => {
  const dia = activitiesOn(exemplo, '2026-04-03');

  test('a missa de semana é cancelada, mas continua na lista (D7)', () => {
    expect(status(dia, 'matriz-mass-mon-tue-wed-thu-fri-1900')).toBe('cancelled');
    expect(dia.find((a) => a.id === 'matriz-mass-mon-tue-wed-thu-fri-1900')?.reason).toMatch(/Sexta-feira Santa/);
  });

  test('o que está em `except` sobrevive', () => {
    expect(status(dia, 'matriz-confession-fri-sat-0900')).toBe('scheduled');
  });

  test('o que foi acrescentado no dia aparece', () => {
    const viaSacra = dia.find((a) => a.kind === 'event');
    expect(viaSacra?.status).toBe('added');
    expect(viaSacra?.communityId).toBe('sao-joao-batista');
  });
});

describe('cancel-all + add — festa do padroeiro', () => {
  const dia = activitiesOn(exemplo, '2026-06-29');

  test('tudo cancelado e a missa campal no lugar', () => {
    expect(status(dia, 'matriz-mass-mon-tue-wed-thu-fri-1900')).toBe('cancelled');
    expect(status(dia, 'festa-2026-campal')).toBe('added');
    expect(dia.find((a) => a.id === 'festa-2026-campal')?.startsAt).toBe('10:00');
  });
});

describe('move', () => {
  test('mover várias preserva o horário de cada uma e cria a entrada no destino', () => {
    const dia = activitiesOn(exemplo, '2026-10-11');
    expect(status(dia, 'matriz-mass-sun-0700')).toBe('moved-out');
    expect(dia.find((a) => a.id === 'matriz-mass-sun-0700')?.movedTo?.communityId).toBe('santa-clara');

    const chegadas = dia.filter((a) => a.status === 'moved-in');
    expect(chegadas).toHaveLength(2);
    expect(chegadas.every((c) => c.communityId === 'santa-clara')).toBe(true);
    expect(chegadas.map((c) => c.startsAt).sort()).toEqual(['07:00', '09:30']);
    expect(chegadas[0]?.movedFrom?.communityId).toBe('matriz');
  });

  test('mover uma só pode trocar o horário', () => {
    const dia = activitiesOn(exemplo, '2026-12-24');
    expect(status(dia, 'matriz-mass-mon-tue-wed-thu-fri-1900')).toBe('moved-out');
    expect(dia.find((a) => a.status === 'moved-in')?.startsAt).toBe('18:00');
    expect(dia.find((a) => a.title === 'Missa do Galo')?.status).toBe('added');
  });
});

describe('passado x próxima', () => {
  const dom = activitiesOn(exemplo, '2026-09-20');

  test('às 08h, a das 07h já passou e a das 09h30 é a próxima', () => {
    const { past, upcoming } = splitByNow(dom, '08:00');
    expect(ids(past)).toEqual(['matriz-mass-sun-0700']);
    expect(ids(upcoming)[0]).toBe('matriz-mass-sun-0930');
  });

  test('atividade com faixa só vira passado depois de terminar', () => {
    const sexta = activitiesOn(exemplo, '2026-09-18');
    const { upcoming } = splitByNow(sexta, '10:00'); // confissão das 09:00 às 11:30
    expect(ids(upcoming)).toContain('matriz-confession-fri-sat-0900');
  });
});

describe('exceções sem efeito — a última falha silenciosa', () => {
  test('o exemplo de referência não tem nenhuma', () => {
    expect(ineffectiveExceptions(exemplo)).toEqual([]);
  });

  test('cancelar catequese de sábado num domingo é detectado', () => {
    const quebrado = structuredClone(exemplo) as Parish;
    quebrado.exceptions = [
      { action: 'cancel', date: '2026-11-08', activityIds: ['matriz-catechesis-sat-0900'] },
    ];
    expect(ineffectiveExceptions(quebrado)).toEqual([
      { index: 0, date: '2026-11-08', activityId: 'matriz-catechesis-sat-0900', motivo: 'a atividade não ocorre nessa data' },
    ]);
  });

  test('proteger em `except` algo que não ocorre no dia é inofensivo', () => {
    const p = structuredClone(exemplo) as Parish;
    p.exceptions = [{ action: 'cancel-all', date: '2026-11-08', except: ['matriz-catechesis-sat-0900'] }];
    expect(ineffectiveExceptions(p)).toEqual([]);
  });

  test('mirar em atividade "described" é detectado', () => {
    const quebrado = structuredClone(exemplo) as Parish;
    quebrado.exceptions = [
      { action: 'cancel', date: '2026-11-08', activityIds: ['matriz-confession-desc'] },
    ];
    expect(ineffectiveExceptions(quebrado)[0]?.motivo).toMatch(/sem data/);
  });
});
