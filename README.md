# LosTankesBets 🎲

App web para apostar entre amigos con **monedas ficticias**. No hay dinero real. Cada amigo invitado empieza con 50.000 monedas.

## Cómo correrla
Necesitas Node 22.5 o más nuevo (usa el SQLite que ya viene con Node).
```
npm install
npm test        # pruebas de cuotas y liquidación
npm start       # abre http://localhost:3000
```
Variables opcionales: `PORT` (puerto, 3000 por defecto), `DB_FILE` (archivo de datos, `data.db`), `ODDS_API_KEY` (líneas reales).

## Crear el administrador
- **Primera vez:** abre la app; si no hay administrador, te pide crear uno (usuario y PIN).
- **O por variable:** `ADMIN_PIN=1234 ADMIN_USER=angel npm start` lo crea al arrancar si todavía no existe.

## Invitar amigos
Entra como admin → pestaña **Admin** → **Crear invitación**. Copia el link (`.../?invitacion=CODIGO`) y mándalo. Cada código sirve una sola vez. El amigo elige usuario y PIN.

## Líneas ficticias
En **Admin** escribe el título (ej. "Hoy como espaguetis") y las opciones con cuota americana (Sí -250, No +880). Puedes poner 2 o más opciones.
- **+880**: apostar 100 gana 880 de ganancia (cobras 980).
- **-250**: apostar 250 gana 100 de ganancia (cobras 350).
Luego: **Cerrar apuestas**, **Ganó esta** (paga) o **Cancelar y devolver**.

## Líneas reales
Usan The Odds API (https://the-odds-api.com). Pon tu clave en `ODDS_API_KEY`. Sin clave verás "Líneas reales: falta configurar la clave". El admin importa un evento en la pestaña **Reales** y lo liquida a mano con "Ganó esta".

## Mercados por evento

- The Odds API v4: `h2h,spreads,totals`, `regions=us`, cuotas americanas. Documentación: https://the-odds-api.com/liveapi/guides/v4/ . Cada mercado conserva el umbral y las cuotas de un solo bookmaker completo; no se mezclan casas dentro de un mercado. Disponibilidad depende del deporte/casa/plan/cuota (hasta 3 créditos por región por consulta). No se fabrican cuotas si falta un mercado.
- Importar crea líneas independientes por mercado; reimportar no cambia apuestas/cuotas ni reabre mercados. Las importaciones antiguas h2h se conservan.
- Admin → Nuevo evento con mercados: equipos, mercados habilitados, umbrales y cuotas explícitas. Líneas enteras/medias; no se admiten cuartos asiáticos/divididos.
- Liquidar/cerrar afecta SOLO al mercado elegido. Push requiere umbral entero y confirmación manual del resultado exacto: devuelve simples y anula patas de parlay (multiplicador 1). No hay feed de marcadores ni liquidación automática.
- Parlay: como máximo una selección por evento, aun entre mercados distintos. Las apuestas simples a mercados independientes sí se permiten.
- Migración aditiva e idempotente; no cambia cuentas, PINs, saldos ni apuestas existentes.
- Pruebas: `node test.js && node test_av3d.js && node test_markets.js`.

### Partidos antiguos solo con Ganador

En la tarjeta del partido (admin), **Agregar hándicap / total** abre Admin. En **Agregar mercados a un evento existente**, selecciona el partido, verifica nombres exactos de equipos, elige Hándicap o Total, escribe umbral y ambas cuotas americanas y pulsa **Agregar mercado al partido**. Repite para el otro mercado. No hay valores prellenados ni cambios de cuotas/apuestas antiguas. Las líneas antiguas quedan vinculadas al evento solo al enviar este formulario, sin cambios financieros. Si un mercado ya existe, se rechaza el intento de sobrescribirlo. Para líneas reales se puede reimportar desde el proveedor si ofrece estos mercados.
