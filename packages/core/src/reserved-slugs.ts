/**
 * D23: as páginas vivem em `vivafi.de/<slug>`, então slug de paróquia disputa
 * espaço com rota institucional. Uma página nova não pode atropelar um link que
 * já está circulando em grupo de WhatsApp.
 */
export const RESERVED_SLUGS = new Set([
  'sobre', 'contato', 'privacidade', 'termos', 'ajuda', 'suporte',
  'about', 'contact', 'privacy', 'terms', 'help', 'support',
  'api', 'admin', 'app', 'www', 'assets', 'static', 'public', '_astro',
  'blog', 'docs', 'login', 'entrar', 'conta', 'painel',
  'paroquias', 'comunidades', 'missas', 'buscar', 'perto-de-mim',
  'parishes', 'communities', 'masses', 'search', 'near-me',
]);

export const SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * D46: o slug da paróquia é o @ do Instagram dela quando existe, então precisa
 * aceitar o que o Instagram aceita — ponto e underscore no meio.
 *
 * Mais largo que `SLUG_FORMAT` de propósito, e só aqui: id de comunidade e de
 * atividade continuam estritos, porque ninguém digita um id numa barra de
 * endereço. Ponto ou underscore na ponta fica de fora — underscore final some
 * quando o link é sublinhado num app de mensagem, e é ali que o link circula.
 */
export const PARISH_SLUG_FORMAT = /^[a-z0-9]+(?:[._-]?[a-z0-9]+)*$/;
