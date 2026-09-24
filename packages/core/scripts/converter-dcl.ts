import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { suggestActivityId, uniqueActivityIds } from '../src/activity-id.ts';
import { parishSchema, type Activity, type Weekday } from '../src/schema.ts';
import { ineffectiveExceptions } from '../src/schedule.ts';
import { atendimento, diaDaSemana, hora, horariosDaLinha, listaDeHoras } from './dcl-parsers.ts';

/**
 * Converte o extrato do site da Diocese de Campo Limpo em JSONs do schema.
 *
 * **Nada vira horário por suposição.** Toda linha que não casa com um padrão
 * conhecido é preservada em `note`, e o relatório final conta quantas foram —
 * é o número que diz se o conversor está bom o bastante para as 113 paróquias.
 */

const ENTRADA = process.argv[2] ?? '/tmp/claude-1000/dcl/bruto.json';
const DESTINO = process.argv[3] ?? join(import.meta.dirname, '../../data/catholic/br/campo-limpo');
const HOJE = new Date().toISOString().slice(0, 10);

const BOILERPLATE = /^Hor[áa]rios de missa da Matriz paroquial/i;
const SO_LETRAS = /[A-Za-zÀ-ÿ]/;

interface Bruto {
  tipo: string; nome?: string; forania?: string | null; igrejaMatriz?: string | null;
  endereco?: string[]; atendimento?: string | null; telefone?: string | null;
  festa?: string | null; missas?: string[]; confissoes?: string[]; adoracao?: string[];
  comunidades?: string[]; redes?: Record<string, string>; erro?: string;
}

const bruto: Record<string, Bruto> = JSON.parse(readFileSync(ENTRADA, 'utf8'));

// ---------------------------------------------------------------- utilidades

function paraSlug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function festa(t?: string | null) {
  if (!t) return undefined;
  const m = /^(\d{1,2})\s+de\s+([\p{L}]+)/iu.exec(t.trim());
  if (!m) return undefined;
  const mes = MESES.indexOf(m[2]!.toLowerCase());
  const dia = Number(m[1]);
  return mes >= 0 && dia >= 1 && dia <= 31 ? { day: dia, month: mes + 1 } : undefined;
}

function telefoneE164(t?: string | null): string | undefined {
  if (!t) return undefined;
  const d = t.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 11 ? `+55${d}` : undefined;
}

/** "Vila Damasceno - São Paulo - SP" + CEP → "Vila Damasceno · São Paulo/SP · 05864-060". */
function endereco(linhas?: string[]): string[] | undefined {
  if (!linhas || linhas.length === 0) return undefined;
  const [rua, local, cep] = linhas;
  if (!rua) return undefined;
  if (!local) return [rua];
  const partes = local.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  /**
   * A UF só é UF quando parece uma: o site mistura três formatos na mesma
   * posição — "Bairro - Cidade - SP", "Bairro - Cidade/SP" e "Bairro - Cidade"
   * sem UF nenhuma. Tratando os três igual, a última parte virava UF e o
   * bairro escorregava para o lugar da cidade: era daí que saía o
   * "Jd. Previdência/São Paulo" sem bairro.
   */
  const uf = partes.length >= 2 && /^[A-Za-z]{2}$/.test(partes.at(-1)!) ? partes.pop()! : null;
  const cidade = partes.length >= 2 ? partes.pop()! : null;
  const bairro = partes.join(' - ');
  const meio = [bairro, cidade && uf ? `${cidade}/${uf}` : cidade].filter(Boolean).join(' · ');
  // Alguns CEPs vêm rotulados ("Cep: 06851-080"); o rótulo é ruído na linha.
  const cepLimpo = cep?.replace(/^cep:?\s*/i, '').trim();
  return [rua, [meio, cepLimpo].filter(Boolean).join(' · ')].filter(Boolean);
}

// ------------------------------------------------------------ bloco de horários

interface Lido { atividades: Omit<Activity, 'id'>[]; sobras: string[] }

/**
 * Lê um bloco "Missas"/"Confissões"/"Adoração": pares dia + horários, e as
 * linhas soltas de "Missas Ocasionais".
 *
 * O site repete o bloco inteiro (versão móvel e desktop), então os pares são
 * acumulados num Map — repetição colapsa em vez de duplicar a missa.
 */
