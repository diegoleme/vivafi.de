import { addDays, type IsoDate } from './calendar.ts';
import { occursOn } from './recurrence.ts';
import type { ActivityKind, Parish } from './schema.ts';

/**
 * `cancelled` e `moved-out` continuam na lista **de propósito**.
 * A D7 exige que missa cancelada apareça riscada e explicada; sumir em silêncio
 * é indistinguível, para quem lê, de nunca ter existido.
 */
export type ActivityStatus = 'scheduled' | 'cancelled' | 'moved-out' | 'moved-in' | 'added';

export interface ScheduledActivity {
  id: string;
  communityId: string;
  kind: ActivityKind;
  title?: string;
  startsAt?: string;
  endsAt?: string;
  note?: string;
  status: ActivityStatus;
  reason?: string;
  movedTo?: { communityId: string; startsAt?: string };
  movedFrom?: { communityId: string };
}

/**
 * Tudo que acontece na paróquia nesta data, com as exceções já aplicadas.
 *
 * Atividades com recorrência `described` não aparecem aqui — elas não têm data.
 * São exibidas na grade da comunidade, como texto.
 */
export function activitiesOn(parish: Parish, date: IsoDate): ScheduledActivity[] {
  const resultado = new Map<string, ScheduledActivity>();

  for (const community of parish.communities) {
    for (const a of community.activities) {
      if (!occursOn(a.recurrence, date)) continue;
      resultado.set(a.id, {
        id: a.id,
        communityId: community.id,
        kind: a.kind,
        ...(a.title !== undefined && { title: a.title }),
        ...(a.startsAt !== undefined && { startsAt: a.startsAt }),
        ...(a.endsAt !== undefined && { endsAt: a.endsAt }),
        ...(a.note !== undefined && { note: a.note }),
        status: 'scheduled',
      });
    }
  }

  const doDia = parish.exceptions.filter((e) => e.date === date);
  const cancelar = (id: string, reason?: string) => {
    const alvo = resultado.get(id);
    if (alvo) Object.assign(alvo, { status: 'cancelled', ...(reason !== undefined && { reason }) });
  };

  for (const e of doDia) {
    if (e.action !== 'cancel-all') continue;
    for (const [id, a] of resultado) {
      if (!e.except.includes(id) && a.status === 'scheduled') cancelar(id, e.reason);
    }
  }
  for (const e of doDia) {
    if (e.action === 'cancel') for (const id of e.activityIds) cancelar(id, e.reason);
  }
  for (const e of doDia) {
    if (e.action !== 'move') continue;
    for (const id of e.activityIds) {
      const origem = resultado.get(id);
      if (!origem || origem.status !== 'scheduled') continue;
      const destino = { communityId: e.to.community, ...(e.to.startsAt !== undefined && { startsAt: e.to.startsAt }) };
      Object.assign(origem, { status: 'moved-out', movedTo: destino, ...(e.reason !== undefined && { reason: e.reason }) });
      resultado.set(`${id}@${e.to.community}`, {
        ...origem,
        id: `${id}@${e.to.community}`,
        communityId: e.to.community,
        startsAt: e.to.startsAt ?? origem.startsAt,
        status: 'moved-in',
        movedFrom: { communityId: origem.communityId },
        movedTo: undefined,
      });
    }
  }
  for (const e of doDia) {
    if (e.action !== 'add') continue;
    const id = e.activity.id ?? `${e.activity.community}-add-${e.date}-${e.activity.startsAt.replace(':', '')}`;
    resultado.set(id, {
      id,
      communityId: e.activity.community,
      kind: e.activity.kind,
      ...(e.activity.title !== undefined && { title: e.activity.title }),
      startsAt: e.activity.startsAt,
      ...(e.activity.endsAt !== undefined && { endsAt: e.activity.endsAt }),
      ...(e.activity.note !== undefined && { note: e.activity.note }),
      status: 'added',
      ...(e.reason !== undefined && { reason: e.reason }),
    });
  }

  return [...resultado.values()].sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
}

/** Separa o que já passou do que ainda vai acontecer, pela hora na paróquia. */
export function splitByNow(
  atividades: ScheduledActivity[],
  nowTime: string,
): { past: ScheduledActivity[]; upcoming: ScheduledActivity[] } {
  const past: ScheduledActivity[] = [];
  const upcoming: ScheduledActivity[] = [];
  for (const a of atividades) {
    ((a.endsAt ?? a.startsAt ?? '') < nowTime ? past : upcoming).push(a);
  }
  return { past, upcoming };
}

