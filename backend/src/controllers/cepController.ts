import { Request, Response } from 'express';
import { CepLookupError, lookupCep, type CepLookup } from '../services/cepService.js';

export function createCepHandler(lookup: CepLookup = lookupCep) {
  return async (req: Request, res: Response) => {
    const rawCep = req.params.cep || req.query.cep || '';
    if (typeof rawCep !== 'string' || !rawCep.trim()) return res.status(400).json({ error: 'Informe o CEP para pesquisa.' });
    try {
      const address = await lookup(rawCep);
      return res.json({ success: true, address });
    } catch (error) {
      if (error instanceof CepLookupError) return res.status(error.status).json({ error: error.message });
      return res.status(502).json({ error: 'Falha temporária na consulta dos Correios. Digite o endereço manualmente.' });
    }
  };
}

export const searchAddressByCep = createCepHandler();
