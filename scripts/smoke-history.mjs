import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const auth=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=auth.headers.get('set-cookie')?.split(';')[0];
async function post(body,expected=200){const r=await fetch(base+'/api/manage',{method:'POST',headers:{cookie,'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j;}
async function records(){return (await fetch(base+'/api/manage',{headers:{cookie}})).json();}
await post({action:'reset-data',confirmation:'incorrect',includeCarriers:false},400);
const before=await records();
await post({action:'reset-data',confirmation:'BORRAR DATOS DE PRUEBA',includeCarriers:false});
const cleared=await records();assert.equal(cleared.clients.length,0);assert.equal(cleared.orders.length,0);assert.equal(cleared.payments.length,0);assert.equal(cleared.documents.length,0);assert.equal(cleared.carriers.length,before.carriers.length);
const carrier=await post({action:'carrier',data:{name:'Conductor historial',phone:'3001111111',document:'',details:''}});
const data={name:'Cliente recurrente',phone:'3002222222',document:'TEST-HISTORY',origin:'Origen uno',originLocation:'',destination:'Destino uno',destinationLocation:'',house:'Casa modular',weight:12.5,dimensions:'',price:5000000,status:'Contratado',dispatchDate:new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'}),notes:'',rejection:'',expenses:100000,vehicles:[{id:crypto.randomUUID(),carrierId:carrier.id,type:'Sencillo',plate:'HST001',cost:2000000}]};
const one=await post({action:'client',data});
const first=await post({action:'order',clientId:one.id});assert.equal(first.sequence,1);
const repeated=await post({action:'order',clientId:one.id});assert.equal(repeated.id,first.id);
await post({action:'client',customerId:crypto.randomUUID(),data},400);
const two=await post({action:'client',customerId:one.id,data:{...data,destination:'Destino dos',price:7000000,vehicles:[{...data.vehicles[0],id:crypto.randomUUID(),plate:'HST002'}]}});
const second=await post({action:'order',clientId:two.id});assert.equal(second.sequence,2);
await post({action:'payment',clientId:two.id,vehicleId:null,kind:'Cliente',amount:6000000,date:data.dispatchDate,reference:'Solo segundo transporte'});
const list=await records();assert.equal(list.clients.find(c=>c.id===one.id).customer_id,list.clients.find(c=>c.id===two.id).customer_id);assert.equal(list.orders.find(o=>o.id===first.id).snapshot.destination,'Destino uno');assert.equal(list.orders.find(o=>o.id===second.id).snapshot.destination,'Destino dos');assert.equal(list.payments.filter(p=>p.client_id===one.id).length,0);
await post({action:'archive-client',id:two.id,version:1});const archived=await records();assert.ok(!archived.clients.find(c=>c.id===one.id).deleted_at);assert.ok(archived.clients.find(c=>c.id===two.id).deleted_at);
await post({action:'reset-data',confirmation:'BORRAR DATOS DE PRUEBA',includeCarriers:false});
const after=await records();assert.equal(after.clients.length,0);assert.equal(after.orders.length,0);assert.equal(after.payments.length,0);assert.equal(after.paymentRevisions.length,0);
console.log('PASS: reset confirmation, carrier preservation, two transports under one customer, independent orders/payments, idempotent order generation, numbering restarted at 1, and per-transport trash.');
