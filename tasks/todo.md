# Tarefas: Vivafide v1 — horários de missa

Plano e riscos em [`tasks/plan.md`](plan.md). Intent e decisões em [`docs/projeto.md`](../docs/projeto.md).
Toda tarefa também precisa passar na Definition of Done do projeto (ver `plan.md`).

---

## Fase 1: Fundação

### Task 1: Scaffold Astro estático com build e testes verdes ✅ CONCLUÍDA

**Descrição:** Projeto Astro 7 em modo estático, TypeScript strict, Tailwind v4 e Vitest, com os
scripts que todas as tarefas seguintes vão usar como verificação. Nenhuma feature — só o esqueleto
que compila e testa.

**Critérios de aceite:**
- [x] `pnpm dev`, `pnpm build`, `pnpm test` e `pnpm check` existem e rodam
- [x] `astro build` gera saída 100% estática, sem adapter de servidor
- [x] Um teste trivial passa, provando que o Vitest está ligado

**Verificação:**
- [x] `pnpm build` termina sem erro e `dist/` contém HTML
- [x] `pnpm test` verde
- [x] Manual: `pnpm dev` serve uma página sem erro no console
- [x] Extra: `apps/site` importa de `@vivafide/core` e o valor sai no HTML estático

**Dependências:** Nenhuma
**Arquivos:** `package.json`, `pnpm-workspace.yaml`, `apps/site/package.json`, `apps/site/astro.config.mjs`, `packages/core/package.json`, `packages/core/tsconfig.json`
**Escopo:** S

---

### Task 2: Schema Zod da paróquia + validador de CLI ✅ CONCLUÍDA

**Descrição:** O artefato central do projeto. Modela paróquia, comunidades, grade recorrente,
exceções datadas, contatos e confirmação. É o contrato que um modelo de linguagem vai escrever a
partir de uma frase solta (D1), então precisa ser fácil de *diffar* e descritível em português.
Inclui um validador de linha de comando que roda sobre todos os JSONs.

**Critérios de aceite:**
- [x] Schema cobre: paróquia, comunidades (com estado — D19), horários com os três tipos de
      recorrência (D17), exceções datadas com motivo, tipo de missa (D20), observação livre por
      entrada e por comunidade (D18), `confirmadoEm` e contatos com ordem de escalonamento (D9)
- [x] `pnpm check` falha com mensagem legível quando um JSON está inválido
- [~] Fixture real valida — usando **Nossa Senhora das Dores** (Diocese de Campo Limpo, 12
      comunidades, 14 horários). Trocar quando a paróquia #1 for definida.
- [x] O validador **rejeita slug reservado** (D23): `sobre`, `contato`, `privacidade`,
      `termos`, `ajuda`, `api`, `admin`, `app`, `www`, `assets`, `static`, `_astro`,
      e qualquer rota institucional futura
- [x] O validador rejeita slug duplicado entre paróquias

**Verificação:**
- [x] `pnpm test` cobre schema válido e pelo menos 3 formas de inválido
- [x] `pnpm check` verde com a fixture real
- [x] Manual: introduzir um erro no JSON e confirmar que a mensagem aponta o campo

**Dependências:** T1
**Arquivos:** `packages/core/src/schema.ts`, `packages/core/src/slugs-reservados.ts`, `packages/core/scripts/validar.ts`, `packages/data/catholic/br/campo-limpo/<slug>.json`, `packages/core/src/schema.test.ts`
**Escopo:** M

> Feito com fixture da diocese, conforme previsto. Trocar pela paróquia #1 quando existir.

---

### Task 3: Motor de recorrência com testes sobre casos reais ✅ CONCLUÍDA

**Descrição:** Dada a grade de uma comunidade e uma data, retorna as missas daquele dia e as
próximas. Suporta os três tipos de recorrência encontrados na pesquisa (D17). **Todo cálculo em
`America/Sao_Paulo`**, nunca no fuso do build — é o risco alto do plano.

**Critérios de aceite:**
- [x] Resolve corretamente, num intervalo de 12 meses, os casos reais extraídos da diocese:
      `1ª Sexta-feira do mês às 19h30`, `3º Domingo às 17h`, `4º Sábado do mês às 18h`,
      `Todo dia 19 do mês às 20h`, `Todo dia 28 às 9h, 15h e 20h`
