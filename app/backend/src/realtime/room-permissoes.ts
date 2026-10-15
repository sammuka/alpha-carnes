import { PERMISSOES, type Permissao } from '../common/rbac/permissoes';

/** Rooms que exigem permissão nomeada (E12 §3.13.6). O restante segue o legado. */
export const ROOMS_PROTEGIDAS: Readonly<Record<string, Permissao>> = {
  'fiscal-empresas': PERMISSOES.FISCAL_EMPRESAS_LER,
  'fiscal-enquadramentos': PERMISSOES.FISCAL_ENQUADRAMENTOS_LER,
  'fiscal-regras': PERMISSOES.FISCAL_REGRAS_LER,
  'fiscal-simulacoes': PERMISSOES.FISCAL_SIMULACOES_LER,
};

/** Permissão exigida para assinar a room. Fora do mapa, permanece `DISPONIBILIDADE_LER`. */
export function permissaoParaRoom(room: string): Permissao {
  return ROOMS_PROTEGIDAS[room] ?? PERMISSOES.DISPONIBILIDADE_LER;
}
