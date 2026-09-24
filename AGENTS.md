# Vivafide

Página estática por paróquia em `vivafi.de/<slug>` que responde "que horas é a missa hoje?".
A edição acontece por **WhatsApp**: a secretária paroquial manda a mudança em linguagem natural,
um humano edita o JSON, o build gera preview, ela aprova, publica.

**Antes de propor qualquer coisa, leia:**

- [`docs/projeto.md`](docs/projeto.md) — intent confirmado e **25 decisões com o porquê de cada uma**.
  Se algo parece estranho, a justificativa provavelmente está lá. Não reabra decisão sem dado novo.
- [`tasks/plan.md`](tasks/plan.md) e [`tasks/todo.md`](tasks/todo.md) — plano, riscos e tarefas
  com critérios de aceite.
- [`docs/pesquisa/`](docs/pesquisa/) — levantamento real de 113 paróquias e 314 comunidades.
  Use isto em vez de imaginar como paróquia funciona.

## Estrutura

```
apps/site/        Astro 7, estático, sem adapter (D3, D5)
packages/core/    domínio puro: schema, recorrência, exceções (D24)
packages/data/    JSONs das paróquias em catholic/<país ISO>/<diocese>/<slug>.json (D24, D47)
docs/  tasks/     decisões, pesquisa, plano
```

**Regra de fronteira (D24):** nada em `packages/core` importa de `astro:*`, de `.astro` ou do DOM.
A dependência é unidirecional. Garantido por `rootDir` no tsconfig, pelo pnpm estrito, e por
`packages/core/src/fronteira.test.ts`.

## Comandos

```bash
pnpm dev      # servidor de desenvolvimento
pnpm build    # build estático
pnpm test     # vitest em todos os pacotes
pnpm check    # tsc no core + astro check no site
```

Para o dev server em segundo plano: `astro dev --background`, com `astro dev stop|status|logs`.

## Armadilhas já descobertas (não repita)

- **TypeScript 7 quebra o `pnpm check`.** O `@astrojs/check` declara peer `^5 || ^6`.
  Versão em uso: **6.0.3**.
- **pnpm 12 usa `allowBuilds`** no `pnpm-workspace.yaml` — não `onlyBuiltDependencies` (pnpm 10)
  nem `allowScripts`.
- **Cloudflare Pages usa pnpm 10.11.1 por padrão** e não lê lockfile do pnpm 12. É obrigatório
  definir `PNPM_VERSION` no projeto (D25).
- **Toda data é calculada em `America/Sao_Paulo`**, nunca no fuso do build. O build roda em UTC;
  "hoje" calculado errado publica missa no dia errado.
- **A página nunca mente** (D7). Todo dado renderizado carrega procedência e data de confirmação.
  Missa cancelada aparece riscada e explicada — nunca some silenciosamente.
