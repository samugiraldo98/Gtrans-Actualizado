import {env} from 'cloudflare:workers';
import {accessConfig,type AccessRow} from './access-core';
import {cookies} from 'next/headers';
import {getChatGPTUser} from './chatgpt-auth';
import {cookieName,readGoogleConfig,readSession} from './google-core';
export function authMode(){const mode=(env as unknown as Record<string,string|undefined>).GTRANS_AUTH_MODE;return mode===undefined||mode==='chatgpt'?'chatgpt':mode==='google'?'google':'invalid';}
export async function googleConfig(){const config=readGoogleConfig(env as unknown as Record<string,string|undefined>);if(!config||!env.DB)return null;try{const rows=(await env.DB.prepare('SELECT email,enabled,version,created,updated FROM authorized_users WHERE owner=?').bind(config.dataOwner).all<AccessRow>()).results;return accessConfig(config,rows);}catch{return null;}}
export async function getGtransUser(){
 if(authMode()==='chatgpt')return getChatGPTUser();
 if(authMode()!=='google')return null;
 const config=await googleConfig();if(!config)return null;
 const token=(await cookies()).get(cookieName(config,'session'))?.value;if(!token)return null;
 const user=await readSession(token,config);if(!user)return null;
 return {userId:config.dataOwner,email:user.email,displayName:user.name,fullName:user.name};
}
