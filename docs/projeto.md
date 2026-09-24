# Vivafide — horários de missa

Documento vivo. Registra o que foi decidido, **por quê**, e o que ainda está aberto.
Serve para não reabrir decisão já tomada. Se uma decisão mudar, edite aqui e diga o motivo.

Última atualização: 2026-09-17

---

## O problema

Encontrar horário de missa de uma paróquia é difícil — principalmente em data festiva
(Semana Santa, Corpus Christi, novena, festa de padroeiro), que é justamente quando a
informação mais importa e menos existe.

Do outro lado, quem mantém essa informação é a **secretária paroquial** (às vezes a PASCOM),
que responde "que horas é a missa?" o dia inteiro no WhatsApp, no direct do Instagram,
no telefone e no balcão. Manter um site paroquial não é realista para esse perfil.

**A exceção é o produto, não a grade semanal.** Grade semanal é fácil e muda uma vez por ano.
Toda implementação ingênua modela bem a grade e mal a exceção. Aqui é o contrário.

---

## Intent confirmado

| | |
|---|---|
| **Resultado** | Um link curto por paróquia (`vivafi.de/<slug>`) que abre instantâneo e responde "que horas é a missa hoje?" antes de qualquer rolagem. |
| **Usuária** | A secretária paroquial (às vezes PASCOM). Decisora *e* operadora. Baixa habilidade técnica. O pároco não decide isso — não cuida do Instagram nem do WhatsApp. |
| **Beneficiário** | O fiel que não acha horário de missa, sobretudo em data festiva. |
| **Por que agora** | É dor própria, o terreno é conhecido por dentro, e operar manual custa quase zero. |
| **Sucesso** | O link **circulando**: visitantes únicos por slug, com padrão de pico em sábado à noite / domingo de manhã e em datas festivas. Receita zero é resultado esperado, não fracasso. |
| **Restrição** | Nada pode exigir conhecimento técnico da secretária. Infra perto de zero (estático). A página nunca mente. |

### Fora de escopo agora

Imagem de preview (V2), monetização, doações, login/dashboard/editor self-service,
automação e API de WhatsApp, catequese/batismo/matrimônio, intenções de missa, pastorais,
voluntariado, newsletter, busca/diretório de paróquias próximas, outras religiões,
comunidades não religiosas.

Tudo isso vem **depois** da adoção. **O norte é pertencimento; a cunha é horário de missa.**

---

## Pesquisa de campo — Diocese de Campo Limpo (2026-09-17)

Levantamento de **113 paróquias e 314 comunidades** (427 páginas) em `dcl.org.br`.
`robots.txt` permitia; coleta espaçada, uma passada única.
Extrato estruturado em `docs/pesquisa/dcl-2026-09-17.json`, extrator em `docs/pesquisa/extrair.py`.

> Nota: o extrato é dado de terceiro. Se o projeto virar open source, decidir se ele fica
> no repositório ou sai. Está aqui porque a alternativa é re-rastrear 427 páginas da diocese.

### Hierarquia real

`Diocese → Forania → Paróquia → Comunidade`

**Forania** é um nível intermediário (9 na diocese, agrupando as 113 paróquias). Não entra no
JSON — ver D14 — mas é a **unidade natural de rollout**: não se aborda "a diocese", aborda-se
uma forania de 13 paróquias.

Distribuição de comunidades: **média 2,8** por paróquia, **máximo 23**, e **12 paróquias com
zero**. A Catedral é um dos casos com zero — o que quase fez generalizar a exceção como regra.

### A diocese inventou o campo de exceção sozinha

O template deles tem uma seção **"Missas Ocasionais"**, separada da grade semanal, presente em
**126 páginas**. Ninguém cria esse campo por elegância: criaram porque a grade não dava conta.
**"A exceção é o produto" deixou de ser hipótese e virou comportamento observado.**

E isto está escrito no campo oficial de horário de missa, no site oficial da diocese:

> *"Quintas, 1ª Sextas e datas específicas (Rodízio entre as capelas, **é necessário confirmar
> pelas redes sociais mês a mês**)"*

> *"Confirmar na secretaria"*

A fonte oficial documentando que a própria informação não é confiável, e mandando o fiel
procurar em outro lugar. É a tese do projeto escrita pela própria fonte.

### Variação real dos horários

| Tipo de recorrência | Exemplo real | Ocorrências |
|---|---|---|
| Semanal | `Domingo — 08h00, 10h00, 19h00` | maioria |
| Ordinal mensal | `1ª Sexta-feira do mês às 19h30` | **108** |
| Dia fixo do mês | `Todo dia 19 do mês às 20h`, `Todo dia 28 às 9h, 15h e 20h` | 4 |

**205 dos 424 blocos contêm texto livre** — quase metade transbordou o template estruturado.

Outros achados:

- **Comunidade inativa é estado, não ausência:** *"São Lázaro está em reforma, por enquanto,
  sem horário de celebrações"*, *"Comunidade em construção"*. Não renderizar faz o fiel ler
  como informação faltando.
- **Missa tem tipo:** `Vetus Ordo (em latim)`, `(unção dos enfermos)`, `Missa por cura e
  libertação`, `Imaculado Coração de Maria`.
- **111 das 113 paróquias publicam a data da Festa do padroeiro** (ex.: `29 de Dezembro`).

### Armadilha da extração: rótulo de campo não é conteúdo

O template da diocese mistura rótulos e valores no mesmo fluxo de texto, e eu caí nisso **duas
vezes** montando as fixtures à mão:

- `Adoração ao Santíssimo Sacramento` é o **rótulo da seção**; virou `title` da atividade, dentro
  de um bloco que já se chamava "Adoração".
- `Igreja Matriz` é **rótulo de campo**; concatenei com o valor e gravei
  `"Igreja Matriz Nossa Senhora das Dores"` como nome da comunidade.

**E o valor de `Igreja Matriz` nem sempre repete o nome da paróquia:** a Paróquia Santo Eugênio de
Mazenod tem matriz **"Santo Antônio"**. Quem assumir que matriz = nome da paróquia erra em silêncio.

Conclusão para a **T11**: o conversor precisa tratar esses rótulos como delimitadores de campo, não
como texto, e ter um teste que compare o extraído contra a página de origem em uma amostra.


---

## Decisões

### D1 — WhatsApp é a interface de edição, em definitivo
Não é andaime. A secretária nunca aprende ferramenta nenhuma: ela usa o app que já domina
e no qual já responde essa mesma pergunta. O produto é um sistema de conteúdo conversacional
que *emite* um site.

**Consequências:** o schema do JSON é alvo de escrita de um modelo de linguagem a partir de
frase solta — precisa ser fácil de *diffar* e de descrever em linguagem natural. O loop de
aprovação (staging → "perfeito, é isso" → produção) é funcionalidade permanente, é o que dá
a ela controle sobre o que sai em nome da paróquia. Nunca existe tela de login para a paróquia.

### D2 — O backend é humano no v1
Diego recebe a mudança em linguagem natural, edita o JSON, publica staging, ela aprova,
vai pra produção. Sem API da Meta, **no celular pessoal, de graça**.

**Por quê:** a tarifa do WhatsApp (~R$0,04/mensagem) não é o custo relevante — 50 paróquias
× 4 mensagens/mês = ~R$8/mês. O custo real da automação é verificação de Business Manager,
aprovação de templates pela Meta e manutenção da integração. Ou seja: tempo, não dinheiro.
Automatizar só quando o manual ficar insustentável (estimado entre 20 e 50 paróquias).

