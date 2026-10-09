import {netCarrierCost,cypresAgreed} from '../../finance';
import { z } from 'zod';
const text = z.string().trim().max(4000);
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
type Context={db:D1Database;bucket:R2Bucket;owner:string};
export async function correctRecord(body:any,{db,bucket,owner}:Context,now:string):Promise<Response|null>{
 if(body.action==='link-document'){
  const input=z.object({id:z.string().uuid(),paymentId:z.string().uuid()}).parse(body);
  const result=await db.prepare(`UPDATE documents SET payment_id=? WHERE id=? AND owner=? AND deleted_at IS NULL AND delete_requested_at IS NULL AND EXISTS (SELECT 1 FROM payments p WHERE p.id=? AND p.owner=documents.owner AND p.client_id=documents.client_id) AND EXISTS (SELECT 1 FROM clients c WHERE c.id=documents.client_id AND c.owner=documents.owner AND c.deleted_at IS NULL)`).bind(input.paymentId,input.id,owner,input.paymentId).run();
  if(!result.meta.changes)return json({error:'El documento y el pago deben pertenecer al mismo transporte activo.'},409);
  return json({id:input.id});
 }
 if(body.action==='edit-payment'){
  const input=z.object({id:z.string().uuid(),version:z.number().int().min(1),amount:z.number().int().min(1).max(100000000000),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;},'Fecha inválida'),reference:text,reason:text.min(3,'Escribe el motivo de la corrección.')}).parse(body);
  const payment=await db.prepare('SELECT * FROM payments WHERE id=? AND owner=?').bind(input.id,owner).first<any>();
  if(!payment)throw new Error('Pago no encontrado.');
  const client=await db.prepare('SELECT * FROM clients WHERE id=? AND owner=?').bind(payment.client_id,owner).first<any>();
  if(!client||client.deleted_at)throw new Error('Restaura el cliente antes de corregir sus pagos.');
  const order=await db.prepare('SELECT snapshot FROM orders WHERE client_id=? AND owner=?').bind(client.id,owner).first<any>();
  const data=JSON.parse(order?.snapshot||client.data);
  if(payment.kind==='Extra'&&input.reference.trim().length<3)throw new Error('Escribe la justificación del pago extra.');
  const limit=payment.kind==='Extra'?100000000000:payment.kind==='Cliente'?data.price:payment.kind==='Cypres'?cypresAgreed(data):(()=>{const v=data.vehicles.find((v:any)=>v.id===payment.vehicle_id);return v?netCarrierCost(v):undefined;})();
  if(!Number.isSafeInteger(limit))throw new Error('No se encontró el valor acordado para este pago.');
  const after={...payment,amount:input.amount,date:input.date,reference:input.reference,version:payment.version+1,updated:now};
  const condition="id=? AND owner=? AND version=? AND (kind='Extra' OR ? + COALESCE((SELECT SUM(amount) FROM payments WHERE owner=? AND client_id=? AND vehicle_id IS ? AND id<>? AND kind<>'Extra' AND (CASE WHEN kind IN ('Cliente','Cypres') THEN kind ELSE 'Transportador' END)=?),0) <= ?) AND EXISTS (SELECT 1 FROM clients WHERE id=? AND owner=? AND version=? AND deleted_at IS NULL)";
  const params=[input.id,owner,input.version,input.amount,owner,payment.client_id,payment.vehicle_id,input.id,['Cliente','Cypres'].includes(payment.kind)?payment.kind:'Transportador',limit,client.id,owner,client.version];
  // D1 batch es una transacción: el historial y la corrección se guardan juntos.
  const result=await db.batch([
   db.prepare(`INSERT INTO payment_revisions (id,owner,payment_id,before_data,after_data,reason,created) SELECT ?,?,?,?,?,?,? FROM payments WHERE ${condition}`).bind(crypto.randomUUID(),owner,input.id,JSON.stringify(payment),JSON.stringify(after),input.reason,now,...params),
   db.prepare(`UPDATE payments SET amount=?,date=?,reference=?,version=version+1,updated=? WHERE ${condition}`).bind(input.amount,input.date,input.reference,now,...params),
  ]);
  if(!result[1].meta.changes)return json({error:'El importe supera el saldo disponible o el registro cambió. Recarga antes de corregirlo.'},409);
  return json({id:input.id});
 }
 if(body.action==='archive-carrier'||body.action==='restore-carrier'){
  const input=z.object({id:z.string().uuid(),version:z.number().int().min(1)}).parse(body);
  const archive=body.action==='archive-carrier';
  const assignments=`NOT EXISTS (SELECT 1 FROM clients c, json_each(c.data,'$.vehicles') v WHERE c.owner=? AND c.deleted_at IS NULL AND json_extract(v.value,'$.carrierId')=? AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.client_id=c.id AND o.owner=c.owner))`;
  const result=await db.prepare(`UPDATE carriers SET deleted_at=?,version=version+1 WHERE id=? AND owner=? AND version=? AND deleted_at IS ${archive?'NULL':'NOT NULL'} ${archive?'AND '+assignments:''}`).bind(archive?now:null,input.id,owner,input.version,...(archive?[owner,input.id]:[])).run();
  if(!result.meta.changes)return json({error:archive?'El transportador cambió o está asignado a un servicio sin orden. Revisa o cambia esa asignación antes de retirarlo.':'El transportador cambió o no está disponible. Recarga para restaurarlo.'},409);
  return json({id:input.id,archived:archive});
 }
 if(body.action==='delete-document'){
  const input=z.object({id:z.string().uuid(),confirm:z.literal(true)}).parse(body);
  const doc=await db.prepare('SELECT * FROM documents WHERE id=? AND owner=?').bind(input.id,owner).first<any>();
  if(!doc)throw new Error('Documento no encontrado.');
  if(doc.deleted_at)return json({id:input.id,deleted:true});
  // Si el proceso se interrumpe, la fila pendiente permite reintentar el borrado.
  await db.prepare('UPDATE documents SET delete_requested_at=? WHERE id=? AND owner=? AND deleted_at IS NULL').bind(now,input.id,owner).run();
  await bucket.delete(`${owner}/${input.id}`);
  await db.prepare('UPDATE documents SET deleted_at=?,delete_requested_at=NULL WHERE id=? AND owner=? AND deleted_at IS NULL').bind(now,input.id,owner).run();
  return json({id:input.id,deleted:true});
 }
 return null;
}
