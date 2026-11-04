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
