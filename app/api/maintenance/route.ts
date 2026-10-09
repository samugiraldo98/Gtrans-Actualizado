export const dynamic='force-dynamic';
// El reinicio no está disponible. Las operaciones normales no dependen de mantenimiento.
export async function POST(){return Response.json({error:'No disponible.'},{status:404,headers:{'Cache-Control':'no-store'}});}
