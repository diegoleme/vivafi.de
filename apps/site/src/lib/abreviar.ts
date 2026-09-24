import type { Community } from '@vivafide/core';

/**
 * Nomes curtos para as tabelas de horário, onde a coluna tem ~28 caracteres.
 *
 * **Só apresentação.** O JSON guarda o nome completo, e ele continua inteiro
 * em "Endereços", no select de comunidade e no `title` do link — a forma curta
 * sempre tem onde ser resolvida, a um toque de distância.
 */

const PREFIXOS = /^(Comunidade|Capela|Igreja Matriz|Paróquia|Santuário)\s+/i;
/** "Comunidade de São Lázaro" deixa o conector órfão na frente quando o prefixo sai. */
const CONECTOR_INICIAL = /^(de|do|da|dos|das)\s+/i;
/**
 * "Nossa Senhora" abrevia em qualquer posição, não só no começo: é o que
 * transforma "São José e Nossa Senhora de Fátima" num nome que cabe **inteiro**
 * em vez de virar "São José e Nossa".
 */
const TITULOS: [RegExp, string][] = [
  [/\bNossa Senhora\b/gi, 'N. Sra.'],
  [/\bNosso Senhor\b/gi, 'N. Sr.'],
];
/** Em título mariano o complemento é a identidade: "das Candeias" não se corta. */
const MARIANO = /^N\. Sra\.|^N\. Sr\./;

/**
 * Palavra que **abre** um nome e pede complemento. Um corte que termina numa
 * delas não produziu um nome mais curto, produziu um pedaço.
 *
 * Era o buraco da regra anterior: "Jesus Bom Pastor" virava "Jesus Bom",
 * "Maria Mãe da Igreja" virava "Maria Mãe", "São José e Nossa Senhora de
 * Fátima" virava "São José e Nossa". Catorze nomes nas 113 paróquias.
 */
const ABRE_NOME = new Set([
  'e', 'de', 'do', 'da', 'dos', 'das', 'ao', 'aos', 'com', 'em',
  'nossa', 'nosso', 'senhora', 'senhor', 'sra.', 'sr.', 'santa', 'santo', 'são',
  'bom', 'boa', 'mãe', 'pai', 'sagrado', 'sagrada', 'imaculado', 'imaculada',
  'divino', 'divina', 'menino', 'rainha', 'mártir', 'mártires',
]);

/** Romano ou arábico: "João Paulo II", "Pio X", "Bento XVI". */
const NUMERAL = /^(\d+[ºªo]?|[IVXLC]+)$/;

/** O corte só vale se o que sobrou ainda fecha um nome. */
function fechaNome(s: string): boolean {
  const palavras = s.trim().split(/\s+/);
  if (palavras.length < 2) return false;
  return !ABRE_NOME.has(palavras[palavras.length - 1]!.toLowerCase());
}

function candidatos(nome: string): string[] {
  let base = nome.replace(PREFIXOS, '').replace(CONECTOR_INICIAL, '');
  for (const [re, curto] of TITULOS) base = base.replace(re, curto);
  const saidas = [base];
  const propor = (s: string) => {
    if (s !== base && fechaNome(s) && !saidas.includes(s)) saidas.push(s);
  };

  // "Sagrado Coração de Jesus e Imaculado Coração de Maria" → tira o segundo orago
  propor(base.replace(/\s+e\s+.+$/i, ''));

  /**
   * O guarda mariano vale só para o complemento: em "N. Sra. das Candeias" o
   * "das Candeias" **é** a identidade, e cortar deixaria todas as Nossas
   * Senhoras da paróquia com o mesmo nome. Já o segundo orago depois do " e "
   * sai normalmente — era isso que deixava "N. Sra. Aparecida e São Luís
   * Montfort" com 37 caracteres na coluna.
   */
  if (!MARIANO.test(base)) {
    for (const s of [...saidas]) {
      // "Santo Antônio de Pádua" → "Santo Antônio"; "Santa Teresinha do Menino Jesus" → "Santa Teresinha"
      propor(s.replace(/\s+(de|do|da|dos|das)\s+.+$/i, ''));
    }
  }
  for (const s of [...saidas]) {
    // "São Miguel Arcanjo" → "São Miguel"; "São Judas Tadeu" → "São Judas"
    const palavras = s.split(' ');
    // Numeral no fim é parte do nome, não epíteto: "São João Paulo II" não
    // pode virar "São João Paulo", que é outra pessoa.
    if (palavras.length >= 3 && !NUMERAL.test(palavras[palavras.length - 1]!)) {
      propor(palavras.slice(0, -1).join(' '));
    }
  }
  return saidas;
}

/** Compara nomes ignorando acento, caixa e o prefixo institucional. */
function mesmoNome(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/^(paroquia|comunidade|capela|santuario|catedral|unidade pastoral)\s+/, '')
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
  return n(a) === n(b);
}

