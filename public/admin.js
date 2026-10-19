const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));
const integer = value => new Intl.NumberFormat('en-US').format(Number(value||0));
const pct = (a,b) => b ? +(a/b*100).toFixed(1) : 0;
const date = value => value ? new Date(value).toLocaleString() : '—';
const empty = cols => `<tr><td class="empty" colspan="${cols}">No records in this view</td></tr>`;
let report;

function range(){
  const end = new Date(), preset = $('#preset').value;
  if(preset === 'custom') return { start:new Date($('#start').value).toISOString(), end:new Date($('#end').value).toISOString() };
  return { start:new Date(end.getTime()-Number(preset)*3600000).toISOString(), end:end.toISOString() };
}
async function api(action, params={}){
  const response=await fetch('/api/admin?'+new URLSearchParams({action,...params}),{cache:'no-store'});
  if(!response.ok) throw Error('The reporting service could not load this view.');
  return response.json();
}
function kpi(label,value,help=''){return `<div class="kpi"><div class="label">${label}</div><strong>${value}</strong><small>${help}</small></div>`}
function metric(label,value){return `<div class="metric-row"><span>${label}</span><strong>${value}</strong></div>`}
function alert(type,title,text){return `<div class="alert ${type}"><b>${title}</b><span>${text}</span></div>`}
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');setTimeout(()=>node.classList.remove('show'),2200)}

