// Textos de las cinemáticas, tomados del guion de ARQUISOFT («JUEGO SPACE APP NASA 2026»).
// Cada cuadro elige un «escenario» visual que arma scenes/Cinematica.ts.
// Marcadores: {NOMBRE}, {MASCOTA}, ingenier@, {o}, {el} (ver core/texto.ts).

export type Etapa = 'PRÓLOGO' | 'NUDO' | 'CLÍMAX' | 'EPÍLOGO';
export type Alerta = 'oxigeno' | 'escarcha' | 'radiacion';

export interface Cuadro {
  escenario: string;
  texto: string;
  datos?: { titulo: string; lineas: string[]; izquierda?: boolean };   // tarjeta «DATOS REALES» (a la derecha, o a la izquierda si tapa algo)
  alertas?: Alerta[];
  segundos?: number;                              // tiempo extra en pantalla
  interactivo?: string;                           // escena que el jugador resuelve al terminar este cuadro (p. ej. 'Ecuacion')
}

export interface Bloque { etapa: Etapa; cuadros: Cuadro[] }

export const HISTORIA: Record<string, Bloque> = {
  prologo: {
    etapa: 'PRÓLOGO',
    cuadros: [
      { escenario: 'tierra_enferma', texto: 'El mundo que conocíamos se está quedando sin aliento. Una anomalía atmosférica consume el oxígeno del planeta y congela los océanos poco a poco.' },
      { escenario: 'salar_base', texto: 'En lo alto de la cordillera, donde el cielo aún permanece limpio, resiste la última base operativa de la NASA: la Ciudadela de la Tierra · Salar andino de UYUNI.' },
      { escenario: 'protagonista', texto: 'Allí vive {NOMBRE}, ingenier@ aeroespacial solitari{o} que decidió quedarse en la superficie cuando todos los demás se refugiaron bajo tierra.' },
      { escenario: 'hogar', texto: 'No tiene familia; su único hogar son los pasillos de la base y el Invernadero, que lucha por mantener vivas las últimas plantas.' },
      { escenario: 'mascota_rover', texto: 'Le acompañan {MASCOTA}, su fiel mascota, que le sigue a todas partes, y su creación más querida del Patio de Pruebas: el Rover explorador.' },
      { escenario: 'caminata_aurora', texto: 'Cada noche, antes de encerrarse en el Hangar de Ensamblaje, sale con {MASCOTA} a caminar sobre la costra de sal bajo el brillo de la Aurora y mira hacia las estrellas.' },
      {
        escenario: 'venus', texto: 'Señala el lucero más brillante y recuerda a Venus: un mundo que pudo parecerse a la Tierra, pero cuya atmósfera aplastante de CO₂ y ácido lo convirtió en un infierno. El espejo de lo que nos pasará si nadie actúa.',
        datos: { titulo: 'VENUS', lineas: ['Superficie: ~465 °C', 'Presión: 92 veces la de la Tierra', 'Atmósfera: 96 % CO₂', 'Nubes de ácido sulfúrico'] },
      },
      {
        escenario: 'marte', texto: 'Observa el punto rojizo de Marte · Valle del polvo: un desierto helado de atmósfera finísima donde las tormentas de óxido cubren todo a su paso.',
        datos: { titulo: 'MARTE', lineas: ['Temperatura media: −63 °C', 'Presión: 0,6 % de la terrestre', 'Tormentas de polvo que cubren el planeta', 'Escala de la misión: Base Tari'] },
      },
      {
        escenario: 'jupiter_europa', texto: 'Finalmente detiene la mirada en el gigante Júpiter y en su pequeña luna helada: Europa.',
        datos: { titulo: 'JÚPITER · EUROPA', lineas: ['Superficie de Europa: −160 °C', 'Radiación: 5,4 Sv por día', 'Extremófilos detectados bajo el hielo'], izquierda: true },
      },
      {
        escenario: 'antena_cepa', texto: 'La Antena de espacio profundo ha confirmado el milagro: en el océano oculto bajo kilómetros de hielo vive un microorganismo extremófilo capaz de restaurar la atmósfera terrestre.',
      },
    ],
  },

  nudo1: {
    etapa: 'NUDO',
    cuadros: [
      { escenario: 'oficina', texto: 'Nadie más vendrá a buscarlo. {NOMBRE} entra a la Oficina de Presupuesto y al Hangar de Ensamblaje.' },
      { escenario: 'hangar_calculo', texto: 'Calcula cada gramo de masa, cada vatio de potencia y cada gota de combustible del Depósito de Combustible. Primero: ¿qué necesita un vehículo para funcionar?' },
    ],
  },

  nudo2: {
    etapa: 'NUDO',
    cuadros: [
      { escenario: 'promesa', texto: 'Antes de subir a la Torre de Lanzamiento, se agacha frente a {MASCOTA} en la puerta del Módulo Habitacional y le hace una única promesa:' },
      { escenario: 'promesa_cerca', texto: '«Voy a traer aire limpio para ti, y te prometo que voy a volver».', segundos: 1.5 },
    ],
  },

  nudo3: {
    etapa: 'NUDO',
    cuadros: [
      { escenario: 'viaje', texto: 'El viaje a través del Sistema Solar pone a prueba cada cálculo. Tras el despegue y la separación de etapas, la misión hace su primera escala en Marte: Base Tari.' },
    ],
  },

  // Tras el minijuego de Base Tari (MisionMarte): el reabastecimiento y el viaje a Europa
  nudo3b: {
    etapa: 'NUDO',
    cuadros: [
      { escenario: 'reabastecimiento', texto: 'Después ejecuta el Reabastecimiento orbital. Con los tanques llenos, la Nave Orión pone rumbo a Júpiter.' },
      { escenario: 'asteroides', texto: 'Cruza el cinturón de asteroides y se adentra en el letal cinturón magnético de Júpiter.' },
      {
        escenario: 'descenso_europa', texto: 'Descenso sobre Europa: perforación «¿Estamos solos?». El descenso es violento...',
        datos: { titulo: 'DATOS REALES · EUROPA', lineas: ['Distancia a la Tierra: ~628 millones de km', 'La luz tarda ~35 minutos en llegar', 'Gravedad: 1,31 m/s² (13 % de la Tierra)', 'Superficie: −160 °C', 'Radiación: ~5 400 mSv por día'] },
        segundos: 2,
      },
      { escenario: 'sismo', texto: 'Apenas tocan la superficie, un sismo criovolcánico fractura el hielo bajo sus pies, daña los tanques principales y corta el enlace directo con la Tierra.' },
      {
        escenario: 'atrapados', texto: 'Están atrapados a seiscientos millones de kilómetros de casa. En el casco comienzan a parpadear las alertas mortales: poco oxígeno, escarcha por el frío de −160 °C y radiación del núcleo joviano.',
        segundos: 1.5,
      },
      { escenario: 'rover_heroe', texto: 'Caminar afuera durante mucho tiempo es una sentencia de muerte para un ser humano, pero no para el Rover explorador.' },
      { escenario: 'escudo', texto: 'Protegido por el Escudo de radiación y guiado desde la nave Orión, el pequeño vehículo de seis ruedas se convierte en el héroe de la misión.' },
    ],
  },

  climax: {
    etapa: 'CLÍMAX',
    cuadros: [
      { escenario: 'computadora', texto: 'La cura está asegurada en el Contenedor de muestras y el tanque tiene combustible. Pero cuando {NOMBRE} traza la ruta de regreso en la computadora de vuelo, la física le da un golpe devastador.' },
      {
        escenario: 'ecuacion', texto: 'El combustible fabricado solo alcanza si la cápsula viaja ligera. Con el peso de {NOMBRE}, el contenedor biológico y los 180 kilos del Rover explorador, la ecuación del cohete falla.',
        datos: { titulo: 'ECUACIÓN DEL COHETE', lineas: ['Δv = Isp · g₀ · ln(masa inicial / masa final)', 'Necesario para escapar: 2,80 km/s', 'Con el rover (180 kg): 2,67 km/s  ✗', 'Sin el rover: 2,89 km/s  ✓'] },
        segundos: 3,
      },
      { escenario: 'dejar_masa', texto: 'La nave no lograría entrar en órbita de escape. Para que la cura llegue a la Tierra y {NOMBRE} cumpla su promesa de volver, hay que dejar masa atrás.', interactivo: 'Ecuacion' },
      { escenario: 'despedida', texto: 'No hay otra pieza que quitar. En silencio, sale por última vez al hielo de Europa y se arrodilla frente a su Rover, cubierto de escarcha y cicatrices del viaje.' },
      {
        escenario: 'faro', texto: 'Lo conecta a la Antena portátil para que sea faro de telemetría durante el despegue, limpia el visor de su cámara y se despide de su compañero de metal con un saludo silencioso.',
        datos: { titulo: 'FARO DE TELEMETRÍA ACTIVO', lineas: ['180 kg liberados', 'Δv nominal alcanzado: 2,89 km/s'] },
      },
      { escenario: 'cuenta', texto: 'Comienza la cuenta regresiva: 3, 2, 1...', segundos: 2 },
      { escenario: 'despegue_colibri', texto: 'Los motores de la Cápsula Colibrí rugen en la oscuridad. Mientras la nave asciende, el pequeño Rover se queda solo sobre la llanura blanca de Europa, manteniendo la señal hasta que su batería empieza a congelarse.' },
    ],
  },

  epilogo: {
    etapa: 'EPÍLOGO',
    cuadros: [
      { escenario: 'travesia', texto: 'Meses después, la cápsula cruza de regreso todo el Sistema Solar: Júpiter, el cinturón de asteroides, Marte... y al fin, un punto azul.', segundos: 1.5 },
      { escenario: 'reentrada', texto: 'Atraviesa las nubes de la Tierra y aterriza suavemente sobre el espejo blanco del Salar de Uyuni.' },
      { escenario: 'cielo_azul', texto: 'El Invernadero procesa la muestra y, por primera vez en décadas, el cielo recupera su profundo color azul bajo un Sol radiante.' },
      { escenario: 'reencuentro', texto: 'La compuerta se abre; {NOMBRE} baja agotad{o}, {MASCOTA} corre a sus brazos y toda la Ciudadela de Uyuni le rodea entre aplausos y felicitaciones por haber devuelto el aliento al planeta, cumpliendo la promesa que comenzó todo.' },
      { escenario: 'ultima_luz', texto: 'A millones de kilómetros, en el silencio helado de Europa, la pequeña luz del Rover parpadea por última vez apuntando a un diminuto punto azul: el hogar que ayudó a salvar.', segundos: 2.5 },
    ],
  },
};
