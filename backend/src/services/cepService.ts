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

const cepCache = new Map<string, CepAddress>();

/**
 * Normaliza e busca endereço pelo CEP utilizando os Correios e provedores integrados
 */
export async function lookupCep(rawCep: string): Promise<CepAddress> {
  if (!rawCep || typeof rawCep !== 'string') {
    throw new Error('Informe um CEP válido.');
  }

  const clean = rawCep.replace(/\D/g, '');

  if (clean.length !== 8) {
    throw new Error('O CEP deve conter exatamente 8 dígitos numéricos.');
  }

  // Verifica cache em memória
  if (cepCache.has(clean)) {
    return cepCache.get(clean)!;
  }

  let result: CepAddress | null = null;

  // 1ª Tentativa: cep-promise (Correios, BrasilAPI, ViaCEP com race / fallback)
  try {
    const data = await cepPromise(clean, { timeout: 6000 });
    result = {
      cep: clean.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
      cep_raw: clean,
      street: data.street || '',
      neighborhood: data.neighborhood || '',
      city: data.city || '',
      state: (data.state || '').toUpperCase(),
      service: data.service || 'correios',
    };
  } catch (err: any) {
    // 2ª Tentativa: Fallback direto no ViaCEP
    try {
      const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
        headers: { 'User-Agent': 'Comunhao-App/1.0' },
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const viaData = await response.json() as any;
        if (!viaData.erro) {
          result = {
            cep: clean.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
            cep_raw: clean,
            street: viaData.logradouro || '',
            neighborhood: viaData.bairro || '',
            city: viaData.localidade || '',
            state: (viaData.uf || '').toUpperCase(),
            service: 'viacep-correios',
          };
        }
      }
    } catch (fallbackErr) {
      // Ignora erro de fallback e deixa tratar abaixo
    }
  }

  if (!result) {
    throw new Error('CEP não localizado na base dos Correios.');
  }

  // Armazena no cache
  cepCache.set(clean, result);
  return result;
}
