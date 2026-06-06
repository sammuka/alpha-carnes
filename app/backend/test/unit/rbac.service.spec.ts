import { RbacService } from '../../src/modules/auth/rbac.service';

describe('RbacService', () => {
  let service: RbacService;

  beforeEach(() => {
    // RbacService em modo sem banco (sem injeção de DRIZZLE nos testes unitários)
    service = new RbacService({ db: null } as never);
  });

  describe('resolverPermissoes', () => {
    it('retorna vazio para perfil sem permissões', () => {
      expect(service.resolverPermissoes(['comercial'])).toEqual([]);
    });

    it('retorna permissões do administrador', () => {
      const perms = service.resolverPermissoes(['administrador']);
      expect(perms).toContain('USUARIOS_GERENCIAR');
      expect(perms).toContain('USUARIOS_APROVAR');
      expect(perms).toContain('PERFIS_GERENCIAR');
      expect(perms).toContain('AUDITORIA_VISUALIZAR');
    });

    it('faz união de permissões de múltiplos perfis', () => {
      const perms = service.resolverPermissoes(['gestor', 'diretoria']);
      expect(perms).toContain('USUARIOS_APROVAR');
      expect(perms).toContain('AUDITORIA_VISUALIZAR');
    });

    it('não duplica permissões de perfis sobrepostos', () => {
      const perms = service.resolverPermissoes(['administrador', 'gestor']);
      const auditCount = perms.filter((p) => p === 'AUDITORIA_VISUALIZAR').length;
      expect(auditCount).toBe(1);
    });
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