/**
 * Exceções que não atingem nada na data em que foram marcadas.
 *
 * É a falha silenciosa que fechou a D32 pela metade: a referência existe, mas a
 * atividade não ocorre naquele dia — cancelar catequese de sábado num domingo.
 * Passa no schema e não faz absolutamente nada.
 */
export function ineffectiveExceptions(
  parish: Parish,
): { index: number; date: IsoDate; activityId: string; motivo: string }[] {
  const porId = new Map(parish.communities.flatMap((c) => c.activities.map((a) => [a.id, a] as const)));
  const achados: { index: number; date: IsoDate; activityId: string; motivo: string }[] = [];

  parish.exceptions.forEach((e, index) => {
    /**
     * `cancel-all.except` é **filtro**, não alvo: "proteja estas se existirem".
     * Proteger algo que não ocorre naquele dia é inofensivo, não é falha.
     * Já `cancel` e `move` afirmam agir sobre algo — e é aí que o silêncio engana.
     */
    const ids = e.action === 'cancel' || e.action === 'move' ? e.activityIds : [];
    for (const id of ids) {
      const a = porId.get(id);
      if (!a) continue; // referência pendurada já é pega pelo schema (D32)
      if (a.recurrence.type === 'described') {
        achados.push({ index, date: e.date, activityId: id, motivo: 'atividade sem data (recorrência "described")' });
      } else if (!occursOn(a.recurrence, e.date)) {
        achados.push({ index, date: e.date, activityId: id, motivo: 'a atividade não ocorre nessa data' });
      }
    }
  });
  return achados;
}

/**
 * O próximo dia, a partir de `from`, em que acontece alguma atividade do tipo
 * pedido. Devolve `null` se nada for encontrado dentro de `maxDays`.
 *
 * Existe porque "hoje não tem missa" é um beco sem saída: quem abriu a página
 * quer saber *quando* tem. Dizer só o que não há responde à letra da pergunta
 * e falha com a pessoa.
 */
export function findNextDayWith(
  parish: Parish,
  kind: ActivityKind,
  from: IsoDate,
  maxDays = 60,
): { date: IsoDate; activities: ScheduledActivity[] } | null {
  for (let i = 0; i <= maxDays; i++) {
    const date = addDays(from, i);
    const activities = activitiesOn(parish, date).filter(
      (a) => a.kind === kind && a.status !== 'cancelled' && a.status !== 'moved-out',
    );
    if (activities.length > 0) return { date, activities };
  }
  return null;
}

/**
 * A agenda dos próximos dias, começando em `from` (incluído).
 *
 * Dias sem nada entram na lista mesmo assim, com `activities` vazio: quem abre
 * a página precisa ver que segunda não tem missa, não deduzir do silêncio.
 */
export function agendaFor(
  parish: Parish,
  from: IsoDate,
  days = 7,
): { date: IsoDate; activities: ScheduledActivity[] }[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, activities: activitiesOn(parish, date) };
  });
}

/** Uma alteração futura que atinge uma atividade da grade. */
export interface UpcomingChange {
  activityId: string;
  date: IsoDate;
  status: Exclude<ActivityStatus, 'scheduled'>;
  reason?: string;
  movedTo?: { communityId: string; startsAt?: string };
}

/**
 * Tudo que foge da rotina nos próximos dias, indexado pela atividade afetada.
 *
 * Serve para anotar a grade semanal no lugar certo: em vez de esconder a missa
 * de domingo numa lista de datas, a própria linha de domingo diz *"neste
 * domingo (27/09) não acontece — Festa da Padroeira"*.
 */
export function upcomingChanges(parish: Parish, from: IsoDate, days = 35): Map<string, UpcomingChange[]> {
  const porAtividade = new Map<string, UpcomingChange[]>();
  for (const { date, activities } of agendaFor(parish, from, days)) {
    for (const a of activities) {
      if (a.status === 'scheduled' || a.status === 'moved-in') continue;
      const base = a.id.split('@')[0]!;
      const lista = porAtividade.get(base) ?? [];
      lista.push({
        activityId: base,
        date,
        status: a.status,
        ...(a.reason !== undefined && { reason: a.reason }),
        ...(a.movedTo !== undefined && { movedTo: a.movedTo }),
      });
      porAtividade.set(base, lista);
    }
  }
  return porAtividade;
}

/** Atividades que existem só numa data — vieram de uma exceção `add`. */
export function oneOffActivities(
  parish: Parish,
  from: IsoDate,
  days = 120,
): { date: IsoDate; activity: ScheduledActivity }[] {
  return agendaFor(parish, from, days).flatMap(({ date, activities }) =>
    activities.filter((a) => a.status === 'added').map((activity) => ({ date, activity })),
  );
}
