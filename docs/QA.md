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
| `npm test` | Servidor real: salas por código, identidad sin correo, reglas del modo cooperativo, salidas, robustez | ~5 s |
| `npm run test:e2e` | El juego compilado en un navegador real, en **PC, celular (Pixel 7) y tablet (iPad)**, con clics y toques reales | ~25 min |
| `npm run test:e2e:pc` / `npm run test:e2e:celular` | Solo un dispositivo | ~9 min |
| `npm run qa:reporte` | Abre el reporte HTML del último E2E (capturas y video de lo que falló) | — |

En GitHub corre solo en cada push (`.github/workflows/qa.yml`). Si falla, el reporte queda en *Actions → QA → Artifacts*.

> En una PC sin el Chromium de Playwright se usa Microsoft Edge automáticamente. Para forzar otro: `QA_NAVEGADOR=chrome`.
> Para no recompilar el juego en cada corrida: `QA_SIN_COMPILAR=1 npm run test:e2e`.

### Qué cubren

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
- Multijugador con **dos navegadores**: crear sala, escribir el código en las 6 casillas, guía de rol, mesa inteligente (va ahora / no va), montar con la aguja, fin de misión, Cerrar, botón «?», salir a mitad con confirmación y volver a la sala.
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

## 3. Pendientes conocidos

- Falta el logo oficial `public/marca/space-apps.png` (el juego muestra una insignia de texto en su lugar). Ver `public/marca/LEEME.txt`.
- En el plan gratis de Render el ranking se borra en cada redeploy.
