/** "Nossa Senhora das Dores" → feminino; "São Sebastião" → masculino. */
function feminino(nome: string): boolean | null {
  if (/^(nossa senhora|santa|imaculada|sagrada)\b/i.test(nome)) return true;
  if (/^(s[ãa]o|santo|sagrado|divino|senhor|bom jesus|cristo|espírito)\b/i.test(nome)) return false;
  return null;
}

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/**
 * "Festa da padroeira em 15 de setembro".
 *
 * Quando o gênero não é reconhecível pelo nome, cai para "Festa em 15 de
 * setembro" — errar a concordância chama mais atenção que omiti-la.
 */
export function textoDaFesta(nome: string, festa: { day: number; month: number }): string {
  const quando = `${festa.day} de ${MESES[festa.month - 1]}`;
  const f = feminino(nome);
  if (f === null) return `Festa em ${quando}`;
  return `Festa ${f ? 'da padroeira' : 'do padroeiro'} em ${quando}`;
}

/** Dias até a próxima ocorrência da festa, a partir de hoje na paróquia. */
export function diasAteFesta(hoje: string, festa: { day: number; month: number }): number {
  const [ano] = hoje.split('-').map(Number) as [number];
  const alvo = `${ano}-${String(festa.month).padStart(2, '0')}-${String(festa.day).padStart(2, '0')}`;
  const base = alvo >= hoje ? alvo : `${ano + 1}-${alvo.slice(5)}`;
  const ms = Date.parse(`${base}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`);
  return Math.round(ms / 86400000);
}
