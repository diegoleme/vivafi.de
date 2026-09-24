# Perguntas para a Paróquia N. Sra. Aparecida e São Lourenço

Primeira paróquia a ser abordada. O cadastro foi atualizado em **24/09/2026** com 24 prints do
Instagram [@catolicosls](https://instagram.com/catolicosls), mas o `source` do arquivo **continua
`diocese-website`** e o `confirmedAt` continua **2026-09-23**, de propósito: 3 das 24 comunidades
não apareceram em print nenhum, e marcar `parish` afirmaria que elas foram confirmadas pela
paróquia. A página não mente (D7).

**Quando estas perguntas forem respondidas**, atualizar `source: "parish"` e `confirmedAt` para a
data da conversa.

---

## 1. Três comunidades removidas por não aparecerem em print

A paróquia publicou um card por comunidade — 24 cards cobrindo 21 comunidades. Estas três não
apareceram em nenhum, e o que havia sobre elas vinha só do site da diocese. Saíram do cadastro em
24/09/2026.

| comunidade | endereço | o que estava cadastrado |
|---|---|---|
| Comunidade Jesus Bom Pastor | R. Serra das Araras, 713 - Gleba III · Fazenda Vitória | missa 2º domingo, 15h00 |
| Comunidade Nossa Senhora de Fátima | R. José Delfino Pinto, 2.000 · Fazenda Vitória | missa 1º sábado, 17h00 |
| Comunidade São José | Estr. Fábio Pires Cintra, 630 · Aldeinha | missas 2º e 4º domingo, 11h00 |

**Confirmar com a secretária:** elas ainda existem? Se sim, voltam com o horário que ela disser.
Se fecharam ou foram incorporadas, ficam fora — mas vale saber qual das duas coisas aconteceu,
porque quem procurava por elas vai continuar procurando.

## 2. A adoração das quintas — três versões do mesmo evento

- **Cadastro (diocese):** Matriz, quinta 19h30
- **Card "Adoração Eucarística":** *"Toda última terça-feira do mês, na Matriz"* | *"Toda quinta
  feira às 18h30, com missa em seguida às 19h30"* — a segunda coluna não diz onde é
- **Card da Comunidade Santo Antônio:** *"quintas às 18h00, com Adoração ao Santíssimo"*

Foi aplicado só o que cada card diz da sua própria comunidade: adoração na Santo Antônio (quinta
18h00, junto da missa) e na Imaculado Coração de Maria (última quinta, 19h30). **A adoração da
Matriz ficou como estava**, e a "última terça-feira do mês na Matriz" **não** foi cadastrada — se
for a mesma adoração que mudou de dia, cadastrar as duas criaria uma missa que não existe.

**Resolvido em parte:** a Matriz passou a ter, nas quintas, adoração às **18h30** e missa às
**19h30** — a coluna direita do card inteira. Fica a pergunta do resto: a "última terça-feira do
mês, na Matriz" existe **além** dessa de quinta, ou é a mesma adoração que mudou de dia e o card
está desatualizado de um lado?

## 3. Confissões

O cadastro tem confissão na Matriz às terças, quintas e sextas, das 9h às 11h e das 14h às 17h —
dado do site da diocese, que não apareceu em nenhum print. Confirmar.

## 4. Festa dos padroeiros — resolvido

O schema passou a guardar uma **lista** de padroeiros, cada um com a sua festa (D50). A paróquia
ficou com São Lourenço (10/08) e Nossa Senhora Aparecida (12/10), as duas datas vindas dos
próprios cards. E 20 comunidades ganharam padroeiro e festa, que antes não tinham onde morar.

A Matriz recebeu os dois padroeiros da paróquia: é a igreja paroquial, e o título dela é o título
da paróquia — o card dela se intitula "Paróquia Nossa Senhora Aparecida e São Lourenço" e traz as
duas imagens no brasão.

O nome da comunidade matriz foi corrigido para "Nossa Senhora Aparecida e São Lourenço" — o site
da diocese registrava só "Nossa Senhora Aparecida" no campo `Igreja Matriz`, mas o card dela se
intitula "Paróquia Nossa Senhora Aparecida e São Lourenço" e traz as duas imagens no brasão. A
comunidade do Bairro Aldeinha, essa sim, é dedicada só a Nossa Senhora Aparecida.

Ainda sem padroeiro cadastrado, por falta de print: Jesus Bom Pastor, N. Sra. de Fátima e São
José.

## 5. Redes sociais

`facebook` e `youtube` apontam para `equipedeteatrosls` / `EquipedeTeatroSLS` — parece o grupo de
teatro, não a página da paróquia. Confirmar se é isso mesmo ou trocar.

---

## O que os prints resolveram

- **Imaculado Coração de Maria** não tinha **nenhuma** atividade; ganhou 6 (missas 1ª e 3ª terça,
  três terços, adoração).
- Os dois horários que estavam em texto livre viraram grade de verdade — o que exigiu abrir o
  schema para `ordinal: 5` (D49).
- 8 endereços corrigidos, 2 horários corrigidos, 2 nomes corrigidos, 12 atividades acrescentadas.
