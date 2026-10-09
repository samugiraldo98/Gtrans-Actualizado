import {env} from 'cloudflare:workers';
import {getGtransUser,authMode} from '../../gtrans-auth';
import {readGoogleConfig} from '../../google-core';
import {archiveOwner,snapshot,canonical,counts,empty,moveSnapshot} from './core';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function context(req:Request,allowTemporary=false){
 const values=env as unknown as Record<string,string|undefined>,config=readGoogleConfig(values);
 if(authMode()!=='google'||!config||!env.DB||!env.BUCKET)throw Error('Configuración no disponible.');
 const secret=values.GTRANS_LAUNCH_SECRET,expires=Date.parse(values.GTRANS_LAUNCH_EXPIRES||'');
 const temporary=Boolean(allowTemporary&&secret&&secret.length>=32&&Number.isFinite(expires)&&Date.now()<expires&&req.headers.get('authorization')==='Bearer '+secret);
 if(!temporary){const user=await getGtransUser();if(!user||user.email!==config.adminEmail)throw Error('Solo el administrador principal puede acceder.');if(req.method==='POST'&&req.headers.get('origin')!==config.origin)throw Error('Origen no permitido.');}
 return {db:env.DB,bucket:env.BUCKET,owner:config.dataOwner,temporary};
}
export async function GET(req:Request){try{const c=await context(req);const active=await snapshot(c.db,c.owner),saved=await snapshot(c.db,archiveOwner(c.owner));return json({active:counts(active),backup:counts(saved),canRestore:empty(active)&&!empty(saved)});}catch(e){return json({error:(e as Error).message},403);}}
export async function POST(req:Request){try{
 const c=await context(req,true),body=await req.json() as any,archive=archiveOwner(c.owner);
 if(body.action==='restore'){
  if(c.temporary)return json({error:'La restauración requiere iniciar sesión como administrador.'},403);
  const saved=await snapshot(c.db,archive);if(empty(saved))throw Error('No hay un respaldo para restaurar.');
  if(!empty(await snapshot(c.db,c.owner)))throw Error('Ya hay datos nuevos. La restauración no los sobrescribe.');
  await moveSnapshot(c.db,archive,c.owner,saved);return json({restored:true,counts:counts(saved)});
 }
 if(body.action!=='archive-launch'||!c.temporary)return json({error:'El reinicio solo se habilita temporalmente para el lanzamiento.'},403);
 const current=await snapshot(c.db,c.owner);if(empty(current))return json({reset:true,alreadyEmpty:true});
 if(!empty(await snapshot(c.db,archive)))throw Error('Ya existe un respaldo de lanzamiento.');
 if(canonical(current)!==canonical(body.expected))throw Error('Los datos cambiaron desde el respaldo. No se realizó el reinicio.');
 const files=[...current.documents.filter(d=>!d.deleted_at).map(d=>({id:d.id,key:`${c.owner}/${d.id}`,size:d.size})),...current.ledger_entries.filter(d=>d.file_name).map(d=>({id:d.id,key:`${c.owner}/ledger/${d.id}`,size:d.file_size}))];
 if(!Array.isArray(body.files)||body.files.length!==files.length)throw Error('Falta verificar el respaldo de documentos.');
 for(const f of files){const expected=body.files.find((d:any)=>d.id===f.id);const obj=await c.bucket.get(f.key);if(!obj||obj.size!==f.size||expected?.size!==f.size)throw Error('Un archivo no coincide con el respaldo.');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await obj.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==expected.sha256)throw Error('El respaldo de un archivo no coincide.');}
 await moveSnapshot(c.db,c.owner,archive,current);
 return json({reset:true,recoverable:true,archived:counts(current),nextOrder:'GT-000001',filesPreserved:files.length});
 }catch(e){return json({error:(e as Error).message},409);}}
