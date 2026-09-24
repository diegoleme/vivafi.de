import type { Recurrence, Weekday } from './schema.ts';

/**
 * Traduz uma recorrência para português corrente: "4ª quinta-feira do mês".
 *
 * Mora no `core`, e não no site, porque a automação de WhatsApp (D2) precisa
 * exatamente disto para puxar confirmação (D8): *"a missa da 1ª sexta continua
 * às 19h30?"*. É a mesma frase, nos dois lados do produto.
 */

const NOME: Record<Weekday, string> = {
  sunday: 'domingo', monday: 'segunda-feira', tuesday: 'terça-feira',
  wednesday: 'quarta-feira', thursday: 'quinta-feira', friday: 'sexta-feira', saturday: 'sábado',
};
const PLURAL: Record<Weekday, string> = {
  sunday: 'domingos', monday: 'segundas', tuesday: 'terças',
  wednesday: 'quartas', thursday: 'quintas', friday: 'sextas', saturday: 'sábados',
};
/** Só domingo e sábado são masculinos; o resto ("a segunda-feira") é feminino. */
const MASCULINO = new Set<Weekday>(['sunday', 'saturday']);

const ORDEM: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function lista(itens: string[]): string {
  if (itens.length === 1) return itens[0]!;
  return `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;
}

function semanal(dias: readonly Weekday[]): string {
  const ordenados = [...dias].sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b));
  /**
   * Plural, não "toda quinta-feira": o plural já implica recorrência, cabe na
   * coluna estreita da grade e desfaz a ambiguidade de "quinta" — que podia ser
   * lido como "nesta quinta".
   */
  if (ordenados.length === 1) return PLURAL[ordenados[0]!];
  if (ordenados.length === 7) return 'todos os dias';

  // Sequência corrida vira intervalo: "de segunda a sexta".
  const indices = ordenados.map((d) => ORDEM.indexOf(d));
  const corrida = indices.every((n, i) => i === 0 || n === indices[i - 1]! + 1);
  if (corrida && ordenados.length >= 3) {
    return `${NOME[ordenados[0]!].replace('-feira', '')} a ${NOME[ordenados.at(-1)!].replace('-feira', '')}`;
  }
  return lista(ordenados.map((d) => PLURAL[d]));
}

export function describeRecurrence(r: Recurrence): string {
  switch (r.type) {
    case 'weekly':
      return semanal(r.day);
    case 'monthly-ordinal': {
      const marca = r.ordinal === 'last' ? 'último' : `${r.ordinal}${MASCULINO.has(r.day) ? 'º' : 'ª'}`;
      const prefixo = r.ordinal === 'last' && !MASCULINO.has(r.day) ? 'última' : marca;
      return `${prefixo} ${NOME[r.day]} do mês`;
    }
    case 'monthly-day':
      return `todo dia ${r.dayOfMonth}`;
    case 'described':
      return r.text;
  }
}

/**
 * Rótulo de cada tipo de atividade. Também no `core` pelo mesmo motivo: é o
 * vocabulário que a automação de WhatsApp vai usar para confirmar mudanças.
 */
export const ACTIVITY_KIND_LABELS = {
  mass: 'Missa',
  confession: 'Confissão',
  adoration: 'Adoração',
  rosary: 'Terço',
  novena: 'Novena',
  'prayer-group': 'Grupo de oração',
  'youth-meeting': 'Encontro de jovens',
  catechesis: 'Catequese',
  formation: 'Formação',
  ministry: 'Pastoral',
  event: 'Evento',
  other: 'Outros',
} as const satisfies Record<string, string>;

export const COMMUNITY_STATUS_LABELS = {
  active: '',
  'under-renovation': 'Em reforma',
  'under-construction': 'Em construção',
  'no-services': 'Sem celebrações',
} as const satisfies Record<string, string>;