### D3 — Site 100% estático, JSONs em repositório
Um JSON por paróquia versionado no git. Push dispara build. Preview do build **é** o staging
que ela aprova. Merge publica.

### D4 — Publicação no Cloudflare Pages
Estático, free tier, custo praticamente zero. Analytics via **Cloudflare Web Analytics**:
grátis, sem cookie, sem banner de consentimento.

### D5 — Astro puro, sem backend
Supera a escolha inicial de "Astro + backend separado". Não há backend neste projeto.

### D6 — Paróquia → comunidades é v1, não v2
O caso que motiva o produto inteiro ("a missa das 10h não vai ter na matriz, vai ser na
comunidade tal, por causa da festa da padroeira") já exige múltiplas comunidades. Adiar
seria modelar errado de propósito.

### D7 — A página nunca mente
Mostra **quando a informação foi confirmada** ("horários confirmados em 12 de setembro").
Informação velha assumida vale mais que informação velha disfarçada.

**Por quê:** o modo de falha default não é a secretária avisar errado — é ela não avisar.
E o estrago não é "página desatualizada", é um fiel ir numa missa que não existia. Quando
isso acontece, quem leva a culpa é ela, não o produto. Aí ela para de compartilhar.

### D8 — Confirmação é puxada, não esperada
Os momentos de risco são previsíveis com meses de antecedência: Semana Santa, Natal,
Corpus Christi, festa do padroeiro, novenas. Diego pergunta antes. Essa é exatamente a
função que o modelo herda dele quando a automação chegar.

### D9 — Um contato responsável por paróquia, escalonamento sequencial
Nunca broadcast. Perguntar a várias pessoas ao mesmo tempo garante que ninguém responde
(difusão de responsabilidade), e some justamente na Semana Santa. Aprovação precisa de dono
único, senão há conflito de conteúdo publicado em nome da paróquia. Um secundário só é
acionado após N dias de silêncio.

### D10 — Fiel reporta erro como sinal, nunca como edição
Botão "esse horário está errado" na página. O report não altera nada: dispara Diego perguntar
ao contato oficial. Transforma a comunidade em detector de desatualização de graça — que é
o que falta no modelo puramente reativo. E dá à página uma função própria além do preview.

### D11 — Preview de imagem fica para o V2, de propósito
Mata o maior risco técnico do v1: o WhatsApp cacheia o metadata da página de forma agressiva
e não há API pública para forçar limpeza. A aposta "o preview é o produto" dependeria de
comportamento não documentado de terceiro.

**E há um motivo melhor:** se a imagem já entrega o horário, ninguém clica e não há o que medir.
**O objetivo do v1 não é informar, é medir.** Sem preview, todo acesso é um voto.

### D12 — Rebuild diário agendado
Além do rebuild por edição. Para "hoje" estar sempre correto e para o `confirmadoEm` envelhecer
à vista. Continua estático e barato.

### D13 — Grade tem recorrência mensal, não só semanal
"Terceiro domingo do mês", "primeira sexta-feira do mês" (devoção ao Sagrado Coração),
"primeiro sábado". Requisito de schema, não extra.

### D14 — Hierarquia diocesana não é modelada
Diocese, arquidiocese, país: fora do JSON. Quando chegar "missas próximas", quem busca quer
*perto de mim*, não *na minha arquidiocese*. Diocese importa como **canal de distribuição**
(falar com uma e alcançar 100 paróquias), não como estrutura de dados.

### D15 — Documentação e conteúdo em português
Projeto possivelmente open source no futuro, tradução depois. Por ora, tudo em português.

### D16 — ~~Pré-gerar em staging privado; publicar só com aceite~~ → REVISTA: publicar todas

**Revisão (2026-09-23):** decidido publicar as 113 paróquias, sem lista de aceites. A abordagem
passou a ser a diocese inteira, não uma paróquia piloto, e a procedência fica visível em cada
página (`source: diocese-website` + `confirmedAt`).

O risco original continua de pé e agora é assumido: o dado é do site da diocese, que em alguns
casos admite estar desatualizado. **A T12 (lista de aceites) fica arquivada** e volta à mesa se
alguma paróquia reclamar.

O texto original, para referência:


Há 113 paróquias com dados públicos. Pré-gerar todas em **staging privado** dá material de
abordagem instantâneo, paróquia por paróquia. Mas só vai ao ar o que tiver aceite da secretária.

**Por quê:** montar a página de uma paróquia que se frequenta é gesto de alguém da comunidade.
Publicar 113 sob domínio próprio, sem ninguém pedir, com dados que a própria diocese admite
estarem desatualizados, é outra coisa — e o primeiro erro de horário vira problema com a
diocese inteira, não com uma secretária.

### D17 — Três tipos de recorrência, não dois
Semanal, ordinal mensal ("1ª sexta-feira"), e **dia fixo do mês** ("todo dia 19"). O terceiro
são devoções de data fixa (dia 19 São José, dia 28 São Judas, dia 24 N. Sra. do Carmo). Raro,
mas quebra qualquer modelo que só entenda dia-da-semana.

### D18 — Campo de observação livre é obrigatório
Por entrada de horário **e** por comunidade. Metade dos blocos reais transbordou o template
estruturado da diocese. Sem esse campo, a informação vaza pro lugar errado ou se perde.

### D19 — Comunidade tem estado
Ativa, em reforma, em construção, sem celebrações. Ausência de horário precisa ser
*afirmada*, não inferida do vazio.

### D20 — Missa tem tipo/qualificador
Campo opcional por horário: latim/Vetus Ordo, unção dos enfermos, cura e libertação, infantil,
devoção específica.

### D21 — Forania é unidade de rollout
Não entra no JSON. Serve para planejar abordagem: 9 foranias, 10 a 16 paróquias cada.

### D22 — Calendário de confirmação derivado da data da Festa
A data do padroeiro de cada paróquia é pública e estruturada. Dá para gerar automaticamente
o calendário de quando puxar confirmação (D8) — a data de maior risco de exceção de cada
paróquia já está publicada.


### D23 — URL por path (`vivafi.de/<slug>`), nunca subdomínio
Path para escala, **domínio próprio** para posse. Subdomínio é descartado.

**Por quê — o fato que fecha a questão:** o Cloudflare Pages no plano free permite **100 domínios
customizados por projeto**, e não há wildcard: a documentação exige o fluxo "Add a custom domain"
no painel para cada um, e adicionar o CNAME na mão sem registrar antes quebra. Só a Diocese de
Campo Limpo tem **113 paróquias** — o teto é atingido antes de terminar a primeira diocese.
Subdomínio custaria um passo manual de painel e um certificado TLS por paróquia, contra a D4
("infra perto de zero") e a D16 (pré-gerar 113 de uma vez).

Além disso: path consolida autoridade de SEO num domínio só, em vez de espalhar por 113 sites
tratados como separados; e é mais fácil de ditar no telefone ("vivafide barra santa-rita").

**A vantagem real do subdomínio é sensação de posse — e ela é melhor atendida de outro jeito.**
Paróquia que quiser posse de verdade aponta o **domínio próprio** (`paroquiasantarita.org.br`)
para o projeto. Aí sim vale gastar um dos 100 slots, porque são poucos casos e com aceite.
Subdomínio fica num meio-termo que não serve bem nem à escala nem à posse.

**Consequência:** path tem um custo que subdomínio não tem — **colisão de rota**. `/sobre`,
`/contato`, `/privacidade` disputam espaço com slug de paróquia. Exige lista de slugs reservados
validada no schema, senão uma página institucional nova atropela um link que já está circulando
em grupo de WhatsApp.


### D24 — Monorepo com `apps/*` e `packages/*`
`apps/site` (Astro), `packages/core` (TypeScript puro) e `packages/data` (os JSONs das paróquias).

**Por quê:** `packages/core` existe para ser consumido depois pela automação de WhatsApp (D2),
que precisa do schema (para validar o que escreve) e do motor de recorrência (para perguntar
"confirma dia 19 às 20h?"). Os JSONs moram em `packages/data` pelo mesmo motivo: são dado do
produto, e a automação vai escrevê-los — não são conteúdo do site.

**Por que pacote e não `dados/` na raiz:** dado na raiz obriga o Astro a alcançar fora do root
do app (`base: '../../dados/paroquias'`), o que esbarra no `server.fs.allow` do Vite. Como pacote
do workspace, a resolução passa pelo symlink do `node_modules`, que o Vite trata nativamente.

**Regra da fronteira:** nada em `packages/core` importa de `astro:*`, de `.astro` ou do DOM.
A dependência é unidirecional: o site depende do core, nunca o contrário.

**Como a fronteira é garantida** — três camadas, nenhuma ferramenta extra:
| Violação | Quem pega |
|---|---|
| `import '../../apps/site/...'` | `rootDir: "src"` no tsconfig do core (TS6059) |
| `import { X } from 'astro'` | pnpm estrito: o core não declara astro, não resolve |
| `import 'astro:content'` | tsc: módulo virtual sem tipos no core |

Mais `packages/core/src/fronteira.test.ts`, que existe para deixar a regra visível onde alguém
vai lê-la. **dependency-cruiser foi avaliado e descartado por ora:** ele resolve grafo não-óbvio
com várias regras; aqui são 3 pacotes e uma regra unidirecional. Gatilho para reavaliar: quando
existir `apps/whatsapp` e houver mais de uma regra.

### D25 — pnpm como gerenciador, versão pinada
`pnpm@12.5.1`, declarado em `packageManager` na raiz.

**Por quê — o argumento decisivo:** o npm achata `node_modules` na raiz do workspace, o que
permite **dependência fantasma** — `apps/site` importaria um pacote que só `packages/core`
declarou. Funciona local, funciona no build, e quebra no dia em que o `core` for extraído para
a automação de WhatsApp: descobre-se que metade dos imports dependia de pacotes nunca declarados.
O pnpm impede isso por layout, não por disciplina. Como `packages/core` existe justamente para
ser extraído, é o argumento que decide.

O Cloudflare é neutro nessa escolha: a doc suporta npm, pnpm e Yarn workspaces igualmente.

**Cuidados operacionais descobertos na montagem:**
- O build image do Cloudflare Pages usa **pnpm 10.11.1 por padrão**. Com lockfile de pnpm 12 é
  **obrigatório** definir `PNPM_VERSION=12.5.1` no projeto, senão o build falha por formato.
- O pnpm 12 bloqueia scripts de build por padrão. O campo é **`allowBuilds`** — não
  `onlyBuiltDependencies` (pnpm 10) nem `allowScripts`.
- O pnpm 12 tem gate de idade mínima de release (`minimumReleaseAge*`), proteção de supply chain
  que exige liberar explicitamente versões recém-publicadas.
- `@astrojs/check` declara peer `typescript: ^5 || ^6`. **TypeScript 7 quebra o `pnpm check`.**
  Versão em uso: **6.0.3**.


### D26 — O modelo cobre a vida da comunidade, não só a missa
`activities[]` com `kind`: `mass`, `confession`, `adoration`, `rosary`, `novena`, `prayer-group`,
`youth-meeting`, `catechesis`, `formation`, `ministry`, `event`, `other`.
**Missa tem destaque na renderização, não no modelo de dados.**

**Por quê:** o norte é pertencimento e a missa é só a cunha. Modelar o resto agora é aditivo e
barato; retroencaixar depois obrigaria a migrar todos os JSONs. A pesquisa também mostrou que
não é marginal: **confissões em 108 das 113 paróquias, adoração em 77**.

**Duas consequências que o modelo só-missa não representava:**
- **Confissão ocupa faixa** (`09:00–11:30`), missa é ponto no tempo. Daí `startsAt` + `endsAt`.
- **Nem tudo é horário.** A Catedral publica `"Antes das Santas Missas"`; outra paróquia publica
  `"Confirmar na secretaria"`. Daí a recorrência `described`, que é exibida como texto e nunca
  calculada. Fingir que isso é horário seria mentir (D7).

`recurrence.day` aceita `"sunday"` ou `["friday","saturday"]`, e o código sempre recebe array.
Colapsou as 4 entradas de confissão da fixture em 2.

### D27 — `reason` na exceção é recomendado, não obrigatório
Era obrigatório. Deixou de ser.

**Por quê:** o caminho principal é edição às pressas a partir de uma mensagem de WhatsApp (D1).
Exigir motivo transforma um campo desejável em atrito no momento de maior pressa — véspera de
festa, Semana Santa. **O que continua inegociável é a missa cancelada aparecer riscada em vez de
sumir** (D7); sem motivo ela ainda aparece riscada, só sem o porquê.

### D28 — Nomes de campo do JSON em inglês; mensagens de erro em português
`name`, `communities`, `activities`, `recurrence`, `confirmedAt`, `isMain`, `startsAt`.

**Por quê:** o projeto pode abrir código (D15 previa tradução futura), e nome de campo é a parte
mais cara de renomear depois — está em todo JSON, em todo código e em toda mensagem do modelo
que escreve o JSON.

**Mas a mensagem de erro fica em português**, porque quem lê o erro é quem está corrigindo o JSON
às pressas lendo WhatsApp. Comentários e documentação também seguem em português (D15).


### D29 — Comunidade tem `location { lat, lng }`, além do endereço em texto
Opcional, mas capturado desde já.

**Por quê:** geocodificar 314 comunidades depois custa tempo e dinheiro; capturar junto com o
endereço é grátis. E "missas perto de mim" — desdobramento previsto — calcula distância sobre
coordenada, não sobre endereço em texto. Adiar cria dívida que só cresce com a adoção.

### D30 — `patron` e `feast` são um objeto só
`patron: { name, feast?: { day, month } }`, em vez de dois campos irmãos.

**Por quê:** a festa *é* a festa do padroeiro. Separados, permitiriam o estado inválido
"festa sem padroeiro". D22 continua valendo: a data gera o calendário de quando puxar
confirmação (D8).

### D31 — Exceções ficam no topo da paróquia, não dentro de cada comunidade
Avaliado mover para dentro de `communities[]`. Descartado.

**O argumento que decide:** `move` atravessa duas comunidades. Se a exceção vive na origem, a
comunidade de destino não sabe que vai *ganhar* uma missa — renderizá-la exigiria varrer todas
as outras. Se vive nas duas, é estado duplicado que diverge. No topo, um `move` é um registro
nomeando os dois lados.

**Dois reforços:**
- A leitura principal é "o que acontece hoje na paróquia inteira" — um filtro por data no topo,
  contra varredura em N arrays.
- É assim que a edição chega: uma frase da secretária ("domingo não tem a das 10h na matriz, vai
  ser em São José") é **um fato, um registro**. Por comunidade, seria preciso partir a frase.

**Custo assumido:** ler uma comunidade isolada não mostra suas exceções. É um join na renderização,
que já é necessário de qualquer forma por causa do `move`.


### D32 — Exceções referenciam atividades por `id`, não por coordenada
Toda atividade tem `id` semântico, único na paróquia inteira. As exceções carregam
`activityIds: [...]`, e ganharam a ação `cancel-all` com `except`.

**O argumento que decide — e que só apareceu ao tentar escrever o exemplo:**
`target: { community, startsAt }` é *consulta*, não referência. Se a missa mudar de 10:00 para
10:30, toda exceção apontando para 10:00 **deixa de casar em silêncio**. Nada quebra, nada avisa,
a exceção só para de existir na prática. É exatamente a falha que a D7 proíbe.

Com `id`: mudar o horário não quebra a referência, e apagar a atividade deixa um ID pendurado
que o validador pega. Isso **resolveu, sem precisar do motor de recorrência**, o buraco registrado
na T3 ("a exceção atinge algo?"). O que sobra para a T3 é a pergunta mais fina: *essa atividade
ocorre nessa data?*

**Evidência de que essa pergunta é real:** ao escrever o exemplo, cancelei catequese de sábado
num domingo e missa dominical numa segunda. **As duas passaram no validador e não faziam nada.**
Escritas com atenção, por quem tinha acabado de descrever o problema.

**`cancel-all` com `except`:** festa do padroeiro, Semana Santa e Natal são os dias em que tudo
muda, e são quando a secretária tem menos paciência. Listar 23 IDs seria o caminho mais provável
de erro. O registro lê como a frase real: *"nesse dia não tem nada, só a missa campal das 10h"*.

**`move` com vários alvos não aceita `to.startsAt`** — várias atividades no mesmo horário de
destino colidiriam. "As missas de 3 comunidades viram uma missa paroquial única" não é um mover:
é `cancel-all` + `add`, e o schema obriga a dizer isso.

**IDs são gerados deterministicamente** por `suggestActivityId()` em `packages/core/src/activity-id.ts`
— formato `<comunidade>-<tipo>-<quando>-<hora>` (ex.: `matriz-mass-lastsat-0800`). Determinismo é
requisito: o conversor da T11 vai gerar IDs para 113 paróquias, e reimportar precisa produzir os
mesmos IDs, senão quebraria toda exceção existente.


### D33 — Data de calendário é string; nada lê o fuso do sistema
`IsoDate = "AAAA-MM-DD"`. Toda aritmética de recorrência opera sobre a string, via `Date.UTC`
apenas como calculadora. O fuso entra em exatamente **duas** funções — `todayIn(timezone)` e
`timeNowIn(timezone)` — e sempre passado explicitamente, nunca herdado do processo.

**Por quê:** o risco Alto do plano era publicar missa no dia errado, e a origem desse risco é
confundir "instante no tempo" com "dia do calendário". O build roda em UTC no Cloudflare; às 23h
de São Paulo o `Date` local já virou o dia seguinte. **A defesa é estrutural, não é cuidado:**
se nada lê o fuso do processo, não há como errar por descuido.

Verificado rodando a suíte inteira sob três fusos a 17 horas de distância — `UTC`,
`Pacific/Kiritimati` (+14) e `America/Sao_Paulo` (−3). É o `test` padrão do pacote, não um script
opcional que apodrece.

**`monthly-day` não ajusta mês curto:** "todo dia 31" não ocorre em fevereiro, em vez de ser
empurrado para o dia 28. Empurrar inventaria uma missa que ninguém marcou.

**`cancel-all.except` é filtro, não alvo.** "Proteja estas se existirem" — proteger algo que não
ocorre naquele dia é inofensivo. Já `cancel` e `move` *afirmam* agir sobre algo, e é aí que o
silêncio engana: são checados contra a data e viram erro de validação.

**`cancelled` e `moved-out` continuam na lista de saída**, com motivo. A D7 exige que apareçam
riscados: sumir em silêncio é, para quem lê, indistinguível de nunca ter existido.


### D34 — A programação é agrupada por recorrência, não por data
Revisada **três vezes, sempre depois de usar a página**. O caminho vale mais que o destino:
cada versão morreu por um motivo diferente, e nenhum deles era previsível na mesa de desenho.

**v1 — "Missas de hoje".** Morreu porque a pergunta real não é *"o que tem hoje"*, é *"quando eu
consigo ir à missa, de preferência na minha comunidade"*. Num dia vazio dava uma resposta só,
possivelmente numa comunidade que não é a da pessoa.

**v2 — agenda de 7 dias + seção por comunidade.** Respondia às duas perguntas, mas mostrava o
mesmo horário duas vezes.

**v3 — lista cronológica de 35 dias com filtros.** Sem repetição entre seções, mas com repetição
dentro da lista: **a missa de domingo aparecia 5 vezes.** A rotina, que é a maior parte da
informação, era a que mais ocupava espaço.

**v4 — agrupada por recorrência.** Cada recorrência aparece **uma vez**, e a exceção é anotada
na própria linha em vez de virar outra entrada:

```
TODA SEMANA
  domingo  27/09   07:00  Santo Antônio de Pádua · Missa
                   08:30  Matriz · Missa
                          ⚠ domingo (11/10): acontece em Santa Clara — Missa campal

UMA VEZ POR MÊS
  4ª quinta-feira do mês   19:30  São Judas Tadeu · Missa
  próxima 24/09

SÓ NESTAS DATAS
  quinta-feira 24/12       22:00  Matriz · Missa do Galo

SEM HORÁRIO FIXO
  Confissão   Antes das Santas Missas — Matriz
```

**Quatro grupos, quatro perguntas:** o que é rotina, o que é do mês, o que é só desta vez, e o
que não tem horário. O bloco mensal é ordenado pela **próxima ocorrência**, não alfabeticamente —
saber que é "4ª quinta" é bom; saber que é *dia 24/09* é o que a pessoa precisa.

A semana começa **hoje**, não no domingo: quem abre a página quer o que vem a seguir.

**O que a v4 revelou de graça:** duas comunidades na mesma 3ª quinta-feira aparecem juntas, sob o
mesmo rótulo — o que antes parecia conflito de dado se lê como o que é (padre convidado, diácono).

**Um filtro só, e nativo: `<select>` de comunidade.** O filtro por tipo foi **removido de
propósito** — nada indicava, com dado real, que ele fosse necessário. Revisitar quando alguma
paróquia real tornar a visualização ruim; até lá, é complexidade sem evidência.

`<select>` nativo em vez de chips: melhor no toque, e não estoura a largura numa paróquia com 23
comunidades. O rótulo é "Ver uma comunidade", não "Filtrar" — descreve o que a pessoa quer, não o
mecanismo.

**Filtro é conveniência, não informação.** O controle nasce `hidden` e só aparece via JS; sem JS a
programação inteira aparece sem filtro. Escolher uma comunidade também revela endereço e estado
dela. `describeRecurrence` e `ACTIVITY_KIND_LABELS` moram no `core` porque a automação de
WhatsApp (D2) precisa do mesmo vocabulário para puxar confirmação (D8).

**v5 — uma seção por tipo.** A v4 ainda misturava missa e confissão na mesma linha da grade
semanal: sexta mostrava só confissão, sábado mostrava confissão *e* missa. Quem procurava missa
filtrava mentalmente.

Agora cada tipo tem sua seção, na ordem de `ACTIVITY_KINDS` — missa primeiro. E um índice no topo
(`Missas · Confissões · Adoração`) com âncora para cada uma, porque as pessoas chegam de dois
jeitos: querendo saber *o que há*, ou já sabendo *o que procuram*.

**Renderização diferente por densidade, não por capricho:** missa é densa (14 horários em 12
comunidades) e ganha grade por dia da semana, onde **dia vazio é informação**. Os outros tipos são
esparsos e ganham lista com a recorrência escrita — senão "sextas e sábados" viraria duas linhas
idênticas, uma em "sexta" e outra em "sábado".

Dentro de uma seção o título aparece sozinho: prefixar daria *"Missa · Devoção a São José"* dentro
do bloco **Missas**.

**A ordem dos tipos é fixa, sem arquivo de configuração.** Avaliado e adiado: nenhuma paróquia real
pediu outra ordem, e o campo seria opcional com default — então acrescentar depois **não migra JSON
nenhum**. Adiar é gratuito; adicionar agora cria um botão que talvez ninguém gire. Mesmo raciocínio
que removeu o filtro por tipo.

**Recorrência semanal no plural, de uma fonte só.** A grade escrevia `"quinta"` e a lista
`"toda quinta-feira"` — mesmo dado, dois textos, porque cada bloco montava o rótulo por conta
própria. Agora os dois chamam `describeRecurrence`, que devolve **`"quintas"`**.

O plural já implica recorrência, cabe na coluna estreita da grade, e desfaz a ambiguidade de
`"quinta"` — que podia ser lido como "nesta quinta", já que o sub-título "Toda semana" sumiu no
agrupamento por tipo.

**Ordenação canônica, não relativa a hoje.** A semana começa no **domingo** e o bloco mensal
segue a posição dentro do mês (1ª sexta, 1º sábado, 2ª quinta, …, 4º sábado, dia 19, dia 28).

Consequência disso: **o bloco semanal deixou de mostrar datas.** Ordenado a partir de domingo, as
datas ficariam fora de ordem (domingo = 27/09, terça = 22/09). E está certo assim — o bloco
semanal é **grade de padrão, não agenda**. A data continua onde importa: na frase de abertura, na
anotação de exceção, e no "próxima 02/10" do bloco mensal, onde não é derivável de cabeça.

**Horários iguais são agrupados na visualização, não no dado.** Confissão das 9h e das 14h, mesma
comunidade, mesmo dia, viram `09:00–11:30, 14:00–16:00` numa linha só.

**Por que não mudar o schema para um array de horários:** cada horário é uma atividade com `id`
próprio, e é isso que permite **cancelar só a confissão da manhã** (D32). Fundir no dado tiraria
essa capacidade para ganhar uma linha na tela. O agrupamento é apresentação e fica na apresentação.

**Consequência no plano:** a T6 foi absorvida.


### D35 — Contato público e fila de escalonamento são campos distintos
`contact` (público, vai para a página) e `escalation` (interno, nunca renderizado).
O campo interno chamava-se `contacts` e foi renomeado.

**Por quê:** `escalation` carrega o **WhatsApp pessoal da secretária** — é como Diego a aciona
para confirmar mudanças (D9). `contact` é o telefone da secretaria paroquial, que já é público.
Dois campos com nomes quase idênticos, um deles com dado pessoal, é uma pegadinha esperando
acontecer: basta alguém renderizar o array errado uma vez.

**Estrutura espelha a realidade, não uma simetria inventada:** o site da diocese publica telefone,
WhatsApp, e-mail e atendimento **no nível da paróquia**, e endereço **em cada comunidade**. O
schema segue isso — `contact` e `officeHours` na paróquia, `address` na comunidade.

`officeHours` é texto livre ("3ª a sábado, das 09h às 12h e das 13h às 16h"): a variação real é
aberta e estruturar não traria nada, já que nada é calculado em cima disso.

### D36 — Seções "Onde fica" e "Contato"; mapa por URL universal
Endereços em seção própria, filtrável pelo select de comunidade — o que **eliminou a caixa
redundante** que repetia o nome da comunidade logo acima do controle que a selecionou.

**Mapa: `google.com/maps/search/?api=1&query=`.** Abre o app no celular e o site no desktop, e
**funciona a partir do endereço em texto** — essencial, porque coordenada nós quase nunca temos.
`geo:` foi descartado: só funciona no Android.

Telefone vira `tel:` e WhatsApp vira `wa.me` — são ações, não texto para copiar à mão.

**O bloco mensal virou "Missas ocasionais"**, o termo que a própria diocese usa no template dela.
Vocabulário de quem vive a coisa vale mais que o nosso.

**Rodapé removido.** A diocese aparece uma vez, pequena, sob o nome da paróquia.


### D37 — Endereço é lista de linhas, não texto solto nem campos estruturados
`address: ["Praça Nossa Senhora das Dores, 01", "Centro — Juquitiba/SP", "06950-000"]`.
Aceita string solta (vira lista de uma linha) e o código sempre recebe lista — mesmo padrão
do `recurrence.day`.

**Por que não estruturado em rua/bairro/cidade/CEP:** o produto é global. Endereço japonês vai do
maior para o menor, alemão põe o CEP antes da cidade, americano tem estado abreviado depois da
cidade. Um schema com a ordem brasileira quebraria em qualquer outro país, e "endereço
estruturado que funciona no mundo todo" é um problema bem maior do que este projeto.

**Preservar as linhas da fonte funciona em qualquer lugar.** Quem cadastra escreve como se
escreve ali, e a página só renderiza uma linha por linha.

### D38 — Ícones em SVG inline, sem biblioteca; e o sprite foi medido e descartado
Seis ícones (mapa, telefone, WhatsApp, Instagram, Facebook, YouTube) como `path` inline.
`astro-icon` + Iconify traria milhares que nunca usaremos, mais etapa de build, numa página de 9 KB.

**O alfinete é genérico, não o logo do Google Maps.** Marca registrada tem diretrizes de uso, e
"mapa" comunica melhor que "Google". Glifos de rede social são o uso esperado para linkar o
próprio perfil.

**Sprite `<symbol>`/`<use>` foi implementado, medido e revertido:** ficou **maior** — 9214 contra
8994 bytes em gzip. O alfinete aparece doze vezes, e a intuição dizia que repetir o `path` era
desperdício; a compressão já deduplicava melhor do que as referências que o sprite acrescenta.
Fica registrado para ninguém "otimizar" isso de novo sem medir.


### D39 — Navegação do one-page: tira horizontal fixa, com scroll-spy
Uma linha grudada no topo que **rola lateralmente**, com destaque da seção atual.

**Duas soluções foram tentadas e descartadas antes, pelo mesmo defeito:**

- **Hambúrguer** — esconde conteúdo atrás de um toque. O índice é *uma linha de texto*: trocar
  uma linha visível por um ícone que exige toque para revelar a mesma linha não economiza espaço.
- **`<details>`** — eu propus, e era o mesmo erro com outra roupa. `<details>` serve para detalhe
  opcional, não para navegação principal. Também escondia.

**Por que a tira resolve:** rolar lateralmente faz **14 seções custarem a mesma altura que 3**, e
os itens continuam **visíveis**. É o padrão consagrado de one-page mobile, e o scroll-spy ainda
responde de graça a "onde estou" — algo que nenhuma das outras duas fazia.

**Custo assumido:** ~44px fixos no topo, somados aos ~56px da barra de comunidade no rodapé. É
cromo permanente numa página que passou a D34 inteira removendo cromo — mas este é cromo *útil*,
diferente do título "Programação" que não informava nada.

**Sem JavaScript continua funcionando** como âncoras; o script só acrescenta o destaque e mantém
o item ativo à vista na tira.

**Dois detalhes que só aparecem implementando:**
- A tira precisa ficar **fora do contêiner com padding**, senão o conteúdo rola por trás das
  laterais quando ela está grudada. Daí os slots `cabecalho` e `tira` no layout.
- As seções ganham `scroll-margin-top` da altura da tira, senão a âncora para embaixo dela.

**Defeito corrigido junto:** o índice listava só seções de tipo de atividade — "Endereços" e
"Contato" ficavam de fora, sendo os destinos mais procurados por quem chega sabendo o que quer.

**"Onde fica" virou "Endereços"** — diz o que a seção tem, não faz uma pergunta.


### D40 — Nomes de comunidade abreviados **só na apresentação**
"Comunidade Sagrado Coração de Jesus e Imaculado Coração de Maria" (64 caracteres) vira
"Sagrado Coração" (15) na tabela de horários. O JSON guarda o nome completo, sempre.

**Onde cada forma aparece:** curta só nas tabelas de horário, onde a coluna tem ~28 caracteres.
Completa em "Endereços", no `<select>` de comunidade e no `title` do link — a forma curta tem
sempre onde ser resolvida, a um toque de distância.

**As regras, nesta ordem:**
1. Tira o prefixo de tipo (`Comunidade`, `Capela`, `Igreja Matriz`, `Paróquia`, `Santuário`).
   Matriz vira "Matriz".
2. Abrevia título mariano: `Nossa Senhora` → `N. Sra.`, `Nosso Senhor` → `N. Sr.`
3. **Em nome mariano, para por aí.** "das Candeias", "de Fátima" e "Aparecida" *são* a identidade —
   cortar daria "N. Sra." para três comunidades diferentes.
4. Em nome de santo, corta o epíteto: o `de/do/da X` final ("de Pádua", "do Menino Jesus") e a
   última palavra solta ("Arcanjo", "Tadeu").

**A verificação de colisão é o que torna isso seguro.** Cada comunidade recebe a forma mais curta
que não coincide com nenhuma outra da mesma paróquia. Numa paróquia com São João Batista *e* São
João Evangelista, a regra tenta cortar, detecta o choque e recua sozinha — **é propriedade
verificada por paróquia, não dicionário de exceções.**

**Por que não gravar o nome curto no dado:** ele depende de *quem são as outras comunidades*.
Acrescentar uma comunidade nova pode obrigar a alongar o nome de outra — o valor não é do registro,
é do conjunto. Gravar criaria um campo que envelhece sozinho.


### D41 — `officeHours` é lista estruturada, não texto livre
`{ recurrence, startsAt?, endsAt?, note? }[]` — a mesma forma de uma atividade, sem `kind` nem
`id`, que ali não teriam uso.

**Por que o texto livre não servia:** duas das três paróquias examinadas têm **horários diferentes
em dias diferentes** — um bloco para os dias de semana e outro para o sábado:

```
Graças    3ª a 6ª das 9 às 12h e das 14 às 17h  e  Sábado das 10h às 12h e das 14h às 16h
Mazenod   3ª a 6ª das 08h às 12h e das 14h às 18h;  Sábado das 08h às 12h
```

Um par único de (dias, faixa) não representaria isso. Lista, sim.

**O que se ganha:** *"a secretaria está aberta agora?"* vira calculável — mesma classe de pergunta
que "que horas é a missa", e a página não respondia. A automação de WhatsApp (D2) também usa
("a secretaria atende até 16h hoje"). E a renderização reaproveita `describeRecurrence` e o
agrupamento de faixas já existentes, saindo no mesmo vocabulário do resto da página:

```
Secretaria   de terça a sexta   09:00–12:00, 14:00–17:00
             sábados            10:00–12:00, 14:00–16:00
```

**O que o texto livre engolia e continua coberto:** `recurrence: { type: 'described' }` é o escape
hatch para "fechado em janeiro" ou "atendimento por agendamento" — o mesmo já usado pela confissão
"Agendar na secretaria paroquial".

**Custo:** a T11 passa a fazer parsing de texto em vez de cópia ao converter as 113 paróquias.


### D42 — Coordenadas extraídas dos pinos do mapa da diocese
`location: { lat, lng }` em **393 das 426 comunidades** (92%).

O site da diocese usa Leaflet/OpenStreetMap e embute os marcadores num
`<script type="application/json">` com `lat`, `lng`, `title` e o ícone — `iconeMatriz.svg`
distingue a matriz de `iconeComunidade.svg`. O casamento é por título, e **nenhum marcador ficou
sem comunidade correspondente**: as 33 sem coordenada simplesmente não têm pino no mapa da fonte.

**Consequência imediata:** o link do mapa passa a usar `lat,lng` em vez do endereço em texto, o
que elimina a geocodificação e acerta o ponto exato. E é o que a D29 tinha antecipado — "missas
perto de mim" calcula distância sobre coordenada, não sobre endereço.

### D43 — Conversor da diocese: nada vira horário por suposição
`packages/core/scripts/converter-dcl.ts` + `dcl-parsers.ts` geram os 113 JSONs a partir do site.

**Resultado:** 1098 atividades — 884 semanais, 112 ordinais mensais, 6 de dia fixo, 96 descritas.
Atendimento estruturado em 111/113, contato em 113/113. **Duas** linhas ficaram sem reconhecimento.

**A regra que governa o parser:** toda linha que não casa com um padrão conhecido vira atividade
`described`, **nunca horário inventado**. Um parser otimista inventa missa em silêncio, que é a
única coisa que a D7 proíbe sem exceção. Por isso `horariosDaLinha` só aceita a quebra em " e "
quando **todas** as partes são reconhecidas — meio-parse vira texto.

**Dois defeitos encontrados, ambos na fonte ou na minha leitura dela:**
- `'Horários'` é sub-rótulo dentro de "Confissões", e eu o tratava como fronteira de seção.
  **46 paróquias tinham perdido o bloco de confissões em silêncio.**
- O site publica `"Lorem ipsum…"` (231 caracteres) como nome de uma comunidade. O conversor
  detecta e cai para o slug.

Guardar as **linhas cruas** de cada página no extrato permitiu corrigir o primeiro sem rebuscar
nada — vale manter essa prática.


### D44 — Identidade visual: serifa nos títulos, relógio como marca, festa como identidade
Quatro frentes, todas conservadoras de propósito — a página é lida na porta da igreja, em 3G.

**Tipografia:** Spectral nos títulos, sans do sistema no corpo e nos horários. A serifa dá gravidade
adequada ao contexto sem custar legibilidade, porque **nunca desce a corpo pequeno**. Os horários
ficam na sans justamente para manter os algarismos tabulares nativos, que são o que alinha a coluna.

Servida pela **API de fontes do Astro 7**: baixada e auto-hospedada no build, com preload e subset
`latin` + `latin-ext`. **Zero requisição a terceiro em runtime** — nenhuma chamada ao CDN do Google.
Custo: 32 KB de fonte.

**Hierarquia por tamanho, não por cor.** MISSAS é `1.5rem`; as demais seções, `1.125rem`. Missa é o
motivo da página existir e agora pesa mais que confissão e adoração.

**Ritmo:** escala única — 10 entre seções, 4 entre sub-blocos, 3 de respiro de linha. Antes havia
`mt-1,2,3,6,8,10` e `py-2,2.5,3,5` convivendo sem critério.

**Marca: um relógio.** O produto é sobre *quando*, a face de relógio lê a 16px, e não amarra a uma
religião — o que importa, porque o norte inclui outras comunidades. Sino seria a metáfora mais
exata hoje e foi descartado por esses dois motivos. O favicon leva disco claro próprio, senão o
verde da marca sumiria numa aba escura.

**Identidade por paróquia: a festa do padroeiro.** Era dado que já tínhamos em 97 das 113 e não
aparecia em lugar nenhum. Agora dá a cada página algo que é só dela — *"Festa da padroeira em 12 de
outubro — em 19 dias"* —, com destaque quando faltam 30 dias ou menos. **25 paróquias** estão nessa
janela hoje.

A concordância de gênero vem do nome ("Nossa Senhora" → padroeira, "São" → padroeiro) e, quando
não é reconhecível, cai para "Festa em 12 de outubro": errar a concordância chama mais atenção
que omiti-la.

**Cor de marca por paróquia foi avaliada e descartada:** quebraria as garantias de contraste
verificadas e produziria combinações ruins em 113 páginas que ninguém revisaria uma a uma.


### D45 — Secretaria e Redes são seções distintas, mas o dado continua plano
A página separa **SECRETARIA** (atendimento, telefone, WhatsApp, e-mail) de **REDES** (Instagram,
Facebook, YouTube, site). O campo `contact` **não** foi dividido no schema.

**A distinção é real:** telefone e WhatsApp são *como se fala com a secretaria* — pertencem ao
contexto do atendimento. Rede social é onde se *acompanha* a paróquia. Uma é transacional, a
outra é passiva.

**Mas o agrupamento é decisão de tela, e o dado plano não impede nada.** Separar no schema custaria
migrar 113 arquivos e um nível de aninhamento, para ganhar hoje exatamente o mesmo resultado.
Mesmo raciocínio do filtro por tipo (D34) e da ordem configurável: adiar é gratuito porque a
mudança seria aditiva.

**Gatilho para revisitar:** quando aparecer contato de outra natureza — telefone do pároco,
WhatsApp de uma comunidade específica — o campo plano fica ambíguo e aí a estrutura se paga.


---

## Perguntas em aberto

- **Confissões e adoração:** resolvido na D26 — modelados. Pendente decidir se aparecem na
  página do v1 ou só no dado (a missa é a cunha; poluir a dobra é risco).
- **Ordem dos tipos configurável por paróquia** — adiada. O default (`ACTIVITY_KINDS`) põe missa
  no topo. Reavaliar quando uma paróquia real pedir outra ordem.
- **Filtro por tipo de atividade** foi removido do v1. Reavaliar quando uma paróquia real tornar
  a visualização ruim — provavelmente uma com muitas atividades não-missa na matriz.
- **Qual o número que define sucesso?** Precisa ser cravado **antes** de ver dado, senão
  qualquer resultado vira "até que foi bom". Proposta: em 4 semanas, uma paróquia com
  ≥30 visitantes únicos/semana e pico visível de domingo.
- **Qual a paróquia #1?** A que Diego frequenta e onde alcança a secretária.
- **Falta um anúncio real de mudança de horário** (post de Instagram / mensagem de grupo) com a
  redação original. Importa para o lado *frase solta → JSON*, que o site da diocese não mostra.
- Limitação conhecida da métrica: link reencaminhado no WhatsApp chega **sem referrer**.
  Quase tudo aparece como tráfego direto. O sinal é o **padrão temporal**, não o número bruto.

### D46 — O slug da paróquia é o @ do Instagram dela; sem Instagram, nome + bairro da matriz
`vivafi.de/somosdasgracas`, não `vivafi.de/nossa-senhora-das-gracas`. **É um nome que a paróquia
já escolheu e reconhece** — a secretária divulga o mesmo identificador nos dois lugares, e não
precisa decorar um terceiro.

**Custo aceito, com os números medidos em 113 paróquias:** 30 dos 85 handles têm ponto ou
underscore, e esse link é ditado em voz alta o dia inteiro. Alguns não nomeiam a paróquia
(`catolicosls`, `somosdasgracas`, `nsfferreira`); um veio truncado pelo limite do Instagram
(`paroquiadivinoespiritosant`); um parece domínio (`saobenedito.org.br`). E handle muda: quando
mudar, o link do mural aponta para um nome que já não existe em lugar nenhum.

**As 28 sem Instagram** usam nome do padroeiro + bairro da matriz, sempre — `sao-jose-operario-
capao-redondo`, `santo-antonio-vila-iase`. Substitui os 20 slugs que carregavam sufixo numérico
(`santo-antonio-3`, `sagrado-coracao-de-jesus-4`), que eram 18% dos links e diziam nada: o que
distingue duas Santo Antônio é **onde ficam**. Verificado: o bairro da matriz resolve os 15 grupos
em colisão da diocese, sem empate.

**Limpezas mínimas sobre o handle:** minúsculas (o Instagram é insensível a caixa) e nada de ponto
ou underscore na ponta — underscore final **some** quando o link é sublinhado num app de mensagem,
que é exatamente onde o link circula. Por isso o `PARISH_SLUG_FORMAT` é mais largo que o
`SLUG_FORMAT` dos ids, e só ele: ninguém digita id de comunidade numa barra de endereço.

**Alias adiado (não descartado):** um campo `aliases` gerando redirects no Cloudflare Pages
resolveria o handle que muda sem matar o link antigo. Fica registrado; só se alguém pedir.

### D47 — As pastas dos dados partem só pelo que é estável: `catholic/<país ISO>/<diocese>/`
`packages/data/catholic/br/campo-limpo/somosdasgracas.json`.

**A sugestão original aninhava a diocese dentro da arquidiocese** —
`arquidiocese-de-sao-paulo/diocese-campo-limpo`. Isso é falso: as duas são **igrejas particulares
no mesmo nível**, e a arquidiocese não governa a diocese. O que as contém é a *Província
Eclesiástica de São Paulo*, onde SP é metropolitana e Campo Limpo sufragânea — e a autoridade do
metropolita sobre a sufragânea é estreita, quase toda de supervisão. A D7 vale para os dados
também: a estrutura não afirma o que não é verdade.

**Forania ficou de fora do caminho** porque se redesenha por decreto do bispo, e diocese se divide
(Campo Limpo nasceu em 1989, desmembrada). O caminho não congela o que muda: `diocese` e `deanery`
**já são campos do JSON**, e um caminho que repetisse o mesmo fato viraria uma segunda fonte de
verdade fadada a divergir. Redesenho de forania = uma edição, nenhum `git mv`.

**País em ISO 3166 (`br`)**, não `Brazil`: neutro de idioma, que importa num produto que quer ser
global, e sem acento no caminho — acento em path é dor garantida entre Linux e macOS no git.

**`catholic` no topo** abre o nível de denominação para a visão de longo prazo. Província fica como
campo quando fizer falta.

**A pasta é só arrumação.** Quem responde pela URL é o campo `slug`; o carregador e o validador
caminham a árvore inteira, então a profundidade pode mudar sem tocar em código. O validador passou
a exigir que o nome do arquivo seja o slug — é assim que se acha o arquivo a partir do link que
circula no WhatsApp.

### D48 — Paróquia de uma comunidade só não repete o que não distingue
São **12 das 113** em Campo Limpo — 11%, não um canto. Três coisas mudam:

**A coluna da comunidade some da grade.** Numa tela de 390px ela media 134px — a coluna mais
larga, **34% da tela** — e carregava "Matriz ›" em todas as oito linhas. Enquanto isso o rótulo da
recorrência estava espremido em 96px, e é lá que mora "Agendar na secretaria paroquial". Medido
depois: `230px | 104px | 0px`, e o rótulo passou a caber numa linha.

**Mas a célula não é apagada do código**, porque ela também guarda título de atividade e aviso de
missa cancelada — hoje nenhuma das 12 tem nenhum dos dois, mas o fluxo do WhatsApp (D2) vai
trazer. A terceira coluna é `auto`: mede zero quando não há nada e cresce quando há. O rótulo leva
`minmax(--col-rotulo, 1fr)` porque `auto` tem prioridade sobre `1fr` na distribuição — sem o piso,
um aviso espremia a recorrência para 66px, menos do que ela tinha antes.

**O endereço perde o cabeçalho.** "Matriz - Comunidade São Benedito" empilhava dois problemas:
"Matriz" só distingue quando existe não-matriz, e em **7 das 12** o nome da matriz é o mesmo da
paróquia — seria o `<h1>` repetido três linhas abaixo dele. Custo aceito: nas outras 5 perde-se o
nome do templo quando ele difere ("Catedral Santuário Sagrada Família" sob "Paróquia Catedral
Sagrada Família"). O selo de status fica, porque não é decoração de cabeçalho: é aviso de que a
comunidade não está em funcionamento.

**"Endereço" no singular**, na tira e no título da seção.

A condição é a mesma que decide se o filtro de comunidade existe: **quando não há o que filtrar,
também não há o que distinguir**.

### D49 — `monthly-ordinal` aceita o 5º, e ele não é o mesmo que "último"
A Comunidade Nossa Senhora Aparecida (São Lourenço da Serra) celebra **1º, 3º e 5º domingo às
11h**. Não dá para escrever isso com `'last'`: em mês de quatro domingos, `'last'` celebraria no
quarto — e ela **não** celebra nesse dia. Seria a página inventando uma missa, que é a única coisa
que a D7 proíbe sem exceção.

`ordinalInMonth` já devolvia 5 para os dias 29–31; só faltava o schema aceitar. Todo 5º é também o
último, mas o contrário é falso — é essa assimetria que os testes travam.

**`nextOccurrence` precisou de mais fôlego.** O `maxDays` era 70, dimensionado para "todo dia 31"
(62 dias). O 5º dia da semana some em meses de 28 a 30 dias: entre 31/01/2021 e 30/05/2021 passam
**119 dias** sem nenhum 5º domingo — medido varrendo 2020–2060 nos sete dias da semana. Com 70, a
linha "próxima" simplesmente sumiria em parte do ano. Passou a 125.

Serviu também para "demais sextas às 15h00" (Comunidade São Lourenço): o schema não tem "toda
sexta menos a primeira", então são quatro entradas — 2ª, 3ª, 4ª e 5ª sexta. Verboso, mas cada
linha é verdadeira e cai no dia certo.

### D50 — `patrons` é lista, na paróquia e na comunidade
Dois padroeiros não é exceção: **15 das 113 paróquias** de Campo Limpo e **24 das 427
comunidades**. E cada um tem a sua festa — a Comunidade São José e Nossa Senhora de Fátima anuncia
no próprio cartaz *"19 de março, 13 de maio, dia dos padroeiros"*. Duas datas, dita pela paróquia.

Importa porque a festa é o gatilho do calendário de confirmação (D8): é no dia do padroeiro que o
horário muda. Com uma data para dois padroeiros, metade dos avisos nunca dispara.

**A D22 continua de pé.** A festa segue morando *dentro* do padroeiro, então "festa sem padroeiro"
continua sendo estado impossível. O que caiu foi a suposição de que padroeiro é um só.

**A comunidade ganhou o campo**, que nunca teve: a dedicação vivia dentro do `name`, e a festa não
vivia em lugar nenhum. Os prints da `catolicosls` trouxeram **21 festas em 20 comunidades** que
antes não tinham onde ser guardadas.

**As 14 paróquias de dois padroeiros ficaram sem festa, de propósito.** O site da diocese publica
uma data só, e de quem ela é varia: 29/06 serve aos dois em "São Pedro e São Paulo", mas 10/08 é
do **segundo** em "Nossa Senhora Aparecida e São Lourenço". Atribuir por regra erraria em pelo
menos dois casos conhecidos, e a página que erra a festa erra justamente no dia em que mais gente
a consulta. As 12 datas que saíram do dado estão registradas em
[`docs/pesquisa/padroeiros-sem-festa.md`](pesquisa/padroeiros-sem-festa.md) — some do JSON, não do
projeto. A `catolicosls` é a exceção: os prints trazem as duas festas, então ali não havia o que
adivinhar.

### D51 — O `title` guarda a frase inteira, não só o nome
"Sagrado Coração de Jesus" no `title` de uma missa aparecia sozinho embaixo do nome da comunidade,
na coluna da comunidade — e ali se lê como **outro lugar**, não como a dedicação da missa. A frase
passou a ser `"Em honra ao Sagrado Coração de Jesus"`.

**A preposição mora no dado, não numa regra de exibição.** Um prefixo calculado teria que acertar
"ao Sagrado Coração", "à Imaculada Conceição", "de São José", "aos Santos Mártires" — concordância
com nome de santo arbitrário, que não se resolve por regra e erraria em português na página. Quem
escreve o JSON está lendo o nome, então acerta sem pensar.

Também evitou inventar um campo. O dado inteiro tem **7 títulos**, de duas naturezas: seis
nomeiam a atividade ("Terço das Mulheres") e um dizia a dedicação. Separar em `title` e `devotion`
resolveria a causa, mas por um registro só — e com a frase completa os dois casos passam a ter a
mesma forma: texto que se explica sozinho embaixo do horário.

### D52 — Uma palavra só para nomear as igrejas, e a matriz não é "Comunidade"
Três telas nomeavam a mesma igreja de três jeitos: o select dizia "Jesus Bom Pastor", a grade
dizia "Jesus Bom Pastor" e a lista de endereços dizia "Comunidade Jesus Bom Pastor". Agora é uma
função só — `nomeIgreja` — usada nas três.

**"Comunidade" sai da frente.** 304 dos 311 nomes não-matriz já trazem a palavra e o resto não,
então a lista saía desencontrada. E ali ela não distingue nada: toda igreja listada pertence a
esta paróquia. "Capela" e "Santuário" ficam, porque dizem o que aquele prédio é, não o que todos
eles são — são 10 nomes em 424.

**A matriz nunca foi "Comunidade" no dado.** Nenhuma das 113 traz essa palavra: a diocese as
registra só pela dedicação, às vezes com "Santuário" (4) ou "Catedral" (1). Quem concatenava era
a nossa função, que montava `Matriz - Comunidade ${nome}`. Canonicamente quem é comunidade é a
**paróquia inteira** (Cân. 515); a matriz é a igreja onde ela se reúne. Na fala pastoral
brasileira "Comunidade Matriz" existe, então não era erro — mas era vocabulário que a fonte não
escolheu e nós escolhemos por ela. Ficou `Matriz — <dedicação>`, em que "Matriz" é marcador do que
a igreja é, não parte do nome.

---

## Próximos passos

1. **Schema do JSON** — o artefato de verdade; todo o resto é renderizador. Exceção no centro:
   grade recorrente (semanal e mensal) por comunidade + exceções datadas (cancelar, mover,
   adicionar, com motivo) + `confirmadoEm` + contatos. *~meio dia*
2. **A página** — estática, instantânea, resposta antes da rolagem, legível em 3G na porta da
   igreja. Identidade da paróquia em primeiro plano. Botão de reportar erro. *~1 dia*
3. **Loop de publicação** — push → build → preview como staging → merge publica. *~horas*
4. **Rebuild diário agendado.** *~1 hora*
5. **Conversa com a secretária** — não como ideia, como fato consumado: a página já existe.
   A pergunta vira "quer que eu mantenha isso atualizado pra você?", e oferecer a troca do slug.

**Passo 1 destravado** pela pesquisa de campo: há variação real suficiente para desenhar o
schema contra a realidade, não contra a imaginação.
