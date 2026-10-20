import { Router } from 'express';
import { createCepHandler } from '../controllers/cepController.js';
import type { CepLookup } from '../services/cepService.js';

export function createCepRoutes(lookup?: CepLookup) {
  const router = Router();
  const handler = createCepHandler(lookup);
  // Endpoint público para consulta de CEP (cadastro, perfil e igrejas).
  router.get('/:cep', handler);
  router.get('/', handler);
  return router;
}

export default createCepRoutes();