function lerBloco(linhas: string[] | undefined, kind: Activity['kind']): Lido {
  const atividades: Omit<Activity, 'id'>[] = [];
  const sobras: string[] = [];
  if (!linhas) return { atividades, sobras };

  const porDia = new Map<Weekday, Set<string>>();
  const ocasionaisVistos = new Set<string>();
  const descritas = new Set<string>();

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]!.trim();
    if (!l || BOILERPLATE.test(l) || /^hor[áa]rios?$/i.test(l) || /^missas ocasionais$/i.test(l)) continue;

    const dia = diaDaSemana(l);
    if (dia && i + 1 < linhas.length) {
      const horas = listaDeHoras(linhas[i + 1]!) ?? faixas(linhas[i + 1]!);
      if (horas) {
        const alvo = porDia.get(dia) ?? new Set<string>();
        for (const h of Array.isArray(horas) ? horas : []) alvo.add(typeof h === 'string' ? h : JSON.stringify(h));
        porDia.set(dia, alvo);
        i++;
        continue;
      }
    }

    const oc = horariosDaLinha(l);
    if (oc) {
      for (const m of oc) {
        const chave = JSON.stringify(m);
        if (ocasionaisVistos.has(chave)) continue;
        ocasionaisVistos.add(chave);
        atividades.push({ kind, startsAt: m.startsAt, ...(m.endsAt ? { endsAt: m.endsAt } : {}), recurrence: m.recurrence });
      }
      continue;
    }

    /**
     * Linha não reconhecida vira atividade `described`, não observação da
     * paróquia: "Agendar na secretaria paroquial" **é** o horário da confissão,
     * e "Rodízio entre as capelas" **é** o da missa. Jogar no `note` tiraria a
     * informação do lugar onde ela é procurada.
     */
    if (SO_LETRAS.test(l) && !descritas.has(l)) {
      descritas.add(l);
      atividades.push({ kind, recurrence: { type: 'described', text: l.slice(0, 200) } });
    }
  }

  for (const [dia, horas] of porDia) {
    for (const h of [...horas].sort()) {
      if (h.startsWith('{')) {
        const f = JSON.parse(h) as { startsAt: string; endsAt: string };
        atividades.push({ kind, startsAt: f.startsAt, endsAt: f.endsAt, recurrence: { type: 'weekly', day: [dia] } });
      } else {
        atividades.push({ kind, startsAt: h, recurrence: { type: 'weekly', day: [dia] } });
      }
    }
  }
  return { atividades: juntarDias(atividades), sobras };
}

/**
 * Junta atividades iguais em dias diferentes: a diocese lista "Sexta" e
 * "Sábado" em linhas separadas, mas é a mesma confissão — e uma entrada com
 * `day: ["friday","saturday"]` rende "sextas e sábados" na página.
 */
function juntarDias(as: Omit<Activity, 'id'>[]): Omit<Activity, 'id'>[] {
  const mapa = new Map<string, Omit<Activity, 'id'>>();
  const resto: Omit<Activity, 'id'>[] = [];
  for (const a of as) {
    if (a.recurrence.type !== 'weekly' || a.recurrence.day.length !== 1) { resto.push(a); continue; }
    const chave = `${a.kind}|${a.startsAt ?? ''}|${a.endsAt ?? ''}|${a.title ?? ''}`;
    const achado = mapa.get(chave);
    if (achado && achado.recurrence.type === 'weekly') {
      achado.recurrence = { type: 'weekly', day: [...achado.recurrence.day, ...a.recurrence.day] };
    } else {
      mapa.set(chave, { ...a, recurrence: { ...a.recurrence } });
    }
  }
  const ORDEM = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (const a of mapa.values()) {
    if (a.recurrence.type === 'weekly') {
      a.recurrence = { type: 'weekly', day: [...new Set(a.recurrence.day)].sort((x, y) => ORDEM.indexOf(x) - ORDEM.indexOf(y)) };
    }
  }
  return [...mapa.values(), ...resto];
}

/** "09h00 - 11h30 e 14h00 - 16h00" → faixas serializadas. */
function faixas(texto: string): string[] | null {
  const achados: string[] = [];
  for (const m of texto.matchAll(/(\d{1,2}(?:[h:]\d{2})?)h?\s*[-–às]+\s*(\d{1,2}(?:[h:]\d{2})?)h?/gi)) {
    const de = hora(m[1]!.match(/[h:]/) ? m[1]! : `${m[1]}h`);
    const ate = hora(m[2]!.match(/[h:]/) ? m[2]! : `${m[2]}h`);
    if (!de || !ate) return null;
    achados.push(JSON.stringify({ startsAt: de, endsAt: ate }));
  }
  return achados.length > 0 ? achados : null;
}


// ------------------------------------------------------------------ conversão

