import { Button } from '@/components/ui/button';
import { SecaoRotulo } from './aba-ficha';

/**
 * Abas de leitura do detalhamento: regras, exceções, integrações e aceite.
 * Texto do catálogo da tela (regras, exceções, campos e ações do cadastro fiscal), sem códigos internos.
 */

function Regra({ children, erro }: { children: React.ReactNode; erro?: boolean }) {
  return (
    <div
      className={`my-2 border-l-[3px] bg-surface-2 px-3 py-2.5 text-xs leading-relaxed ${erro ? 'border-destructive' : 'border-primary'}`}
    >
      {children}
    </div>
  );
}

function Aviso({ children, alerta }: { children: React.ReactNode; alerta?: boolean }) {
  return (
    <p className={`my-2.5 rounded-md p-2.5 text-[11px] ${alerta ? 'bg-warning-soft text-warning-fg' : 'bg-info-soft text-info-fg'}`}>
      {children}
    </p>
  );
}

const CAMINHO_APROVACAO: Array<[string, string]> = [
  ['01 · Autor', 'Registra o cadastro, a versão e a justificativa.'],
  ['02 · Revisor', 'Confere campos, atividades econômicas, regime e vigência.'],
  ['03 · Aprovação', 'Responsável diferente de quem enviou libera o cadastro.'],
];

export function AbaRegras() {
  return (
    <div>
      <SecaoRotulo>Regras de negócio documentadas</SecaoRotulo>
      <Regra>Não admitir empresa sem identificação nem regime sobreposto; regras por estabelecimento e competência.</Regra>
      <Regra>Identidade de negócio, competência, autorização no servidor, idempotência e auditoria sempre exigidas nas operações críticas.</Regra>
      <Regra>CNAE: 1 principal, sem repetição, conferido com a documentação da empresa.</Regra>
      <Regra>Cadastro aprovado não é editado no lugar: a mudança vira uma proposta de alteração, revisada e aprovada por outro usuário.</Regra>
      <SecaoRotulo>Caminho de aprovação</SecaoRotulo>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {CAMINHO_APROVACAO.map(([titulo, texto]) => (
          <div key={titulo} className="rounded-md border border-border bg-surface-2 p-2.5 text-[11px]">
            <b className="mb-1.5 block">{titulo}</b>
            {texto}
          </div>
        ))}
      </div>
      <Aviso>A permissão é conferida no servidor. A visibilidade do menu não substitui o controle de acesso ou de alçada.</Aviso>
    </div>
  );
}

const EXCECOES: Array<{ titulo: string; nota?: string }> = [
  { titulo: 'CNPJ rejeitado' },
  { titulo: 'Troca de regime' },
  {
    titulo: 'Competência bloqueada',
    nota: 'Regra de competência ainda não definida: nenhum bloqueio é aplicado nesta versão.',
  },
];

export function AbaExcecoes() {
  return (
    <div>
      <SecaoRotulo>Catálogo de erros e respostas da interface</SecaoRotulo>
      {EXCECOES.map((e) => (
        <Regra key={e.titulo} erro>
          <b>Bloqueio / exceção:</b> {e.titulo}.
          <br />
          <span className="text-muted-foreground">
            Ação: bloquear conclusão, preservar alterações válidas, registrar ocorrência e permitir revisão autorizada.
          </span>
          {e.nota && (
            <>
              <br />
              <span className="text-muted-foreground">{e.nota}</span>
            </>
          )}
        </Regra>
      ))}
    </div>
  );
}

const INTEGRACOES: Array<[string, string]> = [
  ['Integração fiscal', 'NF-e 55 SEFAZ-SP / DF-e Nacional / catálogos XSD por competência'],
  ['Configuração e segredo', 'PostgreSQL para perfis, certificado cifrado AES-256-GCM e chave externa AWS KMS'],
  ['Execução batch', 'Jobs versionados, identidade técnica, tentativa idempotente e checkpoint em banco'],
];

const DESTINOS_INDISPONIVEIS = ['Central de Integrações', 'Conciliação API × arquivos', 'Agendamentos'];

export function AbaIntegracoes() {
  return (
    <div>
      <SecaoRotulo>Dependências e conexões do domínio</SecaoRotulo>
      {INTEGRACOES.map(([titulo, texto]) => (
        <Regra key={titulo}>
          <b>{titulo}</b>
          <br />
          {texto}
        </Regra>
      ))}
      <div className="flex flex-wrap gap-2">
        {DESTINOS_INDISPONIVEIS.map((destino) => (
          <Button key={destino} type="button" variant="secondary" disabled title="Destino ainda não disponível">
            {destino}
          </Button>
        ))}
      </div>
    </div>
  );
}

const CRITERIOS = [
  'Todos os campos de negócio e seus formatos são exibidos e validados',
  'Ações de cadastro, edição, confirmação, cancelamento e versões possuem estados visíveis',
  'Regras de negócio do servidor e pré-condições são verificadas',
  'Fluxos negativos exibem erros e não produzem gravações parciais',
  'Permissões e segregação das aprovações são auditáveis',
  'Concorrência, duplicação e reprocessamento seguros são testados',
  'Interface respeita o DS v3, teclado, estados vazios e tratamento de carregamento/erro',
  'Integrações e batch possuem evidência de contrato, ambiente de teste e rastreabilidade',
];

const REFERENCIA: Array<[string, string]> = [
  ['Campos', 'CNPJ, IE, IM, CNAE, CRT, UF, município, certificado referenciado, vigência'],
  ['Ações', 'cadastrar empresa e filial, ativar regime por vigência, aprovar alteração'],
  ['Regras', 'não admitir empresa sem identificação nem regime sobreposto; regras por estabelecimento e competência'],
  ['Exceções', 'CNPJ rejeitado; troca de regime; competência bloqueada'],
];

export function AbaAceite() {
  return (
    <div>
      <SecaoRotulo>Matriz de homologação funcional e técnica</SecaoRotulo>
      <ul aria-label="Critérios de aceite" className="list-disc space-y-1.5 pl-5 text-xs">
        {CRITERIOS.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <SecaoRotulo>Referência do requisito</SecaoRotulo>
      {REFERENCIA.map(([titulo, texto]) => (
        <Regra key={titulo}>
          <strong>{titulo}</strong>
          <br />
          {texto}
        </Regra>
      ))}
      <Aviso alerta>
        Os critérios acima são de leitura e não registram aceite. O aceite depende de evidências automatizadas,
        homologação e responsável autorizado.
      </Aviso>
    </div>
  );
}
