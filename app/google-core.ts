import {SignJWT,jwtVerify,createRemoteJWKSet,base64url,type JWTVerifyGetKey} from 'jose';

export type GoogleConfig={clientId:string;clientSecret:string;sessionSecret:string;adminEmail:string;additionalEmails:string[];accessVersions?:Record<string,number>;dataOwner:string;origin:string};
export type GoogleIdentity={sub:string;email:string;name:string};
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const issuer='gtrans';
const allowed=(email:string,config:GoogleConfig)=>email===config.adminEmail||config.additionalEmails.includes(email);
const key=(config:GoogleConfig)=>new TextEncoder().encode(config.sessionSecret);
const random=()=>base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
export function readGoogleConfig(vars:Record<string,string|undefined>):GoogleConfig|null{
 const {GOOGLE_CLIENT_ID:clientId,GOOGLE_CLIENT_SECRET:clientSecret,GTRANS_SESSION_SECRET:sessionSecret,GOOGLE_ADMIN_EMAIL:email,GTRANS_DATA_OWNER:dataOwner,GTRANS_BASE_URL:base}=vars;
 if(!clientId||!clientSecret||!sessionSecret||sessionSecret.length<32||!email||!dataOwner||!base)return null;
 const additionalEmails=[...new Set((vars.GOOGLE_ALLOWED_EMAILS||'').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean))];
 if(![email.trim().toLowerCase(),...additionalEmails].every(e=>/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(e)))return null;
 try{const url=new URL(base);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))return null;if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;return {clientId,clientSecret,sessionSecret,adminEmail:email.trim().toLowerCase(),additionalEmails,dataOwner,origin:url.origin};}catch{return null;}
}
async function sign(payload:Record<string,unknown>,config:GoogleConfig,ttl:number){return new SignJWT(payload).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(issuer).setAudience(config.origin).setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000)+ttl).sign(key(config));}
async function verify(token:string,config:GoogleConfig){return (await jwtVerify(token,key(config),{algorithms:['HS256'],issuer,audience:config.origin})).payload;}
export function cookieName(config:GoogleConfig,kind:'flow'|'session'){return (config.origin.startsWith('https:')?'__Host-':'')+'gtrans-'+kind;}
export function cookie(config:GoogleConfig,kind:'flow'|'session',token:string,ttl:number){return `${cookieName(config,kind)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl}${config.origin.startsWith('https:')?'; Secure':''}`;}
export async function createFlow(config:GoogleConfig){
 const state=random(),nonce=random(),verifier=random();
 const challenge=base64url.encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 const token=await sign({kind:'flow',state,nonce,verifier},config,600);
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 const params={client_id:config.clientId,redirect_uri:config.origin+'/api/auth/google/callback',response_type:'code',scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'};
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 return {url:url.href,token};
}
export async function readFlow(token:string,state:string,config:GoogleConfig){
 const p=await verify(token,config);if(p.kind!=='flow'||typeof p.state!=='string'||p.state!==state||typeof p.nonce!=='string'||typeof p.verifier!=='string')throw Error('Invalid OAuth state');return {nonce:p.nonce,verifier:p.verifier};
}
export async function verifyGoogleToken(token:string,nonce:string,config:GoogleConfig,keys:JWTVerifyGetKey|CryptoKey=googleKeys):Promise<GoogleIdentity>{
 const options={algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:config.clientId};
 const result=typeof keys==='function'?await jwtVerify(token,keys,options):await jwtVerify(token,keys,options);
 const p=result.payload;
 if(!p.sub||p.nonce!==nonce||p.email_verified!==true||typeof p.email!=='string'||!allowed(p.email.toLowerCase(),config)||(p.azp&&p.azp!==config.clientId)||!p.exp)throw Error('Google account not authorized');
 return {sub:p.sub,email:p.email.toLowerCase(),name:typeof p.name==='string'?p.name:'Administrador Gtrans'};
}
export async function createSession(identity:GoogleIdentity,config:GoogleConfig){if(!allowed(identity.email,config))throw Error('Account not authorized');return sign({kind:'session',googleSub:identity.sub,email:identity.email,name:identity.name,accessVersion:config.accessVersions?.[identity.email]??0},config,43200);}
export async function readSession(token:string,config:GoogleConfig):Promise<GoogleIdentity|null>{try{const p=await verify(token,config);if(p.kind!=='session'||typeof p.email!=='string'||!allowed(p.email,config)||(p.accessVersion??0)!==(config.accessVersions?.[p.email]??0)||typeof p.googleSub!=='string'||typeof p.name!=='string')return null;return {sub:p.googleSub,email:p.email,name:p.name};}catch{return null;}}
