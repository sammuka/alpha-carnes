'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, History, Info, Save, X } from 'lucide-react';
import type { Paginado } from '@/lib/comercial';
import type {
  PrecosIncompletosErro,
  TabelaPreco,
  TabelaPrecoDetalhe,
  TabelaPrecoItem,
  TabelaPrecoPublicacao,
} from '@/lib/precos';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusPill } from '@/components/ui/status-pill';

interface TabelaPrecosClientProps {
  podeGerenciar: boolean;
  dataInicial?: string;
}

type CampoPreco = 'precoA' | 'precoB' | 'precoC' | 'precoD';
type ValoresEdicao = Record<string, Record<CampoPreco, string>>;

function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function respostaJson<T>(response: Response): Promise<T> {
  const texto = await response.text();
  let dados: unknown;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = texto;
  }
  if (!response.ok) {
    const negocio = dados && typeof dados === 'object'
      && 'message' in dados
      && typeof (dados as { message?: unknown }).message === 'object'
      ? (dados as { message: unknown }).message
      : dados;
    const mensagem = negocio && typeof negocio === 'object'
      && 'message' in negocio
      && typeof (negocio as { message?: unknown }).message === 'string'
      ? (negocio as { message: string }).message
      : typeof negocio === 'string'
        ? negocio
        : `Falha HTTP ${response.status}`;
    const error = new Error(mensagem) as Error & { dados?: unknown };
    error.dados = negocio;
    throw error;
  }
  return dados as T;
}

function valoresDaTabela(itens: TabelaPrecoItem[]): ValoresEdicao {
  return Object.fromEntries(itens.map((item) => [item.produtoId, {
    precoA: item.precoA ?? '',
    precoB: item.precoB ?? '',
    precoC: item.precoC ?? '',
    precoD: item.precoD ?? '',
  }]));
}

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

