import type {Client,Data,ClientData,Vehicle,Payment} from './types';
export const money=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
export const incoming=(p:Payment)=>p.kind==='Cliente'||p.kind==='Cypres';
export const loadingCost=(v:Vehicle)=>Math.round((v.weight||0)*(v.loadingRate??12000));
export const netCarrierCost=(v:Vehicle)=>v.cost-loadingCost(v);
export const grossCarrierCost=(d:ClientData)=>d.vehicles.reduce((n,v)=>n+v.cost,0);
export const totalLoading=(d:ClientData)=>d.vehicles.reduce((n,v)=>n+loadingCost(v),0);
export const cypresAgreed=(d:ClientData)=>d.cypres&&d.serviceType!=='Cargue'?Math.max(0,grossCarrierCost(d)-d.price):0;
export const serviceRevenue=(d:ClientData)=>d.price+cypresAgreed(d);
export const serviceCosts=(d:ClientData)=>d.vehicles.reduce((n,v)=>n+netCarrierCost(v),0)+d.expenses;
export function serviceData(c:Client,data:Data){return data.orders.find(o=>o.client_id===c.id)?.snapshot||c.data;}
export function balances(data:Data,includeArchived=false){return data.clients.filter(c=>(includeArchived||!c.deleted_at)&&(serviceData(c,data).status==='Contratado'||serviceData(c,data).serviceType==='Cargue')).map(c=>{
 const d=serviceData(c,data),ps=data.payments.filter(p=>p.client_id===c.id);
 const received=ps.filter(p=>p.kind==='Cliente').reduce((n,p)=>n+p.amount,0),cypresReceived=ps.filter(p=>p.kind==='Cypres').reduce((n,p)=>n+p.amount,0),extras=ps.filter(p=>p.kind==='Extra').reduce((n,p)=>n+p.amount,0),paid=ps.filter(p=>!incoming(p)&&p.kind!=='Extra').reduce((n,p)=>n+p.amount,0),carrierCost=d.vehicles.reduce((n,v)=>n+netCarrierCost(v),0),cypresTotal=cypresAgreed(d);
 const cypresPending=Math.max(0,cypresTotal-cypresReceived),pending=Math.max(0,d.price-received);
 return {client:c,detail:d,received,cypresReceived,cypresTotal,cypresPending,paid,pending,payable:Math.max(0,carrierCost-paid),carrierCost,grossCarrierCost:grossCarrierCost(d),loading:totalLoading(d),extras,profit:serviceRevenue(d)-carrierCost-d.expenses-extras,advanced:Math.min(cypresPending,Math.max(0,paid+extras-received-cypresReceived))};
 });}
export function colombiaMonth(date:string){return new Date(date).toLocaleDateString('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit'}).slice(0,7);}
export function monthly(data:Data,month:string){const rows=balances(data,true).filter(r=>r.detail.dispatchDate.slice(0,7)===month),payments=data.payments.filter(p=>p.date.slice(0,7)===month),ledger=(data.ledger||[]).filter(p=>p.date.slice(0,7)===month);
 const received=payments.filter(incoming).reduce((n,p)=>n+p.amount,0),paid=payments.filter(p=>!incoming(p)).reduce((n,p)=>n+p.amount,0),businessExpenses=ledger.filter(p=>p.kind==='Gasto').reduce((n,p)=>n+p.amount,0),withdrawals=ledger.filter(p=>p.kind==='Retiro').reduce((n,p)=>n+p.amount,0);
 return {rows,payments,ledger,received,paid,cash:received-paid-businessExpenses-withdrawals,agreed:rows.reduce((n,r)=>n+serviceRevenue(r.detail),0),serviceProfit:rows.reduce((n,r)=>n+r.profit,0),profit:rows.reduce((n,r)=>n+r.profit,0)-businessExpenses,businessExpenses,withdrawals,expenses:rows.reduce((n,r)=>n+r.detail.expenses,0)};}
// Los totales operativos excluyen la papelera. Los reportes mensuales conservan el historial.
export function businessBalance(data:Data){const rows=balances(data),activeIds=new Set(data.clients.filter(c=>!c.deleted_at).map(c=>c.id)),payments=data.payments.filter(p=>activeIds.has(p.client_id)),serviceProfit=rows.reduce((n,r)=>n+r.profit,0),expenses=(data.ledger||[]).filter(p=>p.kind==='Gasto').reduce((n,p)=>n+p.amount,0),withdrawals=(data.ledger||[]).filter(p=>p.kind==='Retiro').reduce((n,p)=>n+p.amount,0),received=payments.filter(incoming).reduce((n,p)=>n+p.amount,0),paid=payments.filter(p=>!incoming(p)).reduce((n,p)=>n+p.amount,0);return {serviceProfit,expenses,withdrawals,profit:serviceProfit-expenses,remaining:serviceProfit-expenses-withdrawals,cash:received-paid-expenses-withdrawals,cypresPending:rows.reduce((n,r)=>n+r.cypresPending,0),advanced:rows.reduce((n,r)=>n+r.advanced,0)};}
export const paymentCategory=(p:Pick<Payment,'kind'>)=>p.kind==='Cliente'?'Recibo cliente':p.kind==='Cypres'?'Recibo Cypres':p.kind==='Anticipo'?'Anticipo transportador':p.kind==='Extra'?'Pago extra transportador':'Saldo transportador';
export function paymentLabel(p:Payment,d:ClientData){const v=d.vehicles.find(v=>v.id===p.vehicle_id);return `${p.kind==='Cliente'?'Recibo del cliente':p.kind==='Cypres'?'Recibo de Cypres':p.kind==='Extra'?'Soporte de pago extra':p.kind+' al transportador'}${v?' · '+(v.plate||v.type):''} · ${p.date} · ${money(p.amount)}`;}
export function missingForClient(c:Client,data:Data){const d=serviceData(c,data),docs=data.documents.filter(d=>d.client_id===c.id&&!d.delete_requested_at),missing:{paymentId:string|null;category:string;label:string}[]=[];
 if(d.serviceType!=='Cargue'&&!docs.some(d=>d.category==='Contrato'))missing.push({paymentId:null,category:'Contrato',label:'Contrato del transporte'});
 for(const p of data.payments.filter(p=>p.client_id===c.id))if(!docs.some(d=>d.payment_id===p.id))missing.push({paymentId:p.id,category:paymentCategory(p),label:paymentLabel(p,d)});
 return missing;}
export function missingDocuments(data:Data){return balances(data).flatMap(r=>{const missing=missingForClient(r.client,data);return missing.length?[{...r,missing}]:[];});}
export function csvCell(value:unknown){let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function saveCsv(rows:unknown[][],name:string){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);}
