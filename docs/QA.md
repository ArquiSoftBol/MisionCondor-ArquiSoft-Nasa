# QA · Misión Cóndor

Cómo comprobar que **todo funciona y se puede jugar** en PC, celular y tablet.

## 1. Pruebas automáticas

```bash
npm install
```

```bash
npm run qa
```

`npm run qa` corre las dos baterías. También se pueden correr por separado:

| Comando | Qué prueba | Tiempo |
|---|---|---|
| `npm test` | Servidor real (salas, identidad sin correo, reglas del cooperativo, salidas, robustez) y **lógica del juego en equipo** contra ese servidor | ~10 s |
| `npm run test:e2e` | El juego compilado en un navegador real, en **PC, celular (Pixel 7) y tablet (iPad)**, con clics y toques reales | ~25 min |
| `npm run test:e2e:pc` / `npm run test:e2e:celular` | Solo un dispositivo | ~9 min |
| `npm run qa:reporte` | Abre el reporte HTML del último E2E (capturas y video de lo que falló) | — |

En GitHub corre solo en cada push (`.github/workflows/qa.yml`). Si falla, el reporte queda en *Actions → QA → Artifacts*.

> En una PC sin el Chromium de Playwright se usa Microsoft Edge automáticamente. Para forzar otro: `QA_NAVEGADOR=chrome`.
> Para no recompilar el juego en cada corrida: `QA_SIN_COMPILAR=1 npm run test:e2e`.

### Qué cubren

**Lógica del modo en equipo (`tests/logica/`, 18 pruebas)** — `src/core/coopLogica.ts` contra el servidor real
- La mesa del Ingeniero dice «va ahora / después / no va» **exactamente** cuando el servidor monta o rechaza (todas las piezas, en cada paso, en los dos escenarios).
- Siguiendo solo las sugerencias de la mesa («◀ pídela») cada misión termina con 3 estrellas y 0 errores, sin pedir nunca una trampa.
- El Recolector ve al Ingeniero «trabajando» en su mesa (y un Recolector no puede fingirlo).
- Calibración: margen de la zona verde, la aguja rebota y es lenta (se puede con el dedo).
- Compañeros del mapa: su paseo nunca atraviesa edificios ni sale del mapa, y su posición depende solo de la hora (los dos jugadores los ven en el mismo lugar).
- Datos: todos los sprites existen, cada compañero tiene frases, ninguno tapa una pieza, y cada receta se puede completar.

**Servidor (`tests/servidor/`, 30 pruebas)**
- API `/api/salud` y `/api/ranking`.
- Entrar solo con nombre (sin correo); nombre corto rechazado; nombre limpio de `< >`; clave inválida → se asigna una.
- Sala: código de 6 caracteres sin letras confusas, unirse con minúsculas, código inexistente, sala llena, intercambio de roles, empieza solo con los dos listos, reconexión con la misma clave.
- Partida: permisos por rol, avisos «acércate» (no silencios), carro de 2 espacios, pedidos, piezas trampa con su explicación, devolver, calibración fallida, orden del cohete con pistas, partida completa con ranking, otra partida, salir a mitad (el compañero vuelve a la sala y otro puede entrar).
- Robustez: JSON inválido, mensajes raros, mensaje gigante, conexión WebSocket rota.

**Juego (`tests/e2e/`, en los 3 dispositivos)**
- Cada pantalla abre sin errores ni archivos faltantes y **cabe entera** en la pantalla.
- Portada, Archivo, Multijugador, registro de nombre, cinemáticas (tocar y **Saltar**), final, pausa, idioma inglés.
- Misiones jugadas: Sistemas (4 sistemas + trampa), Cohete (elegir y soltar), Orión, Despegue completo hasta la órbita, Marte (moverse en la tormenta), Rover (manejar y escanear), Ecuación (dejar cargas hasta 2,80 km/s).
- Multijugador con **dos navegadores**: crear sala, escribir el código en las 6 casillas, guía de rol, mesa inteligente (va ahora / no va), montar con la aguja, fin de misión, Cerrar, botón «?», salir a mitad con confirmación y volver a la sala; el Ingeniero camina con su hoja de caminar y el compañero lo ve teclear en la mesa; con la guía abierta USAR no abre la mesa; los alienígenas saludan al acercarse y con USAR dicen otra cosa.
- Multiplataforma: PWA instalable (manifiesto e íconos), aviso de girar en vertical, palanca táctil solo en pantallas táctiles, sin zoom ni selección al tocar, el servidor no deja leer archivos fuera del juego.

## 2. Checklist manual (lo que una máquina no puede juzgar)

Antes de presentar, una persona revisa en **un celular real** y en **una PC**:

| ✔ | Qué revisar |
|---|---|
| ☐ | Abrir https://mision-condor.onrender.com (la primera visita puede tardar ~50 s si el servidor estaba dormido) |
| ☐ | Celular: «Agregar a pantalla de inicio» → se abre a pantalla completa y horizontal |
| ☐ | Celular en vertical: aparece «Gira el teléfono» y al girar sigue el juego |
| ☐ | El sonido y la música suenan después del primer toque (iPhone: sin modo silencio) |
| ☐ | Escribir el nombre con el teclado del celular: el campo se ve y no queda tapado |
| ☐ | La palanca táctil se siente cómoda (Marte, Rover, cooperativo) |
| ☐ | La aguja de calibración se puede acertar con el dedo |
| ☐ | Textos legibles en el celular más chico del equipo |
| ☐ | Multijugador entre **dos aparatos distintos** (celular + PC) con el código de sala |
| ☐ | Cortar el wifi de uno a mitad de partida y volver: recupera su lugar |
| ☐ | Jugar la aventura completa una vez de principio a fin |

## 3. Compañeros del mapa (multijugador)

Cada escenario de `public/coop/escenarios.json` tiene una lista `companeros`: sprite, nombre, casa (`x`, `y`), `radio` del paseo y `frases`. En el Salar hay gente de Bolivia (Doña Rosa, Mateo y su llama, Doña Justina, el Mallku Tomás); en la Torre de lanzamiento, alienígenas amigos (Zib, Blub y Lumi) junto a su platillo. Si el Ingeniero pidió una pieza, al Recolector le dicen dónde está.

Los sprites se dibujan con el generador de moldes (`herramientas/moldes/coop.js`, solo en la computadora del equipo: esa carpeta no se sube al repositorio) y se exportan con `node herramientas/servir-moldes.mjs` y abriendo `http://localhost:8791/exportar.html?solo=coop#auto`.

## 4. Pendientes conocidos

- Falta el logo oficial `public/marca/space-apps.png` (el juego muestra una insignia de texto en su lugar). Ver `public/marca/LEEME.txt`.
- En el plan gratis de Render el ranking se borra en cada redeploy.
