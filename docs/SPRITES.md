# Sprites de Misión Cóndor

Hojas 2.5D: columnas = 8 direcciones (columna × 45°; 0 = de frente, 2 = mira a la izquierda, 6 = mira a la derecha),
filas = 8 cuadros de animación. Cada hoja lleva `_brillo.png` (se dibuja en modo aditivo) y, los mundos, `_cielo.png`.

## Nuevos (herramientas/moldes/mision.js → public/sprites/hojas/mision/)

| id | Para qué |
|---|---|
| protagonista_m / _f / _x | Protagonista según la orientación (♂ pelo corto · ♀ melena y cola · OTRO chullo andino) |
| mascota_perro | La mascota que nombra el jugador (trota) |
| mascota_corre · mascota_salta · mascota_sentada | Galope (reencuentro), salto de alegría con corazón (reencuentro, registro, FIN) y sentada jadeando (la promesa, registro) |
| eva_{m,f,x}_{camina,saluda,repara,arrodillado} | Protagonista con traje EVA: visor claro (se ve la cara), franja azul ♂ / rosa ♀ / verde con chullo OTRO |
| eva_{m,f,x}_{oxigeno,escarcha,radiacion} | El mismo traje con la alerta del casco (cinemática «atrapados») |
| venus | Planeta que faltaba (prólogo) |
| cohete_nucleo · cohete_propulsor · cohete_etapa_superior | Piezas de la Misión 2 |
| cohete_completo · cohete_despegue · cohete_vuelo2 · cohete_vuelo3 | Torre y etapas de la Misión 4 |
| orion_servicio · orion_capsula · orion_escape · orion_completa | Misión 3 y viaje |
| panel_control · rtg_nuclear · tanque_criogenico · modulo_lunar | Misión 1 (sistemas de un vehículo) |
| bloque_hielo · electrolizador_isru · criovolcan · cepa_vial | Europa, ISRU y la cura |
| bitacora_holo | Atril con libro holográfico: abre el Archivo desde la portada |

## Decorados (herramientas/moldes/decorados.js → public/sprites/hojas/decorados/)

Todos los fondos se arman con estos sprites (ver `src/ui/decorado.ts`):

| id | Uso |
|---|---|
| suelo_sal · suelo_hielo · suelo_marte · suelo_hangar | Losetas isométricas (sin contorno) que se pintan una vez en una RenderTexture |
| nevado · nevado_chico | Cordillera en dos filas, con reflejo sobre la sal |
| nube_bloques | Nubes de la portada, la plataforma y el ascenso |
| cactus_gigante | Isla Incahuasi en el Salar |
| rocas_marte · penitentes | Utilería de Marte y Europa (también obstáculos visuales en la Misión 5) |
| grua_puente · estanteria | Interior del Hangar de Ensamblaje |
| roca_hielo · cresta_hielo · grieta_hielo · baliza_luz | Obstáculos y balizas de Europa **con cuerpo** (el rover choca): Misión 5 |
| icono_energia · icono_control · icono_comunicacion · icono_propulsion | Íconos de la Misión 1 |

## Íconos de interfaz (herramientas/moldes/iconos.js → public/sprites/hojas/iconos/)

Reemplazan a los emojis del sistema (que cambiaban según la computadora). Cada uno es una cuadrícula de píxeles que el
motor levanta en bloques 2.5D; MAYÚSCULA = brilla, `*` = late. Se usan de frente con `icono(scene, x, y, 'ico_…', tam)`
(`src/ui/iconos.ts`), o pasando `'ico_…'` como `icono` de `boton()` / `cintillo()`. Se cargan al arrancar y no se liberan.
Exportar solo estos: `npm run moldes` → `http://localhost:8791/exportar.html?solo=iconos#auto`.

| id | Uso |
|---|---|
| ico_tocar · ico_masa · ico_sol · ico_deshacer | Guía de la Misión 1 |
| ico_engranaje · ico_pista · ico_soltar · ico_tubos · ico_escudo · ico_objetivo | Guías de las Misiones 2 y 3, botón MONTAR, menú Ajustes |
| ico_subir · ico_bajar · ico_combustible · ico_estrella | Guía de la Misión 4 |
| ico_ruta · ico_taladro · ico_escanear · ico_bateria | Guía de la Misión 5 |
| ico_teclado · ico_idea | Controles e idea clave en «Cómo se juega» |
| ico_candado · ico_volumen · ico_alerta · ico_fuego · ico_pantalla · ico_equipo | Archivo, pausa, intro, prueba de tubos, pantalla completa, multijugador |

## Reutilizados de Ciudadela Cóndor (116 hojas)

ciudadela (base, hangar, torre, antena, invernadero…), flota (cápsula Colibrí…), herramientas (taladro, llave de torque,
lámpara, antena portátil, carrito, contenedor), movimientos y estados del astronauta y del rover, mundos (salar, Europa,
Marte, Venus), planetas y efectos (aurora, humo, explosión, escudo, separación).

## Editor y regenerar

```
npm run moldes
```
- `http://localhost:8791/` → **Taller de sprites y Estudio 3D** (el mismo editor de Ciudadela Cóndor). Lo que guardes ahí
  va a `herramientas/moldes/creaciones.js`.
- `http://localhost:8791/index.html` → catálogo de todos los moldes (incluye los de Misión Cóndor y los decorados).
- `http://localhost:8791/exportar.html#auto` → exporta las categorías **mision, decorados y creaciones** a
  `public/sprites/hojas/` y rehace `atlas.json`. Para una sola: `exportar.html?solo=decorados#auto`.
- Un sprite creado en el Taller se usa en el juego por su id (`new Actor(scene, x, y, 'mio_…')`) tras exportar.
Guarda las hojas en `public/sprites/hojas/mision/` y reconstruye `public/sprites/atlas.json`.
El exportador revisa recortes, saltos en el bucle, azar sin semilla y lentitud (`revision-mision.txt`).
