import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
import {SignJWT,generateKeyPair,base64url} from 'jose';
mkdirSync('.sites-runtime',{recursive:true});
writeFileSync('.sites-runtime/google-core-test.mjs',ts.transpileModule(readFileSync('app/google-core.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const core=await import('../.sites-runtime/google-core-test.mjs');
const vars={GOOGLE_CLIENT_ID:'test-client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-only-client-secret',GTRANS_SESSION_SECRET:'test-only-session-secret-longer-than-32-characters',GOOGLE_ADMIN_EMAIL:'admin@example.com',GTRANS_DATA_OWNER:'existing-company-owner',GTRANS_BASE_URL:'https://gtrans.example.com'};
const c=core.readGoogleConfig(vars);assert.ok(c);
assert.equal(core.readGoogleConfig({...vars,GOOGLE_CLIENT_SECRET:''}),null);
assert.equal(core.readGoogleConfig({...vars,GTRANS_SESSION_SECRET:'short'}),null);
assert.equal(core.readGoogleConfig({...vars,GTRANS_BASE_URL:'http://untrusted.example.com'}),null);
assert.equal(core.readGoogleConfig({...vars,GTRANS_BASE_URL:'https://gtrans.example.com/redirect'}),null);
const flow=await core.createFlow(c);const url=new URL(flow.url);assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),c.origin+'/api/auth/google/callback');assert.equal(url.searchParams.get('scope'),'openid email profile');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
const f=await core.readFlow(flow.token,url.searchParams.get('state'),c);assert.equal(f.nonce,url.searchParams.get('nonce'));
const challenge=base64url.encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(f.verifier))));assert.equal(challenge,url.searchParams.get('code_challenge'));
await assert.rejects(core.readFlow(flow.token,'incorrect-state',c));
await assert.rejects(core.readFlow(flow.token+'tampered',url.searchParams.get('state'),c));
const keys=await generateKeyPair('RS256');
async function token(claims={},issuer='https://accounts.google.com',audience=c.clientId,expiration='5m',privateKey=keys.privateKey){return new SignJWT({email:c.adminEmail,email_verified:true,nonce:f.nonce,name:'Administrador',...claims}).setProtectedHeader({alg:'RS256'}).setSubject('google-subject').setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiration).sign(privateKey);}
const good=await token();const identity=await core.verifyGoogleToken(good,f.nonce,c,keys.publicKey);assert.equal(identity.email,c.adminEmail);
for(const bad of [await token({email:'other@example.com'}),await token({email_verified:false}),await token({nonce:'replay'}),await token({azp:'other-client'}),await token({},'https://attacker.example.com'),await token({},undefined,'other-client'),await token({},undefined,undefined,-1)])await assert.rejects(core.verifyGoogleToken(bad,f.nonce,c,keys.publicKey));
const rogue=await generateKeyPair('RS256');await assert.rejects(core.verifyGoogleToken(await token({},undefined,undefined,undefined,rogue.privateKey),f.nonce,c,keys.publicKey));
const session=await core.createSession(identity,c);assert.deepEqual(await core.readSession(session,c),identity);assert.equal(await core.readSession(session+'tampered',c),null);assert.equal(await core.readSession(session,{...c,sessionSecret:'different-secret-longer-than-32-characters'}),null);assert.equal(await core.readSession(session,{...c,origin:'https://other.example.com'}),null);assert.equal(await core.readSession(session,{...c,adminEmail:'other@example.com'}),null);assert.equal(await core.readSession(flow.token,c),null);
await assert.rejects(core.createSession({...identity,email:'other@example.com'},c));
const cookie=core.cookie(c,'session',session,43200);for(const expected of ['__Host-gtrans-session=','Path=/','HttpOnly','SameSite=Lax','Secure','Max-Age=43200'])assert.ok(cookie.includes(expected));assert.ok(core.cookie(c,'session','',0).includes('Max-Age=0'));
console.log('PASS: required configuration, HTTPS origin, state, PKCE, token signature/issuer/audience/expiration/nonce/verified allowed email, session tampering, key rotation, origin binding, and protected cookies. Real account sign-in is verified separately from these fixture tests.');

const multi=core.readGoogleConfig({...vars,GOOGLE_ALLOWED_EMAILS:' Company@Example.com, company@example.com '});assert.ok(multi);assert.deepEqual(multi.additionalEmails,['company@example.com']);assert.equal(core.readGoogleConfig({...vars,GOOGLE_ALLOWED_EMAILS:'*'}),null);const company=await core.verifyGoogleToken(await token({email:'Company@Example.com'}),f.nonce,multi,keys.publicKey);assert.equal(company.email,'company@example.com');const companySession=await core.createSession(company,multi);assert.deepEqual(await core.readSession(companySession,multi),company);assert.deepEqual(await core.readSession(session,multi),identity);assert.equal(await core.readSession(companySession,c),null);await assert.rejects(core.verifyGoogleToken(await token({email:'company@example.com',email_verified:false}),f.nonce,multi,keys.publicKey));await assert.rejects(core.verifyGoogleToken(await token({email:'other@example.com'}),f.nonce,multi,keys.publicKey));await assert.rejects(core.createSession({...identity,email:'other@example.com'},multi));console.log('PASS: dos cuentas permitidas, identidad de sesión conservada, revocación y rechazo de otras cuentas.');