export function TabelaPrecosClient({
  podeGerenciar,
  dataInicial = hojeEmSaoPaulo(),
}: TabelaPrecosClientProps) {
  const [data, setData] = useState(dataInicial);
  const [tabela, setTabela] = useState<TabelaPrecoDetalhe | null>(null);
  const [valores, setValores] = useState<ValoresEdicao>({});
  const [historico, setHistorico] = useState<TabelaPrecoPublicacao[]>([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState('');
  const [produtosIncompletos, setProdutosIncompletos] = useState<Array<{ codigo: string; nome: string }>>([]);
  const [confirmacao, setConfirmacao] = useState('');
  const [editadaAposPublicacao, setEditadaAposPublicacao] = useState(false);

  const carregarData = useCallback(async (dataAlvo: string) => {
    setCarregando(true);
    setErro('');
    try {
      const listaResponse = await fetch('/api/precos/tabelas?pageSize=100', { cache: 'no-store' });
      const pagina = await respostaJson<Paginado<TabelaPreco>>(listaResponse);
      const resumo = pagina.data.find((item) => item.data === dataAlvo);
      if (!resumo) {
        setTabela(null);
        setValores({});
        setHistorico([]);
        setEditadaAposPublicacao(false);
        return;
      }
      const detalheResponse = await fetch(`/api/precos/tabelas/${resumo.id}`, { cache: 'no-store' });
      const detalhe = await respostaJson<TabelaPrecoDetalhe>(detalheResponse);
      setTabela(detalhe);
      setValores(valoresDaTabela(detalhe.itens));
      setHistorico(detalhe.historico);
      setEditadaAposPublicacao(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao carregar tabela de preços.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarData(data);
  }, [carregarData, data]);

  useEffect(() => {
    const onMessage = (msg: RealtimeMensagem) => {
      if (msg.type === 'tabela_preco_publicada') void carregarData(data);
    };
    return conectarRealtime({
      rooms: ['dashboard'],
      onMessage,
      onReconnect: () => void carregarData(data),
    });
  }, [carregarData, data]);

  function editar(item: TabelaPrecoItem, campo: CampoPreco, valor: string) {
    setValores((atuais) => ({
      ...atuais,
      [item.produtoId]: {
        ...(atuais[item.produtoId] ?? { precoA: '', precoB: '', precoC: '', precoD: '' }),
        [campo]: valor,
      },
    }));
    if (tabela?.status === 'publicada') setEditadaAposPublicacao(true);
  }

  async function executar(
    url: string,
    init: RequestInit,
    sucesso: (detalhe: TabelaPrecoDetalhe) => void,
  ) {
    setPendente(true);
    setErro('');
    setProdutosIncompletos([]);
    try {
      const response = await fetch(url, {
        ...init,
        headers: { 'content-type': 'application/json', ...init.headers },
      });
      const detalhe = await respostaJson<TabelaPrecoDetalhe>(response);
      sucesso(detalhe);
      setTabela(detalhe);
      setValores(valoresDaTabela(detalhe.itens));
      setHistorico(detalhe.historico);
      setEditadaAposPublicacao(false);
    } catch (error) {
      const falha = error as Error & { dados?: unknown };
      const dados = falha.dados as Partial<PrecosIncompletosErro> | undefined;
      if (dados?.code === 'PRECOS_INCOMPLETOS' && Array.isArray(dados.produtos)) {
        setProdutosIncompletos(dados.produtos);
      }
      setErro(falha.message);
    } finally {
      setPendente(false);
    }
  }

  async function criarTabela() {
    await executar('/api/precos/tabelas', {
      method: 'POST',
      body: JSON.stringify({ data }),
    }, () => setConfirmacao('Tabela do dia criada. Revise os preços antes de publicar.'));
  }

  async function copiarAnterior() {
    if (!tabela) return;
    await executar(`/api/precos/tabelas/${tabela.id}/copiar`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, () => setConfirmacao('Preços da tabela anterior copiados. Revise antes de publicar.'));
  }

  async function salvar() {
    if (!tabela) return;
    const itens = tabela.itens.map((item) => {
      const linha = valores[item.produtoId];
      const numeroOuNull = (valor: string | undefined) => valor?.trim() ? Number(valor) : null;
      return {
        produtoId: item.produtoId,
        precoA: numeroOuNull(linha?.precoA),
        precoB: numeroOuNull(linha?.precoB),
        precoC: numeroOuNull(linha?.precoC),
        precoD: numeroOuNull(linha?.precoD),
      };
    });
    await executar(`/api/precos/tabelas/${tabela.id}/itens`, {
      method: 'PATCH',
      body: JSON.stringify({ itens }),
    }, () => setConfirmacao('Tabela salva com sucesso.'));
  }

  async function publicar() {
    if (!tabela) return;
    await executar(`/api/precos/tabelas/${tabela.id}/publicar`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, () => setConfirmacao('Tabela publicada com sucesso.'));
  }

  async function abrirHistorico() {
    if (!tabela) return;
    setErro('');
    try {
      const response = await fetch(`/api/precos/tabelas/${tabela.id}/historico`, {
        cache: 'no-store',
      });
      setHistorico(await respostaJson<TabelaPrecoPublicacao[]>(response));
      setHistoricoAberto(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao carregar histórico.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Comercial / Tabela de Preços</p>
          <h1 className="text-2xl font-bold">Tabela de Preços</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tabela diária de preços por produto, com faixas A, B, C e D.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            aria-label="Data da tabela"
            type="date"
            value={data}
            onChange={(event) => setData(event.target.value)}
            className="w-40"
          />
          {tabela && (
            <StatusPill
              variant={tabela.status === 'publicada' ? 'expedido' : 'pendente'}
              label={tabela.status === 'publicada' ? 'Publicada' : 'Rascunho'}
            />
          )}
          {tabela?.publicadaEm && (
            <span className="text-xs text-muted-foreground">
              Publicada em {new Date(tabela.publicadaEm).toLocaleString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {confirmacao && (
        <div className="flex items-center gap-3 rounded-lg border border-status-recebido/30 bg-status-recebido-bg px-4 py-2.5">
          <Info className="h-4 w-4 shrink-0 text-status-recebido" />
          <p className="flex-1 text-sm">{confirmacao}</p>
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar confirmação" onClick={() => setConfirmacao('')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {erro && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <p>{erro}</p>
          {produtosIncompletos.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {produtosIncompletos.map((produto) => (
                <li key={produto.codigo}>{produto.codigo} — {produto.nome}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {carregando && <p className="text-sm text-muted-foreground">Carregando tabela...</p>}

      {!carregando && !tabela && (
        <section className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma tabela de preços para {formatarData(data)}.</p>
          {podeGerenciar && (
            <Button type="button" className="mt-4" disabled={pendente} onClick={() => void criarTabela()}>
              Criar tabela do dia
            </Button>
          )}
        </section>
      )}

      {tabela && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {podeGerenciar && (
              <Button type="button" variant="outline" disabled={pendente} onClick={() => void copiarAnterior()}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar tabela anterior
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => void abrirHistorico()}>
              <History className="mr-2 h-4 w-4" />
              Histórico
            </Button>
            <div className="flex-1" />
            {podeGerenciar && (
              <>
                <Button type="button" variant="outline" disabled={pendente} onClick={() => void salvar()}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </Button>
                <Button type="button" disabled={pendente || tabela.status === 'publicada'} onClick={() => void publicar()}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Publicar
                </Button>
              </>
            )}
          </div>

          {(editadaAposPublicacao || (tabela.status === 'rascunho' && tabela.publicadaEm)) && (
            <div className="flex items-start gap-2 rounded-lg border border-status-divergencia/30 bg-status-divergencia-bg p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-divergencia" />
              <p className="text-sm">
                Esta tabela já foi publicada anteriormente e sofreu alteração. Publique novamente para que os novos preços entrem em vigor.
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Preço A</th>
                    <th className="px-4 py-3">Preço B</th>
                    <th className="px-4 py-3">Preço C</th>
                    <th className="px-4 py-3">Preço D</th>
                  </tr>
                </thead>
                <tbody>
                  {tabela.itens.map((item) => (
                    <tr key={item.produtoId} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">
                        <span>{item.codigo} — {item.nome}</span>
                        {item.provisorio && (
                          <BadgeProvisorio pendencia="P11" texto="Provisório · P11" className="ml-2" />
                        )}
                      </td>
                      <td className="px-4 py-3">{item.unidadePreco}</td>
                      {(['precoA', 'precoB', 'precoC', 'precoD'] as const).map((campo) => (
                        <td key={campo} className="w-36 px-4 py-3">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                            <Input
                              aria-label={`${{
                                precoA: 'Preço A',
                                precoB: 'Preço B',
                                precoC: 'Preço C',
                                precoD: 'Preço D',
                              }[campo]} de ${item.codigo}`}
                              type="number"
                              min={0}
                              step="0.01"
                              value={valores[item.produtoId]?.[campo] ?? ''}
                              placeholder="—"
                              disabled={!podeGerenciar}
                              className="pl-7 text-right font-mono"
                              onChange={(event) => editar(item, campo, event.target.value)}
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{tabela.itens.length} produtos na tabela.</p>
        </>
      )}

      <Sheet open={historicoAberto} onOpenChange={setHistoricoAberto}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Histórico de publicações</SheetTitle>
            <SheetDescription>Eventos append-only da tabela selecionada.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {historico.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma publicação registrada ainda.</p>
            )}
            {historico.map((entry) => (
              <article key={entry.id} className="border-l-2 border-primary/30 pl-3">
                <p className="text-sm font-semibold">{entry.acao}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.criadoEm).toLocaleString('pt-BR')} · {entry.autorId}
                </p>
                {entry.observacao && <p className="mt-1 text-xs">{entry.observacao}</p>}
              </article>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
