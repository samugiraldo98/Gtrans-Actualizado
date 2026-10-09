# Activar el acceso con Google

El código está preparado, pero el cambio a Google no se activa hasta configurar y probar las credenciales. Mientras `GTRANS_AUTH_MODE` sea `chatgpt` (o no esté definido), Gtrans conserva el inicio de sesión actual. No cambies el acceso de Sites a público antes de validar todas las protecciones.

## 1. Crear las credenciales

1. Abre https://console.cloud.google.com/ con `samugiraldo98@gmail.com` y crea un proyecto llamado **Gtrans**. No actives servicios de pago para esta configuración.
2. En **Google Auth Platform**, configura la aplicación: nombre Gtrans, tu correo de soporte y contacto, y audiencia externa si usas una cuenta Gmail personal. Solicita únicamente `openid`, `email` y `profile`; no añadas permisos de Drive o Gmail.
3. En modo de prueba, añade `samugiraldo98@gmail.com` como usuario de prueba.
4. En **Clients / Clientes**, crea un cliente OAuth de tipo **Web application / Aplicación web**.
5. En **Authorized redirect URIs / URI de redireccionamiento autorizados**, añade exactamente:

   `https://gtrans-operaciones.samuelgiraldo.chatgpt.site/api/auth/google/callback`

6. Conserva el **Client ID / ID de cliente** y el **Client secret / Secreto de cliente**. El secreto va en la configuración privada de Sites; no en GitHub, documentos compartidos, capturas ni mensajes del chat.

Si Google exige verificar un dominio que no puedes acreditar como propio (por ejemplo, `chatgpt.site`), no intentes saltarte esa verificación: hay que conectar un dominio de la empresa u otra opción admitida antes de activar este acceso. La compatibilidad final se confirma con el flujo real de Google, no solo con la compilación.

## 2. Configurar Sites

En ChatGPT Sites → Gtrans → Configuración → Variables de entorno, configura:

| Variable | Valor |
| --- | --- |
| `GOOGLE_CLIENT_ID` | ID de cliente de Google |
| `GOOGLE_CLIENT_SECRET` | Secreto de Google; marcar como secreto |
| `GOOGLE_ADMIN_EMAIL` | `samugiraldo98@gmail.com` |
| `GTRANS_BASE_URL` | `https://gtrans-operaciones.samuelgiraldo.chatgpt.site` |
| `GTRANS_SESSION_SECRET` | Clave aleatoria de al menos 32 caracteres; marcar como secreto |
| `GTRANS_DATA_OWNER` | Identificador del propietario existente; debe conservarse para acceder a los mismos registros |
| `GTRANS_AUTH_MODE` | `chatgpt` durante la preparación; `google` solo al activar |

Gtrans puede preparar la clave de sesión y el identificador de datos con las herramientas de Sites. No hace falta copiar esos valores manualmente del código. Después de cambiar las variables hay que volver a desplegar una versión guardada para aplicarlas.

## 3. Probar y activar

1. Mantén inicialmente Sites con su acceso restringido. Con las credenciales configuradas, activa `GTRANS_AUTH_MODE=google` y despliega la versión preparada.
2. Comprueba el flujo real con el administrador y la denegación de otra cuenta. La sesión de ChatGPT ya no autoriza las APIs cuando el modo es Google.
3. Solo después, configura Sites para que la página de entrada sea accesible sin ChatGPT. Esta pantalla será pública; clientes, pagos y archivos seguirán protegidos por la sesión de Google.
4. Prueba desde un navegador sin sesión de ChatGPT: la página de entrada funciona, las APIs y archivos rechazan visitas sin sesión y Google permite al administrador acceder.
5. Si hay un problema, restaura el modo `chatgpt` y el acceso restringido de Sites, y despliega otra vez.

El modo Google autoriza exclusivamente el correo configurado como administrador. Su sesión dura 12 horas, se guarda en una cookie HttpOnly con Secure y SameSite=Lax, y se comprueba en el servidor en cada operación. Los tokens de Google se verifican con sus claves públicas, emisor, audiencia, vencimiento, correo verificado y nonce. El flujo usa state y PKCE. No se guardan tokens de acceso a otros servicios de Google.


### Cuentas adicionales autorizadas
GOOGLE_ADMIN_EMAIL conserva al administrador principal. GOOGLE_ALLOWED_EMAILS acepta correos adicionales separados por comas. Solo estas cuentas, verificadas por Google, pueden entrar; todas tienen actualmente los mismos permisos de administración y comparten GTRANS_DATA_OWNER. Compartir el proyecto de Sites o agregar usuarios de prueba en Google Cloud no sustituye esta lista. Actualizar las variables y publicar una versión para aplicar cambios. Eliminar un correo adicional de la lista invalida sus sesiones al aplicar la configuración. No cambiar GTRANS_DATA_OWNER al añadir usuarios.
