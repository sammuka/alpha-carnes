(function protoApp(){
'use strict';
const D=window.ALPHA_PROTO_DATA,app=document.getElementById('app'),layer=document.getElementById('layer'),toastContainer=document.getElementById('toast');
if(!D||!Array.isArray(D.screens))throw new Error('Catálogo indisponível');
const S={page:location.hash.slice(1)||'inicio',role:'administrador',env:'HML',tab:'Ficha e campos',row:0,search:'',status:'Todos',sidebar:new Set(['FISCAL','FINANCEIRO','BANCOS & TESOURARIA','CONTABILIDADE','ADMINISTRAÇÃO']),subnav:new Set(['E01','E02','E04','E07','E09','E11','E12']),records:{},events:[],formMode:null,action:null,journeyIndex:0,file:null,notice:''};
const docBase='https://github.com/sammuka/alpha-carnes/blob/feature/erp-fiscal-financeiro-contabil-especificacoes-2026/docs/expansao-erp-2026/';
const formTabNames=['Ficha e campos','Movimentações','Regras e validações','Exceções','Histórico','Integrações','Aceite e testes'];
const stateTypes=['Pendente de validação','Em revisão','Aprovado','Bloqueado','Concluído','Rejeitado'];
const sampleEntities=['Operação demonstração A','Operação demonstração B','Operação demonstração C','Fornecedor exemplo','Cliente exemplo','Estabelecimento exemplo'];
const amounts=['R$ 18.450,00','R$ 7.380,20','R$ 4.119,90','R$ 62.350,00','R$ 1.880,60','R$ 24.070,10'];
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const abbr=v=>escapeHtml(String(v).length>56?String(v).slice(0,53)+'…':v);
const slug=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
const titleCase=v=>String(v).charAt(0).toUpperCase()+String(v).slice(1);
const money=v=>'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
function seed(){
 for(const sc of D.screens){
   S.records[sc.id]=Array.from({length:8},(_,i)=>({id:sc.id+'-EX-'+String(i+1).padStart(3,'0'),name:sampleEntities[(i+sc.id.length)%6],status:stateTypes[(i+sc.id.charCodeAt(2))%6],value:amounts[i%6],date:'2026-10-'+String(10+i).padStart(2,'0'),responsavel:['Equipe Fiscal','Tesouraria','Contabilidade','Administrador'][i%4],origin:['Manual','API HML (simulada)','Importação (simulada)'][i%3]}));
 }
}
seed();
const oldGroup=r=>r.startsWith('/comercial/')?'COMERCIAL':r.startsWith('/gestao/')?'GESTÃO':r.startsWith('/recebimento/')?'RECEBIMENTO & BALANÇA':r.startsWith('/desossa/')?'DESOSSA':r.startsWith('/estoque/')?'ESTOQUE':r.startsWith('/carga/')?'CARGA':r.startsWith('/faturamento/')?'FATURAMENTO':r.startsWith('/cadastros/')?'CADASTROS & REGRAS':'ADMINISTRAÇÃO';
const epTitles={E01:'Motor tributário',E02:'NF-e SEFAZ/SP',E03:'DF-e e devoluções',E04:'Contas a pagar',E05:'Contas a receber',E06:'APIs bancárias',E07:'Conciliação',E08:'Tesouraria',E09:'Contabilidade / SPED',E10:'Operação e expedição',E11:'Arquivos e contingência',E12:'Integrações / certificados / jobs'};
function allowed(sc){
 if(S.role==='administrador')return true;
 if(S.role==='diretoria'||S.role==='gestor')return true;
 const g=sc.group;
 if(S.role==='fiscal'||S.role==='contador')return ['FISCAL','CONTABILIDADE','FATURAMENTO'].includes(g);
 if(S.role==='financeiro'||S.role==='tesouraria')return ['FINANCEIRO','BANCOS & TESOURARIA','CONTABILIDADE'].includes(g);
 if(S.role==='faturamento')return ['FATURAMENTO','FISCAL'].includes(g);
 if(S.role==='auditoria')return true;
 return g==='FATURAMENTO'&&sc.epic==='E10';
}
function currentScreen(){return D.screens.find(x=>x.id===S.page)||null;}
function screenFields(sc){
 let fields=sc.fields.split(',').map(x=>x.trim()).filter(Boolean).map(x=>x.replace(/^\s*e\s+/,'').replace(/[.;]$/,''));
 if(fields.length<5)fields=fields.concat(['Empresa','Ambiente','Data de competência','Situação','Responsável','Documento de origem']);
 return [...new Set(fields)].slice(0,18);
}
function actionNames(sc){
 const arr=sc.actions.split(',').map(x=>x.trim().replace(/^\s*e\s+/,'')).filter(x=>x.length>=5&&x.length<100).slice(0,8);
 if(!arr.length)arr.push('Cadastrar','Revisar','Aprovar');
 return arr;
}
function typeFor(field){
 let s=field.toLowerCase();
 if(/certificado|anexo|xml|arquivo|pfx|crt\+key/.test(s))return 'file';
 if(/senha|secret|token|chave privada/.test(s))return 'password';
 if(/data|vigên|vencimento|competência|validade|emissão|ocorrência/.test(s))return 'date';
 if(/valor|base|quantidade|peso|preço|alíquota|percent|total|rate|saldo|redução|juros/.test(s))return 'number';
 if(/status|situação|ambiente|regime|tipo|finalidade|canal/.test(s))return 'select';
 return 'text';
}
function fakeValue(field,sc,rec,index){
 const k=field.toLowerCase();
 if(/cnpj/.test(k))return '00.000.000/0000-00 (fictício)';
 if(/ambiente/.test(k))return S.env+' (simulado)';
 if(/banco|instituição/.test(k))return ['Bradesco','Itaú','Santander'][index%3];
 if(/status|situação/.test(k))return rec.status;
 if(/valor|saldo|total|base|preço/.test(k))return rec.value;
 if(/data|vencimento|vigência|competência|validade/.test(k))return rec.date;
 if(/cfop/.test(k))return index%2?'5102':'5101';
 if(/cst/.test(k))return '20 (fixture)';
 if(/benef/.test(k))return 'SP020450 (fixture)';
 if(/cclass/.test(k))return '000001 (fixture)';
 if(/ncm/.test(k))return '0201 (fictício)';
 if(/certificado|chave privada|secret|token|senha/.test(k))return '•••••• (não armazenado no protótipo)';
 if(/versão|layout/.test(k))return 'Em homologação';
 if(/empresa|estabelecimento/.test(k))return 'Empresa de demonstração';
 if(/responsável|aprovador|usuário/.test(k))return rec.responsavel;
 if(/id|número|chave|nsu|código/.test(k))return rec.id;
 return 'Dado demonstrativo '+String(index+1);
}
const cls=v=>/aprovad|conclu/i.test(v)?'ok':/rejeit|bloquead/i.test(v)?'error':/revis|pendente/i.test(v)?'warn':'info';
const pill=v=>'<span class="pill '+cls(v)+'">'+escapeHtml(v)+'</span>';
function toast(txt){const el=document.createElement('div');el.className='erp-toast';el.textContent=txt;toastContainer.appendChild(el);setTimeout(()=>el.remove(),4800);}
function renderNav(){
 let html='<aside class="erp-sidebar" aria-label="Navegação ERP"><div class="erp-brand"><div class="erp-brand-symbol">A</div><div><strong>AlphaCarnes</strong><small>ERP INTEGRADO · PROTÓTIPO</small></div></div><nav class="erp-nav">';
 html+='<button class="nav-entry '+(S.page==='inicio'?'active':'')+'" data-go="inicio">▦ &nbsp; Visão geral do ERP</button><button class="nav-entry '+(S.page==='jornadas'?'active':'')+'" data-go="jornadas">⇄ &nbsp; Jornadas completas</button>';
 for(const g of D.menuGroups){
   const ex=D.existing.filter(x=>oldGroup(x.route)===g),n=D.screens.filter(x=>x.group===g&&allowed(x));
   if(!ex.length&&!n.length)continue;
   const isOpen=S.sidebar.has(g);
   html+='<div class="nav-group"><button class="nav-heading" data-toggle-group="'+escapeHtml(g)+'" aria-expanded="'+isOpen+'"><span>'+escapeHtml(g)+'</span><span>'+(isOpen?'−':'+')+'</span></button>';
   if(isOpen){
     if(ex.length){
       if(n.length)html+='<span class="nav-subheading">OPERACIONAL ATUAL</span>';
       for(const it of ex)html+='<button class="nav-entry '+(S.page==='antiga:'+it.route?'active':'')+'" data-old="'+escapeHtml(it.route)+'"><span class="prefix">↗</span>'+escapeHtml(it.title)+'</button>';
     }
     const eps=[...new Set(n.map(x=>x.epic))];
     if(n.length)html+='<span class="nav-subheading">AMPLIAÇÃO DO ERP</span>';
     for(const ep of eps){
       const arr=n.filter(x=>x.epic===ep),open=S.subnav.has(ep);
       html+='<button class="nav-entry" data-toggle-epic="'+ep+'"><span class="prefix">'+ep+'</span>'+escapeHtml(epTitles[ep])+' <span style="margin-left:auto;opacity:.7">'+(open?'⌃':'⌄')+'</span></button>';
       if(open)for(const it of arr)html+='<button class="nav-entry '+(S.page===it.id?'active':'')+'" data-go="'+it.id+'" style="padding-left:24px"><span class="prefix" style="min-width:0">'+it.id.split('-')[1]+'</span>'+escapeHtml(it.title)+'</button>';
     }
   }
   html+='</div>';
 }
 html+='</nav><div class="sb-user"><div class="avatar">AC</div><div class="who"><b>Ambiente demonstrativo</b><span>Dados fictícios • Sem API real</span></div></div></aside>';return html;
}
function renderTop(){
 return '<header class="erp-top"><div class="breadcrumb">AlphaCarnes / <b>'+escapeHtml(S.page==='inicio'?'ERP Integrado':S.page==='jornadas'?'Jornadas':currentScreen()?.title||'Operação existente')+'</b></div><input class="top-search" id="global-search" placeholder="Buscar telas (ex.: certificado, NF-e)" autocomplete="off" aria-label="Buscar tela"><select id="role" aria-label="Simular perfil">'+D.roles.map(x=>'<option value="'+x+'" '+(S.role===x?'selected':'')+'>'+escapeHtml(x)+'</option>').join('')+'</select><select id="env" aria-label="Ambiente"><option '+(S.env==='HML'?'selected':'')+'>HML</option><option '+(S.env==='PROD'?'selected':'')+'>PROD</option></select><span class="proto-flag">PROTÓTIPO · SEM TRANSAÇÕES REAIS</span></header>';
}
function renderIntro(){
 const count=D.screens.length;
 let html='<div class="hero-row"><div><span class="eyebrow">DESIGN SYSTEM V3 · DIREÇÃO A</span><h1>AlphaCarnes — ERP integrado</h1><p class="hero-sub">Navegação ratificada de 13 grupos. Protótipo de alta fidelidade funcional e documental: '+count+' interfaces novas vinculadas aos épicos E01–E12; 39 rotas operacionais existentes referenciadas. Valores e identidades são fictícios.</p></div><div class="hero-actions"><button class="erp-btn primary" data-go="jornadas">Explorar jornadas →</button><button class="erp-btn" data-go="E12-V02">Certificados A1</button><button class="erp-btn" data-go="E11-V01">Conciliação arquivos</button></div></div>';
 html+='<div class="kpi-row"><div class="kpi-card"><span>Novas interfaces</span><b>61</b><small>49 E01–E10 + 5 E11 + 7 E12</small></div><div class="kpi-card"><span>Épicos planejados</span><b>12</b><small>Fiscal, bancos, contabilidade e plataforma</small></div><div class="kpi-card"><span>Grupos de navegação</span><b>13</b><small>9 existentes + 4 novos</small></div><div class="kpi-card"><span>Atividades reais executadas</span><b>0</b><small>Prototipação sem integração externa</small></div></div>';
 html+='<div class="info-row warn"><b>Atenção:</b>&nbsp; todas as ações deste protótipo são simulações em memória. Não envie certificados verdadeiros, dados pessoais, credenciais ou arquivos bancários reais. Nenhuma emissão, registro bancário ou assinatura digital é executada.</div>';
 html+='<div class="quick-grid">';
 for(const ep of Object.keys(epTitles)){
  const screens=D.screens.filter(x=>x.epic===ep),first=screens[0];if(!first)continue;
  html+='<button class="quick" data-go="'+first.id+'"><span class="eyebrow">'+ep+' · '+screens.length+' interfaces</span><strong>'+escapeHtml(epTitles[ep])+'</strong><span>'+escapeHtml(first.title)+'; '+escapeHtml(screens[1]?.title||'')+' e demais fluxos completos do caderno funcional.</span><small>Explorar interfaces →</small></button>';
 }
 html+='</div><div class="erp-card" style="margin-top:16px"><div class="erp-card-header"><h2>Referenciais obrigatórios</h2></div><div class="erp-card-body"><p class="subtle">As telas seguem o menu canônico e o DS v3. Dados normativos, contratos reais, aprovação do contador e capacidades dos bancos são gates externos. Os fluxos integram o Caderno B e os contratos E11/E12 sem substituir o código operacional existente.</p><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><a class="erp-btn" target="_blank" href="'+docBase+'B-ESCOPO-NOVOS-MODULOS-ERP.md">Caderno B</a><a class="erp-btn" target="_blank" href="'+docBase+'22-ARQUITETURA-INTEGRACOES-CERTIFICADOS-BATCH-CADASTROS.md">E12 arquitetura</a><a class="erp-btn" target="_blank" href="'+docBase+'11-E11-FALLBACK-BANCARIO-ARQUIVOS.md">E11 arquivos</a></div></div></div>';
 return html;
}
const journeys=[
 ['J01 · Compra e recebimento','E03-T01','E03-T02','E03-T03','E04-T01','E07-T02','E09-T02'],
 ['J02 · Venda e recebível','E10-T01','E02-T01','E02-T02','E05-T02','E05-T03','E07-T03','E09-T03'],
 ['J03 · Devoluções','E03-T03','E02-T04','E04-T05','E07-T03','E09-T05'],
 ['J04 · Banco API → arquivos','E06-T01','E06-T02','E11-V01','E11-V02','E11-V03','E07-T02','E08-T02'],
 ['J05 · Fechamento e SPED','E09-T01','E09-T02','E09-T04','E09-T05','E09-T07','E09-T08'],
 ['J06 · Certificado até batch','E12-V01','E12-V02','E12-V03','E12-V04','E12-V06','E12-V07'],
 ['J07 · Normas e dados fiscais','E12-V05','E01-T03','E01-T04','E02-T05','E09-T05'],
 ['J08 · Conciliação sem duplicidade','E11-V01','E11-V03','E11-V04','E07-T01','E07-T03','E09-T03']
];
function renderJourneys(){
 let html='<div class="hero-row"><div><span class="eyebrow">PERCURSOS TRANSVERSAIS · E01–E12</span><h1>Jornadas ponta a ponta</h1><p class="hero-sub">O protótipo conserva etapas e dependências. Selecione uma jornada e avance para a interface correspondente.</p></div><button class="erp-btn" data-go="inicio">Voltar à visão geral</button></div>';
 html+='<div class="quick-grid">'+journeys.map((j,i)=>'<button class="quick" data-select-journey="'+i+'"><strong>'+escapeHtml(j[0])+'</strong><span>'+String(j.length-1)+' etapas vinculadas</span><small>'+ (S.journeyIndex===i?'✓ Jornada selecionada':'Abrir percurso →')+'</small></button>').join('')+'</div>';
 let j=journeys[S.journeyIndex];html+='<section class="erp-card" style="margin-top:15px"><div class="erp-card-header"><h2>'+escapeHtml(j[0])+'</h2><span class="badge-proto">Passos com comportamento demonstrativo</span></div><div class="erp-card-body"><div class="journey-steps">';
 for(let i=1;i<j.length;i++){const sc=D.screens.find(x=>x.id===j[i]);if(sc)html+='<button class="journey-step" data-go="'+sc.id+'"><b>'+String(i).padStart(2,'0')+'.</b> '+escapeHtml(sc.title)+' →</button>';}html+='</div><div class="info-row">Aceite transversal: cada vínculo preserva identidade do documento, permissões, segregação de funções e idempotência. Nenhuma ação da simulação altera título, razão ou ambiente de produção.</div></div></section>';return html;
}
function renderLegacy(){
 const route=S.page.replace('antiga:',''),x=D.existing.find(v=>v.route===route);
 return '<div class="hero-row"><div><span class="eyebrow">LINHA-BASE · DEVELOP</span><h1>'+escapeHtml(x?.title||route)+'</h1><p class="hero-sub">Tela da aplicação original; as 39 rotas existentes não são recriadas neste protótipo. Esta referência aponta para a implementação operacional, que deve permanecer integrada à expansão.</p></div><button class="erp-btn" data-go="inicio">Voltar</button></div><div class="erp-card"><div class="erp-card-body"><div class="info-row">Rota canônica: <b style="margin-left:5px">'+escapeHtml(route)+'</b>. A implementação e os testes pertencem à branch develop; não foi alterada neste trabalho.</div><a href="https://github.com/sammuka/alpha-carnes/blob/develop/app/frontend/src/lib/menu-v2.ts" target="_blank" class="erp-btn">Consultar catálogo existente ↗</a><button class="erp-btn" data-go="E10-T01">Ver adequações operacionais novas</button></div></div>';
}
function renderTable(sc){
 let rows=S.records[sc.id].filter(x=>(S.status==='Todos'||x.status===S.status)&&(!S.search||[x.id,x.name,x.value,x.responsavel,x.status].join(' ').toLowerCase().includes(S.search.toLowerCase())));
 let h='<div class="toolbar"><input class="input" id="filter-records" value="'+escapeHtml(S.search)+'" placeholder="Buscar referência, responsável..." aria-label="Filtrar registros"><select class="select" id="filter-status"><option>Todos</option>'+stateTypes.map(x=>'<option '+(S.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select><span class="spacer"></span><button class="erp-btn small" data-action="export">Exportar lista</button></div>';
 h+='<div class="table-shell"><table class="erp-table"><thead><tr><th>Referência</th><th>Descrição</th><th>Valor ilustrativo</th><th>Estado</th><th>Data</th></tr></thead><tbody>';
 if(!rows.length)h+='<tr><td colspan="5"><div class="empty">Nenhum registro encontrado para os filtros. Ajuste a pesquisa ou crie um exemplo.</div></td></tr>';
 for(const r of rows){const n=S.records[sc.id].indexOf(r);h+='<tr class="'+(S.row===n?'selected':'')+'" data-row="'+n+'" tabindex="0"><td class="mono">'+escapeHtml(r.id)+'</td><td>'+escapeHtml(r.name)+'</td><td class="mono">'+escapeHtml(r.value)+'</td><td>'+pill(r.status)+'</td><td class="mono">'+escapeHtml(r.date)+'</td></tr>';}
 h+='</tbody></table></div><div class="smallmuted" style="padding:11px 13px;border-top:1px solid var(--border)">Exibindo '+rows.length+' registros FICTÍCIOS. A busca, seleção e alterações são apenas locais; nenhum dado de produção foi importado.</div>';
 return h;
}
function renderFicha(sc,rec){
 let fields=screenFields(sc);
 let h='<div class="section-label">Ficha do registro · '+escapeHtml(rec.id)+'</div><div class="field-grid">';
 fields.forEach((f,i)=>{const v=fakeValue(f,sc,rec,i);h+='<div class="erp-field"><label>'+escapeHtml(f)+'</label><input readonly value="'+escapeHtml(v)+'" aria-label="'+escapeHtml(f)+'" /></div>';});
 h+='</div><div class="divider"></div><div class="section-label">Dados de governança e vínculo</div><div class="field-grid">';
 [['Empresa','Empresa demonstração'],['Ambiente',S.env],['Responsável',rec.responsavel],['Documento de origem',rec.id],['Estado',rec.status],['Atualização','11/10/2026 (fictício)']].forEach(a=>{h+='<div class="erp-field"><label>'+escapeHtml(a[0])+'</label><input readonly value="'+escapeHtml(a[1])+'"></div>';});h+='</div>';
 h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:15px"><button class="erp-btn" data-action="edit">Editar / propor versão</button><button class="erp-btn" data-action="simulate">Simular validação</button><button class="erp-btn" data-action="history">Ver histórico</button></div>';
 return h;
}
function renderMov(sc,rec){
 const label=sc.kind==='accounting'?'Partidas e competência':sc.kind==='nfe'?'Eventos SEFAZ':sc.kind==='reconciliation'?'Observações por fonte':sc.epic==='E11'?'Lotes e ocorrências bancárias':'Linha de movimentos';
 let h='<div class="section-label">'+label+' — '+escapeHtml(rec.id)+'</div><div class="status-track"><div class="active">01 · Preparação</div><div class="active">02 · Validação</div><div>03 · Aprovação</div><div>04 · Processamento</div></div>';
 h+='<div class="erp-card" style="margin-top:12px"><div class="erp-card-header"><h2>Eventos e contrapartidas (simulados)</h2></div><div class="table-shell"><table class="erp-table"><thead><tr><th>Evento</th><th>Origem</th><th>Referência</th><th>Efeito</th><th>Status</th></tr></thead><tbody>';
 [['CADASTRO','Operador','DOC-'+rec.id,'Nenhum lançamento','Registrado'],['VALIDAÇÃO','Serviço interno','REG-'+rec.id,'Aguardando revisão','Pendente'],['CONFIRMAÇÃO','Terceiro externo','—','Não transmitido','Bloqueado']].forEach(x=>{h+='<tr>'+x.map((v,i)=>'<td>'+ (i===4?pill(v):escapeHtml(v))+'</td>').join('')+'</tr>';});
 h+='</tbody></table></div></div><div class="info-row warn">Este protótipo não efetua autorização SEFAZ, liquidação bancária, escrituração, ou execução de jobs. Os estados finais exigem confirmação externa e gates reais.</div>';
 return h;
}
function renderRules(sc){
 return '<div class="section-label">Regras de negócio documentadas</div><div class="rule-item">'+escapeHtml(sc.rules)+'</div><div class="rule-item">Identidade de negócio, competência, autorização backend, idempotência e auditoria sempre exigidas nas operações críticas.</div><div class="section-label" style="margin-top:18px">Caminho de aprovação</div><div class="approval-path"><div><b>01 · Autor</b>Registra documento, versão e justificativa.</div><div><b>02 · Revisor</b>Confere campos, normas, contratos e limites.</div><div><b>03 · Aprovação</b>Responsável segregado libera o serviço, quando habilitado.</div></div><div class="info-row">RBAC do backend é obrigatório. Visibilidade do menu não substitui controle de acesso ou alçada.</div>';
}
function renderExceptions(sc){
 let arr=sc.exceptions.split(';').map(x=>x.trim()).filter(Boolean);if(arr.length<2)arr=arr.concat(['Referência externa não homologada','Transação duplicada ou já processada','Documento em competência fechada']);
 let h='<div class="section-label">Catálogo de erros e respostas da interface</div>';
 for(const x of arr)h+='<div class="rule-item error"><b>Bloqueio / exceção:</b> '+escapeHtml(titleCase(x))+'.<br><span class="subtle">Ação: bloquear conclusão, preservar alterações válidas, registrar ocorrência e permitir revisão autorizada.</span></div>';
 h+='<div style="display:flex;gap:7px"><button class="erp-btn" data-action="report">Abrir ocorrência</button><button class="erp-btn" data-action="simulate-error">Simular erro de validação</button></div>';
 return h;
}
function renderHistory(sc,rec){
 let events=[{title:'Versão de cadastro consultada',who:'Usuário de demonstração',date:'11/10/2026 10:02'},{title:'Registro selecionado para revisão',who:S.role,date:'11/10/2026 10:11'},{title:'Situação inicial do fixture',who:'Gerador de dados fictícios',date:'11/10/2026 09:00'}];
 S.events.filter(x=>x.id===rec.id).forEach(x=>events.unshift({title:x.action,who:x.who,date:x.date}));
 return '<div class="section-label">Histórico imutável (demonstração)</div><div class="timeline">'+events.map(e=>'<div class="event"><strong>'+escapeHtml(e.title)+'</strong><small>'+escapeHtml(e.date)+' • '+escapeHtml(e.who)+'</small></div>').join('')+'</div><div class="info-row">Eventos reais serão persistidos transacionalmente no backend e correlacionados por ator, origem, justificativa, versão e evento financeiro/fiscal.</div>';
}
function integrationInfo(sc){
 const x=sc.epic,blocks=[];
 if(['E01','E02','E03','E09','E10'].includes(x))blocks.push(['Integração fiscal','NF-e 55 SEFAZ-SP / DF-e Nacional / catálogos XSD por competência']);
 if(['E04','E05','E06','E07','E08','E11'].includes(x))blocks.push(['Integração financeira','Bradesco, Itaú, Santander; API prioritária e CNAB/OFX/CSV homologados via mesmo evento econômico']);
 blocks.push(['Configuração e segredo','E12: PostgreSQL para perfis, certificado cifrado AES-256-GCM e chave externa AWS KMS']);
 blocks.push(['Execução batch','Jobs versionados, identidade técnica, tentativa idempotente e checkpoint em banco']);
 return '<div class="section-label">Dependências e conexões do domínio</div>'+blocks.map(b=>'<div class="rule-item"><b>'+escapeHtml(b[0])+'</b><br>'+escapeHtml(b[1])+'</div>').join('')+'<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="erp-btn" data-go="E12-V01">Central de Integrações</button><button class="erp-btn" data-go="E11-V03">Conciliação API × arquivos</button><button class="erp-btn" data-go="E12-V06">Agendamentos</button></div>';
}
function renderAccept(sc){
 let qs=[sc.fields,sc.actions,sc.rules,sc.exceptions];
 let h='<div class="section-label">Matriz de homologação funcional e técnica</div><ul class="checklist">';
 const tests=[
 'Todos os campos de negócio e seus formatos são exibidos e validados',
 'Ações de cadastro, edição, confirmação, cancelamento e versões possuem estados visíveis',
 'Regras de negócio do backend e pré-condições são verificadas',
 'Fluxos negativos exibem erros e não produzem gravações parciais',
 'Permissões e segregação das aprovações são auditáveis',
 'Concorrência, duplicação e reprocessamento seguros são testados',
 'Interface respeita DS v3, teclado, estados vazios e tratamento de loading/erro',
 'Integrações e batch possuem evidência de contrato, sandbox e rastreabilidade'
 ];
 for(let i=0;i<tests.length;i++)h+='<li><input type="checkbox" id="test-'+i+'-'+sc.id+'" aria-label="Critério de aceite '+(i+1)+'"><label for="test-'+i+'-'+sc.id+'">'+escapeHtml(tests[i])+'</label></li>';
 h+='</ul><div class="divider"></div><div class="section-label">Referência do requisito (sem generalizar dados externos)</div>';
 h+=qs.map((a,i)=>'<div class="rule-item"><strong>'+['Campos','Ações','Regras','Exceções'][i]+'</strong><br>'+escapeHtml(a)+'</div>').join('');
 h+='<div class="info-row warn">A seleção dos checkboxes serve apenas à revisão do protótipo: não registra aceite contratual. O aceite real depende de evidências CI, integração HML, UAT e responsável autorizado.</div>';return h;
}

function domainPanel(sc){
const box=(title,body,actions='')=>'<section class="erp-card" style="margin-bottom:12px"><div class="erp-card-header"><h2>'+title+'</h2><span class="badge-proto">CENÁRIO DE HOMOLOGAÇÃO</span></div><div class="erp-card-body">'+body+(actions?'<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px">'+actions.split('|').map(x=>'<button class="erp-btn" data-action="custom" data-caption="'+x+'">'+x+'</button>').join('')+'</div>':'')+'</div></section>';
const input=(label,value,type='text')=>'<div class="erp-field"><label>'+label+'</label><input '+(type==='number'?'type="number" step="0.01"':'readonly')+' value="'+value+'"></div>';
const tbl=(heads,rows)=>'<div class="table-shell"><table class="erp-table"><thead><tr>'+heads.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
if(sc.epic==='E01'){
const rows=[
 ['191948 · revenda','5102','20','41,67%','12,00%','SP020450','51','06 / 06','000001'],
 ['191948 · própria','5101','20','41,67%','12,00%','SP020450','53','06 / 06','000001'],
 ['188305 · devolução','1202','20','41,67%','12,00%','SP020740','53','06 / 06','200003'],
 ['189504 · subproduto','5102','20','0,00% BC=0','0,00%','SP020100','51','08 / 08','200036'],
 ['191923 · devolução','5202','20','41,67%','12,00%','SP020450','51','06 / 06','000001']
];
return box('Matriz de enquadramentos — cinco variantes das quatro NF-e de referência',
 tbl(['Cenário XML','CFOP','ICMS CST','Redução BC','ICMS','cBenef','IPI CST','PIS/COFINS','cClassTrib IBS/CBS'],rows)+
 '<div class="info-row warn">Valores históricos de XML: apenas fixtures para testes, não tabelas normativas. A aprovação fiscal e as versões vigentes das NTs determinam a emissão real.</div><div class="field-grid">'+input('Competência de aplicação','2026-10-11')+input('Versão de norma/RTC','Pendente de validação')+input('Regra vencedora','por produto + operação + UF + vigência')+input('Revisor responsável','Contador / fiscal')+'</div>',
 'Simular cálculo fiscal|Comparar regras por vigência|Submeter classificação|Exportar memória de cálculo');
}
if(sc.epic==='E03'){
return box('Conferência fiscal × compra × recebimento físico',
 '<div class="approval-path"><div><b>01 · Compra negociada</b>Preço unitário contratado; quantidade/peso previstos por fornecedor.</div><div><b>02 · NF-e de entrada</b>XML validado por chave, CNPJ, item, NCM, total e tributação.</div><div><b>03 · Conferência do Richard</b>Pesagem física, peças recebidas, divergência e ocorrência aprovada.</div></div>'+
 tbl(['Medida','Comprado','NF entrada','Pesagem física','Divergência'],[['Peso/kg','1.000,00','1.000,00','982,00','−18,00 kg'],['Preço/kg','R$ 24,50','R$ 24,50','—','0,00'],['Valor','R$ 24.500,00','R$ 24.500,00','—','Sujeito à negociação']])+
 '<div class="info-row warn">Reclamação de diferença não é nota de devolução autorizada nem desconto financeiro já confirmado. AP permanece com obrigação documental até ajuste válido.</div>',
 'Abrir ocorrência de peso|Solicitar devolução referenciada|Vincular NF origem|Submeter abatimento ao fornecedor');
}
if(sc.epic==='E04'){
 return box('Contas a pagar — obrigações, parcelas e pagamentos',
 tbl(['Origem','Credor','Parcela','Vencimento','Valor','Situação'],[['NF fornecedor EX-001','Fornecedor exemplo','1/2','20/10/2026','R$ 12.250,00','Aguardando aprovação'],['NF fornecedor EX-001','Fornecedor exemplo','2/2','20/11/2026','R$ 12.250,00','Pendente'],['Despesa recorrente EX','Serviço exemplo','1/1','16/10/2026','R$ 890,00','Agendada']])+
 '<div class="field-grid">'+input('Origem econômica','NF de entrada conferida')+input('Total do título','R$ 24.500,00')+input('Desconto solicitado','Pendente de aceite')+input('Status bancário','Nenhuma confirmação recebida')+'</div>'+
 '<div class="info-row warn">DDA não confirma pagamento nem desconto. A baixa só ocorre após retorno inequívoco do banco e alocação ao título no E07.</div>',
 'Parcelar obrigação|Revisar divergência DDA|Criar agenda de pagamentos|Solicitar autorização dupla');
}
if(sc.epic==='E05'){
 return box('Ciclo do recebível — NF-e → título → boleto → liquidação',
 '<div class="approval-path"><div><b>01 · NF-e autorizada</b>Documento com chave e protocolo real, emitido após expedição.</div><div><b>02 · Cobrança registrada</b>Nosso número, banco, carteira, retorno de registro.</div><div><b>03 · Recebimento conciliado</b>Retorno de liquidação e extrato vinculados a um fato econômico.</div></div>'+
 tbl(['Documento','Parcela','Vencimento','Boleto','Liquidação'],[['NFe-EX-0001','1/3','18/10/2026','Não registrado (simulado)','Pendente'],['NFe-EX-0001','2/3','18/11/2026','Aguardando banco','Pendente'],['NFe-EX-0001','3/3','18/12/2026','Sem instrução','Pendente']])+
 '<div class="info-row warn">Um boleto exportado ou registrado não é título quitado. Arquivos e API entram no mesmo E07 para evitar baixa duplicada.</div>',
 'Simular parcelamento|Preparar cobrança|Consultar registro bancário|Abrir renegociação');
}
if(sc.epic==='E06'){
 return box('Capacidades contratadas por banco e serviço',
 tbl(['Banco','Conta (mascarada)','Cobrança API','Extrato API','Pagamentos','Fallback arquivo'],[
 ['Bradesco','••••001','Pendente convênio','Pendente','Pendente','CNAB a homologar'],['Itaú','••••002','Pendente contrato','Pendente','Pendente','OFX/CNAB a homologar'],['Santander','••••003','Pendente ativação','Pendente','Pendente','CNAB 240 v8.5 a validar']])+
 '<div class="approval-path"><div><b>Cadastro externo</b>Conta, contrato bancário e portal de aplicações.</div><div><b>E12 central</b>mTLS, client ID, OAuth, certificado e endpoint.</div><div><b>Adapter E06</b>Contrato homologado da capacidade, operação idempotente.</div></div><div class="info-row">Nenhuma API privada ou layout está presumido como habilitado na conta da AlphaCarnes. Configurações são tratadas em E12.</div>',
 'Solicitar contrato de API|Testar autenticação HML|Associar capacidade|Abrir fallback E11');
}
if(sc.epic==='E08'){
 const vals=[['Semana 1','R$ 64.200','R$ 51.900','R$ 12.300'],['Semana 2','R$ 49.800','R$ 62.100','−R$ 12.300'],['Semana 3','R$ 80.350','R$ 46.900','R$ 33.450'],['Semana 4','R$ 55.200','R$ 50.000','R$ 5.200']];
 return box('Fluxo de caixa — previsto × realizado × posição conciliada',
 tbl(['Horizonte','Entradas previstas','Saídas previstas','Saldo líquido'],vals)+
 '<div class="field-grid">'+input('Saldo de abertura','R$ 70.000,00 (exemplo)')+input('Saldo bancário reconciliado','Independente do saldo projetado')+input('Centro de custo','Todos')+input('Período de referência','Outubro/2026')+'</div>'+
 '<div class="info-row">Transferências entre contas não constituem receita/despesa. Tarifas e estornos são eventos próprios, com trilha e período contábil.</div>',
 'Alterar horizonte de projeção|Analisar liquidez|Reconciliar contas|Registrar transferência entre contas');
}
if(sc.epic==='E10'){
 return box('Integração com expedição — bloqueios completos',
 '<div class="approval-path"><div><b>Operação</b>Pedido e preço Onda 14, peso final e peças confirmadas.</div><div><b>Emissão NF-e 55</b>Motor fiscal, certificado A1, protocolo de autorização SEFAZ.</div><div><b>Liberação</b>Seguro, conferência, autorização fiscal e demais verificações.</div></div>'+
 tbl(['Gate','Estado de demonstração','Conduta'],[['Carga fechada','Conferida','Permitir pré-faturamento'],['Divergência crítica','Pendente de validação','Bloquear envio'],['NF-e autorizada','Não transmitida','Bloquear liberação'],['Seguro obrigatório','Aguardando registro','Bloquear liberação']])+
 '<div class="info-row warn">Não reutilizar status da NFS-e municipal incipiente como autorização de NF-e estadual de mercadorias. Evento fiscal real controla a saída.</div>',
 'Revisar itens realmente carregados|Abrir validação SEFAZ|Abrir checklist de saída|Consultar ocorrências');
}
if(sc.id==='E11-V04'){
 return box('Rastreabilidade de um fato econômico (exemplo)',
 tbl(['Horário','Fonte','Referência externa','Valor','Resultado'],[['09:04','API Extrato','TX-DEMO-100','R$ 5.000,00','Observação anexada'],['09:06','CNAB Retorno','NOSSO-DEMO-100','R$ 5.000,00','Evento cobrança'],['10:00','OFX','FITID-DEMO-100','R$ 5.000,00','Observação associada'],['10:15','Conciliação E07','ALOC-DEMO-100','R$ 5.000,00','Uma baixa ilustrativa']])+
 '<div class="info-row warn">A existência de três evidências não justifica três créditos, lançamentos ou baixas. Identidade fraca requer revisão.</div>',
 'Comparar hash da origem|Consultar evento canônico|Solicitar revisão de conflito');
}
if(sc.id==='E11-V05'){
 return box('Política de continuidade operacional por capability',
 tbl(['Serviço','API preferencial','Canal fallback','Ação se indisponível'],[['Extrato Bradesco','Não homologada','CNAB/OFX aprovado','Importar e reconciliar'],['Cobrança Itaú','Aguardando credenciais','CNAB retorno homologado','Consultar antes de remessa'],['Extrato Santander','Falha intermitente','CSV perfilado / CNAB','Ativar fallback com aprovação']])+
 '<div class="info-row warn">Timeout na transmissão de pagamento não autoriza automaticamente nova instrução por arquivo. O estado externo deve ser consultado primeiro.</div>',
 'Aprovar fallback|Suspender capacidade|Reprocessar observações|Executar failback');
}
if(sc.id==='E12-V01'){
 return box('Catálogo de serviços e estados de habilitação',
 tbl(['Provedor','Serviço','Ambiente','Credencial','Status'],[['SEFAZ/SP','Autorização NF-e 55','HML','A1 ainda não associado','Aguardando validação'],['Ambiente Nacional','Distribuição DF-e','HML','A1 ainda não associado','Aguardando validação'],['Bradesco','Cobrança','HML','Contrato pendente','Bloqueado'],['Itaú','OAuth mTLS','HML','Certificado bancário pendente','Bloqueado'],['Santander','Cobrança/CNAB','HML','Convênio pendente','Bloqueado']])+
 '<div class="info-row">Registro de endpoint aprovado por serviço/ambiente. URLs de destino exigem allowlist e validação contra SSRF; perfis de integração não contêm chave privada.</div>',
 'Cadastrar provedor|Criar perfil fiscal|Configurar banco|Solicitar homologação');
}
if(sc.id==='E12-V03'){
 return box('Contrato bancário e aplicações OAuth/mTLS',
 tbl(['Componente','Bradesco','Itaú','Santander'],[['Certificado cliente','Conforme produto','mTLS dinâmico','Conforme produto'],['Autenticação','Conforme API do convênio','OAuth2 / mTLS','Conforme Swagger privado'],['App/convênio','Registro portal','API Owner / contrato','Workspace conforme serviço'],['Contingência','Layout banco','Layout bancário','CNAB 240 v8.5 a validar']])+
 '<div class="field-grid">'+input('Chave mestra de proteção','AWS KMS por identidade IAM')+input('Segredo API do cliente','Ciphertext no PostgreSQL')+input('Certificado por finalidade','Vínculo versionado')+input('Escopo de autorização','Por conta + capability + ambiente')+'</div>',
 'Gerar CSR controlado|Associar certificado mTLS|Testar OAuth HML|Habilitar serviço contratado');
}
if(sc.id==='E12-V04'){
 return box('Catálogo SEFAZ — modelo 55 e Distribuição DF-e',
 tbl(['Serviço oficial','Ambiente','Certificado','Verificação'],[['NFeAutorizacao4','HML','e-CNPJ A1','Status teste pendente'],['NFeConsultaProtocolo4','HML','e-CNPJ A1','Consulta pendente'],['NFeRecepcaoEvento4','HML','e-CNPJ A1','Evento em homologação'],['NFeInutilizacao4','HML','e-CNPJ A1','Vigência dependente'],['NFeDistribuicaoDFe','Nacional/HML','e-CNPJ A1','Checkpoint NSU necessário']])+
 '<div class="info-row warn">Credenciamento estadual, homologação de série e versão NT/XSD são pré-condições separadas. Contingência somente no modo regulamentar permitido.</div>',
 'Testar status SEFAZ|Validar certificado emitente|Simular XSD|Solicitar ativação produção');
}
if(sc.id==='E12-V05'){
 return box('Versionamento, diff e aprovação de referências externas',
 tbl(['Referência','Versão pública pesquisada','Vigência/compatibilidade','Estado'],[['NT 2025.002 RTC','v1.52 (01/10/2026)','Validar com XSD aplicável','Staging'],['Pacote XSD NF-e','010f (31/08/2026)','Compatibilidade com NT v1.52 pendente','Bloqueado'],['EFD ICMS/IPI','Guia 3.2.4 (09/2026)','Por competência/regime','Pendente'],['CNAB Santander','H7815 v8.5 (02/2026)','Por carteira/convênio','Pendente'],['Tabela cBenef SP','Versão documentada (2026)','Contador confirma elegibilidade','Em revisão']])+
 '<div class="info-row warn">Atualizar catálogo não muda regra tributária aprovada nem reprocessa NF-e emitida. Staging → diff → revisão → ativação por vigência.</div>',
 'Consultar fonte oficial|Comparar duas versões|Submeter homologação|Ativar após aprovação');
}
if(sc.id==='E12-V07'){
 return box('Operações monitoradas e alertas de continuidade',
 tbl(['Tipo','Criticidade','Ação recomendada','Responsável'],[['Vencimento e-CNPJ A1','Alta','Renovar antes de 60/30/15/7 dias','Administrativo'],['Itaú mTLS / CA','Alta','Conferir mudança da cadeia vigente','TI'],['SEFAZ timeout autorização','Crítica','Consultar chave/protocolo antes de reenviar','Fiscal'],['Job DF-e interrompido','Média','Retomar checkpoint NSU sem duplicar','Integrações'],['CNAB layout desconhecido','Alta','Quarentena e contrato com banco','Tesouraria']])+
 '<div class="info-row">Todos os alertas preservam logs sem segredo e justificativa de quem executou a correção. Disponibilidade de API de terceiro não é garantida pelo ERP.</div>',
 'Reconhecer alerta|Abrir incidente|Pausar job|Reprocessar com idempotência');
}
return '';
}
function specialPanel(sc){
 const domain = domainPanel(sc); if (domain) return domain;
 if(sc.id==='E12-V02')return '<div class="erp-card" style="margin-bottom:12px;border-color:var(--primary-soft-border)"><div class="erp-card-header"><h2>Assistente de certificado digital A1</h2><span class="badge-proto">UPLOAD DEMONSTRATIVO</span></div><div class="erp-card-body"><div class="status-track"><div class="active">1 · Identificação</div><div>2 · Arquivo e senha</div><div>3 · Validação</div><div>4 · Binding e aprovação</div></div><div class="info-row warn">Não importe certificados reais. Este protótipo não lê, valida, criptografa nem transmite o conteúdo do arquivo: captura somente nome e tamanho para demonstrar UX.</div><div class="field-grid"><div class="erp-field"><label>Tipo</label><select id="cert-kind"><option>e-CNPJ A1 — NF-e/DF-e</option><option>Certificado mTLS bancário</option><option>Certificado público de confiança</option></select></div><div class="erp-field"><label>Ambiente</label><input readonly value="'+S.env+'"></div><div class="erp-field"><label>Selecionar arquivo ilustrativo</label><input id="cert-file" type="file" accept=".pfx,.p12,.crt,.pem,.cer"></div><div class="erp-field"><label>Senha ilustrativa (não armazenar)</label><input id="cert-password" type="password" autocomplete="off" placeholder="Não use senha verdadeira"></div></div><div style="margin-top:10px;display:flex;gap:8px"><button class="erp-btn" data-action="cert-preview">Pré-validar arquivo</button><button class="erp-btn primary" data-action="cert-flow">Simular envio para revisão</button></div></div></div>';
 if(sc.id==='E11-V01'||sc.id==='E11-V02')return '<div class="erp-card" style="margin-bottom:12px;border-color:var(--primary-soft-border)"><div class="erp-card-header"><h2>Importação de extrato / retorno</h2><span class="badge-proto">SEM LEITURA DO CONTEÚDO REAL</span></div><div class="erp-card-body"><div class="field-grid"><div class="erp-field"><label>Instituição</label><select id="bank-name"><option>Bradesco</option><option>Itaú</option><option>Santander</option></select></div><div class="erp-field"><label>Serviço do arquivo</label><select id="bank-service"><option>Extrato bancário</option><option>Retorno cobrança</option><option>Remessa cobrança</option><option>Retorno pagamento</option></select></div><div class="erp-field"><label>Layout homologado</label><select id="bank-layout"><option>CNAB 240 — sob homologação</option><option>CNAB 400 — sob homologação</option><option>OFX — perfil autorizado</option><option>CSV — mapeamento validado</option></select></div><div class="erp-field"><label>Arquivo demonstrativo</label><input type="file" id="bank-file" accept=".txt,.ret,.rem,.ofx,.csv"></div></div><div class="info-row warn">Nenhum lote de arquivo é considerado conciliado pelo upload; o retorno exige validação, contrato/layout e correspondência com transação canônica.</div><button class="erp-btn primary" data-action="file-preview">Gerar prévia ilustrativa do lote</button></div></div>';
 if(sc.id==='E12-V06')return '<div class="erp-card" style="margin-bottom:12px"><div class="erp-card-header"><h2>Processamento agendado e retomada</h2></div><div class="erp-card-body"><div class="field-grid"><div class="erp-field"><label>Operação</label><select id="job-service"><option>Distribuição DF-e NSU</option><option>SEFAZ consulta protocolo</option><option>Sincronização extratos API</option><option>Importação de retorno CNAB</option><option>Alerta expiração certificado</option></select></div><div class="erp-field"><label>Frequência / timezone</label><input value="0 */3 * * * · America/Sao_Paulo" id="job-cron"></div><div class="erp-field"><label>Controle de concorrência</label><input readonly value="lease + fencing token + outbox"></div><div class="erp-field"><label>Checkpoint</label><input readonly value="NSU/transactionId versionado (fixture)"></div></div><button class="erp-btn" data-action="job-run" style="margin-top:10px">Simular agendamento / execução</button></div></div>';
 if(sc.id==='E11-V03'||sc.epic==='E07')return '<div class="erp-card" style="margin-bottom:12px"><div class="erp-card-header"><h2>Convergência API × arquivo sem duplicar baixas</h2><span class="badge-proto">CENÁRIO XB-01</span></div><div class="erp-card-body"><div class="approval-path"><div><b>Observação A · API</b>Transação TX-DEMO-001<br>Crédito R$ 5.000,00</div><div><b>Observação B · OFX</b>FITID-DEMO-001<br>Crédito R$ 5.000,00</div><div><b>Fato econômico canônico</b>Uma transação<br>Uma baixa / Um ledger</div></div><div class="info-row warn">Somente chaves externas fortes confirmadas permitem deduplicação automática; igualdade de valor e data não é suficiente.</div><button class="erp-btn" data-action="dedupe">Simular análise CROSS / proposta</button></div></div>';
 if(sc.epic==='E02')return '<div class="erp-card" style="margin-bottom:12px"><div class="erp-card-header"><h2>Etapas da NF-e 55 · SEFAZ/SP</h2><span class="badge-proto">HOMOLOGAÇÃO SIMULADA</span></div><div class="erp-card-body"><div class="status-track"><div class="active">Rascunho</div><div>Validada / XSD</div><div>Transmitida</div><div>Autorizada</div></div><div class="info-row warn">A autorização e o protocolo não são simulados como reais. O fluxo deve tratar rejeição, timeout, contingência regulamentar, consulta e eventos após aprovação de regras e certificado A1.</div><button class="erp-btn" data-action="nfe-check">Verificar pré-condições de emissão</button></div></div>';
 if(sc.epic==='E09')return '<div class="erp-card" style="margin-bottom:12px"><div class="erp-card-header"><h2>Controle contábil · competência</h2></div><div class="erp-card-body"><div class="approval-path"><div><b>Débitos (ilustrativo)</b>R$ 5.000,00</div><div><b>Créditos (ilustrativo)</b>R$ 5.000,00</div><div><b>Diferença</b>R$ 0,00 · Exige conciliação</div></div><div class="info-row">O fechamento de período requer lançamentos balanceados, conciliação documental, aprovação do contador e validação das obrigações aplicáveis.</div></div></div>';
 return '';
}
function renderScreen(sc){
 if(!allowed(sc))return '<div class="hero-row"><div><h1>Acesso não permitido ao perfil '+escapeHtml(S.role)+'</h1><p class="hero-sub">O protótipo demonstra a restrição RBAC por área. Alterne o perfil, sem alterar dados reais.</p></div><button class="erp-btn" data-go="inicio">Voltar</button></div>';
 const records=S.records[sc.id],rec=records[S.row]||records[0],tabs=formTabNames;
 let h='<div class="hero-row"><div><span class="eyebrow">'+sc.epic+' · '+escapeHtml(epTitles[sc.epic])+' · '+escapeHtml(sc.source)+'</span><h1>'+escapeHtml(sc.title)+'</h1><p class="hero-sub">'+escapeHtml(sc.actions)+'. Acesso típico: '+escapeHtml(sc.role)+'.</p></div><div class="hero-actions"><span class="proto-flag">DADOS FICTÍCIOS</span><button class="erp-btn" data-action="export">Exportar</button><button class="erp-btn" data-action="new">+ Novo registro</button><button class="erp-btn primary" data-action="workflow">Ações do processo ▾</button></div></div>';
 h+='<div class="kpi-row"><div class="kpi-card"><span>Itens no cenário</span><b>'+records.length+'</b><small>Base sintética isolada</small></div><div class="kpi-card"><span>Em revisão</span><b>'+records.filter(x=>x.status==='Em revisão').length+'</b><small>Exigem decisão humana</small></div><div class="kpi-card"><span>Bloqueados</span><b>'+records.filter(x=>x.status==='Bloqueado').length+'</b><small>Não gerar sucesso falso</small></div><div class="kpi-card"><span>Ambiente em tela</span><b style="font-size:20px">'+escapeHtml(S.env)+'</b><small>Sem acesso a serviços externos</small></div></div>';
 h+=specialPanel(sc);
 h+='<div class="work-grid"><section class="erp-card"><div class="erp-card-header"><h2>Registros e consultas</h2>'+pill('Fixture de teste')+'</div>'+renderTable(sc)+'</section>';
 h+='<section class="erp-card"><div class="erp-card-header"><h2>Detalhamento e execução</h2><span class="smallmuted mono">'+escapeHtml(rec.id)+'</span></div><div class="tab-strip" role="tablist">'+tabs.map(x=>'<button data-tab="'+escapeHtml(x)+'" class="'+(S.tab===x?'active':'')+'" role="tab" aria-selected="'+(S.tab===x)+'">'+escapeHtml(x)+'</button>').join('')+'</div><div class="detail-body">';
 if(S.tab===tabs[0])h+=renderFicha(sc,rec);
 else if(S.tab===tabs[1])h+=renderMov(sc,rec);
 else if(S.tab===tabs[2])h+=renderRules(sc);
 else if(S.tab===tabs[3])h+=renderExceptions(sc);
 else if(S.tab===tabs[4])h+=renderHistory(sc,rec);
 else if(S.tab===tabs[5])h+=integrationInfo(sc);
 else h+=renderAccept(sc);
 h+='</div></section></div>';
 h+='<div class="erp-card" style="margin-top:12px"><div class="erp-card-header"><h2>Ações do domínio — previstas no contrato completo</h2></div><div class="erp-card-body"><div style="display:flex;flex-wrap:wrap;gap:8px">'+actionNames(sc).map((x,i)=>'<button class="erp-btn '+(i===0?'primary':'')+'" data-action="custom" data-caption="'+escapeHtml(x)+'">'+escapeHtml(titleCase(x))+'</button>').join('')+'</div><div class="form-hint">Cada operação exige implementação com DTO, domínio backend, validações, estados, auditoria e testes. Neste protótipo o efeito é local e nunca é lançado em produção.</div></div></div>';
 h+='<p class="smallmuted" style="margin-top:12px">ID canônico de especificação: <span class="mono">'+sc.id+'</span> · '+escapeHtml(sc.source)+' · Referencial de engenharia: E12 para credenciais/secret-store/jobs e E11 para arquivos/conciliação.</p>';
 return h;
}
function render(){
 const sc=currentScreen();S.row=Math.max(0,Math.min(S.row,(sc?S.records[sc.id].length:1)-1));
 let page=S.page==='inicio'?renderIntro():S.page==='jornadas'?renderJourneys():S.page.startsWith('antiga:')?renderLegacy():sc?renderScreen(sc):renderIntro();
 app.innerHTML='<div class="erp-layout">'+renderNav()+'<main class="erp-main">'+renderTop()+'<div class="erp-content">'+page+'</div></main></div>';
 document.title=(sc?sc.title+' — ':'')+'AlphaCarnes ERP | Protótipo DS v3';
}
function go(page){
 S.page=page;S.tab='Ficha e campos';S.row=0;S.search='';S.status='Todos';
 const sc=D.screens.find(x=>x.id===page);
 if(sc){S.sidebar.add(sc.group);S.subnav.add(sc.epic);}
 location.hash=encodeURIComponent(page);render();window.scrollTo({top:0,behavior:'instant'});
}
function addEvent(action,sc){const rec=S.records[sc.id][S.row];if(!rec)return;S.events.push({id:rec.id,action,who:S.role,date:new Date().toLocaleString('pt-BR')});}
function actionMain(name,caption=''){
 const sc=currentScreen();if(!sc)return;
 if(name==='new'||name==='edit'){openDrawer(sc,name);return;}
 if(name==='history'){S.tab='Histórico';render();return;}
 if(name==='export'){toast('Exportação de demonstração: dados fictícios. O arquivo de produção depende do serviço real.');return;}
 if(name==='cert-preview'){const file=document.querySelector('#cert-file')?.files?.[0];toast(file?'Arquivo selecionado: '+file.name+' ('+file.size+' bytes). Nenhuma validação criptográfica executada.':'Selecione um arquivo demonstrativo para visualizar o fluxo.');return;}
 if(name==='cert-flow'){const file=document.querySelector('#cert-file')?.files?.[0];openConfirm('Submeter certificado à revisão','Etapas reais: validar PKCS#12/ICP-Brasil, cifrar conteúdo com AES-256-GCM e proteger chave de dados via AWS KMS, persistir somente metadados no PostgreSQL, exigir aprovação e associação por finalidade. Este protótipo não executa criptografia nem envia o arquivo.',file?'Solicitação demonstrativa':'Selecione um arquivo ilustrativo para revisar o fluxo.',true);return;}
 if(name==='file-preview'){const file=document.querySelector('#bank-file')?.files?.[0];toast(file?'Prévia ilustrativa: '+file.name+' (sem leitura, remessa ou baixa).':'Selecione um arquivo fictício para pré-visualizar.');return;}
 if(name==='job-run'){toast('Job demonstrativo agendado. Nenhuma chamada SEFAZ ou banco foi disparada.');addEvent('Planejamento batch simulado',sc);return;}
 if(name==='dedupe'){openConfirm('Análise CROSS de duplicidade','Observação API + observação OFX com mesmo identificador externo validado convergem a uma transação e uma baixa. Se IDs fracos, manter pendente. Não criar fatos reais.','Visualizar resultado',false);return;}
 if(name==='nfe-check'){openConfirm('Checklist de emissão SEFAZ/SP','Exigir CNPJ/IE, certificado A1 válido, XSD vigente, tabela fiscal aprovada, carga conferida, série/numeração exclusiva, ambiente e autorização. Sem essas condições não transmitir em produção.','Registrar checklist simulado',false);return;}
 if(name==='workflow'){openWorkflow(sc);return;}
 if(name==='simulate-error'){toast('Erro 422 simulado: condição fiscal/bancária não homologada; nenhuma mutação realizada.');addEvent('Validação negativa executada (simulação)',sc);return;}
 if(name==='simulate'){toast('Simulação local: regras precisam de versão aprovada e teste de integração para permitir a operação.');addEvent('Pré-validação demonstrativa',sc);return;}
 if(name==='report'){openConfirm('Nova ocorrência','Informe justificativa, origem e evidência do erro. O backend deverá registrar ocorrência com trilha antes/depois.','Abrir ocorrência fictícia',false);return;}
 if(name==='custom'){openConfirm('Ação do domínio: '+caption,'Ação prevista na especificação: '+caption+'. Pré-condições: '+sc.rules+'. Riscos: '+sc.exceptions+'. Qualquer transação bancária, fiscal, assinatura ou baixa requer confirmação externa e não é efetuada no protótipo.','Registrar solicitação demonstrativa',false);return;}
}
function openWorkflow(sc){
 const actions=actionNames(sc);
 layer.innerHTML='<div class="drawer-backdrop" data-close-layer="1"><aside class="drawer" role="dialog" aria-modal="true" aria-label="Ações do processo"><div class="drawer-head"><div><span class="eyebrow">'+sc.id+'</span><h2>Ações e decisões do processo</h2><p class="subtle">Operações completas previstas no Caderno B</p></div><button class="erp-btn" data-close-layer="1">Fechar ×</button></div><div class="drawer-body"><div class="section-label">Comandos de negócio</div>'+actions.map((x,i)=>'<div class="rule-item"><b>'+String(i+1).padStart(2,'0')+' · '+escapeHtml(titleCase(x))+'</b><div class="smallmuted" style="margin:7px 0">Confirme permissões, validade, origem e efeitos fiscais/financeiros antes de registrar.</div><button class="erp-btn small" data-action="custom" data-caption="'+escapeHtml(x)+'">Abrir decisão →</button></div>').join('')+'<div class="section-label">Condicionantes de aceite</div><div class="rule-item">'+escapeHtml(sc.rules)+'</div><div class="rule-item error">'+escapeHtml(sc.exceptions)+'</div><div class="info-row warn">O protótipo não transmite nenhum documento nem efetua nenhuma transação financeira.</div></div></aside></div>';
}
function openDrawer(sc,mode){
 S.formMode=mode;
 const rec=S.records[sc.id][S.row]||S.records[sc.id][0];
 let fields=screenFields(sc),h='<form id="editor-form"><div class="field-grid">';
 fields.forEach((f,i)=>{const tp=typeFor(f);let input='';
 const common='name="field-'+i+'" aria-label="'+escapeHtml(f)+'"';
 if(tp==='select')input='<select '+common+'><option value="">Selecione</option><option>Rascunho</option><option>Em análise</option><option>HML</option><option>PROD</option><option>Não aplicável</option></select>';
 else if(tp==='file')input='<input type="file" '+common+' accept=".xml,.txt,.csv,.ofx,.pfx,.p12,.pem,.cer,.crt,.pdf">';
 else if(tp==='date')input='<input type="date" '+common+' value="'+(mode==='edit'?escapeHtml(rec.date):'')+'">';
 else if(tp==='password')input='<input type="password" '+common+' autocomplete="off" placeholder="Demonstração — nunca use segredo real">';
 else if(tp==='number')input='<input type="number" step="0.01" '+common+' placeholder="0,00 (exemplo)">';
 else input='<input type="text" '+common+' value="'+(mode==='edit'?escapeHtml(String(fakeValue(f,sc,rec,i)).replace(/"/g,'')):'')+'" placeholder="Informe '+escapeHtml(f)+'" '+(i<2?'required':'')+'>';
 h+='<div class="erp-field"><label>'+escapeHtml(f)+(i<2?' *':'')+'</label>'+input+'</div>';
 });h+='</div><div class="divider"></div><div class="section-label">Governança, versão e rastreabilidade</div><div class="field-grid"><div class="erp-field"><label>Justificativa da alteração</label><textarea name="justificativa" placeholder="Descreva o motivo e a evidência" required></textarea></div><div class="erp-field"><label>Ambiente</label><input readonly value="'+S.env+'"></div></div><div class="info-row warn">Salvamento apenas demonstrativo em memória. Segredos e certificados verdadeiros não devem ser informados. No sistema real, backend, KMS e aprovações protegerão a operação.</div></form>';
 layer.innerHTML='<div class="drawer-backdrop" data-close-layer="1"><aside class="drawer" role="dialog" aria-modal="true"><div class="drawer-head"><div><span class="eyebrow">'+sc.id+' · '+(mode==='edit'?'ALTERAR VERSÃO':'CRIAR REGISTRO')+'</span><h2>'+escapeHtml(sc.title)+'</h2><p class="subtle">Formulário gerado dos campos específicos do contrato funcional</p></div><button class="erp-btn" data-close-layer="1">Fechar ×</button></div><div class="drawer-body">'+h+'</div><div class="drawer-actions"><button class="erp-btn" data-close-layer="1">Cancelar</button><button class="erp-btn" data-action="validate-form">Validar campos</button><button class="erp-btn primary" data-action="save-form">Salvar rascunho ilustrativo</button></div></aside></div>';
}
function saveForm(validateOnly){
 const form=document.getElementById('editor-form'),sc=currentScreen();if(!form||!sc)return;
 if(!form.reportValidity()){toast('Preencha os campos obrigatórios e a justificativa.');return;}
 if(validateOnly){toast('Validação estrutural demonstrativa concluída; regras de backend/terceiros ainda não executadas.');return;}
 const fd=new FormData(form),rec=S.records[sc.id][S.row];
 if(S.formMode==='new'){S.records[sc.id].unshift({id:sc.id+'-EX-'+String(S.records[sc.id].length+1).padStart(3,'0'),name:String(fd.get('field-0')||'Novo exemplo'),status:'Pendente de validação',value:money(0),date:'2026-10-11',responsavel:S.role,origin:'Cadastro demonstrativo'});S.row=0;}
 else if(rec){rec.status='Em revisão';rec.name=String(fd.get('field-0')||rec.name).slice(0,80);}
 addEvent(S.formMode==='new'?'Criado rascunho demonstrativo':'Editada proposta demonstrativa',sc);
 layer.innerHTML='';render();toast('Rascunho demonstrativo atualizado em memória; nenhuma API ou banco foi alterado.');
}
function openConfirm(title,detail,ok='Confirmar (simulação)',restricted=false){
 layer.innerHTML='<div class="modal-backdrop-erp" data-close-layer="1"><section class="erp-modal" role="dialog" aria-modal="true"><span class="eyebrow">FLUXO DE APROVAÇÃO · SIMULADO</span><h2>'+escapeHtml(title)+'</h2><p>'+escapeHtml(detail)+'</p><div class="erp-field" style="margin-top:12px"><label>Justificativa / observação</label><textarea id="action-reason" placeholder="Registre a razão para a decisão demonstrativa"></textarea></div><div class="info-row warn">'+(restricted?'A ação está bloqueada enquanto falta validação externa; nenhum estado real será alterado.':'A confirmação somente registra evento de demonstração, sem integração real.')+'</div><div class="modal-btns"><button class="erp-btn" data-close-layer="1">Cancelar</button><button class="erp-btn primary" data-action="confirm" '+(restricted?'disabled':'')+'>'+escapeHtml(ok)+'</button></div></section></div>';
}
function confirmAction(){
 const text=document.querySelector('#action-reason')?.value?.trim();if(!text){toast('Informe justificativa para demonstrar a decisão auditável.');return;}
 const sc=currentScreen();if(sc)addEvent('Decisão demonstrativa: '+text,sc);
 layer.innerHTML='';render();toast('Ação registrada apenas na simulação; nenhuma operação externa ou financeira foi executada.');
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-go],[data-old],[data-toggle-group],[data-toggle-epic],[data-tab],[data-select-journey],[data-action],[data-close-layer],[data-row]');if(!b)return;
 if(b.dataset.go){go(b.dataset.go);return;}
 if(b.dataset.old){go('antiga:'+b.dataset.old);return;}
 if(b.dataset.toggleGroup){const x=b.dataset.toggleGroup;S.sidebar.has(x)?S.sidebar.delete(x):S.sidebar.add(x);render();return;}
 if(b.dataset.toggleEpic){const x=b.dataset.toggleEpic;S.subnav.has(x)?S.subnav.delete(x):S.subnav.add(x);render();return;}
 if(b.dataset.tab){S.tab=b.dataset.tab;render();return;}
 if(b.dataset.selectJourney){S.journeyIndex=Number(b.dataset.selectJourney);render();return;}
 if(b.dataset.row!==undefined){S.row=Number(b.dataset.row);render();return;}
 if(b.dataset.closeLayer){if(e.target===b||b.tagName==='BUTTON'){layer.innerHTML='';return;}}
 if(b.dataset.action==='save-form'||b.dataset.action==='validate-form'){saveForm(b.dataset.action==='validate-form');return;}
 if(b.dataset.action==='confirm'){confirmAction();return;}
 if(b.dataset.action){actionMain(b.dataset.action,b.dataset.caption||'');return;}
});
document.addEventListener('change',e=>{
 if(e.target.id==='role'){S.role=e.target.value;S.page='inicio';render();return;}
 if(e.target.id==='env'){S.env=e.target.value;render();return;}
 if(e.target.id==='filter-status'){S.status=e.target.value;render();return;}
});
document.addEventListener('input',e=>{
 if(e.target.id==='filter-records'){
  const a=e.target.selectionStart;S.search=e.target.value;render();let x=document.getElementById('filter-records');if(x){x.focus();x.setSelectionRange(a,a);}return;
 }
 if(e.target.id==='global-search'){
  const q=e.target.value.toLowerCase().trim();if(q.length<2)return;
  const r=D.screens.find(x=>(x.title+' '+x.id+' '+x.area).toLowerCase().includes(q));if(r){S.sidebar.add(r.group);S.subnav.add(r.epic);document.querySelectorAll('.erp-nav button').forEach(b=>{if(b.dataset.go===r.id)b.style.outline='2px solid #fff';});}
 }
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&layer.innerHTML)layer.innerHTML='';
 if(e.key==='Enter'&&e.target.matches('tr[data-row]')){S.row=Number(e.target.dataset.row);render();}
 if(e.key==='Enter'&&e.target.id==='global-search'){const q=e.target.value.toLowerCase().trim();const x=D.screens.find(v=>(v.title+' '+v.id+' '+v.area).toLowerCase().includes(q));if(x)go(x.id);else toast('Nenhuma interface encontrada.');}
});
window.addEventListener('hashchange',()=>{const p=decodeURIComponent(location.hash.slice(1));if(p&&p!==S.page){S.page=p;S.tab='Ficha e campos';S.row=0;S.search='';render();}});
render();
})();
