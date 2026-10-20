import { api } from './api';

export interface CepResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  service?: string;
}

/**
 * Remove qualquer caractere que não seja dígito numérico
 */
export function cleanCep(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(0, 8);
}

/**
 * Aplica a máscara 00000-000 no CEP
 */
export function formatCep(raw: string): string {
  const digits = cleanCep(raw);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/**
 * Consulta o endereço do CEP através da API dos Correios integrada no backend,
 * com fallback direto ao ViaCEP para máxima resiliência no aplicativo.
 */
export async function searchCep(raw: string): Promise<CepResult> {
  const digits = cleanCep(raw);
  if (digits.length !== 8) {
    throw new Error('Digite os 8 dígitos do CEP.');
  }

  // 1ª Tentativa: Endpoint dos Correios no backend
  try {
    const res = await api.get(`/api/cep/${digits}`);
    if (res.data?.success && res.data?.address) {
      return {
        cep: res.data.address.cep || formatCep(digits),
        street: res.data.address.street || '',
        neighborhood: res.data.address.neighborhood || '',
        city: res.data.address.city || '',
        state: (res.data.address.state || '').toUpperCase(),
        service: res.data.address.service || 'correios',
      };
    }
  } catch (err: any) {
    // Se o backend retornou 400 ou 404 explícito (CEP não existe), propaga a mensagem
    if (err.response?.status === 400 || err.response?.status === 404) {
      throw new Error(err.response.data?.error || 'CEP não localizado na base dos Correios.');
    }
    // Para outros erros (falha de rede com backend), segue para o fallback abaixo
  }

  // 2ª Tentativa: Fallback direto no ViaCEP
  try {
    const fallbackResponse = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (fallbackResponse.ok) {
      const data = await fallbackResponse.json() as any;
      if (!data.erro) {
        return {
          cep: formatCep(digits),
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: (data.uf || '').toUpperCase(),
          service: 'viacep-correios',
        };
      }
    }
  } catch {
    // Falha em ambas as tentativas
  }

  throw new Error('CEP não localizado. Verifique os números digitados.');
}
