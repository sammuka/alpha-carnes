import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { RbacService } from '../auth/rbac.service';

@Injectable()
export class PerfisService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly rbacService: RbacService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar() {
    return this.rbacService.listarPerfisComPermissoes();
  }

  /**
   * Define o conjunto de permissões de um perfil (ADR-008 §3). Auditado (antes/depois).
   * A mudança reflete no acesso efetivo no próximo login/refresh (ADR-008 §4).
   */
  async definirPermissoes(slug: string, permissoes: string[], usuarioId: string) {
    // Valida ANTES de mutar: código desconhecido → 400 explícito, sem alterar nada (RA-05).
    if (permissoes.length > 0) {
      const existentes = await this.db
        .select({ codigo: schema.permissoes.codigo })
        .from(schema.permissoes)
        .where(inArray(schema.permissoes.codigo, permissoes));
      const validos = new Set(existentes.map((p) => p.codigo));
      const desconhecidas = permissoes.filter((p) => !validos.has(p));
      if (desconhecidas.length > 0) {
        throw new BadRequestException(`Permissões desconhecidas: ${desconhecidas.join(', ')}`);
      }
    }

    const resultado = await this.rbacService.definirPermissoesDoPerfil(slug, permissoes);
    if (!resultado) throw new NotFoundException('Perfil não encontrado');

    await this.auditoria.registrar(this.db, {
      tabela: 'perfis_permissoes',
      registroId: '00000000-0000-0000-0000-000000000000',
      operacao: 'UPDATE',
      modulo: 'perfis',
      usuarioId,
      dadosAnteriores: { slug, permissoes: resultado.anterior },
      dadosNovos: { slug, permissoes: resultado.novo },
    });

    return { slug, permissoes: resultado.novo };
  }
}
