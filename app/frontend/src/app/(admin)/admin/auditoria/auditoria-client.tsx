'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, FileJson, Filter } from 'lucide-react';
import { toast } from 'sonner';
import type {
  FacetasAuditoria,
  FiltrosAuditoria,
  OperacaoAuditoria,
  PaginadoAuditoria,
  RegistroAuditoria,
} from '@/lib/auditoria';
import { mensagemDeErro } from '@/lib/error-message';
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ComboboxField } from '@/components/ui/combobox-field';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableCellCode,
  TableCellNum,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** StatusPill exigido pela Tarefa 29 — INSERT→expedido, UPDATE→recebido, DELETE→bloqueado, ACAO_MANUAL→divergencia. */
const VARIANT_OPERACAO: Record<OperacaoAuditoria, StatusPillVariant> = {
  INSERT: 'expedido',
  UPDATE: 'recebido',
  DELETE: 'bloqueado',
  ACAO_MANUAL: 'divergencia',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UsuarioAuditoriaOpcao { id: string; nome: string; email: string }

export function AuditoriaAdminClient() {
  const [usuarios, setUsuarios] = useState<UsuarioAuditoriaOpcao[]>([]);
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({ page: 1, pageSize: 20 });
  const [resultado, setResultado] = useState<PaginadoAuditoria | null>(null);
  const [selecionado, setSelecionado] = useState<RegistroAuditoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [facetas, setFacetas] = useState<FacetasAuditoria | null>(null);
  const [registro, setRegistro] = useState('');
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.set(k, String(v));
      });
      const res = await fetch(`/api/admin/auditoria?${params.toString()}`);
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      const data = (await res.json()) as PaginadoAuditoria;
      setResultado(data);
      setSelecionado((atual) => atual ?? data.data[0] ?? null);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/auditoria/facetas', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      setFacetas((await res.json()) as FacetasAuditoria);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const resUsuarios = await fetch('/api/admin/usuarios?page=1&pageSize=100&status=ativo', { cache: 'no-store' });
      if (!resUsuarios.ok) {
        setErro(await mensagemDeErro(resUsuarios, 'Falha ao carregar usuários'));
        return;
      }
      const raw: unknown = await resUsuarios.json();
      const lista = Array.isArray(raw)
        ? raw as UsuarioAuditoriaOpcao[]
        : ((raw as { data: UsuarioAuditoriaOpcao[] }).data ?? []);
      setUsuarios(lista);
    })();
  }, []);

  const aplicarFiltros = () => {
    const valor = registro.trim();
    setFiltros((s) => ({
      ...s,
      registroId: UUID.test(valor) ? valor : undefined,
      registroBusca: valor && !UUID.test(valor) ? valor : undefined,
      page: 1,
    }));
  };

  const exportarCsv = async () => {
    setExportando(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && k !== 'page' && k !== 'pageSize') params.set(k, String(v));
      });
      const res = await fetch(`/api/admin/auditoria/export?${params.toString()}`);
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      if (res.headers.get('X-Auditoria-Truncado') === '1') {
        toast.warning('Exportação truncada em 5000 registros. Refine o período.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Auditoria Filtrável" subtitle="Rastreabilidade completa de alterações no sistema e segregação de funções">
        <Button variant="secondary" onClick={() => void exportarCsv()} disabled={exportando}>
          <Download />
          {exportando ? 'Exportando…' : 'Exportar CSV'}
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-3 xl:grid-cols-6">
          <FormField label="Período" htmlFor="periodo-inicio" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                id="periodo-inicio"
                type="datetime-local"
                className="font-data"
                value={filtros.dataInicio ?? ''}
                onChange={(e) => setFiltros((s) => ({ ...s, dataInicio: e.target.value || undefined, page: 1 }))}
              />
              <Input
                aria-label="Período — fim"
                type="datetime-local"
                className="font-data"
                value={filtros.dataFim ?? ''}
                onChange={(e) => setFiltros((s) => ({ ...s, dataFim: e.target.value || undefined, page: 1 }))}
              />
            </div>
          </FormField>

          <FormField label="Usuário" htmlFor="auditoria-usuario">
            <ComboboxField
              id="auditoria-usuario"
              items={usuarios.map((usuario) => ({
                id: usuario.id,
                label: usuario.nome,
                sublabel: usuario.email,
              }))}
              value={filtros.usuarioId ?? ''}
              onChange={(id) =>
                setFiltros((s) => ({ ...s, usuarioId: id || undefined, page: 1 }))
              }
              placeholder="Todos os usuários"
              searchPlaceholder="Buscar usuário..."
              emptyText="Nenhum usuário encontrado."
              clearable
            />
          </FormField>

          <FormField label="Módulo">
            <SelectNative
              aria-label="Módulo"
              value={filtros.modulo ?? 'todos'}
              onChange={(e) =>
                setFiltros((s) => ({ ...s, modulo: e.target.value === 'todos' ? undefined : e.target.value, page: 1 }))
              }
            >
              <option value="todos">Todos</option>
              {(facetas?.modulos ?? []).map((modulo) => (
                <option key={modulo} value={modulo}>
                  {modulo}
                </option>
              ))}
            </SelectNative>
          </FormField>

          <FormField label="Operação">
            <SelectNative
              aria-label="Operação"
              value={filtros.operacao ?? 'todas'}
              onChange={(e) =>
                setFiltros((s) => ({
                  ...s,
                  operacao: e.target.value === 'todas' ? undefined : (e.target.value as OperacaoAuditoria),
                  page: 1,
                }))
              }
            >
              <option value="todas">Todas</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="ACAO_MANUAL">ACAO_MANUAL</option>
            </SelectNative>
          </FormField>

          <FormField label="Registro (ID)" htmlFor="registro">
            <Input
              id="registro"
              placeholder="UUID completo ou parte dele"
              value={registro}
              onChange={(e) => setRegistro(e.target.value)}
            />
          </FormField>

          <div className="flex items-end">
            <Button onClick={aplicarFiltros}>
              <Filter />
              Aplicar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid min-h-[420px] grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardContent className="max-h-[520px] overflow-auto p-0">
            {loading && <p className="p-5 text-sm text-muted-foreground">Carregando…</p>}
            {!loading && resultado && (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Data / Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Tabela / Registro</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.data.map((ev) => (
                    <TableRow
                      key={ev.id}
                      data-state={selecionado?.id === ev.id ? 'selected' : undefined}
                      className="group cursor-pointer"
                      onClick={() => setSelecionado(ev)}
                    >
                      <TableCellNum>
                        {new Date(ev.createdAt).toLocaleString('pt-BR')}
                      </TableCellNum>
                      <TableCell className="text-[13px] font-semibold text-foreground">{ev.usuarioNome ?? 'Sistema'}</TableCell>
                      <TableCell className="text-muted-foreground">{ev.modulo ?? '—'}</TableCell>
                      <TableCell>
                        <StatusPill variant={VARIANT_OPERACAO[ev.operacao]} label={ev.operacao} />
                      </TableCell>
                      <TableCellCode>
                        {ev.tabela} · {ev.registroId.slice(0, 8)}…
                      </TableCellCode>
                      <TableCell className="text-right">
                        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                          <Button variant="ghost" size="iconSm" onClick={() => setSelecionado(ev)}>
                            <Eye />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {resultado && resultado.total > resultado.pageSize && (
            <CardFooter className="justify-between">
              <Button
                variant="secondary"
                size="sm"
                disabled={(filtros.page ?? 1) <= 1}
                onClick={() => setFiltros((s) => ({ ...s, page: (s.page ?? 1) - 1 }))}
              >
                Anterior
              </Button>
              <BadgeCount>Página {filtros.page ?? 1}</BadgeCount>
              <Button
                variant="secondary"
                size="sm"
                disabled={(filtros.page ?? 1) * (filtros.pageSize ?? 20) >= resultado.total}
                onClick={() => setFiltros((s) => ({ ...s, page: (s.page ?? 1) + 1 }))}
              >
                Próxima
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <FileJson className="size-4 text-primary" />
            <CardTitle>Detalhe da Alteração</CardTitle>
          </CardHeader>
          <CardContent>
            {selecionado?.justificativa && (
              <p className="mb-2 text-xs text-muted-foreground">
                Justificativa: <span className="font-medium text-foreground">{selecionado.justificativa}</span>
              </p>
            )}
            {selecionado ? (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Dados Anteriores</p>
                  <pre className="max-h-96 overflow-auto rounded-md bg-surface-2 p-3 font-data text-[11px]">
                    {JSON.stringify(selecionado.dadosAnteriores, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Dados Novos</p>
                  <pre className="max-h-96 overflow-auto rounded-md bg-surface-2 p-3 font-data text-[11px]">
                    {JSON.stringify(selecionado.dadosNovos, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um evento.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
