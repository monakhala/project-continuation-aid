import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/lib/inventra/copilot.functions.ts', 'utf8');

describe('Copilot access control', () => {
  it('requires verified sign-in before handling AI requests', () => {
    expect(source).toMatch(/createServerFn\(\{method:'POST'\}\)\s*\.middleware\(\[requireSupabaseAuth\]\)\s*\.inputValidator/);
  });
});