export const tables=['clients','carriers','orders','payments','documents','payment_revisions','expense_concepts','ledger_entries','order_counters'] as const;
export type Snapshot=Record<string,Record<string,any>[]>;
export const archiveOwner=(owner:string)=>owner+':launch-backup-2026-10-09';
export async function snapshot(db:D1Database,owner:string):Promise<Snapshot>{
 const results=await db.batch(tables.map(t=>db.prepare(`SELECT * FROM ${t} WHERE owner=?`).bind(owner)));
 return Object.fromEntries(tables.map((t,i)=>[t,results[i].results as Record<string,any>[]]));
}
export function canonical(value:any):string{if(Array.isArray(value))return '['+value.map(canonical).sort().join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
export function counts(s:Snapshot){return Object.fromEntries(tables.map(t=>[t,s[t].length]));}
export function empty(s:Snapshot){return tables.every(t=>s[t].length===0);}
// One transaction verifies the exact snapshot and moves ownership into a private recovery namespace.
// No rows or bucket objects are deleted. A restore reverses the same ownership changes.
export async function moveSnapshot(db:D1Database,from:string,to:string,expected:Snapshot){
 const checks:string[]=[],args:any[]=[];
 for(const t of tables){
  checks.push(`(SELECT COUNT(*) FROM ${t} WHERE owner=?)=0`);args.push(to);
  checks.push(`(SELECT COUNT(*) FROM ${t} WHERE owner=?)=?`);args.push(from,expected[t].length);
  if(expected[t].length){
   const columns=Object.keys(expected[t][0]);if(columns.some(c=>!/^\w+$/.test(c)))throw Error('Esquema no válido.');
   checks.push(`NOT EXISTS(SELECT ${columns.map(c=>'"'+c+'"').join(',')} FROM ${t} WHERE owner=? EXCEPT SELECT ${columns.map(c=>`json_extract(value,'$.${c}')`).join(',')} FROM json_each(?))`);args.push(from,JSON.stringify(expected[t]));
  }
 }
 await db.batch([db.prepare(`SELECT CASE WHEN ${checks.join(' AND ')} THEN 1 ELSE json('Los datos cambiaron') END AS verified`).bind(...args),...tables.map(t=>db.prepare(`UPDATE ${t} SET owner=? WHERE owner=?`).bind(to,from))]);
}
