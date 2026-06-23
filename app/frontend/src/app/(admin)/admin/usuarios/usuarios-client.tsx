'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit2, Key, Plus, Shield, Trash2, UserCircle } from 'lucide-react';
import type { CriarUsuarioDto, PerfilComPermissoes, Usuario } from '@/lib/usuarios';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export function UsuariosAdminClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfis, setPerfis] = useState<PerfilComPermissoes[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState<CriarUsuarioDto>({ nome: '', email: '', password: '', perfis: [] });
  const [submitting, setSubmitting] = useState(false);

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

  function abrirNovo() {
    setEditando(null);
    setForm({ nome: '', email: '', password: '', perfis: [] });
    setSheetAberto(true);
  }

  function abrirEditar(u: Usuario) {
    setEditando(u);
    setForm({ nome: u.nome, email: u.email, password: '', perfis: u.perfis });
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
          body: JSON.stringify({ nome: form.nome, email: form.email }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErro((data as { message?: string }).message ?? 'Falha ao atualizar');
          return;
        }
        if (pode('PERFIS_GERENCIAR') && form.perfis) {
          await fetch(`/api/admin/usuarios/${editando.id}/perfis`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ perfis: form.perfis }),
          });
        }
      } else {
        const res = await fetch('/api/admin/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErro((data as { message?: string }).message ?? 'Falha ao criar usuário');
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

  async function remover(id: string) {
    if (!confirm('Remover este usuário?')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro((data as { message?: string }).message ?? 'Falha ao remover');
        return;
      }
      await carregar();
    } finally {
      setSubmitting(false);
    }
  }

  const resumoPerfis = perfis.map((p) => ({
    ...p,
    total: usuarios.filter((u) => u.perfis.includes(p.slug)).length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários & Perfis</h1>
          <p className="text-sm text-muted-foreground">Controle de acesso (RBAC) e permissões no sistema</p>
        </div>
        {pode('USUARIOS_GERENCIAR') && (
          <Button onClick={abrirNovo}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Usuário
          </Button>
        )}
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <div className="flex items-center gap-2 border-b p-5">
            <UserCircle className="h-5 w-5 text-primary" />
            <h2 className="font-bold">Lista de Usuários</h2>
          </div>
          <div className="overflow-auto p-5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Nome / E-mail</th>
                    <th className="pb-3 font-medium">Perfis</th>
                    <th className="pb-3 text-center font-medium">Status</th>
                    <th className="pb-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/40">
                      <td className="py-4">
                        <p className="font-semibold">{u.nome}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-1">
                          {u.perfis.map((p) => (
                            <Badge key={p} variant="outline">
                              <Shield className="mr-1 h-3 w-3" />
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <Badge variant={u.ativo ? 'default' : 'destructive'}>{u.ativo ? 'ATIVO' : 'INATIVO'}</Badge>
                      </td>
                      <td className="py-4 text-right">
                        {pode('USUARIOS_GERENCIAR') && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => abrirEditar(u)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => void remover(u.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-violet-600" />
              <h2 className="font-bold">Resumo de Perfis</h2>
            </div>
            {resumoPerfis.map((p) => (
              <div key={p.slug} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-semibold">{p.nome}</span>
                <Badge>{p.total} usuários</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editando ? 'Editar Usuário' : 'Novo Usuário'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={(e) => void salvar(e)} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} required />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} required />
            </div>
            {!editando && (
              <div>
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} required minLength={8} />
              </div>
            )}
            {pode('PERFIS_GERENCIAR') && (
              <div className="space-y-2">
                <Label>Perfis</Label>
                {perfis.map((p) => (
                  <label key={p.slug} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.perfis?.includes(p.slug) ?? false}
                      onChange={(e) => {
                        const perfisAtuais = form.perfis ?? [];
                        setForm((s) => ({
                          ...s,
                          perfis: e.target.checked
                            ? [...perfisAtuais, p.slug]
                            : perfisAtuais.filter((x) => x !== p.slug),
                        }));
                      }}
                    />
                    {p.nome}
                  </label>
                ))}
              </div>
            )}
            <SheetFooter>
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
