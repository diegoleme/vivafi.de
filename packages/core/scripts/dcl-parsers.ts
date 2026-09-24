import type { Recurrence, Weekday } from '../src/schema.ts';

/**
 * Parsers do texto publicado pela Diocese de Campo Limpo.
 *
 * Regra que governa tudo aqui: **o que não for reconhecido com certeza vira
 * observação em texto, nunca horário**. Inventar uma missa é a única coisa que
 * a D7 proíbe sem exceção, e um parser otimista inventa em silêncio.
 */

const DIA_POR_NOME: Record<string, Weekday> = {
  domingo: 'sunday',
  segunda: 'monday', '2ª': 'monday', '2a': 'monday',
  terça: 'tuesday', terca: 'tuesday', '3ª': 'tuesday', '3a': 'tuesday',
  quarta: 'wednesday', '4ª': 'wednesday', '4a': 'wednesday',
  quinta: 'thursday', '5ª': 'thursday', '5a': 'thursday',
  sexta: 'friday', '6ª': 'friday', '6a': 'friday',
  sábado: 'saturday', sabado: 'saturday',
};

export const ORDEM_SEMANA: Weekday[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

const norm = (s: string) => s.toLowerCase().trim().replace(/-feira\b/g, '').replace(/\s+/g, ' ');

/** "Sexta-feira", "6ª", "Sábado" → Weekday. `null` quando não reconhece. */
export function diaDaSemana(texto: string): Weekday | null {
  const t = norm(texto).replace(/[.,:;]$/, '');
  return DIA_POR_NOME[t] ?? null;
}

/** "3ª a 6ª" e "3ª a Sábado" → lista de dias. */
export function intervaloDeDias(texto: string): Weekday[] | null {
  const m = /^(.+?)\s+a\s+(.+)$/.exec(norm(texto));
  if (!m) {
    const unico = diaDaSemana(texto);
    return unico ? [unico] : null;
  }
  const de = diaDaSemana(m[1]!);
  const ate = diaDaSemana(m[2]!);
  if (!de || !ate) return null;
  const i = ORDEM_SEMANA.indexOf(de);
  const f = ORDEM_SEMANA.indexOf(ate);
  if (i < 0 || f < 0 || f < i) return null;
  return ORDEM_SEMANA.slice(i, f + 1);
}

/** "08h00", "19h30", "9h", "17 horas", "09:00" → "HH:MM". */
export function hora(texto: string): string | null {
  const t = texto.trim().toLowerCase();
  const m = /^(\d{1,2})\s*(?:h|:|\s+horas?)\s*(\d{2})?$/.exec(t) ?? /^(\d{1,2})\s*h(\d{2})?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "08h00, 10h00 e 19h00" → ["08:00","10:00","19:00"]; `null` se algo não casar. */
export function listaDeHoras(texto: string): string[] | null {
  const partes = texto.split(/\s*(?:,|\se\s)\s*/i).filter(Boolean);
  const horas = partes.map(hora);
  if (horas.length === 0 || horas.some((h) => h === null)) return null;
  return horas as string[];
}

const ORDINAIS: Record<string, 1 | 2 | 3 | 4 | 'last'> = {
  '1': 1, '2': 2, '3': 3, '4': 4, 'último': 'last', 'ultimo': 'last', 'última': 'last', 'ultima': 'last',
};

export interface Marcado { recurrence: Recurrence; startsAt: string; endsAt?: string }

/**
 * Reconhece uma linha de horário avulso e devolve uma ou mais entradas.
 *
 * Devolve `null` — e o chamador guarda a linha como observação — sempre que
 * houver qualquer dúvida. Parser otimista inventa missa em silêncio, que é a
 * única coisa que a D7 proíbe sem exceção.
 */
export function ocasional(linha: string): Marcado[] | null {
  const t = linha.trim().replace(/\.$/, '');

  // "Todo dia 19 do mês às 20h" | "Todo dia 28 às 9h, 15h e 20h"
  const diaFixo = /^todo\s+dia\s+(\d{1,2})(?:\s+(?:do|de cada)\s+m[êe]s)?\s+[àa]s?\s+(.+)$/i.exec(t);
  if (diaFixo) {
    const horas = listaDeHoras(diaFixo[2]!);
    const d = Number(diaFixo[1]);
    if (!horas || d < 1 || d > 31) return null;
    return horas.map((h) => ({ recurrence: { type: 'monthly-day', dayOfMonth: d } as Recurrence, startsAt: h }));
  }

  // "5ª das 15h às 17h" | "Quinta-feira das 14h às 18h" — faixa semanal
  const faixaSemanal = /^([\p{L}\d]+[ºª°]?(?:\s*-?\s*feira)?)\s+d[ae]s\s+(\d{1,2}(?:[h:]\d{2})?)h?\s+[àa]s\s+(\d{1,2}(?:[h:]\d{2})?)h?$/iu.exec(t);
  if (faixaSemanal) {
    const dia = diaDaSemana(faixaSemanal[1]!);
    const de = hora(/[h:]/.test(faixaSemanal[2]!) ? faixaSemanal[2]! : `${faixaSemanal[2]}h`);
    const ate = hora(/[h:]/.test(faixaSemanal[3]!) ? faixaSemanal[3]! : `${faixaSemanal[3]}h`);
    if (dia && de && ate && ate > de) {
      return [{ recurrence: { type: 'weekly', day: [dia] }, startsAt: de, endsAt: ate }];
    }
    return null;
  }

  // "2º e 4º Sábado às 19h30" — vários ordinais, mesmo dia e hora
  const multiOrd = /^(\d)[ºª°]?\s+e\s+(\d)[ºª°]?\s+([\p{L}]+)(?:\s*-?\s*feira)?(?:\s+do\s+m[êe]s)?\s+[àa]s?\s+(.+)$/iu.exec(t);
  if (multiOrd) {
    const dia = diaDaSemana(multiOrd[3]!);
    const horas = listaDeHoras(multiOrd[4]!);
    const a = ORDINAIS[multiOrd[1]!];
    const b = ORDINAIS[multiOrd[2]!];
    if (!dia || !horas || !a || !b) return null;
    return [a, b].flatMap((o) =>
      horas.map((h) => ({ recurrence: { type: 'monthly-ordinal', ordinal: o, day: dia } as Recurrence, startsAt: h })),
    );
  }

  // "1ª Sexta-feira do mês às 19h30" | "3º Domingo às 17h" | "último sábado do mês às 8h"
  const ord = /^(\d|[úu]ltim[oa])[ºª°]?\s+([\p{L}]+)(?:\s*-?\s*feira)?(?:\s+do\s+m[êe]s)?\s+[àa]s?\s+(.+)$/iu.exec(t);
  if (ord) {
    const ordinal = ORDINAIS[ord[1]!.toLowerCase()];
    const dia = diaDaSemana(ord[2]!);
    const horas = listaDeHoras(ord[3]!);
    if (!ordinal || !dia || !horas) return null;
    return horas.map((h) => ({ recurrence: { type: 'monthly-ordinal', ordinal, day: dia } as Recurrence, startsAt: h }));
  }

  // "5ª às 19h" — semanal escrito no bloco de ocasionais
  const sem = /^([\p{L}\d]+[ºª°]?(?:\s*-?\s*feira)?)\s+[àa]s?\s+(.+)$/iu.exec(t);
  if (sem) {
    const dia = diaDaSemana(sem[1]!);
    const horas = listaDeHoras(sem[2]!);
    if (dia && horas) {
      return horas.map((h) => ({ recurrence: { type: 'weekly', day: [dia] } as Recurrence, startsAt: h }));
    }
  }
  return null;
}

/**
 * Tenta a linha inteira; só então tenta quebrá-la em " e ".
 *
 * A ordem importa: "Todo dia 28 às 9h, 15h e 20h" precisa casar inteira, senão
 * a quebra produziria "20h" solto. E a quebra só vale se **todas** as partes
 * forem reconhecidas — meio-parse vira texto.
 */
export function horariosDaLinha(linha: string): Marcado[] | null {
  const inteira = ocasional(linha);
  if (inteira) return inteira;

  const partes = linha.split(/\s+e\s+/i).map((p) => p.trim()).filter(Boolean);
  if (partes.length < 2) return null;
  const lidas = partes.map(ocasional);
  if (lidas.some((l) => l === null)) return null;
  return lidas.flat() as Marcado[];
}

const DIA_RE = String.raw`(?:\d[ºª°]?|domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(?:\s*-?\s*feira)?`;
const ESPEC_RE = new RegExp(String.raw`(${DIA_RE}(?:\s+a\s+${DIA_RE})?)\s+d[ae]s\s+`, 'gi');

export interface BlocoAtendimento {
  dias: Weekday[];
  faixas: { startsAt: string; endsAt: string }[];
}

/**
 * "3ª a 6ª das 9 às 12h e das 14 às 17h e Sábado das 10h às 12h" → dois blocos.
 *
 * Duas das três paróquias examinadas têm um bloco para os dias de semana e
 * outro para o sábado, então a saída é lista. Devolve `null` inteiro se
 * qualquer trecho não casar — meio-parse é pior que nenhum.
 */
export function atendimento(texto: string): BlocoAtendimento[] | null {
  const marcas = [...texto.matchAll(ESPEC_RE)];
  if (marcas.length === 0) return null;

  const blocos: BlocoAtendimento[] = [];
  for (let i = 0; i < marcas.length; i++) {
    const m = marcas[i]!;
    const dias = intervaloDeDias(m[1]!);
    if (!dias) return null;

    const fim = i + 1 < marcas.length ? marcas[i + 1]!.index : texto.length;
    const trecho = texto.slice(m.index + m[0].length, fim);

    const faixas: { startsAt: string; endsAt: string }[] = [];
    // O `h?` fica fora do grupo: "09h" tem o h sem minutos, "09h00" tem os dois.
    for (const f of trecho.matchAll(/(\d{1,2}(?:[h:]\d{2})?)h?\s*[àa]s\s+(\d{1,2}(?:[h:]\d{2})?)h?/gi)) {
      const de = hora(f[1]!.includes('h') || f[1]!.includes(':') ? f[1]! : `${f[1]}h`);
      const ate = hora(f[2]!.includes('h') || f[2]!.includes(':') ? f[2]! : `${f[2]}h`);
      if (!de || !ate) return null;
      faixas.push({ startsAt: de, endsAt: ate });
    }
    if (faixas.length === 0) return null;
    blocos.push({ dias, faixas });
  }
  return blocos;
}
