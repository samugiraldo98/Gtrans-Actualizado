import {authMode,googleConfig} from '../../../../gtrans-auth';
import {cookie,createFlow} from '../../../../google-core';
export const dynamic='force-dynamic';
export async function GET(){
 const config=await googleConfig();if(authMode()!=='google'||!config)return Response.json({error:'El acceso con Google todavía no está activado.'},{status:503,headers:{'Cache-Control':'no-store'}});
 const flow=await createFlow(config);return new Response(null,{status:302,headers:{Location:flow.url,'Set-Cookie':cookie(config,'flow',flow.token,600),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
