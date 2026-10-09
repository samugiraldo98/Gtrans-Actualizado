import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
fs.mkdirSync('.sites-runtime',{recursive:true});
function compile(path,name){let source=fs.readFileSync(path,'utf8').replace("import { env } from 'cloudflare:workers';",'const env=globalThis.testEnv;').replace("import {env} from 'cloudflare:workers';",'const env=globalThis.testEnv;').replace("import { getGtransUser } from '../../gtrans-auth';",'const getGtransUser=async()=>globalThis.testUser;').replace("import {getGtransUser} from '../../gtrans-auth';",'const getGtransUser=async()=>globalThis.testUser;').replaceAll("from '../../finance'","from './finance.mjs'").replace("from './corrections'","from './corrections.mjs'");fs.writeFileSync('.sites-runtime/'+name,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);}
for(const [path,name] of [['app/finance.ts','finance.mjs'],['app/api/manage/route.ts','manage.mjs'],['app/api/manage/corrections.ts','corrections.mjs'],['app/api/ledger/route.ts','ledger.mjs'],['app/api/maintenance/route.ts','maintenance.mjs']])compile(path,name);
const db=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
const adapter={prepare(sql){const stmt=db.prepare(sql);return {bind(...args){return {first:async()=>stmt.get(...args),all:async()=>({results:stmt.all(...args)}),run:async()=>sql.trim().startsWith('SELECT')?{results:stmt.all(...args)}:{meta:{changes:stmt.run(...args).changes}}};},run:async()=>({meta:{changes:stmt.run().changes}})};},batch:async stmts=>{db.exec('BEGIN');try{const r=[];for(const stmt of stmts)r.push(await stmt.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const files=new Map();const bucket={put:async(key,data)=>files.set(key,data),delete:async(keys)=>{for(const key of Array.isArray(keys)?keys:[keys])files.delete(key);},list:async()=>({objects:[...files.keys()].map(key=>({key})),truncated:false}),get:async key=>files.has(key)?{body:files.get(key)}:null};
globalThis.testEnv={DB:adapter,BUCKET:bucket};globalThis.testUser={userId:'owner'};
const manage=await import('../.sites-runtime/manage.mjs'),ledger=await import('../.sites-runtime/ledger.mjs'),maintenance=await import('../.sites-runtime/maintenance.mjs'),f=await import('../.sites-runtime/finance.mjs');
const request=body=>new Request('http://localhost/api/manage',{method:'POST',headers:body instanceof FormData?{}:{'Content-Type':'application/json'},body:body instanceof FormData?body:JSON.stringify(body)});
async function post(body,status=200){const r=await manage.POST(request(body));const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
async function read(){const r=await manage.GET(new Request('http://localhost/api/manage'));assert.equal(r.status,200);return r.json();}
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'}),carrier=(await post({action:'carrier',data:{name:'Transportador prueba',phone:'3001234567',document:'',details:''}})).id,vehicle=crypto.randomUUID();
const detail={name:'Servicio prueba',phone:'3001234567',document:'',origin:'Medellín',originLocation:'',destination:'Pereira',destinationLocation:'',house:'Casa modular',weight:10,dimensions:'',price:700000,status:'Contratado',dispatchDate:today,notes:'',rejection:'',expenses:0,serviceType:'Transporte',cypres:true,vehicles:[{id:vehicle,carrierId:carrier,type:'Sencillo',plate:'ABC123',cost:2000000,weight:10,loadingRate:12000}]};
const client=(await post({action:'client',data:detail})).id;
assert.equal(f.cypresAgreed(detail),1300000);assert.equal(f.netCarrierCost(detail.vehicles[0]),1880000);assert.equal(f.loadingCost(detail.vehicles[0]),120000);
await post({action:'payment',clientId:client,vehicleId:vehicle,kind:'Extra',amount:1,date:today,reference:'Prueba'},400);
const order=await post({action:'order',clientId:client});assert.equal(order.sequence,1);
const payment=async(kind,amount,vehicleId=null,reference='Pago registrado')=>post({action:'payment',clientId:client,vehicleId,kind,amount,date:today,reference});
const clientPay=await payment('Cliente',700000);await payment('Anticipo',1000000,vehicle);await payment('Saldo',880000,vehicle);
await post({action:'payment',clientId:client,vehicleId:vehicle,kind:'Saldo',amount:1,date:today,reference:''},400);
let records=await read(),row=f.balances(records)[0];assert.equal(row.profit,120000);assert.equal(row.cypresPending,1300000);assert.equal(row.advanced,1180000);assert.equal(row.payable,0);assert.equal(row.pending,0);
assert.equal(f.missingDocuments(records)[0].missing.length,4);assert.ok(!f.missingDocuments(records)[0].missing.some(m=>m.category==='Pago extra transportador'));assert.ok(f.missingDocuments(records)[0].missing.some(m=>m.label.includes('ABC123')));
const cypresPay=await payment('Cypres',1300000);await post({action:'payment',clientId:client,vehicleId:null,kind:'Cypres',amount:1,date:today,reference:''},400);
await post({action:'edit-payment',id:cypresPay.id,version:1,amount:1200000,date:today,reference:'Ajuste',reason:'Corrección del recibo'});assert.equal(f.balances(await read())[0].cypresPending,100000);
const extra=await payment('Extra',200000,vehicle,'Peaje por desvío');records=await read();assert.equal(f.balances(records)[0].profit,-80000);assert.ok(f.missingDocuments(records)[0].missing.some(m=>m.category==='Pago extra transportador'));
async function upload(category,paymentId=null){const form=new FormData();form.set('clientId',client);form.set('category',category);if(paymentId)form.set('paymentId',paymentId);form.set('file',new File(['%PDF-1.4\n%%EOF'],crypto.randomUUID()+'.pdf',{type:'application/pdf'}));return post(form);}
await upload('Contrato');const unlinked=await upload('Otro');records=await read();const before=f.missingDocuments(records)[0].missing.length;await post({action:'link-document',id:unlinked.id,paymentId:clientPay.id});assert.equal(f.missingDocuments(await read())[0].missing.length,before-1);
for(const p of (await read()).payments.filter(p=>p.id!==clientPay.id))await upload(f.paymentCategory(p),p.id);assert.equal(f.missingDocuments(await read()).length,0);
await post({action:'link-document',id:unlinked.id,paymentId:crypto.randomUUID()},409);
const loading=(await post({action:'client',data:{...detail,name:'Solo cargue',serviceType:'Cargue',status:'No contratado',vehicles:[],cypres:false,weight:5,price:1,loadingRate:12000,rejection:'Transporte propio',origin:'',destination:''}})).id;
records=await read();assert.equal(records.clients.find(c=>c.id===loading).data.price,60000);assert.equal(f.balances(records).find(r=>r.client.id===loading).profit,60000);assert.equal(f.missingDocuments(records).length,0);await post({action:'order',clientId:loading},400);await post({action:'payment',clientId:loading,vehicleId:null,kind:'Cliente',amount:60000,date:today,reference:'Cargue recibido'});assert.equal(f.missingDocuments(await read())[0].missing.length,1);
const conceptResponse=await ledger.POST(request({action:'concept',name:'Arriendo'}));assert.equal(conceptResponse.status,200);const concept=(await conceptResponse.json()).id;
for(const [kind,amount] of [['Gasto',10000],['Retiro',5000]]){const form=new FormData();for(const [key,value] of Object.entries({kind,amount:String(amount),conceptId:concept,date:today,reference:'Prueba de '+kind}))form.set(key,value);if(kind==='Gasto')form.set('file',new File(['%PDF-1.4\n%%EOF'],'arriendo.pdf',{type:'application/pdf'}));const r=await ledger.POST(request(form));assert.equal(r.status,200,JSON.stringify(await r.json()));}
records=await read();const business=f.businessBalance(records);assert.equal(business.serviceProfit,-20000);assert.equal(business.profit,-30000);assert.equal(business.remaining,-35000);assert.equal(business.cash,-135000);assert.equal(f.monthly(records,today.slice(0,7)).cash,-135000);
// Validaciones: descuento excesivo, pago de otro dueño y fecha imposible.
await post({action:'client',data:{...detail,vehicles:[{...detail.vehicles[0],cost:1}]}},400);await post({action:'payment',clientId:client,vehicleId:null,kind:'Cliente',amount:1,date:'2026-02-31',reference:''},400);globalThis.testUser={userId:'intruder'};await post({action:'link-document',id:unlinked.id,paymentId:clientPay.id},409);globalThis.testUser={userId:'owner'};
// Una variable antigua de mantenimiento nunca bloquea las operaciones normales.
globalThis.testEnv.GTRANS_MAINTENANCE_SECRET='stale-test-value';
const current=(await read()).clients.find(c=>c.id===client);
await post({action:'archive-client',id:client,version:current.version});
let archived=(await read()).clients.find(c=>c.id===client);assert.ok(archived.deleted_at);
assert.equal((await read()).payments.length,records.payments.length);
await post({action:'restore-client',id:client,version:archived.version});
assert.equal((await read()).clients.find(c=>c.id===client).deleted_at,null);
const ledgerCheck=await ledger.POST(request({action:'concept',name:'Operación sin bloqueo'}));assert.equal(ledgerCheck.status,200);
const disabled=await maintenance.POST();assert.equal(disabled.status,404);
assert.ok(files.size>0);
console.log('Verificados: flujos financieros, archivo/restauración sin bloqueo con configuración antigua, registros conservados y reinicio deshabilitado.');
