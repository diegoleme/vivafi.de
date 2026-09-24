import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parishSchema, type Recurrence } from './schema.ts';

const FIXTURE = new URL('../../data/catholic/br/campo-limpo/par.nsdasdores.json', import.meta.url);
const real: any = JSON.parse(readFileSync(FIXTURE, 'utf8'));

/** Mensagens achatadas como `caminho.do.campo: mensagem`, para asserção legível. */
function errors(entrada: unknown): string[] {
  const r = parishSchema.safeParse(entrada);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

function changed(mutate: (p: any) => void) {
  const copy = structuredClone(real);
  mutate(copy);
  return copy;
}

describe('paróquia válida', () => {
  test('a fixture real da Diocese de Campo Limpo valida', () => {
    expect(errors(real)).toEqual([]);
  });

  test('representa os três tipos de recorrência calculável da D17', () => {
    const p = parishSchema.parse(real);
    const tipos = new Set(p.communities.flatMap((c) => c.activities.map((a) => a.recurrence.type)));
    expect(tipos).toContain('weekly');
    expect(tipos).toContain('monthly-ordinal');

    // dia fixo do mês ("todo dia 19") não ocorre nesta paróquia; validado à parte
    expect(
      errors(
        changed((p) => {
          p.communities[1].activities.push({
            id: 'sao-jose-devocao-d19',
            kind: 'mass',
            title: 'devoção a São José',
            startsAt: '20:00',
            recurrence: { type: 'monthly-day', dayOfMonth: 19 },
          });
        }),
      ),
    ).toEqual([]);
  });

  test('8 das 12 comunidades têm apenas missa mensal — é o padrão, não a exceção', () => {
    const p = parishSchema.parse(real);
    const onlyMonthly = p.communities.filter((c) => {
      const masses = c.activities.filter((a) => a.kind === 'mass');
      return masses.length > 0 && masses.every((m) => m.recurrence.type !== 'weekly');
    });
    expect(onlyMonthly).toHaveLength(8);
  });

  test('modela a vida da comunidade além da missa', () => {
    const p = parishSchema.parse(real);
    const kinds = new Set(p.communities.flatMap((c) => c.activities.map((a) => a.kind)));
    expect(kinds).toContain('mass');
    expect(kinds).toContain('confession');
    expect(kinds).toContain('adoration');
  });

  test('confissão ocupa faixa de horário; missa é ponto no tempo', () => {
    const p = parishSchema.parse(real);
    const all = p.communities.flatMap((c) => c.activities);
    const confession = all.find((a) => a.kind === 'confession');
    expect(confession?.startsAt).toBe('09:00');
    expect(confession?.endsAt).toBe('11:30');
    expect(all.find((a) => a.kind === 'mass')?.endsAt).toBeUndefined();
  });

  test('`day` aceita array e o código sempre recebe array', () => {
    const p = parishSchema.parse(real);
    const semanais = p.communities
      .flatMap((c) => c.activities)
      .map((a) => a.recurrence)
      .filter((r): r is Extract<Recurrence, { type: 'weekly' }> => r.type === 'weekly');

    // Propriedade, não id literal: a fixture é gerada e os ids mudam na reimportação.
    expect(semanais.length).toBeGreaterThan(0);
    expect(semanais.every((r) => Array.isArray(r.day))).toBe(true);
    expect(semanais.some((r) => r.day.length > 1)).toBe(true);
  });

  test('recorrência "described" aceita o que não é horário — "Antes das Santas Missas"', () => {
    expect(
      errors(
        changed((p) => {
          p.communities[1].activities.push({
            id: 'sao-jose-confession-desc',
            kind: 'confession',
            recurrence: { type: 'described', text: 'Antes das Santas Missas' },
          });
        }),
      ),
    ).toEqual([]);
  });
});

describe('paróquia inválida', () => {
  test('slug reservado é rejeitado (D23)', () => {
    expect(errors(changed((p) => (p.slug = 'sobre')))).toContainEqual(expect.stringContaining('slug reservado'));
  });

  test('slug fora do formato kebab-case é rejeitado', () => {
    expect(errors(changed((p) => (p.slug = 'Nossa Senhora')))).toContainEqual(expect.stringContaining('minúsculo'));
  });

  test('exige exatamente uma matriz', () => {
    expect(errors(changed((p) => (p.communities[0].isMain = false)))).toContainEqual(
      expect.stringContaining('exatamente uma matriz'),
    );
    expect(errors(changed((p) => (p.communities[1].isMain = true)))).toContainEqual(
      expect.stringContaining('exatamente uma matriz'),
    );
  });

  test('comunidade não-ativa sem motivo é rejeitada (D7/D19)', () => {
    expect(errors(changed((p) => (p.communities[2].status = 'under-renovation')))).toContainEqual(
      expect.stringContaining('a página nunca mente'),
    );
  });

  test('exceção apontando para atividade inexistente é rejeitada', () => {
    const msgs = errors(
      changed((p) => {
        p.exceptions.push({ action: 'cancel', date: '2026-12-25', reason: 'Natal', activityIds: ['nao-existe'] });
      }),
    );
    expect(msgs).toContainEqual(expect.stringContaining('atividade inexistente'));
  });

  test('id de atividade duplicado na paróquia é rejeitado', () => {
    const msgs = errors(changed((p) => (p.communities[2].activities[0].id = p.communities[1].activities[0].id)));
    expect(msgs).toContainEqual(expect.stringContaining('id de atividade duplicado'));
  });

  test('mover várias atividades para um horário único é rejeitado', () => {
    const msgs = errors(
      changed((p) => {
        const ids = p.communities[0].activities.slice(0, 2).map((a: any) => a.id);
        p.exceptions.push({ action: 'move', date: '2026-12-25', activityIds: ids, to: { community: 'sao-jose', startsAt: '10:00' } });
      }),
    );
    expect(msgs).toContainEqual(expect.stringContaining('colidiriam'));
  });

  test('id de comunidade duplicado é rejeitado', () => {
    expect(errors(changed((p) => (p.communities[2].id = p.communities[1].id)))).toContainEqual(
      expect.stringContaining('duplicado'),
    );
  });

  test('hora fora do formato 24h é rejeitada', () => {
    expect(errors(changed((p) => (p.communities[0].activities[0].startsAt = '8h30')))).toContainEqual(
      expect.stringContaining('HH:MM'),
    );
  });

  test('atividade com recorrência calculável exige startsAt', () => {
    const msgs = errors(
      changed((p) => {
        p.communities[1].activities.push({ id: 'x-rosary-wed', kind: 'rosary', recurrence: { type: 'weekly', day: 'wednesday' } });
      }),
    );
    expect(msgs).toContainEqual(expect.stringContaining('precisa de startsAt'));
  });

  test('endsAt antes de startsAt é rejeitado', () => {
    expect(errors(changed((p) => (p.communities[0].activities[0].endsAt = '07:00')))).toContainEqual(
      expect.stringContaining('depois de startsAt'),
    );
  });
});

describe('exceções — a exceção é o produto', () => {
  const ids = (p: any) => p.communities.flatMap((c: any) => c.activities.map((a: any) => a.id));

  test('as quatro ações são aceitas', () => {
    const p = changed((p) => {
      const [primeiro, segundo] = ids(p);
      p.exceptions = [
        { action: 'cancel', date: '2026-09-15', reason: 'Festa da Padroeira', activityIds: [primeiro] },
        { action: 'move', date: '2026-09-15', reason: 'Festa da Padroeira', activityIds: [segundo], to: { community: 'sao-jose', startsAt: '19:00' } },
        { action: 'add', date: '2026-09-15', reason: 'Festa da Padroeira', activity: { community: 'sao-jose', kind: 'mass', title: 'Procissão e missa campal', startsAt: '15:00' } },
        { action: 'cancel-all', date: '2026-09-15', reason: 'Festa da Padroeira', except: [primeiro] },
      ];
    });
    expect(errors(p)).toEqual([]);
  });

  test('exceção sem motivo é aceita — recomendado, não exigido (D27)', () => {
    const p = changed((p) => {
      p.exceptions = [{ action: 'cancel', date: '2026-12-25', activityIds: [ids(p)[0]] }];
    });
    expect(errors(p)).toEqual([]);
  });

  test('uma exceção pode atingir várias atividades de uma vez', () => {
    const p = changed((p) => {
      p.exceptions = [{ action: 'cancel', date: '2026-12-25', reason: 'Natal', activityIds: ids(p).slice(0, 4) }];
    });
    expect(errors(p)).toEqual([]);
  });

  test('cancel-all com except inexistente é rejeitado', () => {
    const msgs = errors(
      changed((p) => {
        p.exceptions = [{ action: 'cancel-all', date: '2026-04-03', except: ['nao-existe'] }];
      }),
    );
    expect(msgs).toContainEqual(expect.stringContaining('atividade inexistente'));
  });

  test('toda atividade da fixture tem id único', () => {
    const p = parishSchema.parse(real);
    const todos = p.communities.flatMap((c) => c.activities.map((a) => a.id));
    expect(new Set(todos).size).toBe(todos.length);
  });
});
