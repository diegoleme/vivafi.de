/**
 * Validador de CLI. Roda sobre todos os JSONs de `packages/data/catholic`.
 *
 * D1: quem vai escrever esses JSONs é um humano apressado lendo WhatsApp e,
 * depois, um modelo de linguagem. A mensagem de erro precisa dizer o caminho
 * exato do campo e o que se esperava — não "invalid input".
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parishSchema } from '../src/schema.ts';
import { ineffectiveExceptions } from '../src/schedule.ts';

const DIR = resolve(import.meta.dirname, '../../data/catholic');

/** Caminha a árvore `catholic/<país>/<diocese>/` inteira (D47). */
function jsons(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) =>
      e.isDirectory() ? jsons(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : [],
    );
}

const arquivos = jsons(DIR).map((f) => relative(DIR, f));
if (arquivos.length === 0) {
  console.log('nenhum JSON de paróquia em packages/data/catholic — nada a validar');
  process.exit(0);
}

/**
 * O nome do arquivo tem que ser o slug: é assim que quem recebe "muda a missa
 * da Nossa Senhora das Graças" acha o arquivo a partir do link que circula.
 */
function esperado(arquivo: string): string {
  return arquivo.split(/[\\/]/).pop()!.replace(/\.json$/, '');
}

const slugsVistos = new Map<string, string>();
let falhas = 0;

for (const arquivo of arquivos) {
  const caminho = join(DIR, arquivo);
  let bruto: unknown;
  try {
    bruto = JSON.parse(readFileSync(caminho, 'utf8'));
  } catch (e) {
    console.error(`✗ ${arquivo}\n    JSON inválido: ${(e as Error).message}`);
    falhas++;
    continue;
  }

  const r = parishSchema.safeParse(bruto);
  if (!r.success) {
    console.error(`✗ ${arquivo}`);
    for (const issue of r.error.issues) {
      const caminhoCampo = issue.path.length ? issue.path.join('.') : '(raiz)';
      console.error(`    ${caminhoCampo}: ${issue.message}`);
    }
    falhas++;
    continue;
  }

  /**
   * Exceção que não atinge nada é a última falha silenciosa: o schema aceita,
   * a página renderiza igual, e quem escreveu acha que cancelou a missa.
   * Por isso é erro, não aviso.
   */
  const semEfeito = ineffectiveExceptions(r.data);
  if (semEfeito.length > 0) {
    console.error(`✗ ${arquivo}`);
    for (const p of semEfeito) {
      console.error(`    exceptions.${p.index} (${p.date}) → "${p.activityId}": ${p.motivo}`);
    }
    falhas++;
    continue;
  }

  if (r.data.slug !== esperado(arquivo)) {
    console.error(`✗ ${arquivo}\n    slug "${r.data.slug}" não bate com o nome do arquivo`);
    falhas++;
    continue;
  }

  const anterior = slugsVistos.get(r.data.slug);
  if (anterior) {
    console.error(`✗ ${arquivo}\n    slug "${r.data.slug}" já usado por ${anterior}`);
    falhas++;
    continue;
  }
  slugsVistos.set(r.data.slug, arquivo);

  const atividades = r.data.communities.flatMap((c: { activities: { kind: string }[] }) => c.activities);
  const missas = atividades.filter((a: { kind: string }) => a.kind === 'mass').length;
  console.log(
    `✓ ${r.data.slug}  (${r.data.communities.length} comunidades, ${missas} missas, ` +
      `${atividades.length - missas} outras atividades, confirmado em ${r.data.confirmedAt})`,
  );
}

if (falhas > 0) {
  console.error(`\n${falhas} de ${arquivos.length} arquivo(s) com erro`);
  process.exit(1);
}
console.log(`\n${arquivos.length} arquivo(s) válido(s)`);
