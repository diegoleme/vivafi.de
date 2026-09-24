import { z } from 'zod';
import { PARISH_SLUG_FORMAT, RESERVED_SLUGS, SLUG_FORMAT } from './reserved-slugs.ts';

/**
 * Contrato central do Vivafide.
 *
 * D1: este schema é alvo de escrita de um modelo de linguagem a partir de uma
 * frase solta no WhatsApp. Por isso usa uniões discriminadas em vez de flags,
 * e nada de estrutura implícita — o diff de uma mudança precisa ser óbvio.
 *
 * Nomes de campo em inglês; mensagens de erro em português, porque quem lê o
 * erro é quem está corrigindo o JSON às pressas.
 */

export const SCHEMA_VERSION = 1 as const;

export const WEEKDAYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const slug = z
  .string()
  .regex(SLUG_FORMAT, 'slug deve ser minúsculo, com hífens (ex.: nossa-senhora-das-dores)')
  .refine((s) => !RESERVED_SLUGS.has(s), 'slug reservado: colidiria com rota institucional (D23)');

/** O slug que vira URL: aceita o @ do Instagram da paróquia (D46). */
const parishSlug = z
  .string()
  .regex(PARISH_SLUG_FORMAT, 'slug deve ser minúsculo, com hífen, ponto ou underscore no meio (ex.: nossa-senhora-das-dores, somosdasgracas)')
  .refine((s) => !RESERVED_SLUGS.has(s), 'slug reservado: colidiria com rota institucional (D23)');

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'hora deve ser HH:MM em 24h (ex.: 19:30)');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser AAAA-MM-DD');
const text = (max: number) => z.string().trim().min(1).max(max);

const weekday = z.enum(WEEKDAYS);
/** Aceita `"sunday"` ou `["friday","saturday"]`; o código sempre recebe array. */
const weekdays = z
  .union([weekday, z.array(weekday).min(1)])
  .transform((d) => (Array.isArray(d) ? d : [d]));

/**
 * D17: três tipos de recorrência, descobertos na pesquisa de campo.
 * `monthly-day` são devoções de data fixa: dia 19 São José, dia 28 São Judas.
 */
export const recurrenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('weekly'), day: weekdays }),
  z.object({
    type: z.literal('monthly-ordinal'),
    /**
     * O 5 existe e não é o mesmo que `last`. "1º, 3º e 5º domingo" é grade real
     * (Comunidade N. Sra. Aparecida, São Lourenço da Serra): em mês de quatro
     * domingos ela simplesmente não celebra no quarto — `last` diria que sim.
     */
    ordinal: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal('last')]),
    day: weekday,
  }),
  z.object({ type: z.literal('monthly-day'), dayOfMonth: z.number().int().min(1).max(31) }),
  /**
   * Escape hatch honesto: o site da diocese publica coisas como
   * "Antes das Santas Missas" ou "Confirmar na secretaria". Isso não é horário,
   * e fingir que é seria mentir (D7). Exibido como texto, nunca calculado.
   */
  z.object({ type: z.literal('described'), text: text(200) }),
]);

/**
 * A missa é a cunha, mas o norte é pertencimento. O modelo já carrega o resto
 * da vida da comunidade. Missa tem destaque na *renderização*, não aqui.
 */
