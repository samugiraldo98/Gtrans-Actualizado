import { requireChatGPTUser } from './chatgpt-auth';
import {authMode,getGtransUser,googleConfig} from './gtrans-auth';
import Dashboard from './dashboard';
export const dynamic = 'force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{login?:string}>}) {
 if(authMode()==='chatgpt'){await requireChatGPTUser('/');return <Dashboard authProvider="chatgpt"/>;}
 const config=await googleConfig();const user=await getGtransUser();if(user)return <Dashboard authProvider="google" canManageUsers={user.email===config?.adminEmail}/>;
 const ready=authMode()==='google'&&Boolean(config);
 const params=await searchParams;
 return <main className="login-page"><section className="login-card"><img className="login-logo" src="/gtrans-logo.png" alt="Gtrans"/><div className="eyebrow">GTRANS · OPERACIONES</div><h1>Tu operación, en orden.</h1><p>Inicia sesión con el correo administrador autorizado para consultar clientes, transportes y documentos.</p>{params.login==='failed'&&<p role="alert" className="alert">No se pudo iniciar sesión. Selecciona el correo administrador autorizado e intenta nuevamente.</p>}{ready?<a className="primary" href="/api/auth/google/start" target="_top">Iniciar sesión con Google</a>:<p role="status">El acceso con Google está pendiente de configuración. Contacta al administrador.</p>}<small>La información de la empresa solo está disponible después de iniciar sesión.</small></section></main>;
}
