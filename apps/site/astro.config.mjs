// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // D3/D5: saída 100% estática, sem adapter de servidor.
  // Baixadas e auto-hospedadas no build: nenhuma requisição a terceiro em
  // runtime, e o subset sai pronto com os diacríticos do português.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Spectral',
      cssVariable: '--fonte-serifa',
      weights: [600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
    },
  ],

  output: 'static',

  site: 'https://vivafi.de',

  vite: {
    plugins: [tailwindcss()],
  },
});