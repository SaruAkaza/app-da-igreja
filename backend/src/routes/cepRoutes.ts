import { Router } from 'express';
import { searchAddressByCep } from '../controllers/cepController.js';

const router = Router();

// Endpoint público para consulta de CEP (utilizado no cadastro, perfil e igrejas)
router.get('/:cep', searchAddressByCep);
router.get('/', searchAddressByCep);

export default router;
