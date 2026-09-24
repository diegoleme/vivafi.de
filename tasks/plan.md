# Plano de implementação: Vivafide v1 — horários de missa

Intent confirmado e 22 decisões em [`docs/projeto.md`](../docs/projeto.md).
Pesquisa de campo (113 paróquias, 314 comunidades) em `docs/pesquisa/`.

## Visão geral

Uma página estática por paróquia em `vivafi.de/<slug>` que responde "que horas é a missa hoje?"
antes de qualquer rolagem. Dados em JSON versionado no repositório, editados manualmente por
Diego a partir de mensagens de WhatsApp da secretária paroquial. Publicação no Cloudflare Pages,
com o preview do build servindo de staging de aprovação.

**O objetivo do v1 não é informar, é medir** (D11). O placar é visitante único por slug, com
padrão de pico em sábado à noite e domingo de manhã.

## Decisões de arquitetura

- **Astro estático, sem backend** (D5). O backend é humano no v1 (D2). Zero servidor, zero login.
- **Um JSON por paróquia**, versionado (D3). O schema é o contrato que um modelo de linguagem
  vai escrever depois — precisa ser fácil de *diffar* e de descrever em linguagem natural (D1).
- **Três tipos de recorrência** (D17): semanal, ordinal mensal (`1ª sexta`), dia fixo do mês
  (`todo dia 19`). Motor próprio com testes, não biblioteca de calendário genérica.
- **Toda data é calculada em `America/Sao_Paulo`**, nunca no fuso do build. O build roda em UTC
  no Cloudflare; "hoje" calculado errado publica missa no dia errado.
- **Exceção é cidadã de primeira classe** (D11 da pesquisa): a grade recorrente é a base, a lista
  de exceções datadas é aplicada por cima. Não é campo extra — é o caminho principal.
- **A página nunca mente** (D7). Todo dado renderizado carrega procedência e data de confirmação.
- **URL por path, nunca subdomínio** (D23). O Pages free permite 100 domínios customizados
  por projeto e não tem wildcard; só a Diocese de Campo Limpo tem 113 paróquias. Posse para
  quem quiser é via domínio próprio, não subdomínio. Exige lista de slugs reservados.
- **Staging privado protegido por Cloudflare Access**; só vai a público o que tiver aceite (D16).

## Definition of Done do projeto

Não existia arquivo de DoD no repositório. Vale para toda tarefa:

- [ ] `pnpm test` verde
- [ ] `pnpm build` verde
- [ ] `pnpm check` verde (tipos + todos os JSONs validados contra o schema)
- [ ] Nenhuma informação renderizada sem procedência e data de confirmação
- [ ] A página inicial abre em menos de 1s em 3G simulado

## Grafo de dependências

```
T1 scaffold
 └── T2 schema + validador
      ├── T3 motor de recorrência  ──┐
      │                              │
      │                        T4 missas de hoje
      │                              ├── T5 exceções datadas
      │                              ├── T6 grade + comunidades
      │                              └── T7 sinais de confiança
      │                                        │
      │                                   T8 deploy Cloudflare
      │                                        ├── T9 rebuild diário
      │                                        └── T10 analytics + reportar erro
      │
      └── T11 conversor diocese → JSON
                └── T12 pré-geração em staging privado
```

## Lista de tarefas

Detalhamento completo, com critérios de aceite e verificação, em [`tasks/todo.md`](todo.md).

### Fase 1: Fundação
- T1 — Scaffold Astro estático com build e testes verdes
- T2 — Schema Zod da paróquia + validador de CLI
- T3 — Motor de recorrência com testes sobre casos reais da diocese
- **Checkpoint 1**

### Fase 2: A página que responde
- T4 — "Missas de hoje" acima da dobra
- T5 — Exceções datadas aplicadas sobre a grade
- T6 — Grade da semana, comunidades e estado de comunidade
- T7 — Sinais de confiança: confirmadoEm, observações, tipo de missa
- **Checkpoint 2**

### Fase 3: No ar e medindo
- T8 — Deploy no Cloudflare Pages com preview como staging
- T9 — Rebuild diário agendado
- T10 — Analytics e botão "esse horário está errado"
- **Checkpoint 3**

### Fase 4: Material de abordagem
- T11 — Conversor: extrato da diocese → JSONs validados
- T12 — Pré-geração das 113 paróquias em staging privado
- **Checkpoint 4 — o experimento**

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Recorrência mensal calculada errada publica horário inexistente | **Alto** — é exatamente o modo de falha que D7 existe para evitar; queima a secretária, não o produto | T3 com testes sobre os casos reais extraídos da diocese, incluindo mês sem 5ª sexta |
| Build roda em UTC e "hoje" vira o dia errado perto da meia-noite | **Alto** — erra silenciosamente | Toda data calculada em `America/Sao_Paulo`; teste com horário de fronteira |
| Dado pré-gerado da diocese está desatualizado | **Alto** — publicar erro em nome de 113 paróquias | D16: staging privado; procedência visível na página ("dado do site da diocese, não confirmado") |
| Secretária some e o dado envelhece | Médio | `confirmadoEm` visível (D7) + confirmação puxada antes das datas de risco (D8, D22) |
| Cron do GitHub Actions atrasa ou é desativado por inatividade do repo | Médio | Usar Cloudflare Cron Trigger chamando o Deploy Hook, já que a stack é Cloudflare |
| Ninguém acessa o link | **É a hipótese** | Não mitigar: medir. É o que o v1 existe para descobrir |

## Perguntas em aberto

- **Qual é a paróquia #1?** Trava a fixture real da T2 e toda a Fase 2.
- **O número que define sucesso.** Proposta: ≥30 visitantes únicos/semana com pico de domingo,
  em 4 semanas. Precisa ser cravado **antes** de ver dado.
- **`vivafi.de` já está registrado e com DNS disponível para apontar ao Cloudflare?**
- Falta um anúncio real de mudança de horário (post de Instagram) com a redação original.
  Não bloqueia o v1; importa para o lado *frase solta → JSON*.
- Se o projeto abrir código, o extrato da diocese em `docs/pesquisa/` fica ou sai?

## Paralelização

- **Sequencial obrigatório:** T1 → T2 → T3 → T4. É a espinha.
- **Paralelizável:** T11/T12 (conversor e pré-geração) correm em paralelo à Fase 2, pois só
  dependem de T2. T10 é independente de T9.
- **Precisa de contrato antes:** T5, T6 e T7 compartilham a saída de T3 — fechar essa assinatura
  na T3 antes de paralelizar.
