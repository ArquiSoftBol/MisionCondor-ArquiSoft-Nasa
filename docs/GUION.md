# Misión Cóndor — Guion de escenas

Fuente: «JUEGO SPACE APP NASA 2026 ARQUISOFT.pdf» (32 láminas). Aquí se reparte esa historia en escenas
que **sí se usan** en el juego. Los textos exactos de cada cuadro viven en `src/data/historia.ts`.

Marcadores: `{NOMBRE}` = nombre del jugador, `{MASCOTA}` = nombre de la mascota,
`ingenier@` → ingeniero / ingeniera / ingenierx según la orientación elegida.

## A. Ingreso (lámina 1–6)

| # | Escena | Qué hace el jugador | Sprites |
|---|---|---|---|
| A1 | Recomendaciones | Ve 12+, auriculares, teclado. Toca para seguir. | íconos dibujados |
| A2 | Logo | «ARQUISOFT presenta» con hexágono animado | — |
| A3 | Título «Misión Cóndor · Tu estrella» | Salar de Uyuni con reflejo, nevados, sonda cruzando. Jugar / Logros / Ajustes | `salar_andino`, `orbita_baja` |
| A4 | Introduce tu nombre | Escribe (teclado físico o del celular) | nebulosa procedural |
| A5 | Selecciona tu orientación | ♂ / ♀ / OTRO → elige el sprite del protagonista | `protagonista_m/f/x` |
| A6 | Nombre de tu mascota | Escribe; aparece la mascota moviendo la cola | `mascota_perro` |

## B. Prólogo — cinemática (láminas 7–11)

1. **El mundo sin aliento**: Tierra con anomalía; océanos que se congelan. → `tierra` + escarcha
2. **Ciudadela del Tierra · Salar de Uyuni**: última base. Presenta a {NOMBRE}. → `salar_andino`, `modulo_habitacional`, protagonista
3. **Su hogar**: pasillos, Invernadero, {MASCOTA} y el Rover del Patio de Pruebas. → `invernadero`, `patio_pruebas`, `rover_explorador`, mascota
4. **Caminata nocturna** bajo la Aurora sobre la costra de sal. → `aurora`, protagonista + mascota caminando
5. **Venus**: el espejo de lo que nos pasará. → `venus` (nuevo), `venus_superficie`
6. **Marte · Valle del polvo**. → `marte`, `marte_valle`
7. **Júpiter y Europa**: la Antena confirma el microorganismo. → `jupiter`, `europa`, `antena_espacio_profundo`, `cepa_vial` (nuevo)

## C. Nudo 1 — cinemática (lámina 12) + **Misión 1**

- Oficina de Presupuesto y Hangar: masa, potencia, combustible. → `oficina_presupuesto`, `hangar_ensamblaje`, `deposito_combustible`
- **MISIÓN 1 · Sistemas vitales**: arrastra a la nave lo que necesita para funcionar: energía (panel solar / RTG),
  control (panel de control / computadora), comunicación (antena), propulsión (tanque). Aprende qué hace cada uno.
  → `panel_desplegable`, `rtg_nuclear`, `panel_control`, `antena_portatil`, `tanque_criogenico`, `modulo_lunar`

## D. Nudo 2 — la promesa (lámina 14) + **Misiones 2, 3 y 4**

- Puerta del Módulo Habitacional: «Voy a traer aire limpio para ti, y te prometo que voy a volver». → protagonista + mascota
- **MISIÓN 2 · Cohete** (tipo SLS): apila etapa central, 2 propulsores sólidos, etapa superior, adaptador. → `cohete_*`
- **MISIÓN 3 · Orión**: módulo de servicio + alas solares, módulo de tripulación, escudo térmico, torre de escape. → `orion_*`
- **MISIÓN 4 · Despegue**: cuenta regresiva, aceleración, separación de propulsores y etapa central en el momento justo.
  → `torre_lanzamiento`, `cohete_completo`, `humo_despegue`, `separacion`

## E. Nudo 3 — cinemática del viaje (láminas 20–24)

1. Escala en **Marte · Base Tari**, tormenta, polvo pegado en los paneles; sale con la Llave de torque. → `marte_base_alfa`, `astro_repara`, `estado_rover_polvo`, `llave_torque`
2. Reabastecimiento orbital. → `reabastecimiento`
3. Cinturón de asteroides y cinturón magnético de Júpiter. → `cinturon_mineria`, `jupiter`, `rayo_tesla`
4. **Descenso a Europa · choque** (DATOS REALES): −160 °C, gravedad 1,31 m/s², hielo de 15–25 km, océano de hasta 100 km, ~628 millones de km de la Tierra, la luz tarda ~35 min. Sismo criovolcánico. → `europa_hielo`, `criovolcan` (nuevo), `explosion`
5. **Alertas del casco**: Poco oxígeno, Escarcha, Radiación. → `estado_astro_oxigeno/escarcha/radiacion`

## E2. **Misión 5 · Tormenta en Base Tari** (Guía Maestra, fase 3 · TIC TAC ROVER.mp3, 1:14)

Escena `MisionMarte`. 0:00–0:11 calma: la cámara recorre Base Tari (tanques llenos de hielo marciano) hasta el Rover.
0:11–0:54 tormenta de óxido: correr hasta el Rover (flecha), mantener USAR para limpiar sus paneles con la llave de torque,
esquivar remolinos de polvo (empujan y frenan la limpieza) y volver a la nave con el Rover. 0:54–1:05 ignición de escape;
1:05–1:14 zoom-out: «Marte queda atrás». Si se acaba el tiempo entra la reserva de oxígeno (máximo 1 estrella), nunca se pierde.
Después, la cinemática `nudo3b` (reabastecimiento orbital, asteroides, Europa).

## F. **Misión 6 · Rover en Europa** (láminas 25–30)

Manejas el rover (6 ruedas) con escudo de radiación: lámpara en la oscuridad, taladro sobre grietas térmicas, sellar la cepa
en el contenedor, recolectar bloques de hielo con el carrito y llevarlos al electrolizador (ISRU: agua → O₂ + combustible).
→ `rover_explorador`, `escudo`, `lampara_trabajo`, `taladro_muestras`, `contenedor_muestras`, `carrito_muestras`, `bloque_hielo`, `electrolizador_isru`

## G. Clímax — cinemática (láminas 29–30)

- La computadora de vuelo: la ecuación del cohete falla con los 180 kg del Rover. → barra de Δv que no alcanza
- Despedida: el rover conectado a la Antena portátil como faro. → `rover_explorador`, `antena_portatil`, `astro_saluda`
- 3, 2, 1… la Cápsula Colibrí despega; el rover queda solo. → `cuenta_regresiva`, `capsula_colibri`, `humo_despegue`

## H. Epílogo — cinemática (láminas 31–32) + FIN

- Reentrada atravesando el sistema solar y las nubes; aterriza en el Salar. → `capsula_colibri`, `tierra`, `salar_andino`
- El cielo vuelve a ser azul; la mascota corre a sus brazos. → mascota + protagonista
- En Europa, la luz del rover parpadea por última vez hacia el punto azul. → `europa_hielo`, `rover_explorador`, `estado_rover_escarcha`
- **FIN** sobre nebulosa.
