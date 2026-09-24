import { expect, test } from 'vitest';
import { SCHEMA_VERSION } from './index.ts';

test('o pacote core carrega e o vitest está ligado', () => {
  expect(SCHEMA_VERSION).toBe(1);
});