- [x] Mês sem a 5ª ocorrência do dia da semana não gera missa fantasma
- [x] "Hoje" continua correto quando o build roda em UTC às 23h de São Paulo
- [x] Distingue missa já ocorrida de próxima missa dentro do mesmo dia
- [x] **O validador checa que a atividade ocorre na data da exceção.** A referência pendurada já
      é pega pela D32; falta a pergunta fina: cancelar catequese de sábado num domingo é aceito
      hoje e não faz nada. Precisa do motor para resolver a recorrência na data concreta

**Verificação:**
- [x] `pnpm test` verde, com um caso de teste por linha real citada acima
- [x] Teste explícito rodando sob `TZ=UTC` e sob `TZ=America/Sao_Paulo`, com o mesmo resultado

**Dependências:** T2
**Arquivos:** `packages/core/src/calendar.ts`, `packages/core/src/recurrence.ts`, `packages/core/src/schedule.ts` (+ testes)
**Escopo:** M

---

### Checkpoint 1: Fundação
- [ ] `pnpm test`, `pnpm build` e `pnpm check` verdes
- [ ] Schema valida a paróquia real
- [ ] Motor de recorrência acerta os casos reais da diocese sob dois fusos
- [ ] **Revisar com Diego antes de seguir** — a assinatura de saída da T3 é o contrato de T4–T7

---

## Fase 2: A página que responde

### Task 4: Programação agrupada por recorrência ✅ (falta conferência visual)

**Descrição:** A tela que justifica o produto. Revisada três vezes após uso real (D34). Quatro
blocos — toda semana, uma vez por mês, só nestas datas, sem horário fixo — com exceções anotadas
na própria linha e filtros por comunidade e tipo. Absorveu a T6.

**Critérios de aceite:**
- [x] Uma seção por tipo de atividade, missa primeiro
- [x] Índice em `<details>` com todas as seções, incluindo "Onde fica" e "Contato" (D39)
- [x] Grade semanal (só missa) em ordem canônica, com hoje marcado e dias vazios explícitos
- [x] Tipos esparsos em lista por recorrência ("sextas e sábados"), sem quebrar em linhas iguais
- [x] Bloco mensal ordenado pela posição no mês (1ª sexta → 4º sábado → dia 19)
- [x] Horários da mesma atividade agrupados na visualização ("09:00–11:30, 14:00–16:00")
- [x] Bloco mensal ordenado pela próxima ocorrência, com a data ("próxima 24/09")
- [x] Exceção anotada na linha da atividade ("domingo (11/10): acontece em Santa Clara")
- [x] Atividades de data única em bloco próprio
- [x] Atividades sem horário (`described`) exibidas como texto, nunca como horário
- [x] Cada recorrência aparece uma vez — sem repetição de rotina
- [x] Filtro de comunidade em `<select>` nativo, em barra fixa no rodapé
- [x] Seção "Onde fica" com endereço de cada comunidade e link de mapa (D36)
- [x] Seção "Contato" com atendimento, telefone (`tel:`), WhatsApp (`wa.me`) e redes
- [x] Contato público separado da fila de escalonamento interna (D35)
- [x] Filtro por tipo removido — sem evidência de necessidade, revisitar com paróquia real
- [x] Sem JavaScript de bloqueio; sem JS mostra tudo e esconde os controles
- [x] Frase de abertura responde direto: "Próxima missa: quinta-feira, 24/09, às 19:30 — ..."
- [ ] Resposta mais próxima sem rolagem em 360×640 — **falta você conferir**

**Verificação:**
- [x] `pnpm build` verde
- [x] Contraste WCAG AA nos temas claro e escuro (mínimo 5.97:1)
- [x] Um h1, `role="list"`, `<time datetime>`, skip link, zero scripts externos
- [x] Todos os quatro blocos exercitados contra o exemplo de referência
- [ ] Manual: 360×640 com throttling 3G — **falta você**
- [ ] Manual: filtros no toque; paróquia com 23 comunidades não vira muro

**Dependências:** T3
**Arquivos:** `apps/site/src/components/Programacao.astro`, `packages/core/src/describe.ts`, `packages/core/src/schedule.ts`
**Escopo:** M

---

### Task 5: Exceções datadas aplicadas sobre a grade

**Descrição:** O produto. A grade recorrente é a base; a lista de exceções é aplicada por cima:
cancelar, mover para outra comunidade, acrescentar, sempre com motivo visível ("Festa da Padroeira").
É o caso que motivou o projeto inteiro.

