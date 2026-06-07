import { RbacService } from '../../src/modules/auth/rbac.service';

describe('RbacService (unidade — métodos puros)', () => {
  let service: RbacService;

  beforeEach(() => {
    // resolverPermissoes/ensurePermissoes dependem do banco (ADR-008) e são cobertos por e2e.
    // Aqui validamos apenas os métodos puros, sem injeção de DRIZZLE.
    service = new RbacService({ db: null } as never);
  });

  describe('temPermissao', () => {
    it('retorna true quando a permissão está presente', () => {
      expect(service.temPermissao(['USUARIOS_GERENCIAR'], 'USUARIOS_GERENCIAR')).toBe(true);
    });

    it('retorna false quando a permissão está ausente', () => {
      expect(service.temPermissao(['AUDITORIA_VISUALIZAR'], 'USUARIOS_GERENCIAR')).toBe(false);
    });
  });

  describe('assertCriadorNaoAprovador (SF-01)', () => {
    it('não lança quando criador e aprovador são diferentes', () => {
      expect(() => service.assertCriadorNaoAprovador('id-a', 'id-b')).not.toThrow();
    });

    it('lança quando criador e aprovador são o mesmo ID', () => {
      expect(() => service.assertCriadorNaoAprovador('id-x', 'id-x')).toThrow();
    });
  });
});
