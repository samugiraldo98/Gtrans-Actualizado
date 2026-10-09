# Gtrans · Gestión de transportes

Aplicación privada para un administrador. Datos estructurados en Cloudflare D1 y documentos en R2. La plataforma Sites administra el acceso con la cuenta ChatGPT propietaria.

## Uso

1. Crea los transportadores en el directorio.
2. Crea una ficha por servicio: cliente, teléfono, origen, destino, ubicaciones, tipo de casa y peso o dimensiones.
3. Ingresa la cotización. Si no se contrata, registra el motivo. Si se contrata, ingresa precio y fecha de despacho.
4. Agrega una fila por camión: tipo, transportador, placa y costo acordado. Registra otros gastos para calcular la utilidad estimada.
5. Adjunta contratos y recibos. Registra pagos recibidos del cliente y anticipos a transportadores.
6. El día del despacho, revisa los datos y genera la orden. Su número es único. La ficha de la orden conserva los datos de ese momento y no se edita. Los pagos y anexos posteriores siguen relacionados con ella.
7. Registra el saldo final por camión. Abre la orden para imprimirla o guardarla como PDF desde el navegador. La impresión refleja los pagos registrados al momento de imprimir.

## Documentos y respaldos

- PDF, JPG y PNG; 20 MB por archivo y 1 GB total por administrador como límite de aplicación para esta prueba. Este límite no constituye una garantía de gratuidad del proveedor.
- En Documentos, Exportar registros descarga JSON (no incluye el contenido de los PDF).
- Descargar respaldo completo crea ZIP con registros JSON y archivos, hasta 200 MB acumulados por descarga. Para volúmenes mayores, exporta registros y descarga los documentos individualmente.
- Guarda respaldos fuera de la aplicación. Todavía no hay restauración automática por interfaz; el JSON contiene identificadores y relaciones para una recuperación técnica.
- Para retirar un cliente: abre su ficha y selecciona Mover a papelera. Desaparece de la lista y de los despachos activos; sus órdenes, pagos y documentos se conservan. En Papelera puedes consultar su ficha y restaurarlo. No se permite agregar información mientras esté en la papelera.
- La papelera de clientes no libera almacenamiento ni borra archivos. No hay eliminación definitiva de órdenes o pagos.
- En Cliente > Pagos, Corregir pago permite actualizar importe, fecha y referencia con un motivo. Se conserva historial y se recalculan saldos. El tipo de pago y el camión permanecen asociados al registro original; los soportes no se reemplazan automáticamente.
- En Transportadores se pueden editar datos y retirar/restaurar entradas. Las órdenes ya generadas conservan los datos originales. Se impide retirar un transportador asignado a un cliente activo sin orden.
- En Documentos, Borrar solicita confirmación y elimina el PDF o imagen de R2 definitivamente. El pago se conserva y el espacio deja de contar en la cuota. Se conserva metadata de eliminación para seguimiento técnico; el archivo no puede recuperarse por interfaz. Si una eliminación queda pendiente, aparece Reintentar.

## Desarrollo

Node 22.13+ y pnpm 11.25.0. Instala con `pnpm run install:ci`. Genera migraciones con `pnpm run db:generate` y compila con el helper build-site.mjs del plugin Sites. Inicia la vista con `pnpm dev`.

La simulación de inicio de sesión del starter solo existe en desarrollo local. Las pruebas `node scripts/smoke.mjs` y `node scripts/check-backup.mjs` requieren el servidor local y las migraciones locales aplicadas. Los datos ficticios de prueba no se publican.

Utilidad estimada = precio al cliente − costos acordados de todos los camiones − otros gastos. Los pagos se registran separadamente para mostrar saldos; no se cuentan dos veces como costos. Importes en COP enteros.

Esta versión carga todos los registros para búsqueda y reportes. Antes de crecer a muchos miles de servicios conviene añadir paginación, auditoría, correcciones de órdenes y respaldos automáticos.
# Clientes recurrentes e historial

## Preparación del acceso con Google

El flujo de Google está implementado y probado con claves y cuentas ficticias. Para activarlo con una cuenta real, sigue [GOOGLE-SETUP.md](GOOGLE-SETUP.md). Mientras no se configure expresamente el modo Google, el sitio mantiene el acceso existente con ChatGPT. Cambiar el acceso de Sites a público por sí solo no activa Google. Nunca publiques credenciales en GitHub.

Un cliente puede contratar varios transportes. Desde su ficha, **Nuevo transporte** conserva nombre, teléfono y documento e inicia una ruta, cotización y fecha nuevas. **Historial** muestra todos sus servicios, incluidas las órdenes y los servicios en papelera. Cada transporte conserva sus propios pagos, documentos, camiones y orden. La lista Clientes muestra una sola entrada por cliente; Despachos muestra cada servicio.

Internamente `clients` contiene fichas de transporte y `customer_id` las agrupa bajo un cliente estable; los registros anteriores se migran sin mezclar personas por coincidencias de nombre o teléfono. `client_id` en órdenes, pagos y documentos identifica el transporte. La numeración visible se asigna con una transacción y un contador por administrador; generar la misma orden otra vez no consume números.

En Documentos, **Reiniciar datos de prueba** elimina definitivamente los registros del administrador autenticado y los archivos asociados, reiniciando su contador. Requiere escribir la frase de confirmación; conservar transportadores es la opción predeterminada. Mover un transporte a Papelera conserva su orden y no reinicia la numeración.


## Cobros, reportes y documentos
- Cobros muestra saldos actuales de servicios contratados activos, búsqueda, filtros y CSV. Abre Pagos desde cada transporte.
- Reportes usa la fecha de despacho para valores acordados y la fecha del pago para movimientos reales. La utilidad estimada descuenta costos y gastos acordados; el flujo registrado no descuenta otros gastos sin movimiento de pago. Los movimientos incluyen servicios en papelera; los servicios acordados excluyen papelera.
- Documentos: categorías, búsqueda, vista previa autenticada de PDF/imágenes, descarga y eliminación; avisos de contratos y pagos sin soporte. Se avisa ante archivos con nombre y tamaño iguales en el mismo transporte.
- Reiniciar datos de prueba fue retirado y la acción reset-data devuelve 403. No se borraron registros con esta actualización.
- Respaldos automáticos a servidor: pendiente de configurar un destino autenticado. Ethernet es suficiente si el servidor tiene internet. No se requiere un navegador abierto ni estar en la misma red para usar la app.
- Verificación local: scripts/check-operations.mjs (datos ficticios; no ejecutar contra producción), scripts/smoke.mjs y compilación.

Usuarios autorizados: sección disponible solo para GOOGLE_ADMIN_EMAIL. /api/access permite altas y retirada de acceso con control de versión; D1 authorized_users conserva cambios. La lista inicial de GOOGLE_ALLOWED_EMAILS se mantiene, pero los cambios guardados en la app prevalecen. Se consulta en cada inicio de sesión y solicitud autenticada; al cambiar permisos se invalidan las sesiones anteriores del correo. No se envían invitaciones. Migración 0004_chubby_proteus. Prueba scripts/check-access.mjs exige una configuración ficticia local en .dev.vars y no debe ejecutarse contra producción.