**Critérios de aceite:**
- [ ] Os três tipos de exceção funcionam: cancelar, mover entre comunidades, acrescentar
- [ ] O motivo aparece junto do horário afetado, não em nota de rodapé
- [ ] Missa cancelada aparece **riscada e explicada**, nunca some silenciosamente
- [ ] Missa movida mostra para onde foi, com o nome da comunidade de destino

**Verificação:**
- [ ] `pnpm test` cobre os três tipos aplicados sobre uma grade recorrente
- [ ] Manual: reproduzir o caso real — missa das 10h da matriz cancelada, transferida para a
      comunidade por causa da festa da padroeira

**Dependências:** T4
**Arquivos:** `packages/core/src/excecoes.ts`, `packages/core/src/excecoes.test.ts`, `apps/site/src/components/MissasHoje.astro`
**Escopo:** M

---

### Task 6: ~~Grade da semana, comunidades e estado de comunidade~~ — ABSORVIDA PELA T4

Ver D34. A seção "Onde e quando" da T4 cobre a grade por comunidade, endereço, estado e motivo.
Sobrou um item, movido para a verificação da T4: conferir que a paróquia com 23 comunidades
(`paroquia-nossa-senhora-aparecida-e-sao-lourenco`) não vira um muro de texto.

---

### Task 7: Sinais de confiança

**Descrição:** Materializa a D7 — a página nunca mente. Data de confirmação visível, observações
livres no lugar certo, tipo de missa exibido.

**Critérios de aceite:**
- [ ] "Horários confirmados em <data>" visível sem rolagem
- [ ] Confirmação com mais de 30 dias fica visualmente destacada como possivelmente desatualizada
- [ ] Observação livre aparece junto da entrada a que pertence (D18)
- [ ] Tipo de missa exibido quando existir: latim, unção dos enfermos, infantil (D20)

**Verificação:**
- [ ] `pnpm test` cobre o cálculo de "confirmação envelhecida"
- [ ] Manual: colocar `confirmadoEm` de 60 dias atrás e confirmar o destaque

**Dependências:** T4
**Arquivos:** `apps/site/src/components/Confianca.astro`, `packages/core/src/confianca.ts`, `packages/core/src/confianca.test.ts`
**Escopo:** S

---

### Checkpoint 2: A página funciona
- [ ] Testes, build e check verdes
- [ ] O caso real de exceção (missa transferida por festa de padroeira) renderiza correto
- [ ] Página abre em menos de 1s em 3G simulado
- [ ] **Revisar com Diego** — é a primeira vez que dá para ver o produto

---

## Fase 3: No ar e medindo

### Task 8: Deploy no Cloudflare Pages com preview como staging — workflow escrito, faltam os secrets

**Descrição:** Fecha o loop de publicação da D3. Push em branch gera preview, que **é** o staging
que a secretária aprova; merge na principal publica. Preview protegido por Cloudflare Access (D16).

**Critérios de aceite:**
- [ ] `vivafi.de/<slug>` serve a página em produção
- [ ] Push em branch gera URL de preview estável, compartilhável por WhatsApp
- [ ] Preview exige autenticação; produção é pública
- [ ] `PNPM_VERSION=12.5.1` definido no projeto (o padrão do build image é 10.11.1 e
      não lê lockfile do pnpm 12) — ver D25
- [ ] Comando de build no painel é `pnpm test && pnpm check && pnpm build` — o `check` valida os
      113 JSONs contra o schema, e é o que impede dado inválido de ir ao ar
- [ ] *Build watch paths* configurados: editar `docs/` ou `tasks/` não dispara build do site
- [ ] `vivafi.de/` decidido: hoje o build não gera `index.html` na raiz, só as 113 pastas

**Verificação:**
- [ ] Manual: abrir o preview em janela anônima e confirmar que pede autenticação
- [ ] Manual: abrir produção em janela anônima e confirmar que abre livre

**Dependências:** T7
**Arquivos:** `wrangler.jsonc`, `.node-version`, `.github/workflows/ci.yml`, config do painel, `README.md`
**Escopo:** S

---

### Task 9: Rebuild diário agendado

**Descrição:** D12. "Hoje" precisa continuar certo sem ninguém editar nada, e `confirmadoEm`
precisa envelhecer à vista.

**Critérios de aceite:**
- [ ] Build dispara automaticamente uma vez por dia, de madrugada no horário de São Paulo
- [ ] Um build sem mudança de conteúdo ainda atualiza "hoje" corretamente
- [ ] Falha de build agendado é visível para Diego, não silenciosa

