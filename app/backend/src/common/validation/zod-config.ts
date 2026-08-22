import { z } from 'zod';
import { zodErrorMapPtBr } from './zod-error-map.pt-br';

// Registrado uma única vez, antes de qualquer parse. O main.ts importa este módulo
// como primeira dependência da aplicação; testes que dependem do mapa importam-no no topo.
z.config({ customError: zodErrorMapPtBr });
