import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

/**
 * D24: `packages/core` é domínio puro. A dependência é unidirecional —
 * o site depende do core, nunca o contrário.
 *
 * O tsc com `rootDir` já rejeita import relativo pra fora do pacote, e o pnpm
 * estrito já impede importar `astro` (não declarado). Este teste existe para
 * deixar a regra visível onde alguém vai lê-la.
 */
const PROIBIDOS = [/from\s+['"]astro[:/]/, /from\s+['"]astro['"]/, /\.astro['"]/, /\bdocument\b/, /\bwindow\b/];

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return caminho.endsWith('.ts') ? [caminho] : [];
  });
}

test('nada no core importa de astro, de .astro ou do DOM', () => {
  const violacoes = arquivos(new URL('.', import.meta.url).pathname)
    .filter((f) => !f.endsWith('fronteira.test.ts'))
    .flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      return PROIBIDOS.filter((p) => p.test(src)).map((p) => `${f}: ${p}`);
    });
  expect(violacoes).toEqual([]);
});