**Verificação:**
- [ ] Manual: disparar o hook na mão e confirmar novo deploy
- [ ] Manual: confirmar a data do próximo agendamento no painel

**Dependências:** T8
**Arquivos:** Cloudflare Cron Trigger + Deploy Hook, `README.md`
**Escopo:** S

> Preferir Cron Trigger do Cloudflare a `schedule` do GitHub Actions: o Actions atrasa em horário
> de pico e é desativado após 60 dias de inatividade do repositório.

---

### Task 10: Analytics e botão "esse horário está errado"

**Descrição:** Sem isto o v1 não cumpre o próprio objetivo, que é medir (D11). Mais o canal de
report da D10, que transforma o fiel em detector de desatualização.

**Critérios de aceite:**
- [ ] Cloudflare Web Analytics ativo, sem cookie e sem banner de consentimento
- [ ] Dá para ler visitante único **por slug**, não só do domínio inteiro
- [ ] Botão "esse horário está errado" abre WhatsApp para Diego com o slug já preenchido
- [ ] O report não altera nada no site — é sinal, não edição (D10)

**Verificação:**
- [ ] Manual: acessar de dois dispositivos e confirmar contagem separada por slug
- [ ] Manual: tocar no botão e confirmar que o WhatsApp abre com a mensagem certa

**Dependências:** T8
**Arquivos:** `apps/site/src/layouts/Base.astro`, `apps/site/src/components/ReportarErro.astro`
**Escopo:** S

---

### Checkpoint 3: No ar e medindo
- [ ] Uma paróquia real publicada e acessível
- [ ] Analytics registrando acesso por slug
- [ ] Rebuild diário confirmado por dois dias seguidos
- [ ] **Cravar o número de sucesso antes de ver qualquer dado**

---

## Fase 4: Material de abordagem

### Task 11: Conversor — extrato da diocese para JSONs validados ✅ CONCLUÍDA

**Descrição:** Transforma `docs/pesquisa/dcl-2026-09-17.json` em JSONs no schema da T2. Metade dos
blocos tem texto livre, então o conversor precisa ser honesto sobre o que não entendeu em vez de
adivinhar.

**Critérios de aceite:**
- [ ] Gera JSONs válidos contra o schema para as 113 paróquias
- [ ] O que não foi parseado vai para observação livre, **nunca** vira horário inventado
- [ ] Relatório final diz quantas entradas foram estruturadas e quantas caíram em texto livre
- [ ] Todo registro fica marcado com procedência: site da diocese, não confirmado

**Verificação:**
- [ ] `pnpm check` verde sobre os 113 JSONs gerados
- [ ] Manual: conferir 5 paróquias contra a página original da diocese
- [ ] Manual: conferir que os casos `Rodízio entre as capelas` e `Confirmar na secretaria` viraram
      observação, e não grade

**Dependências:** T2
**Arquivos:** `packages/core/scripts/converter-dcl.ts`, `packages/data/catholic/br/campo-limpo/*.json`
**Escopo:** M

---

### Task 12: ~~Pré-geração das 113 em staging privado~~ — ARQUIVADA (D16 revista: publicar todas)

**Descrição:** D16. Material de abordagem instantâneo, paróquia por paróquia, sem publicar nada em
nome de quem não pediu.

**Critérios de aceite:**
- [ ] As 113 páginas existem no staging privado e só no privado
- [ ] Cada uma exibe, de forma inequívoca, que o dado veio do site da diocese e não foi confirmado
- [ ] Existe uma lista de aceites que controla o que vai a público; vazia por padrão
- [ ] Nenhuma página pré-gerada aparece em produção sem estar nessa lista

**Verificação:**
- [ ] `pnpm build` de produção gera **apenas** as paróquias com aceite
- [ ] Manual: janela anônima em produção não alcança nenhuma paróquia sem aceite

**Dependências:** T11, T8
**Arquivos:** `packages/data/aceites.json`, `apps/site/src/pages/[slug].astro`, config do Pages
**Escopo:** M

---

### Checkpoint 4: O experimento
- [ ] Todos os critérios de aceite cumpridos
- [ ] Número de sucesso cravado e escrito em `docs/projeto.md`
- [ ] Primeira secretária abordada, com a página dela já pronta na mão
- [ ] **Este é o único checkpoint que o código não consegue passar sozinho**
