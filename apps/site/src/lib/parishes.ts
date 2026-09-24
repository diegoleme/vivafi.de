import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { parishSchema, type Parish } from '@vivafide/core';

/**
 * Lê os JSONs em tempo de build, dentro do `getStaticPaths` — é Node, não Vite,
 * então não esbarra no `server.fs.allow`.
 *
 * Resolvido **pelo pacote**, não por travessia de diretório: `import.meta.url`
 * aponta para o módulo empacotado, que não fica onde o fonte ficava. Passar pelo
 * symlink do workspace é o que a D24 comprou ao escolher `packages/data`.
 */
const DIR = join(dirname(createRequire(import.meta.url).resolve('@vivafide/data/package.json')), 'catholic');

/**
 * Caminha a árvore inteira: os JSONs vivem em `catholic/<país>/<diocese>/`
 * (D47). A pasta é só arrumação — quem responde pela URL é o campo `slug`,
 * então a profundidade pode mudar sem mexer em nada aqui.
 */
function jsons(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) =>
      e.isDirectory() ? jsons(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : [],
    );
}

/**
 * Paróquia de uma comunidade só — 12 das 113 em Campo Limpo.
 *
 * Muda o que a página precisa dizer: a coluna da comunidade repetiria a mesma
 * palavra em toda linha, o cabeçalho do endereço repetiria o `<h1>`, e o
 * plural "Endereços" anunciaria um item. É a mesma condição que decide se o
 * filtro de comunidade existe — quando não há o que filtrar, também não há o
 * que distinguir.
 */
export function umaComunidadeSo(parish: Parish): boolean {
  return parish.communities.length === 1;
}

export function loadParishes(): Parish[] {
  return jsons(DIR).map((f) => parishSchema.parse(JSON.parse(readFileSync(f, 'utf8'))));
}

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIAS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

/** Formata sem tocar no fuso do sistema: a data já é dia de calendário (D33). */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const weekday = DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
  return `${weekday}, ${d} de ${MESES[m - 1]}`;
}

export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number) as [number, number, number];
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export function weekdayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
}
