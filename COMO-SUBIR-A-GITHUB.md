# Subir Gtrans a GitHub

El ZIP contiene el código completo, las migraciones de la base de datos, los recursos gráficos y los archivos de configuración del proyecto. No contiene los registros de clientes, pagos, documentos adjuntos ni las claves privadas de producción.

## Pasos en Windows

1. Descomprime `gtrans-codigo.zip` en una carpeta llamada `gtrans`.
2. Instala Git desde https://git-scm.com/downloads/win si todavía no lo tienes.
3. En https://github.com/new crea un repositorio llamado `gtrans`. Puedes elegir **Private**. Déjalo vacío: no añadas README, licencia ni `.gitignore`, porque el código ya incluye archivos propios.
4. Abre PowerShell dentro de la carpeta que contiene `package.json` y ejecuta lo siguiente, reemplazando `TU_USUARIO` por tu usuario de GitHub:

```powershell
git init -b main
git add .
git commit -m "Código inicial de Gtrans"
git remote add origin https://github.com/TU_USUARIO/gtrans.git
git push -u origin main
```

Si Git pide tu identidad antes del commit, configura tu nombre y el correo asociado a GitHub:

```powershell
git config user.name "Tu nombre"
git config user.email "tu-correo@example.com"
```

Después repite el commit y el push. Si se abre la ventana de autenticación de GitHub, inicia sesión allí. El ZIP no incluye una carpeta `.git`, por lo que crea un repositorio nuevo sin conectarlo al repositorio interno de Sites.

## Para subir modificaciones posteriores

Desde la misma carpeta:

```powershell
git add .
git commit -m "Actualizar Gtrans"
git push
```

## Código y publicación

Guardar el código en GitHub no publica automáticamente la aplicación. Gtrans usa un servidor con Cloudflare Workers, D1 para los registros, R2 para archivos y autenticación Google. GitHub Pages no ejecuta estas APIs. El sitio existente seguirá disponible en https://gtrans-operaciones.samuelgiraldo.chatgpt.site.

Para desplegarlo en otro servidor habrá que configurar esos servicios y las variables documentadas en `GOOGLE-SETUP.md`. Las credenciales van en la configuración privada del alojamiento, no en el repositorio. `.gitignore` excluye `.env*`, `.dev.vars*`, `node_modules` y el estado local de la base de datos.

## Desarrollo local

Instala Node.js 22.13 o superior y pnpm 11.25.0. Desde la carpeta del código:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

El desarrollo local necesita sus propias variables de entorno y migraciones D1. Las claves y los datos reales de producción no se incluyen en el ZIP. Para compilar: `pnpm build`.

Las pruebas del arreglo de utilidad y del reinicio recuperable se ejecutan con:

```powershell
node scripts/check-trash-totals.mjs
node scripts/check-launch-reset.mjs
```

Guía oficial de GitHub: https://docs.github.com/es/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
