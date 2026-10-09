# Cómo modificar Gtrans

El código describe el funcionamiento del programa. Los registros de clientes y los PDF se guardan separadamente en D1 y R2. Editar o borrar un archivo del código no borra un cliente de la base de datos.

## Archivos de la papelera

| Archivo | Responsabilidad |
| --- | --- |
| `app/dashboard.tsx` | Muestra clientes, el botón Mover a papelera, su confirmación y Restaurar cliente. |
| `app/api/manage/route.ts` | Comprueba la sesión, identifica el cliente y permite retirarlo o restaurarlo. |
| `app/api/manage/corrections.ts` | Valida y guarda correcciones de pagos, retiro/restauración de transportadores y borrado definitivo de documentos. |
| `db/schema.ts` | Define los campos de la base de datos; `deleted_at` registra cuándo se retiró. |
| `drizzle/0001_polite_agent_zero.sql` | Agrega el campo a la base existente al publicar la versión. |
| `app/gtrans.css` | Define colores y presentación de la confirmación y avisos. |

El cliente permanece guardado. La lista principal muestra los que no tienen fecha de retiro, mientras Papelera muestra los que sí la tienen. Los pagos, órdenes y archivos no se eliminan.

## Ejemplo de la petición que envía el botón

```ts
await api({
  action: 'archive-client',
  id: chosen.id,
  version: chosen.version,
});
await refresh();
```

`api` envía una petición POST al servidor, `chosen` es la ficha seleccionada y `refresh` recarga los registros. Para restaurar se utiliza `restore-client`. La versión impide que una ventana desactualizada retire una ficha que cambió en otra ventana.

## Cambiar manualmente un texto desde GitHub

1. Abre tu repositorio privado Gtrans.
2. Abre `app/dashboard.tsx`.
3. Pulsa el lápiz para editar.
4. Busca un texto, por ejemplo `Mover a papelera`, y cambia solo el contenido entre comillas o etiquetas. Conserva la sintaxis.
5. Guarda con Commit changes y un mensaje que describa el cambio.

Esto actualiza tu copia en GitHub. Actualmente GitHub y el despliegue de Sites no están conectados para publicación automática: el cambio aún debe trasladarse al código del proyecto de Sites, comprobarse y publicarse como una nueva versión.

## Verificar y publicar

Una modificación completa puede necesitar cambios en pantalla, API y base de datos. Comprueba los tipos con `pnpm exec tsc --noEmit`. Para nuevos campos, modifica `db/schema.ts` y genera una nueva migración con `pnpm run db:generate`; no alteres migraciones ya aplicadas. Prueba primero con datos ficticios y publica la versión mediante el flujo de Sites.

La versión actual incluye pruebas de retirada y restauración en `scripts/smoke.mjs`. Requieren la vista previa local y las migraciones locales aplicadas. Mantén respaldos del código y de los registros/documentos por separado.

## Pagos, transportadores y documentos

Las correcciones de pagos se guardan con historial en `payment_revisions`; actualizar solo el valor en la pantalla no cambia el registro. La API valida el saldo dentro de una transacción, preserva el vínculo con el camión y los soportes, y exige un motivo.

Los transportadores retirados mantienen su ficha y pueden restaurarse. Las órdenes conservan los datos registrados al generarlas.

El botón Borrar de documentos elimina el archivo de R2 tras una confirmación explícita. La metadata se conserva para seguimiento; el contenido eliminado no se puede recuperar desde la interfaz. Si la operación falla, se puede reintentar desde la lista de documentos. La nueva estructura se agrega mediante `drizzle/0002_brainy_king_cobra.sql` y sus metadatos.
