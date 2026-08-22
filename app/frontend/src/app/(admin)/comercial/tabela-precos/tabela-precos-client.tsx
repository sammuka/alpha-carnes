'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Copy, History, Info, Save, Upload, X } from 'lucide-react';
import type { Paginado } from '@/lib/comercial';
import type {
  PrecosIncompletosErro,
  TabelaPreco,
  TabelaPrecoDetalhe,
  TabelaPrecoItem,
  TabelaPrecoPublicacao,
} from '@/lib/precos';
import { extrairMensagemErro } from '@/lib/error-message';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
    const mensagem = extrairMensagemErro(dados, `Falha HTTP ${response.status}`);
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

const RÓTULO_PRECO: Record<CampoPreco, string> = {
  precoA: 'Preço A',
  precoB: 'Preço B',
  precoC: 'Preço C',
  precoD: 'Preço D',
};

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
    <div className="space-y-3">
      <PageHeader
        title="Tabela de Preços"
        subtitle="Tabela diária de preços por produto, com faixas A, B, C e D."
      >
        <DatePickerField aria-label="Data da tabela" value={data} onChange={setData} />
        {tabela && (
          <StatusPill
            variant={tabela.status === 'publicada' ? 'expedido' : 'pendente'}
            label={tabela.status === 'publicada' ? 'Publicada' : 'Rascunho'}
          />
        )}
        {tabela?.publicadaEm && (
          <span className="font-data text-[11px] text-muted-foreground">
            Publicada em {new Date(tabela.publicadaEm).toLocaleString('pt-BR')}
          </span>
        )}
      </PageHeader>

      {confirmacao && (
        <div className="flex items-center gap-2 rounded-md border border-success-soft-border bg-success-soft px-3 py-2 text-xs text-success-fg">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          <p className="flex-1">{confirmacao}</p>
          <Button type="button" variant="ghost" size="iconSm" aria-label="Fechar confirmação" onClick={() => setConfirmacao('')}>
            <X />
          </Button>
        </div>
      )}

      {erro && (
        <div role="alert" className="rounded-md border border-danger-soft-border bg-danger-soft p-3 text-xs text-danger-fg">
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
        <EmptyState
          icon={<Info />}
          title={`Nenhuma tabela de preços para ${formatarData(data)}.`}
          action={podeGerenciar && (
            <Button type="button" disabled={pendente} onClick={() => void criarTabela()}>
              Criar tabela do dia
            </Button>
          )}
        />
      )}

      {tabela && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {podeGerenciar && (
              <Button type="button" variant="secondary" disabled={pendente} onClick={() => void copiarAnterior()}>
                <Copy />
                Copiar tabela anterior
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => void abrirHistorico()}>
              <History />
              Histórico
            </Button>
            <div className="flex-1" />
            {podeGerenciar && (
              <>
                <Button type="button" variant="secondary" disabled={pendente} onClick={() => void salvar()}>
                  <Save />
                  Salvar
                </Button>
                <Button type="button" disabled={pendente || tabela.status === 'publicada'} onClick={() => void publicar()}>
                  <Upload />
                  Publicar
                </Button>
              </>
            )}
          </div>

          {(editadaAposPublicacao || (tabela.status === 'rascunho' && tabela.publicadaEm)) && (
            <div className="flex items-start gap-2 rounded-md border border-warning-soft-border bg-warning-soft p-3 text-xs text-warning-fg">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <p>
                Esta tabela já foi publicada anteriormente e sofreu alteração. Publique novamente para que os novos preços entrem em vigor.
              </p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Faixas de preço</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Produto</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Preço A</TableHead>
                    <TableHead>Preço B</TableHead>
                    <TableHead>Preço C</TableHead>
                    <TableHead>Preço D</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tabela.itens.map((item) => (
                    <TableRow key={item.produtoId}>
                      <TableCell className="text-[13px] font-semibold text-foreground">
                        <span>{item.codigo} — {item.nome}</span>
                        {item.provisorio && (
                          <BadgeProvisorio codigo="P11" className="ml-2" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.unidadePreco}</TableCell>
                      {(['precoA', 'precoB', 'precoC', 'precoD'] as const).map((campo) => (
                        <TableCell key={campo} className="w-32">
                          <Input
                            aria-label={`${RÓTULO_PRECO[campo]} de ${item.codigo}`}
                            adornLeft={<span className="text-[11px]">R$</span>}
                            inputMode="decimal"
                            type="number"
                            min={0}
                            step="0.01"
                            value={valores[item.produtoId]?.[campo] ?? ''}
                            placeholder="—"
                            disabled={!podeGerenciar}
                            className="h-7 w-28 text-right font-data"
                            onChange={(event) => editar(item, campo, event.target.value)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">{tabela.itens.length} produtos na tabela.</p>
        </>
      )}

      <Sheet open={historicoAberto} onOpenChange={setHistoricoAberto}>
        <SheetContent className="sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>Histórico de publicações</SheetTitle>
            <SheetDescription>Eventos append-only da tabela selecionada.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 p-4">
            {historico.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma publicação registrada ainda.</p>
            )}
            {historico.map((entry) => (
              <article key={entry.id} className="border-l-2 border-primary-soft-border pl-3">
                <p className="text-sm font-semibold">{entry.acao}</p>
                <p className="font-data text-[11px] text-muted-foreground">
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