function idDeComunidade(slug: string, usados: Set<string>): string {
  let base = slug
    .replace(/^(comunidade|capela|centro-pastoral(-do| da| de)?|area-missionaria)-/, '')
    .replace(/-\d+$/, '');
  if (!base) base = slug;
  let id = base;
  for (let n = 2; usados.has(id); n++) id = `${base}-${n}`;
  usados.add(id);
  return id;
}

/**
 * D46: o slug é o @ do Instagram da paróquia — é um nome que ela escolheu e
 * reconhece. Quando não há Instagram, nome do padroeiro mais o bairro da
 * matriz: o que distingue duas Santo Antônio é onde ficam, e "santo-antonio-3"
 * não é link que alguém dita no telefone.
 */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** "Jd." → "jardim": o bairro entra no slug como as pessoas o dizem. */
const ABREVIACOES: Record<string, string> = {
  jd: 'jardim', pq: 'parque', vl: 'vila', cj: 'conjunto',
  chac: 'chacara', cid: 'cidade', st: 'sitio', ch: 'chacara',
};

function bairroDaMatriz(comunidades: { isMain?: boolean; address?: string[] }[]): string | null {
  const m = comunidades.find((c) => c.isMain);
  const a = m?.address;
  if (!a || a.length < 2) return null;
  const partes = a[a.length - 1]!.split('·').map((x) => x.trim());
  // Sem "·" o campo não separa bairro de cidade; sobra a cidade, que ainda serve.
  const bruto = (partes.length >= 2 ? partes[0]! : partes[0]!).split('/')[0]!.trim();
  if (!bruto) return null;
  return normalizar(
    bruto
      .split(/\s+/)
      .map((w) => (w.endsWith('.') ? (ABREVIACOES[normalizar(w)] ?? w) : w))
      .join(' '),
  );
}

function slugDaParoquia(
  nome: string,
  instagram: string | undefined,
  comunidades: { isMain?: boolean; address?: string[] }[],
): string {
  // Underscore na ponta some quando o link é sublinhado num app de mensagem.
  if (instagram) return instagram.toLowerCase().replace(/^[._]+|[._]+$/g, '');
  const base = normalizar(nome.replace(/^Paróquia\s+/i, ''));
  const lugar = bairroDaMatriz(comunidades);
  if (!lugar) return base;
  const semTipo = lugar.replace(/^(jardim|parque|vila|conjunto|chacara|cidade|sitio)-/, '');
  return base.includes(lugar) || base.includes(semTipo) ? base : `${base}-${lugar}`;
}

/**
 * D50: o nome da paróquia traz um ou dois padroeiros; o site publica **uma**
 * data. Quando são dois, essa data fica de fora — de quem ela é varia
 * ("29/06" serve aos dois em São Pedro e São Paulo, mas "10/08" é do segundo
 * em Nossa Senhora Aparecida e São Lourenço), e chutar publicaria festa errada.
 */
function padroeiros(nome: string, dia: { day: number; month: number } | undefined) {
  const partes = nome.replace(/^Paróquia\s+/i, '').split(/\s+e\s+/).map((x) => x.trim()).filter(Boolean);
  if (partes.length > 1) return partes.map((name) => ({ name }));
  return [{ name: partes[0]!, ...(dia ? { feast: dia } : {}) }];
}

const relatorio = { paroquias: 0, comunidades: 0, atividades: 0, sobras: 0, semAtividade: 0, invalidas: [] as string[] };
mkdirSync(DESTINO, { recursive: true });