function renderOverview(){
  const s=report.summary, checkout=pct(s.checkout_visitors,s.visitors), lead=pct(s.leads,s.visitors);
  const alerts=[];
  if(s.attempts && s.approval_rate<50) alerts.push(alert('danger','Critical: payment approval rate is below target',`${s.approval_rate}% of charge attempts approved. Review issuer responses before scaling traffic.`));
  if(s.checkout_visitors && pct(s.payment_people,s.checkout_visitors)<35) alerts.push(alert('warn','Checkout abandonment is elevated',`Only ${pct(s.payment_people,s.checkout_visitors)}% of checkout visitors attempted payment.`));
  if(s.leads && report.attribution.every(x=>x.source==='direct'&&x.campaign==='—')) alerts.push(alert('warn','Campaign attribution is missing','Traffic is arriving without campaign identifiers, preventing true earnings-per-mailing analysis.'));
  if(!alerts.length) alerts.push(alert('good','Campaign systems are healthy','No critical operational thresholds are currently breached.'));
  $('#alerts').innerHTML=alerts.join('');
  $('#primary-kpis').innerHTML=[kpi('Unique visitors',integer(s.visitors),`${integer(s.views)} total page views`),kpi('Captured leads',integer(s.leads),`${lead}% visitor → lead`),kpi('Buyers',integer(s.buyers),`${s.conversion}% visitor conversion`),kpi('Gross revenue',money(s.revenue),`${money(s.net_revenue)} net`),kpi('Approval rate',`${s.approval_rate}%`,`${s.approvals} of ${s.attempts} attempts`),kpi('Revenue / visitor',money(s.rpv),`${checkout}% reached checkout`)].join('');
  $('#economics').innerHTML=metric('Average order value',money(s.aov))+metric('Revenue per visitor',money(s.rpv))+metric('Revenue per lead',money(s.rpl))+metric('Lead-to-buyer rate',`${s.lead_conversion}%`)+metric('Refunds',money(s.refunds));
  $('#quality').innerHTML=metric('VSL engagement',`${pct(s.video_engaged,s.visitors)}%`)+metric('Landing → checkout',`${checkout}%`)+metric('Checkout → payment',`${pct(s.payment_people,s.checkout_visitors)}%`)+metric('Visitor → lead',`${lead}%`)+metric('Views per visitor',s.visitors?(s.views/s.visitors).toFixed(2):'0');
  renderTrend();
}
function renderTrend(){
  const data=report.trend;if(!data.length){$('#trend').innerHTML='<div class="empty">No trend data in this period</div>';return}
  const w=1000,h=240,p=30,max=Math.max(...data.map(x=>Number(x.views)),1),points=data.map((x,i)=>({x:p+i*(w-p*2)/Math.max(data.length-1,1),y:h-p-Number(x.views)/max*(h-p*2),...x}));
  const line=points.map(x=>`${x.x},${x.y}`).join(' '), area=`${p},${h-p} ${line} ${w-p},${h-p}`;
  const labels=points.filter((_,i)=>i===0||i===points.length-1||i%Math.ceil(points.length/6)===0).map(x=>`<text class="chart-label" x="${x.x}" y="235" text-anchor="middle">${new Date(x.bucket).toLocaleTimeString([],{hour:'numeric'})}</text>`).join('');
  $('#trend').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb" stop-opacity=".25"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>${[40,90,140,190].map(y=>`<line class="chart-grid" x1="30" x2="970" y1="${y}" y2="${y}"/>`).join('')}<polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${line}"/>${points.map(x=>`<circle class="chart-point" cx="${x.x}" cy="${x.y}" r="3"><title>${x.views} views · ${x.leads} leads · ${money(x.revenue)}</title></circle>`).join('')}${labels}</svg>`;
}
function renderFunnel(){
  const s=report.summary, stages=[['Visitors',s.visitors],['VSL engaged',s.video_engaged],['Checkout views',s.checkout_visitors],['Checkout starts',s.checkout_started],['Leads',s.leads],['Payment people',s.payment_people],['Buyers',s.buyers]],base=Math.max(s.visitors,1);
  $('#funnel-kpis').innerHTML=[kpi('VSL engagement',`${pct(s.video_engaged,s.visitors)}%`),kpi('Checkout reach',`${pct(s.checkout_visitors,s.visitors)}%`),kpi('Form completion',`${pct(s.leads,s.checkout_started)}%`),kpi('Payment intent',`${pct(s.payment_people,s.leads)}%`),kpi('Buyer conversion',`${s.conversion}%`)].join('');
  $('#funnel-chart').innerHTML=stages.map((x,i)=>`<div class="funnel-row"><b>${x[0]}</b><div class="funnel-track"><div class="funnel-fill" style="width:${Math.max(x[1]/base*100,1)}%">${integer(x[1])}</div></div><div class="funnel-value">${pct(x[1],base)}%<small>${i?pct(x[1],stages[i-1][1])+'% step':'baseline'}</small></div></div>`).join('');
  const v=[['Unmuted',s.video_engaged],['25% watched',s.video_25],['50% watched',s.video_50],['75% watched',s.video_75],['Completed',s.video_100]],vbase=Math.max(s.video_engaged,1);
  $('#vsl-chart').innerHTML=v.map(x=>`<div><div class="bar-head"><b>${x[0]}</b><span>${integer(x[1])} <small>${pct(x[1],vbase)}%</small></span></div><div class="bar-track"><div class="bar-fill" style="width:${x[1]/vbase*100}%"></div></div></div>`).join('');
  $('#routes-table').innerHTML=`<div class="table-scroll"><table><thead><tr><th>Page</th><th>Visitors</th><th>Views</th><th>Repeat factor</th></tr></thead><tbody>${report.routes.map(x=>`<tr><td>${esc(x.path)}</td><td>${integer(x.visitors)}</td><td>${integer(x.views)}</td><td>${x.visitors?(x.views/x.visitors).toFixed(2):'0'}×</td></tr>`).join('')||empty(4)}</tbody></table></div>`;
  $('#devices').innerHTML=report.devices.map(x=>metric(x.device,`${integer(x.visitors)} · ${pct(x.visitors,s.visitors)}%`)).join('')||'<div class="empty">Device capture begins with new traffic</div>';
}
function renderPayments(){
  const s=report.summary;
  $('#payment-kpis').innerHTML=[kpi('Attempts',integer(s.attempts),`${integer(s.payment_people)} unique people`),kpi('Approvals',integer(s.approvals),`${s.approval_rate}% approval`),kpi('Declines',integer(s.declines),`${integer(s.declined_people)} people affected`),kpi('System errors',integer(s.errors),s.errors?'Action required':'Gateway integration stable'),kpi('Approved revenue',money(s.revenue),`${money(s.refunds)} refunded`)].join('');
  $('#responses').innerHTML=report.payments.map(x=>`<div class="response-card"><code>${esc(x.response_code)}</code><div><b>${esc(x.response)}</b><small>${esc(x.status)} · ${x.people} unique people · ${money(x.amount)}</small></div><strong>${x.attempts}</strong></div>`).join('')||'<div class="empty">No gateway activity</div>';
  const health=[];health.push(`<div class="health-card ${s.errors?'bad':'good'}"><b>Gateway integration: ${s.errors?'Errors detected':'Operational'}</b><small>${s.errors} system errors in this reporting window.</small></div>`);health.push(`<div class="health-card ${s.approval_rate<50?'bad':s.approval_rate<70?'warn':'good'}"><b>Issuer approval: ${s.approval_rate}%</b><small>${s.approval_rate<50?'Critical — pause scaling and investigate processor or traffic quality.':'Continue monitoring issuer decisions.'}</small></div>`);health.push(`<div class="health-card ${s.declined_attempts>s.declined_people*2?'warn':'good'}"><b>Retry pressure: ${s.declined_people?s.declined_attempts/s.declined_people:0} attempts per declined person</b><small>Repeated hard-decline retries inflate attempt counts and rarely recover revenue.</small></div>`);$('#payment-health').innerHTML=health.join('');
}
function renderOffers(){
  const s=report.summary;$('#offer-kpis').innerHTML=[kpi('Active offers',report.offers.length),kpi('Offer revenue',money(s.revenue)),kpi('Overall approval',`${s.approval_rate}%`),kpi('Backend revenue',money(report.offers.filter(x=>x.offer_key!=='frontend').reduce((n,x)=>n+Number(x.revenue),0))),kpi('Average order value',money(s.aov))].join('');
  $('#offer-table').innerHTML=report.offers.length?report.offers.map(x=>{const rate=pct(x.approvals,x.attempts),state=!x.attempts?'idle':rate<50?'bad':'';return `<tr><td><b>${esc(x.product_name)}</b><br><small>${esc(x.offer_key)}</small></td><td>${x.people}</td><td>${x.attempts}</td><td>${x.approvals}</td><td>${x.declines}</td><td>${rate}%</td><td><b>${money(x.revenue)}</b></td><td><span class="dot ${state}"></span>${!x.attempts?'No data':rate<50?'Needs attention':'Healthy'}</td></tr>`}).join(''):empty(8);
}
function renderAcquisition(){
  const s=report.summary,attributed=report.attribution.filter(x=>x.source!=='direct'||x.campaign!=='—').reduce((n,x)=>n+x.leads,0),coverage=pct(attributed,s.leads);
  $('#acq-kpis').innerHTML=[kpi('Tracked leads',integer(attributed)),kpi('Attribution coverage',`${coverage}%`),kpi('Sources',new Set(report.attribution.map(x=>x.source)).size),kpi('Campaigns',new Set(report.attribution.filter(x=>x.campaign!=='—').map(x=>x.campaign)).size),kpi('Lead conversion',`${s.lead_conversion}%`)].join('');
  $('#attribution').innerHTML=`<div class="table-scroll"><table><thead><tr><th>Source</th><th>Campaign</th><th>Leads</th><th>Buyers</th><th>Conversion</th></tr></thead><tbody>${report.attribution.map(x=>`<tr><td>${esc(x.source)}</td><td>${esc(x.campaign)}</td><td>${x.leads}</td><td>${x.buyers}</td><td>${pct(x.buyers,x.leads)}%</td></tr>`).join('')||empty(5)}</tbody></table></div>`;
  $('#tracking-health').innerHTML=`<div class="health-card ${coverage<50?'bad':'good'}"><b>Attribution coverage: ${coverage}%</b><small>${coverage<50?'Add utm_source, utm_campaign, aid and tid to every traffic link.':'Campaign links are carrying usable attribution.'}</small></div><div class="health-card ${report.attribution.some(x=>x.campaign!=='—')?'good':'warn'}"><b>Campaign naming</b><small>${report.attribution.some(x=>x.campaign!=='—')?'Campaign identifiers detected.':'No campaign names detected in this period.'}</small></div><div class="health-card"><b>Recommended link format</b><small>?utm_source=email&utm_campaign=campaign_name&tid=list_segment</small></div>`;
}
async function loadOrders(){const d=await api('orders',{limit:100});$('#orders').innerHTML=d.rows.length?d.rows.map(x=>`<tr><td><b>${esc(x.name)}</b><br><small>${esc(x.email)}</small></td><td>${esc(x.product_name)}</td><td>${money(x.amount)}</td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td><td>${esc(x.response_code)} · ${esc(x.gateway_response||'—')}</td><td>${esc(x.transaction_id||'—')}</td><td>${date(x.updated_at)}</td></tr>`).join(''):empty(7)}
async function loadLeads(){const d=await api('leads',{limit:100,search:$('#lead-search').value});$('#leads-table').innerHTML=d.rows.length?d.rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td>${esc(x.phone)}</td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td><td>${esc(x.source)}</td><td>${esc(x.campaign||'—')}</td><td>${esc(x.landing_page||'—')}</td><td>${date(x.created_at)}</td></tr>`).join(''):empty(8);$('#leads-foot').textContent=`${integer(d.count)} captured leads`}
async function loadSales(){const d=await api('sales',{limit:100,search:$('#sale-search').value});$('#sales-table').innerHTML=d.rows.length?d.rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td>${esc(x.phone)}</td><td>${x.purchases}</td><td>${esc(x.products)}</td><td>${money(x.gross)}</td><td>${money(x.refunds)}</td><td><b>${money(x.net)}</b></td><td>${date(x.last_purchase)}</td></tr>`).join(''):empty(9)}
async function loadAll(){
  $('#refresh').disabled=true;$('#updated').textContent='Synchronizing campaign data…';
  try{report=await api('logistics',range());renderOverview();renderFunnel();renderPayments();renderOffers();renderAcquisition();await Promise.all([loadOrders(),loadLeads(),loadSales()]);$('#updated').textContent=`Updated ${new Date().toLocaleTimeString()} · ${date(report.range.start)} to ${date(report.range.end)}`;toast('Campaign data refreshed')}
  catch(error){$('#updated').textContent=error.message;toast(error.message)}finally{$('#refresh').disabled=false}
}
$('#tabs').addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(!button)return;document.querySelectorAll('.tabs button,.tabpage').forEach(x=>x.classList.remove('active'));button.classList.add('active');$('#tab-'+button.dataset.tab).classList.add('active');history.replaceState({},'',`#${button.dataset.tab}`)});
$('#preset').addEventListener('change',()=>{$('#custom').classList.toggle('hidden',$('#preset').value!=='custom');if($('#preset').value!=='custom')loadAll()});
$('#refresh').addEventListener('click',loadAll);document.querySelectorAll('[data-search]').forEach(b=>b.addEventListener('click',()=>b.dataset.search==='leads'?loadLeads():loadSales()));document.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click',()=>location.href='/api/admin?'+new URLSearchParams({action:b.dataset.export,search:$(b.dataset.export.startsWith('leads')?'#lead-search':'#sale-search').value})));
const now=new Date(),yesterday=new Date(now-86400000),local=d=>new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);$('#start').value=local(yesterday);$('#end').value=local(now);setInterval(()=>$('#clock').textContent=new Date().toLocaleTimeString(),1000);const hash=location.hash.slice(1);if(hash&&$(`[data-tab="${hash}"]`))$(`[data-tab="${hash}"]`).click();loadAll();setInterval(loadAll,60000);
