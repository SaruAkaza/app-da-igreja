import assert from 'node:assert/strict';
import { createCepLookup, CepLookupError, type CepLookup, type CepProvider } from './cepService.js';

export async function runCepTests() {
  let checks = 0;
  const check = (label: string, assertion: () => void) => { assertion(); checks++; console.log('✓ ' + label); };
  const address = { city: 'São Paulo', state: 'sp', street: 'Praça da Sé', neighborhood: 'Sé', service: 'fixture' };
  const unavailable: CepProvider = async () => { throw new Error('Timeout de rede'); };
  let primaryCalls = 0, fallbackCalls = 0;
  const cached = createCepLookup({ primary: async clean => { assert.equal(clean, '01001000'); primaryCalls++; return address; }, fallback: async () => { fallbackCalls++; return null; } });
  const result = await cached('01001-000');
  await cached('01001000');
  check('CEP normaliza endereço e reutiliza cache sem chamar fallback', () => { assert.equal(result.cep, '01001-000'); assert.equal(result.state, 'SP'); assert.equal(primaryCalls, 1); assert.equal(fallbackCalls, 0); });
  const fallback = await createCepLookup({ primary: unavailable, fallback: async () => address })('01001000');
  check('CEP usa fallback quando provedor primário está indisponível', () => assert.equal(fallback.city, 'São Paulo'));
  await assert.rejects(createCepLookup({ primary: unavailable, fallback: async () => null })('00000000'), error => error instanceof CepLookupError && error.status === 404);
  check('CEP ausente é 404 somente com resposta explícita do provedor', () => {});
  await assert.rejects(createCepLookup({ primary: unavailable, fallback: unavailable })('01001000'), error => error instanceof CepLookupError && error.status === 502);
  check('Falhas dos provedores de CEP retornam 502, sem inventar ausência', () => {});
  await assert.rejects(createCepLookup({ primary: async () => ({ city: '', state: '' }), fallback: unavailable })('01001000'), error => error instanceof CepLookupError && error.status === 502);
  check('Resposta incompleta de CEP é falha temporária', () => {});
  await assert.rejects(cached('123'), error => error instanceof CepLookupError && error.status === 400);
  await assert.rejects(cached('abc01001000'), error => error instanceof CepLookupError && error.status === 400);
  check('CEP inválido é rejeitado antes de consultar provedores', () => assert.equal(primaryCalls, 1));
  return checks;
}

export const cepFixture: CepLookup = createCepLookup({
  primary: async clean => {
    if (clean === '01001000') return { city: 'São Paulo', state: 'SP', street: 'Praça da Sé', neighborhood: 'Sé', service: 'fixture' };
    if (clean === '00000000') return null;
    throw new Error('Provedor de teste indisponível');
  },
  fallback: async clean => {
    if (clean === '00000000') return null;
    throw new Error('Provedor de teste indisponível');
  },
});
