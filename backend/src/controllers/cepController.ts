import { Request, Response } from 'express';
import { lookupCep } from '../services/cepService.js';

export async function searchAddressByCep(req: Request, res: Response) {
  try {
    const rawCep = (req.params.cep || req.query.cep || '') as string;
    
    if (!rawCep.trim()) {
      return res.status(400).json({ error: 'Informe o CEP para pesquisa.' });
    }

    const address = await lookupCep(rawCep);
    return res.json({
      success: true,
      address,
    });
  } catch (error: any) {
    const message = error.message || 'Erro ao consultar CEP.';
    if (message.includes('8 dígitos') || message.includes('válido')) {
      return res.status(400).json({ error: message });
    }
    if (message.includes('não localizado')) {
      return res.status(404).json({ error: message });
    }
    return res.status(502).json({ error: 'Falha temporária na consulta dos Correios. Digite o endereço manualmente.' });
  }
}