export const ACTIVITY_KINDS = [
  'mass', 'confession', 'adoration', 'rosary', 'novena',
  'prayer-group', 'youth-meeting', 'catechesis',
  'formation', 'ministry', 'event', 'other',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const activitySchema = z
  .object({
    /**
     * Identificador semântico, único na paróquia inteira (não só na comunidade),
     * para que a exceção o referencie sem qualificar a comunidade.
     *
     * Por que ID e não coordenada (`community` + `startsAt`): coordenada é
     * *consulta*, não referência. Se a missa mudar de 10:00 para 10:30, toda
     * exceção apontando para 10:00 deixa de casar — em silêncio, que é o que a
     * D7 proíbe. Com ID, mudar o horário não quebra nada, e apagar a atividade
     * deixa um ID pendurado que o validador pega.
     */
    id: slug,
    kind: z.enum(ACTIVITY_KINDS),
    /**
     * D20: "Vetus Ordo (em latim)", "unção dos enfermos", "Grupo de Oração Nova Aliança".
     *
     * **Escreva a frase inteira, não só o nome.** O título aparece sozinho
     * embaixo do nome da comunidade, e ali "Sagrado Coração de Jesus" se lê
     * como outro lugar; "Em honra ao Sagrado Coração de Jesus" se lê como o que
     * é. A preposição fica aqui, e não numa regra de exibição, porque ela muda
     * com o nome — "ao Sagrado Coração", "à Imaculada Conceição", "aos Santos
     * Mártires" — e quem escreve o JSON está lendo o nome, então acerta.
     */
    title: text(120).optional(),
    startsAt: time.optional(),
    /** Confissão e adoração ocupam faixa; missa é ponto no tempo. */
    endsAt: time.optional(),
    recurrence: recurrenceSchema,
    /** D18: metade dos blocos reais transbordou o template estruturado da diocese. */
    note: text(280).optional(),
  })
  .refine((a) => a.recurrence.type === 'described' || a.startsAt !== undefined, {
    message: 'atividade com recorrência calculável precisa de startsAt',
    path: ['startsAt'],
  })
  .refine((a) => a.endsAt === undefined || (a.startsAt !== undefined && a.endsAt > a.startsAt), {
    message: 'endsAt precisa vir depois de startsAt',
    path: ['endsAt'],
  });

/** D19: comunidade inativa é estado declarado, não ausência. */
export const COMMUNITY_STATUSES = ['active', 'under-renovation', 'under-construction', 'no-services'] as const;

/**
 * Padroeiro, com a sua festa.
 *
 * **É lista** porque dois padroeiros é comum, não exceção: 15 das 113 paróquias
 * de Campo Limpo e 24 das 427 comunidades. E cada um tem a sua data — a
 * Comunidade São José e Nossa Senhora de Fátima anuncia "19 de março, 13 de
 * maio, dia dos padroeiros", duas festas no mesmo cartaz.
 *
 * A D22 continua de pé: a festa mora **dentro** do padroeiro, então "festa sem
 * padroeiro" segue sendo estado impossível. O que caiu foi a suposição de que
 * padroeiro é um só.
 *
 * Importa porque a festa é o gatilho do calendário de confirmação (D8): é
 * justamente no dia do padroeiro que o horário muda. Com uma data para dois
 * padroeiros, metade dos avisos nunca dispara.
 */
export const patronSchema = z.object({
  name: text(120),
  feast: z
    .object({ day: z.number().int().min(1).max(31), month: z.number().int().min(1).max(12) })
    .optional(),
});

export const communitySchema = z
  .object({
    id: slug,
    name: text(120),
    /**
     * A dedicação da comunidade, quando se sabe. O `name` já costuma trazê-la,
     * mas o nome é texto e a festa precisa ser data.
     */
    patrons: z.array(patronSchema).min(1).optional(),
    isMain: z.boolean().default(false),
    /**
     * Linhas do endereço, na ordem em que o país as escreve. Aceita string
     * solta (vira lista de uma linha) e o código sempre recebe lista.
     *
     * Não é estruturado em rua/bairro/CEP de propósito: o produto é global, e
     * endereço japonês, alemão e brasileiro têm ordens diferentes. Preservar as
     * linhas da fonte funciona em qualquer lugar; impor a ordem brasileira não.
     */
    address: z
      .union([text(200), z.array(text(200)).min(1)])
      .transform((a) => (Array.isArray(a) ? a : [a]))
      .optional(),
    /**
     * Capturar junto com o endereço é grátis; geocodificar 314 comunidades
     * depois custa tempo e dinheiro. É o que "missas perto de mim" vai exigir —
     * endereço em texto não serve para calcular distância.
     */
    location: z
      .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .optional(),
    status: z.enum(COMMUNITY_STATUSES).default('active'),
    statusReason: text(200).optional(),
    activities: z.array(activitySchema).default([]),
    note: text(280).optional(),
  })
  .refine((c) => c.status === 'active' || !!c.statusReason, {
    message: 'comunidade não-ativa precisa de statusReason — a página nunca mente (D7)',
    path: ['statusReason'],
  });

const activityIds = z.array(slug).min(1);

/**
 * A exceção é o produto. A grade recorrente é a base; isto é aplicado por cima.
 * `reason` é opcional — idealmente existe, mas exigir travaria a edição às
 * pressas via WhatsApp, que é o caminho principal (D1). Sem motivo, a
 * renderização ainda mostra a missa riscada: sumir em silêncio é que não pode (D7).
 */
export const exceptionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('cancel'),
    date: isoDate,
    reason: text(200).optional(),
    activityIds,
  }),
  z
    .object({
      action: z.literal('move'),
      date: isoDate,
      reason: text(200).optional(),
      activityIds,
      to: z.object({ community: slug, startsAt: time.optional() }),
    })
    .refine((e) => e.to.startsAt === undefined || e.activityIds.length === 1, {
      message: 'to.startsAt só faz sentido movendo uma atividade — várias colidiriam no mesmo horário',
      path: ['to', 'startsAt'],
    }),
  z.object({
    action: z.literal('add'),
    date: isoDate,
    reason: text(200).optional(),
    activity: z.object({
      id: slug.optional(),
      community: slug,
      kind: z.enum(ACTIVITY_KINDS).default('mass'),
      title: text(120).optional(),
      startsAt: time,
      endsAt: time.optional(),
      note: text(280).optional(),
    }),
  }),
  /**
   * Festa do padroeiro, Semana Santa, Natal: os dias em que *tudo* muda são
   * justamente quando a secretária tem menos paciência. Listar 23 IDs seria
   * o caminho mais provável de erro. `except` deixa o registro ler como a
   * frase real: "nesse dia não tem nada, só a missa campal das 10h".
   */
  z.object({
    action: z.literal('cancel-all'),
    date: isoDate,
    reason: text(200).optional(),
    except: z.array(slug).default([]),
  }),
]);

