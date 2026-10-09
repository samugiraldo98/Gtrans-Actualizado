'use client';
import {useState} from 'react';
import type {Client,Data} from './types';
import {missingForClient} from './finance';
export function DocumentsPending({client,data,attach,link,busy}:{client:Client;data:Data;attach:(paymentId:string|null,category:string)=>void;link:(docId:string,paymentId:string)=>void;busy:boolean}){
 const missing=missingForClient(client,data);
 return <section className="pending-documents"><h3>Documentos pendientes ({missing.length})</h3>{missing.length?<><p className="hint">Cada soporte debe estar vinculado a su pago. Puedes adjuntar uno nuevo o usar un archivo ya cargado. Solo se pide soporte de un pago extra cuando ese pago existe.</p>{missing.map(m=><Missing key={m.paymentId||'contract'} item={m} data={data} clientId={client.id} attach={attach} link={link} busy={busy}/>)}</>:<p>Todos los documentos requeridos están completos.</p>}</section>;
}
function Missing({item,data,clientId,attach,link,busy}:{item:{paymentId:string|null;category:string;label:string};data:Data;clientId:string;attach:(id:string|null,category:string)=>void;link:(doc:string,payment:string)=>void;busy:boolean}){
 const [doc,setDoc]=useState(''),docs=data.documents.filter(d=>d.client_id===clientId&&!d.delete_requested_at&&!d.payment_id&&d.category!=='Contrato');
 return <div className="pending-document"><strong>{item.label}</strong><div className="pending-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>attach(item.paymentId,item.category)}>Adjuntar soporte</button>{item.paymentId&&docs.length>0&&<><select aria-label={'Archivo existente para '+item.label} value={doc} onChange={e=>setDoc(e.target.value)}><option value="">Seleccionar archivo ya subido</option>{docs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><button type="button" className="secondary" disabled={busy||!doc} onClick={()=>link(doc,item.paymentId!)}>Vincular archivo</button></>}</div></div>;
}
