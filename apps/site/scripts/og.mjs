/**
 * Gera `public/og.png`, a imagem que aparece quando alguém cola vivafi.de no
 * WhatsApp. Rodar à mão quando o texto mudar: `node scripts/og.mjs` (em apps/site).
 *
 * Não roda no build: o PNG é commitado. Renderizar SVG com texto depende das
 * fontes da máquina, e o build no Cloudflare não tem a Spectral instalada.
 * Aqui ela é apontada via fontconfig, a partir do cache de fontes do Astro
 * (exige ter rodado `pnpm dev` ou `pnpm build` antes).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const FONTES = resolve(import.meta.dirname, '../node_modules/.astro/fonts');
if (!readdirSync(FONTES).some((f) => f.endsWith('.woff2'))) {
  throw new Error(`Spectral não encontrada em ${FONTES}: rode pnpm build antes.`);
}

// O sharp traz um FreeType sem brotli: não lê woff2. Descomprime para TTF numa
// pasta temporária (fontTools, `pip install fonttools brotli`).
const tmp = mkdtempSync(join(tmpdir(), 'og-'));
for (const f of readdirSync(FONTES).filter((f) => f.endsWith('.woff2'))) {
  execFileSync('python3', ['-I', '-c',
    'import sys; from fontTools.ttLib import TTFont; f = TTFont(sys.argv[1]); f.flavor = None; f.save(sys.argv[2])',
    join(FONTES, f), join(tmp, f.replace('.woff2', '.ttf'))]);
}

// fontconfig precisa ser configurado antes de o sharp (libvips) carregar.
const conf = join(tmp, 'fonts.conf');
writeFileSync(conf, `<?xml version="1.0"?>
<fontconfig><dir>${tmp}</dir><include ignore_missing="yes">/etc/fonts/fonts.conf</include></fontconfig>`);
process.env.FONTCONFIG_FILE = conf;
const { default: sharp } = await import('sharp');

// Mesma paleta do global.css.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#faf8f5"/>
  <rect y="598" width="1200" height="32" fill="#1f513a"/>

  <g transform="translate(96 120) scale(2)" fill="none" stroke="#1f513a" stroke-width="3"
     stroke-linecap="round" stroke-linejoin="round">
    <circle cx="16" cy="16" r="12"/>
    <path d="M16 8.5V16.5l5.5 3.4"/>
  </g>
  <text x="176" y="168" font-family="system-ui, sans-serif" font-size="44" font-weight="600"
        fill="#1c1b17">vivafi.de</text>

  <text font-family="Spectral SemiBold" font-weight="600" font-size="88" fill="#1c1b17" letter-spacing="-1">
    <tspan x="96" y="330">Sua paróquia com</tspan>
    <tspan x="96" y="430">um site só dela</tspan>
  </text>

  <text x="96" y="512" font-family="system-ui, sans-serif" font-size="32" fill="#63604f">
    Horários de missa sempre certos, atualizados pelo WhatsApp.
  </text>
</svg>`;

const saida = resolve(import.meta.dirname, '../public/og.png');
await sharp(Buffer.from(svg)).png().toFile(saida);
console.log(`gerado: ${saida}`);