for (const [slug, p] of Object.entries(bruto)) {
  if (p.tipo !== 'paroquia' || p.erro) continue;

  const sobras: string[] = [];
  const usados = new Set<string>();

  const matriz = lerBloco(p.missas, 'mass');
  const conf = lerBloco(p.confissoes, 'confession');
  const ador = lerBloco(p.adoracao, 'adoration');
  sobras.push(...matriz.sobras, ...conf.sobras, ...ador.sobras);

  const comunidades: Record<string, unknown>[] = [{
    id: 'matriz',
    // "Igreja Matriz" é rótulo de campo; o valor é a dedicação, que nem sempre
    // repete o nome da paróquia (Santo Eugênio de Mazenod tem matriz "Santo Antônio").
    name: p.igrejaMatriz ?? (p.nome ?? slug).replace(/^Paróquia\s+/i, ''),
    isMain: true,
    ...(endereco(p.endereco) ? { address: endereco(p.endereco) } : {}),
    activities: [...matriz.atividades, ...conf.atividades, ...ador.atividades],
  }];
  usados.add('matriz');

  for (const cs of p.comunidades ?? []) {
    const c = bruto[cs];
    if (!c || c.erro) continue;
    const lido = lerBloco(c.missas, 'mass');
    sobras.push(...lido.sobras);
    comunidades.push({
      id: idDeComunidade(cs, usados),
      // O site publica "Lorem ipsum..." como nome de uma comunidade. Dado podre
      // na fonte: cai para o slug em vez de virar nome de 231 caracteres.
      name: c.nome && !/lorem ipsum/i.test(c.nome) && c.nome.length <= 120
        ? c.nome
        : cs.replace(/^(comunidade|capela)-/, '').replace(/-/g, ' ').replace(/\b\p{L}/gu, (m) => m.toUpperCase()),
      ...(endereco(c.endereco) ? { address: endereco(c.endereco) } : {}),
      activities: lido.atividades,
    });
  }

  // IDs determinísticos: reimportar precisa produzir os mesmos, senão quebraria
  // toda exceção já escrita (D32).
  const sugestoes = comunidades.flatMap((c) =>
    (c['activities'] as Omit<Activity, 'id'>[]).map((a) => suggestActivityId(c['id'] as string, a)),
  );
  const ids = uniqueActivityIds(sugestoes);
  let n = 0;
  for (const c of comunidades) {
    c['activities'] = (c['activities'] as Omit<Activity, 'id'>[]).map((a) => ({ id: ids[n++], ...a }));
  }

  const horas = p.atendimento ? atendimento(p.atendimento) : null;
  if (p.atendimento && !horas) sobras.push(`Atendimento: ${p.atendimento}`);

  const redes = p.redes ?? {};
  const zap = redes['whatsapp'] ? `+${redes['whatsapp'].replace(/\D/g, '').replace(/^55?/, '55')}` : undefined;
  const contato = {
    ...(telefoneE164(p.telefone) ? { phone: telefoneE164(p.telefone) } : {}),
    ...(zap && /^\+\d{12,13}$/.test(zap) ? { whatsapp: zap } : {}),
    ...(redes['instagram'] ? { instagram: redes['instagram'].replace(/.*instagram\.com\//, '').replace(/\/$/, '') } : {}),
    ...(redes['facebook'] ? { facebook: redes['facebook'].replace(/\/$/, '') } : {}),
    ...(redes['youtube'] ? { youtube: redes['youtube'].replace(/\/$/, '') } : {}),
  };

  const paroquia = {
    schemaVersion: 1,
    slug: slugDaParoquia(p.nome ?? slug, contato.instagram, comunidades),
    name: p.nome ?? slug,
    patrons: padroeiros(p.nome ?? slug, festa(p.festa)),
    diocese: 'Diocese de Campo Limpo',
    ...(p.forania ? { deanery: p.forania } : {}),
    timezone: 'America/Sao_Paulo',
    confirmedAt: HOJE,
    source: 'diocese-website' as const,
    ...(horas ? {
      officeHours: horas.flatMap((b) =>
        b.faixas.map((f) => ({ recurrence: { type: 'weekly' as const, day: b.dias }, ...f })),
      ),
    } : {}),
    ...(Object.keys(contato).length > 0 ? { contact: contato } : {}),
    escalation: [],
    exceptions: [],
    ...(sobras.length > 0 ? { note: sobras.join(' — ').slice(0, 280) } : {}),
    communities: comunidades,
  };

  const r = parishSchema.safeParse(paroquia);
  if (!r.success) {
    relatorio.invalidas.push(`${slug}: ${r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    continue;
  }
  const semEfeito = ineffectiveExceptions(r.data);
  if (semEfeito.length > 0) relatorio.invalidas.push(`${slug}: exceções sem efeito`);

  writeFileSync(join(DESTINO, `${paroquia.slug}.json`), JSON.stringify(paroquia, null, 2) + '\n');
  relatorio.paroquias++;
  relatorio.comunidades += comunidades.length;
  const total = comunidades.reduce((t, c) => t + (c['activities'] as unknown[]).length, 0);
  relatorio.atividades += total;
  relatorio.sobras += sobras.length;
  if (total === 0) relatorio.semAtividade++;
}

console.log(`paróquias convertidas : ${relatorio.paroquias}`);
console.log(`comunidades           : ${relatorio.comunidades}`);
console.log(`atividades estruturadas: ${relatorio.atividades}`);
console.log(`linhas em texto livre : ${relatorio.sobras}`);
console.log(`paróquias sem nenhuma atividade: ${relatorio.semAtividade}`);
if (relatorio.invalidas.length > 0) {
  console.log(`\nINVÁLIDAS (${relatorio.invalidas.length}):`);
  for (const l of relatorio.invalidas.slice(0, 15)) console.log('  ' + l);
}