const phone = z.string().regex(/^\+\d{10,15}$/, 'telefone em formato internacional (ex.: +5511987654321)');

/**
 * Horário de atendimento da secretaria.
 *
 * Mesma forma de uma atividade — recorrência semanal com faixa — porque é a
 * mesma coisa: "de terça a sexta, das 09h às 12h". Sem `kind` nem `id`, que
 * aqui não teriam uso.
 *
 * É lista porque a realidade exige: duas das três paróquias examinadas têm um
 * bloco para os dias de semana e outro para o sábado. `described` é o escape
 * hatch para "fechado em janeiro" ou "atendimento por agendamento".
 */
export const officeHoursSchema = z
  .object({
    recurrence: recurrenceSchema,
    startsAt: time.optional(),
    endsAt: time.optional(),
    note: text(200).optional(),
  })
  .refine((h) => h.recurrence.type === 'described' || h.startsAt !== undefined, {
    message: 'atendimento com recorrência calculável precisa de startsAt',
    path: ['startsAt'],
  })
  .refine((h) => h.endsAt === undefined || (h.startsAt !== undefined && h.endsAt > h.startsAt), {
    message: 'endsAt precisa vir depois de startsAt',
    path: ['endsAt'],
  });

/**
 * D9: quem Diego aciona quando precisa confirmar uma mudança. A ordem do array
 * é a ordem de escalonamento — fila, nunca broadcast.
 *
 * **Isto é dado interno e nunca vai para a página.** Carrega o WhatsApp pessoal
 * da secretária. O contato público da paróquia é `contact`, outro campo.
 */
export const escalationSchema = z.object({
  name: text(120),
  whatsapp: phone,
  role: z.enum(['secretary', 'pascom', 'priest', 'other']).default('other'),
});