/**
 * Escolhe, para cada comunidade, a forma mais curta que **não colide** com
 * nenhuma outra da mesma paróquia.
 *
 * A verificação de colisão é o que torna a regra segura sem dicionário de
 * exceções: numa paróquia com São João Batista *e* São João Evangelista, a
 * regra tenta cortar, detecta o choque e recua sozinha.
 *
 * **A matriz só se chama "Matriz" quando não tem nome próprio a dizer.** Em 49
 * das 113 paróquias de Campo Limpo a dedicação da matriz é outra — a Paróquia
 * Jesus Bom Pastor tem matriz Santo Antônio, a Cristo Libertador tem São
 * Marcos Evangelista. Escrever "Matriz" ali escondia o nome da igreja de quem
 * está procurando por ele. Quando a dedicação repete a da paróquia, "Matriz"
 * volta a ser a melhor palavra: o nome já está no título da página.
 *
 * "Matriz" fica sempre no fim da lista como última saída — é o que resolve as
 * duas paróquias em que a matriz tem o mesmo nome de outra comunidade.
 */
export function nomesCurtos(comunidades: Community[], nomeParoquia?: string): Map<string, string> {
  /** Ordem de preferência: as formas do nome, da mais curta à mais longa. */
  const preferencias = comunidades.map((c) => {
    if (c.isMain && (!nomeParoquia || mesmoNome(c.name, nomeParoquia))) return ['Matriz'];
    const formas = [...candidatos(c.name)].sort((a, b) => a.length - b.length);
    // "Matriz" entra **no fim**, não na ordenação: é rótulo, não nome, e só
    // vale quando nenhuma forma do nome distingue esta comunidade das outras.
    return c.isMain ? [...formas, 'Matriz'] : formas;
  });
  const todos = preferencias.map((f) => new Set(f));
  return new Map(
    comunidades.map((c, i) => {
      const escolhido =
        preferencias[i]!.find((cand) => !todos.some((outros, j) => j !== i && outros.has(cand))) ??
        preferencias[i]![0]!;
      return [c.id, escolhido];
    }),
  );
}

/**
 * Abreviações de logradouro e bairro, no padrão dos Correios.
 *
 * Só apresentação: o JSON guarda o endereço por extenso, e é ele que vai para
 * a busca do mapa — abreviação atrapalha geocodificação.
 */
const TIPOS: [RegExp, string][] = [
  [/^Rua\b/i, 'R.'],
  [/^Avenida\b/i, 'Av.'],
  [/^Praça\b/i, 'Pç.'],
  [/^Travessa\b/i, 'Tv.'],
  [/^Estrada\b/i, 'Estr.'],
  [/^Rodovia\b/i, 'Rod.'],
  [/^Alameda\b/i, 'Al.'],
  [/^Largo\b/i, 'Lgo.'],
  [/^Vila\b/i, 'Vl.'],
  [/^Jardim\b/i, 'Jd.'],
  [/^Parque\b/i, 'Pq.'],
  [/^Conjunto\b/i, 'Cj.'],
  [/^Chácara\b/i, 'Ch.'],
  [/^Fazenda\b/i, 'Faz.'],
  [/^Núcleo\b/i, 'Núc.'],
  [/^Distrito\b/i, 'Dist.'],
];

/** Cidade/UF ("Juquitiba/SP") e CEP ficam intactos — ali não há tipo a abreviar. */
const NAO_ABREVIAR = [/\/[A-Z]{2}$/, /^\d{5}-?\d{3}$/];

function abreviarTrecho(trecho: string): string {
  const t = trecho.trim();
  if (NAO_ABREVIAR.some((re) => re.test(t))) return t;
  for (const [re, curto] of TIPOS) {
    if (re.test(t)) return t.replace(re, curto);
  }
  return t;
}

/**
 * Abrevia cada trecho separado por `·`, e cada linha.
 *
 * Idempotente: a fonte já vem com "Jd. Thomaz" em alguns casos, e as regras só
 * casam com a palavra por extenso.
 */
export function abreviarEndereco(linhas: string[]): string[] {
  return linhas.map((linha) => linha.split('·').map(abreviarTrecho).join(' · '));
}

/**
 * Nome da igreja por extenso, o mesmo em toda a página: no select, no `title`
 * do link da grade e na lista de endereços.
 *
 * **"Comunidade" sai da frente.** 304 dos 311 nomes não-matriz já trazem a
 * palavra e o resto não, então a lista saía desencontrada — "Comunidade Jesus
 * Bom Pastor" logo acima de "Nossa Senhora Aparecida". E ali ela não distingue
 * nada: toda igreja listada pertence a esta paróquia.
 *
 * **"Capela" e "Santuário" ficam**, porque dizem o que o prédio é, não o que
 * todos eles são.
 *
 * **A matriz não vira "Comunidade".** Nenhuma das 113 matrizes traz essa
 * palavra no dado — a diocese as registra só pela dedicação, às vezes com
 * "Santuário" ou "Catedral". Quem é comunidade é a paróquia inteira (Cân. 515);
 * a matriz é a igreja onde ela se reúne. O "Matriz —" na frente é marcador do
 * que a igreja é, e a dedicação nem sempre repete a da paróquia: a Paróquia
 * Santo Eugênio de Mazenod tem matriz "Santo Antônio".
 */
export function nomeIgreja(c: Community): string {
  const nome = c.name.replace(/^Comunidade\s+/i, '');
  return c.isMain ? `Matriz — ${nome}` : nome;
}
