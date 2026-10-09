import {authMode,googleConfig} from '../../../../gtrans-auth';
import {cookie} from '../../../../google-core';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const config=await googleConfig();if(authMode()!=='google'||!config)return Response.json({error:'Acceso no configurado.'},{status:503});
 if(req.headers.get('origin')!==config.origin)return Response.json({error:'Origen no permitido.'},{status:403});
 const headers=new Headers({Location:config.origin+'/','Cache-Control':'no-store'});headers.append('Set-Cookie',cookie(config,'session','',0));headers.append('Set-Cookie',cookie(config,'flow','',0));return new Response(null,{status:303,headers});
}