/** Contato **público** da paróquia: é isto que a página mostra. */
export const publicContactSchema = z.object({
  phone: phone.optional(),
  whatsapp: phone.optional(),
  email: z.string().email('e-mail inválido').optional(),
  website: z.string().url('endereço de site inválido').optional(),
  /** Apenas o identificador, sem "@" e sem URL: `par.nsdasdores`. */
  instagram: z.string().regex(/^[A-Za-z0-9._]+$/, 'use só o identificador, sem @ e sem URL').optional(),
  facebook: z.string().url('use a URL completa do Facebook').optional(),
  youtube: z.string().url('use a URL completa do YouTube').optional(),
});

/** D16: dado pré-gerado da diocese nunca se passa por confirmado. */
export const SOURCES = ['parish', 'diocese-website'] as const;

export const parishSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    slug: parishSlug,
    name: text(160),
    /** A quem a paróquia é dedicada. Ver `patronSchema` (D22, D50). */
    patrons: z.array(patronSchema).min(1).optional(),
    diocese: text(160).optional(),
    deanery: text(120).optional(),
    timezone: z.string().default('America/Sao_Paulo'),
    communities: z.array(communitySchema).min(1),
    exceptions: z.array(exceptionSchema).default([]),
    officeHours: z.array(officeHoursSchema).default([]),
    contact: publicContactSchema.optional(),
    /** Interno, nunca renderizado — ver `escalationSchema`. */
    escalation: z.array(escalationSchema).default([]),
    /** D7: a página mostra isto. Informação velha assumida vale mais que disfarçada. */
    confirmedAt: isoDate,
    source: z.enum(SOURCES),
    note: text(280).optional(),
  })
  .superRefine((p, ctx) => {
    const mains = p.communities.filter((c) => c.isMain);
    if (mains.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['communities'],
        message: `a paróquia precisa de exatamente uma matriz (encontradas: ${mains.length})`,
      });
    }

    const ids = p.communities.map((c) => c.id);
    for (const id of new Set(ids.filter((v, i) => ids.indexOf(v) !== i))) {
      ctx.addIssue({ code: 'custom', path: ['communities'], message: `id de comunidade duplicado: "${id}"` });
    }

    const knownCommunities = new Set(ids);

    // IDs de atividade são únicos na paróquia inteira: é o que permite a
    // exceção referenciá-los sem qualificar a comunidade.
    const activityIdList = p.communities.flatMap((c) => c.activities.map((a) => a.id));
    for (const id of new Set(activityIdList.filter((v, i) => activityIdList.indexOf(v) !== i))) {
      ctx.addIssue({ code: 'custom', path: ['communities'], message: `id de atividade duplicado na paróquia: "${id}"` });
    }
    const knownActivities = new Set(activityIdList);

    // Referência pendurada faz a exceção virar no-op silencioso (D7).
    p.exceptions.forEach((e, i) => {
      const activityRefs =
        e.action === 'cancel' || e.action === 'move' ? e.activityIds
        : e.action === 'cancel-all' ? e.except
        : [];
      for (const ref of activityRefs) {
        if (!knownActivities.has(ref)) {
          ctx.addIssue({ code: 'custom', path: ['exceptions', i], message: `exceção aponta para atividade inexistente: "${ref}"` });
        }
      }

      const communityRefs =
        e.action === 'add' ? [e.activity.community] : e.action === 'move' ? [e.to.community] : [];
      for (const ref of communityRefs) {
        if (!knownCommunities.has(ref)) {
          ctx.addIssue({ code: 'custom', path: ['exceptions', i], message: `exceção aponta para comunidade inexistente: "${ref}"` });
        }
      }
    });
  });

export type Recurrence = z.infer<typeof recurrenceSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type Community = z.infer<typeof communitySchema>;
export type ParishException = z.infer<typeof exceptionSchema>;
export type Escalation = z.infer<typeof escalationSchema>;
export type PublicContact = z.infer<typeof publicContactSchema>;
export type OfficeHours = z.infer<typeof officeHoursSchema>;
export type Parish = z.infer<typeof parishSchema>;
