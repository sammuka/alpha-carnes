import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { MENUS_CANONICOS, menusDesconhecidos } from '../../common/rbac/menus-canonicos';
import { DESCRICOES_PERMISSOES } from '../../common/rbac/permissoes';
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
   * Define os menus visíveis do perfil (decisão 10 da Onda 3). Valida ANTES de mutar:
   * href fora do catálogo canônico devolve 400 sem alterar nada (RA-05).
   */
  async definirMenus(slug: string, menus: string[], usuarioId: string) {
    const desconhecidos = menusDesconhecidos(menus);
    if (desconhecidos.length > 0) {
      throw new BadRequestException(`Menus desconhecidos: ${desconhecidos.join(', ')}`);
    }

    const resultado = await this.rbacService.definirMenusDoPerfil(slug, menus);
    if (!resultado) throw new NotFoundException('Perfil não encontrado');

    await this.auditoria.registrar(this.db, {
      tabela: 'perfis',
      registroId: '00000000-0000-0000-0000-000000000000',
      operacao: 'UPDATE',
      modulo: 'perfis',
      usuarioId,
      dadosAnteriores: { slug, menusVisiveis: resultado.anterior },
      dadosNovos: { slug, menusVisiveis: resultado.novo },
    });

    return { slug, menusVisiveis: resultado.novo };
  }

  /**
   * Catálogo para a tela de perfis: permissões agrupadas por módulo (prefixo do código)
   * e a lista canônica de menus. Cobre 100% de DESCRICOES_PERMISSOES (DoD-29).
   */
  catalogo() {
    const MODULOS: Array<{ modulo: string; prefixos: string[] }> = [
      { modulo: 'Administração', prefixos: ['USUARIOS_', 'PERFIS_', 'AUDITORIA_', 'PARAMETROS_'] },
      { modulo: 'Cadastros', prefixos: ['CLIENTES_', 'FORNECEDORES_', 'ITENS_', 'PRODUTOS_', 'REPRESENTANTES_', 'ROTAS_', 'REGRAS_', 'FROTA_', 'MODELOS_ETIQUETA_'] },
      { modulo: 'Comercial', prefixos: ['COMPRAS_PROGRAMADAS_', 'DISPONIBILIDADE_', 'PEDIDOS_', 'PEDIDO_', 'OVERBOOKING_', 'OPERACOES_', 'TABELA_PRECO_', 'ESPELHO_COMERCIAL_'] },
      { modulo: 'Gestão', prefixos: ['SIF_', 'APROVACOES_'] },
      { modulo: 'Recebimento', prefixos: ['RECEBIMENTO_', 'DIVERGENCIA_', 'OCORRENCIA_', 'CONFERENCIA_'] },
      { modulo: 'Pesagem e Desossa', prefixos: ['PESAGEM_', 'PESO_', 'ASSOCIACAO_', 'LEITURA_', 'ETIQUETA_', 'CORTE_', 'DESOSSA_', 'ESTOQUE_'] },
      { modulo: 'Expedição e Faturamento', prefixos: ['EXPEDICAO_', 'FATURAMENTO_', 'NFSE_', 'SEGURO_', 'LIBERACAO_'] },
    ];

    const codigos = Object.keys(DESCRICOES_PERMISSOES).sort();
    const usados = new Set<string>();
    const grupos = MODULOS.map(({ modulo, prefixos }) => {
      const permissoes = codigos
        .filter((c) => !usados.has(c) && prefixos.some((p) => c.startsWith(p)))
        .map((codigo) => {
          usados.add(codigo);
          return { codigo, descricao: DESCRICOES_PERMISSOES[codigo as keyof typeof DESCRICOES_PERMISSOES] };
        });
      return { modulo, permissoes };
    });

    const restantes = codigos.filter((c) => !usados.has(c));
    if (restantes.length > 0) {
      // Falha explícita: permissão nova sem módulo é erro de configuração, não silêncio (RA-05).
      throw new Error(`Permissões sem módulo no catálogo: ${restantes.join(', ')}`);
    }

    return { grupos, menus: [...MENUS_CANONICOS] };
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
