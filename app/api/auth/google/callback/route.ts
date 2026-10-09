import {cookies} from 'next/headers';
import {authMode,googleConfig} from '../../../../gtrans-auth';
import {cookie,cookieName,readFlow,verifyGoogleToken,createSession} from '../../../../google-core';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const config=await googleConfig();if(authMode()!=='google'||!config)return Response.json({error:'Acceso con Google no configurado.'},{status:503});
 const headers=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 headers.append('Set-Cookie',cookie(config,'flow','',0));
 const fail=()=>{headers.set('Location',config.origin+'/?login=failed');return new Response(null,{status:303,headers});};
 try{
  const params=new URL(req.url).searchParams;
  const token=(await cookies()).get(cookieName(config,'flow'))?.value;
  const code=params.get('code'),state=params.get('state');
  if(params.has('error')||!token||!code||!state)return fail();
  const flow=await readFlow(token,state,config);
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:config.origin+'/api/auth/google/callback',code_verifier:flow.verifier}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return fail();
  const result=await response.json() as {id_token?:string};if(!result.id_token)return fail();
  const identity=await verifyGoogleToken(result.id_token,flow.nonce,config);
  headers.append('Set-Cookie',cookie(config,'session',await createSession(identity,config),43200));
  headers.set('Location',config.origin+'/');return new Response(null,{status:303,headers});
 }catch{return fail();}
}
