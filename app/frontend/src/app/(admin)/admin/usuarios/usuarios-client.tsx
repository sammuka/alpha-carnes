'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2, Filter, Plus, Trash2 } from 'lucide-react';
import type { CriarUsuarioDto, PerfilComPermissoes, Usuario } from '@/lib/usuarios';
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusPill } from '@/components/ui/status-pill';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SelectNative } from '@/components/ui/select-native';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FormField } from '@/components/ui/form-field';
import { detalharErro, extrairMensagemErro } from '@/lib/error-message';
import { useErrosPorCampo } from '@/lib/use-erros-campo';
import { RepresentantesPermitidos } from './_components/representantes-permitidos';
import { ResumoPerfis } from './resumo-perfis';

function formatarUltimoAcesso(valor: string | null): string {
  if (valor === null) return 'Nunca acessou';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(valor));
}

export function UsuariosAdminClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfis, setPerfis] = useState<PerfilComPermissoes[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState<CriarUsuarioDto>({
    nome: '', email: '', password: '', perfis: [], representantes: [],
  });
  const [representantesSelecionados, setRepresentantesSelecionados] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [aprovando, setAprovando] = useState(false);
  const [perfilFiltro, setPerfilFiltro] = useState('todos');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const { erros, setErros, limparCampo, limparTudo } = useErrosPorCampo();

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [resU, resP] = await Promise.all([
        fetch('/api/admin/usuarios'),
        fetch('/api/admin/perfis'),
      ]);
      if (!resU.ok) {
        setErro('Falha ao carregar usuários');
        return;
      }
      setUsuarios((await resU.json()) as Usuario[]);
      if (resP.ok) {
        setPerfis((await resP.json()) as PerfilComPermissoes[]);
      }
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const usuariosFiltrados = useMemo(() => usuarios.filter((usuario) => {
    const atendePerfil =
      perfilFiltro === 'todos' || usuario.perfis.includes(perfilFiltro);
    const atendeStatus =
      statusFiltro === 'todos'
      || (statusFiltro === 'ativo' ? usuario.ativo : !usuario.ativo);
    return atendePerfil && atendeStatus;
  }), [usuarios, perfilFiltro, statusFiltro]);

  function abrirNovo() {
    setEditando(null);
    setForm({ nome: '', email: '', password: '', perfis: [], representantes: [] });
    setRepresentantesSelecionados([]);
    setAtivo(true);
    limparTudo();
    setSheetAberto(true);
  }

  function abrirEditar(u: Usuario) {
    setEditando(u);
    setForm({ nome: u.nome, email: u.email, password: '', perfis: u.perfis });
    setRepresentantesSelecionados(u.representantesPermitidos.map((r) => r.id));
    setAtivo(u.ativo);
    limparTudo();
    setSheetAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSubmitting(true);
    try {
      if (editando) {
        const res = await fetch(`/api/admin/usuarios/${editando.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: form.nome, email: form.email, ativo }),
        });
        if (!res.ok) {
          const { mensagem, porCampo } = await detalharErro(res, 'Falha ao atualizar');
          setErro(mensagem);
          setErros(porCampo);
          return;
        }
        if (pode('PERFIS_GERENCIAR') && form.perfis) {
          const resPerfis = await fetch(`/api/admin/usuarios/${editando.id}/perfis`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ perfis: form.perfis }),
          });
          if (!resPerfis.ok) {
            const { mensagem, porCampo } = await detalharErro(resPerfis, 'Falha ao atualizar perfis');
            setErro(mensagem);
            setErros(porCampo);
            await carregar();
            return;
          }
        }
        const anteriores = [...editando.representantesPermitidos.map((r) => r.id)].sort();
        const novos = [...representantesSelecionados].sort();
        const mudouRep = anteriores.length !== novos.length
          || anteriores.some((id, i) => id !== novos[i]);
        if (pode('USUARIOS_GERENCIAR') && mudouRep) {
          const resRep = await fetch(`/api/admin/usuarios/${editando.id}/representantes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ representantes: representantesSelecionados }),
          });
          if (!resRep.ok) {
            const { mensagem, porCampo } = await detalharErro(resRep, 'Falha ao atualizar representantes');
            setErro(mensagem);
            setErros(porCampo);
            await carregar();
            return;
          }
        }
      } else {
        const res = await fetch('/api/admin/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            representantes: representantesSelecionados,
          }),
        });
        if (!res.ok) {
          const { mensagem, porCampo } = await detalharErro(res, 'Falha ao criar usuário');
          setErro(mensagem);
          setErros(porCampo);
          return;
        }
      }
      setSheetAberto(false);
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  async function aprovar(id: string) {
    setErro(null);
    setAprovando(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${id}/aprovar`, { method: 'POST' });
      if (!res.ok) {
        setErro(extrairMensagemErro(await res.json().catch(() => ({})), 'Falha ao aprovar usuário'));
        return;
      }
      setSheetAberto(false);
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setAprovando(false);
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover este usuário?')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(extrairMensagemErro(data, 'Falha ao remover'));
        return;
      }
      await carregar();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader title="Gestão de Usuários & Perfis" subtitle="Controle de acesso (RBAC) e permissões no sistema">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" aria-label="Filtros">
              <Filter />
              Filtros
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <label className="block text-sm font-medium" htmlFor="filtro-perfil">
              Perfil de acesso
            </label>
            <SelectNative
              id="filtro-perfil"
              value={perfilFiltro}
              onChange={(event) => setPerfilFiltro(event.target.value)}
            >
              <option value="todos">Todos</option>
              {perfis.map((perfil) => (
                <option key={perfil.slug} value={perfil.slug}>{perfil.nome}</option>
              ))}
            </SelectNative>
            <label className="block text-sm font-medium" htmlFor="filtro-status">
              Status
            </label>
            <SelectNative
              id="filtro-status"
              value={statusFiltro}
              onChange={(event) =>
                setStatusFiltro(event.target.value as 'todos' | 'ativo' | 'inativo')
              }
            >
              <option value="todos">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </SelectNative>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPerfilFiltro('todos');
                setStatusFiltro('todos');
              }}
            >
              Limpar filtros
            </Button>
          </PopoverContent>
        </Popover>
        {pode('USUARIOS_GERENCIAR') && (
          <Button onClick={abrirNovo}>
            <Plus />
            Novo Usuário
          </Button>
        )}
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid gap-2.5 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
            <BadgeCount>{usuariosFiltrados.length}</BadgeCount>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-5 text-sm text-muted-foreground">Carregando…</p>
            ) : usuariosFiltrados.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">
                Nenhum usuário encontrado para os filtros aplicados.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Nome / E-mail</TableHead>
                    <TableHead>Perfis</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Último Acesso</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuariosFiltrados.map((u) => (
                    <TableRow key={u.id} className="group">
                      <TableCell>
                        <p className="text-[13px] font-semibold text-foreground">{u.nome}</p>
                        <p className="font-data text-[11px] text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.perfis.map((p) => (
                            <BadgeCount key={p}>{p}</BadgeCount>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusPill
                          variant={u.ativo ? 'expedido' : 'pendente'}
                          label={u.ativo ? 'Ativo' : 'Inativo'}
                        />
                      </TableCell>
                      <TableCell className="text-right font-data text-muted-foreground">
                        {formatarUltimoAcesso(u.ultimoAcesso)}
                      </TableCell>
                      <TableCell>
                        {pode('USUARIOS_GERENCIAR') && (
                          <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button variant="ghost" size="iconSm" onClick={() => abrirEditar(u)}>
                              <Edit2 />
                            </Button>
                            <Button variant="ghost" size="iconSm" onClick={() => void remover(u.id)}>
                              <Trash2 className="text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-4">
          <ResumoPerfis />
        </div>
      </div>

      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="gap-0 p-0 sm:max-w-[520px]">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle className="text-[16px] font-bold">
              {editando ? 'Editar Usuário' : 'Novo Usuário'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={(e) => void salvar(e)} className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex-1 space-y-3 p-4">
              <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                <FormField label="Nome" required htmlFor="nome" error={erros.nome}>
                  <Input
                    id="nome"
                    value={form.nome}
                    maxLength={200}
                    aria-invalid={'nome' in erros || undefined}
                    onChange={(e) => {
                      limparCampo('nome');
                      setForm((s) => ({ ...s, nome: e.target.value }));
                    }}
                    required
                  />
                </FormField>

                <FormField label="E-mail" required htmlFor="email" error={erros.email}>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    disabled={editando !== null}
                    maxLength={200}
                    aria-invalid={'email' in erros || undefined}
                    onChange={(e) => {
                      limparCampo('email');
                      setForm((s) => ({ ...s, email: e.target.value }));
                    }}
                    required
                  />
                </FormField>

                {!editando && (
                  <FormField label="Senha" required htmlFor="senha" className="sm:col-span-2" error={erros.password}>
                    <Input
                      id="senha"
                      type="password"
                      value={form.password}
                      aria-invalid={'password' in erros || undefined}
                      onChange={(e) => {
                        limparCampo('password');
                        setForm((s) => ({ ...s, password: e.target.value }));
                      }}
                      required
                      minLength={8}
                    />
                  </FormField>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label htmlFor="ativo">Ativo</Label>
                <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
              </div>

              {pode('PERFIS_GERENCIAR') && (
                <div className="space-y-1.5">
                  <Label>Perfis</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {perfis.map((p) => (
                      <div key={p.slug} className="flex items-center gap-2">
                        <Checkbox
                          id={`perfil-${p.slug}`}
                          checked={form.perfis?.includes(p.slug) ?? false}
                          onCheckedChange={(marcado) => {
                            limparCampo('perfis');
                            const atuais = form.perfis ?? [];
                            setForm((s) => ({
                              ...s,
                              perfis: marcado === true ? [...atuais, p.slug] : atuais.filter((x) => x !== p.slug),
                            }));
                          }}
                        />
                        <Label htmlFor={`perfil-${p.slug}`} className="text-[13px] font-normal normal-case">
                          {p.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {erros.perfis && (
                    <p role="alert" className="text-[11px] font-medium text-danger-fg">
                      {erros.perfis}
                    </p>
                  )}
                </div>
              )}

              {pode('USUARIOS_GERENCIAR') && (
                <RepresentantesPermitidos
                  selecionados={representantesSelecionados}
                  vinculadosIniciais={editando?.representantesPermitidos ?? []}
                  onChange={setRepresentantesSelecionados}
                />
              )}
            </div>

            <SheetFooter className="flex-row justify-between gap-2 border-t border-border p-4">
              {editando && pode('USUARIOS_APROVAR') && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={aprovando}
                  onClick={() => void aprovar(editando.id)}
                >
                  {aprovando ? 'Aprovando…' : 'Aprovar usuário'}
                </Button>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Salvando…' : 'Salvar'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
