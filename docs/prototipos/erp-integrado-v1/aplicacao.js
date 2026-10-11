(function protoApp(){
'use strict';
const D=window.ALPHA_PROTO_DATA,C=window.ALPHA_PROTO_COMPONENTS,app=document.getElementById('app'),layer=document.getElementById('layer'),toastContainer=document.getElementById('toast');
if(!D||!C||!Array.isArray(D.screens))throw new Error('Catálogo indisponível');
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
       if(open)for(const it of arr)html+='<button class="nav-entry '+(S.page===it.id?'active':'')+'" data-go="'+it.id+'" style="padding-left:24px"><span class="prefix" style="min-width:0">'+'•'+'</span>'+escapeHtml(it.title)+'</button>';
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
function componentSpec(sc){return C?.screens?.[sc.id]||null;}
function fieldVal(key,sc,rec,i=0){
 const meta=C.fields[key]||{},cat=C.catalogs[meta.source];
 if(meta.type==='relation'&&cat?.length)return cat[(i+S.row)%cat.length][1];
 if(meta.type==='enum'){const a=C.enums[meta.source]||[];return a[(i+S.row)%a.length]?.[1]||'Não definido';}
 if(meta.writeOnly)return 'Protegido — não exibido';
 if(key==='status')return rec.status;
 if(key==='dataVencimento'||key==='dataEmissao'||key==='vigenciaInicio'||key==='periodoInicio'||key==='dataTransacao')return '20/10/2026';
 if(key==='vigenciaFim'||key==='periodoFim')return '31/12/2026';
 if(key==='competencia')return 'Outubro de 2026';
 if(key==='ambiente')return S.env==='PROD'?'Produção (simulada)':'Homologação (simulada)';
 if(key==='cnpj')return 'CNPJ cadastrado (mascarado)';
 if(key==='ie')return 'Inscrição estadual cadastrada';
 if(meta.type==='money'||key==='valorLiquido'||key==='baseCalculo')return rec.value;
 if(meta.type==='percent')return '12,00% (exemplo)';
 if(meta.type==='decimal')return key.startsWith('peso')?'982,00 kg':'10,000';
 if(meta.type==='readOnly')return key==='nNF'?'Conforme sequência fiscal':key==='nossoNumero'?'Gerado/confirmado pelo banco':'Obtido após confirmação externa';
 if(meta.type==='date'||meta.type==='datetime')return '20/10/2026';
 if(meta.type==='month')return 'Outubro de 2026';
 if(key==='cron')return 'A cada três horas (exemplo)';
 if(meta.type==='approvedEndpoint')return 'Serviço cadastrado e homologado';
 if(meta.type==='file')return 'Nenhum arquivo enviado';
 if(key==='razaoSocial')return 'AlphaCarnes — demonstração';
 if(key==='justificativa')return 'Justificativa necessária para alteração';
 return rec.name||'Não informado';
}
function renderTable(sc){
 const conf=componentSpec(sc),columns=conf.grid.columns,fields=C.fields,rows=S.records[sc.id].map((r,i)=>({...r,_index:i}));
 const q=(S.search||'').toLowerCase().trim();
 const matched=rows.filter(r=>(S.status==='Todos'||r.status===S.status)&&(!q||columns.some(k=>fieldVal(k,sc,r,r._index).toLowerCase().includes(q))||r.name.toLowerCase().includes(q)));
 const sort=S.gridSort?.key||conf.grid.defaultSort,reverse=S.gridSort?.descending||false;
 matched.sort((a,b)=>fieldVal(sort,sc,a,a._index).localeCompare(fieldVal(sort,sc,b,b._index),'pt-BR',{numeric:true})*(reverse?-1:1));
 let h='<div class="toolbar"><input class="input" id="filter-records" placeholder="Pesquisar descrição ou referência de negócio" aria-label="Buscar registros da lista" value="'+escapeHtml(S.search)+'"><select class="select" id="filter-status" aria-label="Filtrar situação"><option>Todos</option>'+stateTypes.map(x=>'<option '+(S.status===x?'selected':'')+'>'+escapeHtml(x)+'</option>').join('')+'</select><span class="spacer"></span><button class="erp-btn small" data-action="export">Exportar visão</button></div>';
 h+='<div class="table-shell"><table class="erp-table"><thead><tr>'+columns.map(key=>'<th><button type="button" class="grid-sort" data-sort="'+escapeHtml(key)+'" aria-label="Ordenar por '+escapeHtml(fields[key].label)+'">'+escapeHtml(fields[key].label)+(sort===key?(reverse?' ↓':' ↑'):' ⇵')+'</button></th>').join('')+'</tr></thead><tbody>';
 if(!matched.length)h+='<tr><td colspan="'+columns.length+'"><div class="empty">Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.</div></td></tr>';
 for(const r of matched){
  h+='<tr tabindex="0" data-row="'+r._index+'" class="'+(S.row===r._index?'selected':'')+'">'+columns.map(key=>'<td title="'+escapeHtml(fieldVal(key,sc,r,r._index))+'">'+(key==='status'?pill(r.status):escapeHtml(fieldVal(key,sc,r,r._index)))+'</td>').join('')+'</tr>';
 }
 h+='</tbody></table></div><div class="smallmuted" style="padding:10px 13px;border-top:1px solid var(--border)">Exibindo '+matched.length+' de '+rows.length+' registros fictícios · Ordenação por coluna · Selecionar linha abre a ficha. Identificadores de banco de dados nunca são mostrados.</div>';
 return h;
}
function renderFicha(sc,rec){
 const conf=componentSpec(sc);
 let h='<div class="section-label">Informações do registro selecionado</div>';
 for(const section of conf.sections){
  h+='<div class="subsection-caption">'+escapeHtml(section.title)+'</div><div class="field-grid">';
  section.fields.forEach((key,i)=>{
   const m=C.fields[key],val=fieldVal(key,sc,rec,i);
   h+='<div class="erp-field"><label>'+escapeHtml(m.label)+'</label><div class="view-value '+(m.writeOnly?'view-secure':'')+'">'+escapeHtml(val)+'</div>'+(m.type==='relation'?'<span class="form-hint">Vinculado a cadastro existente; seleção obrigatória no formulário.</span>':m.type==='enum'?'<span class="form-hint">Valor pertencente ao conjunto de opções do domínio.</span>':'')+'</div>';
  });
  h+='</div><div class="divider"></div>';
 }
 h+='<div class="section-label">Trilha e responsabilização</div><div class="field-grid"><div class="erp-field"><label>Empresa</label><div class="view-value">AlphaCarnes Matriz</div></div><div class="erp-field"><label>Situação</label><div class="view-value">'+escapeHtml(rec.status)+'</div></div><div class="erp-field"><label>Responsável</label><div class="view-value">'+escapeHtml(rec.responsavel)+'</div></div><div class="erp-field"><label>Ambiente</label><div class="view-value">'+escapeHtml(S.env==='PROD'?'Produção (simulada)':'Homologação (simulada)')+'</div></div></div>';
 h+='<div class="toolbar"><button class="erp-btn" data-action="edit">Editar versão</button><button class="erp-btn" data-action="simulate">Validar pré-condições</button><button class="erp-btn" data-action="history">Consultar histórico</button></div>';
 return h;
}
function renderMov(sc,rec){
 return '<div class="section-label">Etapas e evidências de negócio</div><div class="status-track"><div class="active">Preparação</div><div class="active">Verificação</div><div>Autorização</div><div>Conclusão</div></div><div class="erp-card" style="margin-top:12px"><div class="erp-card-header"><h2>Acontecimentos simulados</h2></div><div class="table-shell"><table class="erp-table"><thead><tr><th>Acontecimento</th><th>Origem</th><th>Efeito</th><th>Situação</th></tr></thead><tbody><tr><td>Dados cadastrados</td><td>Operador</td><td>Sem efeito contábil</td><td>'+pill('Aprovado')+'</td></tr><tr><td>Validação de regras</td><td>Motor de negócio</td><td>Aguarda revisão</td><td>'+pill('Em revisão')+'</td></tr><tr><td>Confirmação por serviço externo</td><td>SEFAZ / banco quando aplicável</td><td>Nenhuma transmissão efetuada</td><td>'+pill('Bloqueado')+'</td></tr></tbody></table></div></div><div class="info-row warn">Autorizações, liquidações e lançamentos são eventos de negócio distintos. A confirmação requer fonte externa confiável e auditoria; este protótipo não gera documentos oficiais.</div>';
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
 const actions=S.events.filter(x=>x.id===rec.id).map(x=>({what:x.action,who:x.who,when:x.date}));
 const events=[...actions,{what:'Informações selecionadas para conferência',who:'Equipe demonstrativa',when:'11/10/2026 10:11'},{what:'Cadastro de demonstração preparado',who:'Sistema de prototipação',when:'11/10/2026 09:00'}];
 return '<div class="section-label">Histórico e justificativas</div><div class="timeline">'+events.map(x=>'<div class="event"><strong>'+escapeHtml(x.what)+'</strong><small>'+escapeHtml(x.when)+' • '+escapeHtml(x.who)+'</small></div>').join('')+'</div><div class="info-row">O sistema real preservará evento, ator, empresa, objeto e versão na auditoria. Identificadores técnicos, payloads sigilosos e GUIDs não serão apresentados nesta tela.</div>';
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
 tbl(['Horário','Fonte','Referência externa','Valor','Resultado'],[['09:04','API Extrato','Crédito por API','R$ 5.000,00','Observação anexada'],['09:06','CNAB Retorno','Liquidação de cobrança','R$ 5.000,00','Evento cobrança'],['10:00','OFX','Crédito no extrato','R$ 5.000,00','Observação associada'],['10:15','Conciliação E07','Recebimento confirmado','R$ 5.000,00','Uma baixa ilustrativa']])+
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
 if(sc.id==='E11-V03'||sc.epic==='E07')return '<div class="erp-card" style="margin-bottom:12px"><div class="erp-card-header"><h2>Convergência API × arquivo sem duplicar baixas</h2><span class="badge-proto">CENÁRIO XB-01</span></div><div class="erp-card-body"><div class="approval-path"><div><b>Observação A · API</b>Crédito recebido do cliente<br>Crédito R$ 5.000,00</div><div><b>Observação B · OFX</b>Mesma movimentação comprovada<br>Crédito R$ 5.000,00</div><div><b>Fato econômico canônico</b>Uma transação<br>Uma baixa / Um ledger</div></div><div class="info-row warn">Somente chaves externas fortes confirmadas permitem deduplicação automática; igualdade de valor e data não é suficiente.</div><button class="erp-btn" data-action="dedupe">Simular análise CROSS / proposta</button></div></div>';
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
 h+='<p class="smallmuted" style="margin-top:12px">Ações apresentadas para conferência de UX. A implementação real exige aprovação de regras, integração homologada e auditoria.</p>';
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
function renderControl(m,val,mode){
 let common='name="'+escapeHtml(m.key)+'" id="fld-'+escapeHtml(m.key)+'" data-field-key="'+escapeHtml(m.key)+'" aria-label="'+escapeHtml(m.label)+'"'+(m.required&&!m.readOnly&&!m.writeOnly?' required':'');
 let t=m.type;
 if(t==='relation'||t==='enum'){
  const opt=t==='relation'?(C.catalogs[m.source]||[]):(C.enums[m.source]||[]);
  return '<div class="combo-shell"><select '+common+' data-choice="'+t+'" data-depends="'+escapeHtml((m.dependsOn||[]).join(','))+'"><option value="">Selecione '+escapeHtml(m.label.toLowerCase())+'</option>'+opt.map(a=>'<option value="'+escapeHtml(a[0])+'" title="'+escapeHtml(a[2]||a[1])+'">'+escapeHtml(a[1])+'</option>').join('')+'</select>'+(t==='relation'?'<button type="button" class="erp-btn small lookup-button" data-lookup="'+escapeHtml(m.key)+'" title="Pesquisar cadastro pelo nome">Pesquisar</button>':'')+'</div><span class="form-hint">'+escapeHtml(t==='relation'?'Seleção vinculada ao cadastro; sem digitar identificadores.':m.validation)+'</span>';
 }
 if(m.readOnly)return '<div class="view-value" aria-label="'+escapeHtml(m.label)+'">'+escapeHtml(val)+'</div><span class="form-hint">Informação calculada ou confirmada pelo serviço.</span>';
 if(t==='file')return '<input type="file" '+common+' accept=".pfx,.p12,.pem,.crt,.cer,.xml,.pdf,.csv,.ofx,.txt"><span class="form-hint">Somente arquivo fictício; conteúdo não é enviado nem processado.</span>';
 if(t==='password')return '<input type="password" '+common+' autocomplete="new-password" placeholder="Não insira segredos reais"><span class="form-hint">Campo protegido, sem leitura posterior; jamais pré-preencher.</span>';
 if(t==='date')return '<input type="date" '+common+' value="'+(mode==='edit'?'2026-10-20':'')+'">';
 if(t==='datetime')return '<input type="datetime-local" '+common+'>';
 if(t==='month')return '<input type="month" '+common+' value="'+(mode==='edit'?'2026-10':'')+'">';
 if(t==='money'||t==='percent'||t==='decimal')return '<div class="numeric-field"><span class="numeric-prefix">'+(t==='money'?'R$':t==='percent'?'%':'kg')+'</span><input type="text" '+common+' inputmode="decimal" placeholder="'+(t==='percent'?'0,00':t==='money'?'0,00':'0,000')+'" data-numeric="'+t+'" autocomplete="off"></div><span class="form-hint">'+escapeHtml(m.validation)+'</span>';
 if(t==='approvedEndpoint')return '<select '+common+'><option value="">Selecione serviço oficial aprovado</option><option value="nfe-aut">Autorização NF-e/SP (homologação)</option><option value="dfe-nsu">Distribuição DF-e (homologação)</option><option value="bank-app">Endpoint habilitado no banco (sob contrato)</option></select><span class="form-hint">URL permitida precisa constar no catálogo, não aceitar URL digitada.</span>';
 if(t==='textarea')return '<textarea '+common+' rows="3" placeholder="Informe a justificativa ou observação operacional"></textarea>';
 if(t==='cron')return '<select '+common+'><option value="">Selecione frequência</option><option value="HOURLY">A cada hora</option><option value="EVERY3H">A cada 3 horas</option><option value="DAILY">Diariamente</option><option value="MANUAL">Somente manual</option></select><span class="form-hint">O backend gera expressão cron e prévia de horários; não exigir sintaxe técnica do operador.</span>';
 if(t==='integer')return '<input type="number" min="1" step="1" '+common+'>';
 return '<input type="text" '+common+' maxlength="180" autocomplete="off" placeholder="Informe '+escapeHtml(m.label.toLowerCase())+'">';
}
function openDrawer(sc,mode){
 S.formMode=mode;
 const rec=S.records[sc.id][S.row]||S.records[sc.id][0],conf=componentSpec(sc);
 let h='<form id="editor-form" autocomplete="off">';
 for(const section of conf.sections){
  h+='<div class="section-label">'+escapeHtml(section.title)+'</div><div class="field-grid">';
  for(const key of section.fields){const m=C.fields[key],v=fieldVal(key,sc,rec);h+='<div class="erp-field '+(["justificativa","descricao"].includes(key)?'field-wide':'')+'"><label for="fld-'+escapeHtml(key)+'">'+escapeHtml(m.label)+(m.required&&!m.readOnly?' *':'')+'</label>'+renderControl(m,v,mode)+'</div>';}
  h+='</div><div class="divider"></div>';
 }
 if(!conf.sections.some(x=>x.fields.includes('justificativa')))h+='<div class="erp-field"><label for="review-justification">Motivo da alteração *</label><textarea name="justificativa" id="review-justification" rows="3" required placeholder="Por que este cadastro precisa ser criado/alterado?"></textarea></div>';
 h+='</form><div class="info-row warn">Cadastro demonstrativo em memória. Selecione empresas e entidades existentes pelo nome; não informe IDs internos, senhas verdadeiras ou certificados reais.</div>';
 layer.innerHTML='<div class="drawer-backdrop" data-close-layer="1"><aside class="drawer" role="dialog" aria-modal="true" aria-label="Formulário de '+escapeHtml(sc.title)+'"><div class="drawer-head"><div><span class="eyebrow">CADASTRO · '+escapeHtml(sc.group)+'</span><h2>'+escapeHtml(sc.title)+'</h2><p class="subtle">Formulário completo com tipos e origem de cada campo</p></div><button class="erp-btn" data-close-layer="1">Fechar</button></div><div class="drawer-body">'+h+'</div><div class="drawer-actions"><button class="erp-btn" data-close-layer="1">Cancelar</button><button class="erp-btn" data-action="validate-form">Verificar dados</button><button class="erp-btn primary" data-action="save-form">Salvar rascunho ilustrativo</button></div></aside></div>';
}
function saveForm(validateOnly){
 const form=document.getElementById('editor-form'),sc=currentScreen();if(!form||!sc)return;
 const conf=componentSpec(sc),errors=[];
 for(const m of conf.sections.flatMap(x=>x.fields).map(k=>C.fields[k])){
   const input=form.elements.namedItem(m.key);if(!input||m.readOnly)continue;
   if(m.required&&!m.writeOnly&&!input.value.trim())errors.push(m.label+' é obrigatório.');
   if((m.type==='relation'||m.type==='enum')&&input.value){const options=m.type==='relation'?C.catalogs[m.source]:C.enums[m.source];if(!(options||[]).some(x=>x[0]===input.value))errors.push('Seleção inválida de '+m.label+'.');}
   if((m.type==='money'||m.type==='percent'||m.type==='decimal')&&input.value&&!/^\\d+(,\\d{1,3})?$/.test(input.value.trim()))errors.push(m.label+': use valor positivo com vírgula decimal.');
 }
 const reason=form.elements.namedItem('justificativa');if(reason&&!reason.value.trim())errors.push('Informe justificativa para auditoria.');
 if(errors.length){toast(errors[0]+' '+(errors.length>1?'Outras '+(errors.length-1)+' pendências.':''));const first=conf.sections.flatMap(x=>x.fields).map(k=>form.elements.namedItem(k)).find(x=>x?.required&&!x.value);first?.focus();return;}
 if(validateOnly){toast('Campos e referências selecionadas estão coerentes no protótipo; regras reais ainda requerem backend.');return;}
 const first=conf.sections[0].fields.find(key=>C.fields[key]?.type==="relation"||C.fields[key]?.type==="text")||conf.sections[0].fields[0];
 const el=form.elements.namedItem(first);const cat=C.catalogs[C.fields[first]?.source];let text=el?.selectedOptions?.[0]?.textContent || el?.value||sc.title;
 if(!text||text.toLowerCase().startsWith('selecione '))text=sc.title;
 const rec=S.records[sc.id][S.row];
 if(S.formMode==='new'){S.records[sc.id].unshift({id:'internal-'+Math.random().toString(36).slice(2),name:text,status:'Pendente de validação',value:'R$ 0,00',date:'2026-10-11',responsavel:S.role,origin:'Rascunho simulado'});S.row=0;}
 else if(rec){rec.name=text;rec.status='Em revisão';}
 addEvent(S.formMode==='new'?'Registro demonstrativo criado':'Alteração demonstrativa proposta',sc);layer.innerHTML='';render();toast('Dados demonstrativos salvos apenas nesta sessão. Nenhum documento ou integração externa foi alterado.');
}
function openLookup(key){
 const m=C.fields[key],opts=C.catalogs[m.source]||[];
 if(!opts.length){toast('Nenhum cadastro disponível para seleção. Consulte a área responsável.');return;}
 const popup=document.createElement('div');popup.className='lookup-popup';popup.innerHTML='<div class="lookup-card"><div class="erp-card-header"><h2>Selecionar '+escapeHtml(m.label)+'</h2><button class="erp-btn small" data-close-lookup="1">Fechar</button></div><input class="lookup-search" type="search" placeholder="Pesquisar pelo nome ou descrição" aria-label="Pesquisar cadastro"><div class="lookup-options">'+opts.map(o=>'<button class="lookup-option" data-lookup-select="'+escapeHtml(key)+'" data-choice="'+escapeHtml(o[0])+'"><b>'+escapeHtml(o[1])+'</b><small>'+escapeHtml(o[2]||'Cadastro ativo')+'</small></button>').join('')+'</div><div class="form-hint" style="padding:10px">A seleção utiliza uma referência interna invisível, nunca digitação de GUID.</div></div>';
 layer.appendChild(popup);popup.querySelector('.lookup-search').focus();
 popup.querySelector('[data-close-lookup]').onclick=()=>popup.remove();
 popup.querySelector('.lookup-search').oninput=(e)=>{const q=e.target.value.toLowerCase();popup.querySelectorAll('.lookup-option').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(q));};
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
 const b=e.target.closest('[data-go],[data-old],[data-toggle-group],[data-toggle-epic],[data-tab],[data-select-journey],[data-action],[data-close-layer],[data-row],[data-sort],[data-lookup],[data-lookup-select]');if(!b)return;
 if(b.dataset.sort){if(!S.gridSort||S.gridSort.key!==b.dataset.sort)S.gridSort={key:b.dataset.sort,descending:false};else S.gridSort.descending=!S.gridSort.descending;render();return;}
 if(b.dataset.lookup){openLookup(b.dataset.lookup);return;}
 if(b.dataset.lookupSelect){const sel=layer.querySelector('#fld-'+b.dataset.lookupSelect);if(sel){sel.value=b.dataset.choice;sel.dispatchEvent(new Event('change',{bubbles:true}));}layer.querySelector('.lookup-popup')?.remove();return;}
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
 if(e.target.matches('select[data-choice]')){const key=e.target.dataset.fieldKey;const dependents=layer.querySelectorAll('select[data-depends]');dependents.forEach(select=>{if(select!==e.target&&(select.dataset.depends||'').split(',').includes(key)){select.value='';select.disabled=!e.target.value;}});}
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
