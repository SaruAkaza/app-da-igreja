import cepPromise from 'cep-promise';

export interface CepAddress {
  cep: string;
  cep_raw: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  service: string;
}

export class CepLookupError extends Error {
  constructor(public readonly status: 400 | 404 | 502, message: string) { super(message); }
}

export type CepLookup = (rawCep: string) => Promise<CepAddress>;
export type CepProvider = (cep: string) => Promise<{
  street?: string;
  neighborhood?: string;
  city: string;
  state: string;
  service?: string;
} | null>;

const primaryProvider: CepProvider = clean => cepPromise(clean, { timeout: 6000 });
const fallbackProvider: CepProvider = async clean => {
  const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
    headers: { 'User-Agent': 'Comunhao-App/1.0' },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error('Provedor de CEP indisponível.');
  const data = await response.json() as any;
  if (data.erro === true || data.erro === 'true') return null;
  return { street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf, service: 'viacep-correios' };
};

/** Provedores separados permitem testar o contrato sem depender da rede externa. */
export function createCepLookup({ primary = primaryProvider, fallback = fallbackProvider }: { primary?: CepProvider; fallback?: CepProvider } = {}): CepLookup {
  const cache = new Map<string, CepAddress>();
  return async rawCep => {
    if (typeof rawCep !== 'string' || !/^\d{5}-?\d{3}$/.test(rawCep.trim())) throw new CepLookupError(400, 'O CEP deve conter exatamente 8 dígitos numéricos.');
    const clean = rawCep.trim().replace('-', '');
    const cached = cache.get(clean);
    if (cached) return cached;

    let notFound = false;
    for (const provider of [primary, fallback]) {
      try {
        const data = await provider(clean);
        if (data === null) { notFound = true; continue; }
        // Respostas incompletas também indicam falha do provedor.
        if (!data || typeof data.city !== 'string' || !data.city.trim() || typeof data.state !== 'string' || !/^[a-z]{2}$/i.test(data.state)) throw new Error('Resposta inválida do provedor de CEP.');
        const address: CepAddress = {
          cep: clean.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
          cep_raw: clean,
          street: data.street || '',
          neighborhood: data.neighborhood || '',
          city: data.city,
          state: data.state.toUpperCase(),
          service: data.service || 'correios',
        };
        cache.set(clean, address);
        return address;
      } catch {
        // Timeout, rede, HTTP 5xx e respostas inválidas não comprovam ausência.
      }
    }
    if (notFound) throw new CepLookupError(404, 'CEP não localizado na base dos Correios.');
    throw new CepLookupError(502, 'Falha temporária na consulta dos Correios. Digite o endereço manualmente.');
  };
}

export const lookupCep = createCepLookup();
