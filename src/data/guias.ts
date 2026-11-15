// Guías de cada misión: QUÉ se aprende (tema), PARA QUÉ (objetivo), CÓMO se juega (pasos) y con qué teclas.
// Se muestran en la tarjeta de inicio (2.ª página «Cómo se juega»), en el botón «?» y en el menú de pausa.
// La clave es la escena de la misión. Los textos se traducen con t() (ver data/en.ts, bloque «Guías»).

export interface Guia {
  /** Tema científico que trabaja la misión. */
  tema: string;
  /** Una idea clave del tema, en una línea. */
  idea: string;
  /** Qué hay que lograr para ganar. */
  objetivo: string;
  /** Pasos: [ícono propio (ico_…, ver ui/iconos.ts), texto]. Entre 3 y 4. */
  pasos: [string, string][];
  /** Controles en una línea (teclado y ratón). */
  controles: string;
  /** Los mismos controles para celular / tableta. */
  tactil?: string;
}

export const GUIAS: Record<string, Guia> = {
  Mision1Sistemas: {
    tema: 'Sistemas de una nave espacial',
    idea: 'Toda nave necesita energía, control, comunicación y propulsión.',
    objetivo: 'Instala los 4 sistemas del módulo sin pasar de 900 kg.',
    pasos: [
      ['ico_tocar', 'Toca una pieza del hangar: se lleva al módulo y el escáner la revisa.'],
      ['ico_masa', 'Mira la barra de masa: el módulo no puede pasar de 900 kg.'],
      ['ico_sol', 'En Júpiter llega solo el 4 % de la luz del Sol: elige una energía que alcance.'],
      ['ico_deshacer', '¿Te equivocaste? Toca la etiqueta del sistema para retirarlo.'],
    ],
    controles: 'Ratón o dedo: tocar  ·  Esc: pausa',
    tactil: 'Dedo: tocar  ·  ⏸: pausa',
  },
  Mision2Cohete: {
    tema: 'Cohetes por etapas',
    idea: 'Un cohete se arma de abajo hacia arriba y suelta lo que ya no usa.',
    objetivo: 'Arma el cohete en orden y conecta sus líneas de combustible.',
    pasos: [
      ['ico_engranaje', 'Toca la pieza que va primero: el dron BIT-7 la lleva a su lugar.'],
      ['ico_pista', 'Si no es la que sigue, una pista te explica por qué.'],
      ['ico_soltar', 'Con viento, la pieza se balancea: suéltala sobre la línea verde.'],
      ['ico_tubos', 'Prueba final: gira los tubos hasta unir el tanque con los motores.'],
    ],
    controles: 'Ratón o dedo: tocar  ·  Espacio: soltar la pieza  ·  Esc: pausa',
    tactil: 'Dedo: tocar  ·  ⏸: pausa',
  },
  Mision3Orion: {
    tema: 'Naves para tripulación',
    idea: 'La cápsula protege a la tripulación del calor, el vacío y los accidentes.',
    objetivo: 'Arma la nave Orión en orden y sella las fugas de la cabina.',
    pasos: [
      ['ico_engranaje', 'Toca la pieza que va primero: BIT-7 la lleva a su lugar.'],
      ['ico_escudo', 'Piensa hacia dónde mira el escudo térmico: recibe el calor al volver.'],
      ['ico_soltar', 'Suelta cada pieza cuando pase sobre la línea verde.'],
      ['ico_objetivo', 'Prueba de vacío: toca las fugas antes de que caiga la presión.'],
    ],
    controles: 'Ratón o dedo: tocar  ·  Espacio: soltar la pieza  ·  Esc: pausa',
    tactil: 'Dedo: tocar  ·  ⏸: pausa',
  },
  Mision4Despegue: {
    tema: 'Despegue y separación de etapas',
    idea: 'En Max-Q el aire empuja más fuerte: hay que bajar la potencia.',
    objetivo: 'Llega a la órbita sin dañar el cohete y separando cada etapa a tiempo.',
    pasos: [
      ['ico_subir', 'Acelera a fondo con ▲ para subir.'],
      ['ico_bajar', 'Cuando aparezca MAX-Q, baja el acelerador con ▼.'],
      ['ico_combustible', 'Si la barra de combustible de una etapa se vacía, sepárala ya.'],
      ['ico_estrella', 'Separar justo a tiempo da las 3 estrellas.'],
    ],
    controles: '▲ / ▼ o W / S: acelerador  ·  Espacio o botón: separar  ·  Esc: pausa',
    tactil: 'Botones ▲ / ▼: acelerador  ·  Botón: separar  ·  ⏸: pausa',
  },
  MisionMarte: {
    tema: 'Tormentas de polvo en Marte',
    idea: 'El polvo marciano tapa los paneles solares: sin luz no hay energía.',
    objetivo: 'Rescata al Rover y vuelve con él a la nave antes de que la tormenta los sepulte.',
    pasos: [
      ['ico_ruta', 'Cuando estalle la tormenta, sigue la flecha hasta el Rover.'],
      ['ico_engranaje', 'Mantén USAR junto al Rover para limpiar sus paneles.'],
      ['ico_alerta', 'Esquiva los remolinos de polvo: te empujan y frenan la limpieza.'],
      ['ico_fuego', 'Vuelve a la nave con el Rover: ¡ignición de escape!'],
    ],
    controles: 'Flechas / WASD o dedo: caminar  ·  E / Espacio (mantener): usar  ·  Esc: pausa',
    tactil: 'Palanca o dedo: caminar  ·  USAR (mantener): usar  ·  ⏸: pausa',
  },
  Mision5Rover: {
    tema: 'Exploración de Europa y recursos locales (ISRU)',
    idea: 'Con el hielo de Europa se puede fabricar oxígeno y combustible.',
    objetivo: 'Sella la cepa en el contenedor y lleva 3 bloques de hielo al electrolizador.',
    pasos: [
      ['ico_ruta', 'Sigue la flecha: te lleva al objetivo que toca.'],
      ['ico_taladro', 'Perfora la grieta con USAR; si la broca se calienta, suéltalo un momento.'],
      ['ico_escanear', 'Pulsa ESCANEAR (o Q) para encontrar el hielo escondido.'],
      ['ico_bateria', 'Vuelve a la nave para cargar batería; evita los géiseres.'],
    ],
    controles: 'Flechas / WASD o dedo: manejar  ·  E / Espacio: usar  ·  Q: escanear  ·  Esc: pausa',
    tactil: 'Palanca o dedo: manejar  ·  USAR: usar  ·  ESCANEAR: escanear  ·  ⏸: pausa',
  },
};

/** Guía de una escena (si tiene). */
export const guiaDe = (escena: string): Guia | undefined => GUIAS[escena];

// ───────── Multijugador «Turno de noche»: una guía por escenario y por rol ─────────
const CTRL_ING = 'WASD / flechas: moverse  ·  E: abrir la mesa  ·  Ratón: elegir, pedir y MONTAR';
const TAC_ING = 'Palanca: moverse  ·  USAR: abrir la mesa  ·  Toca las piezas para elegir y pedir';
const CTRL_REC = 'WASD / flechas: moverse  ·  E: tomar y entregar piezas';
const TAC_REC = 'Palanca o dedo: moverse  ·  USAR: tomar y entregar piezas';

export const GUIAS_COOP: Record<string, Record<'ingeniero' | 'recolector', Guia>> = {
  salar: {
    ingeniero: {
      tema: 'Sistemas de una nave espacial',
      objetivo: 'Arma el módulo para Europa: energía, control, comunicación y propulsión, sin pasar de 900 kg.',
      pasos: [
        ['ico_objetivo', 'Ve a tu mesa del hangar (círculo cian) y ábrela con USAR.'],
        ['ico_equipo', 'En «Pedir al Recolector» toca la pieza que falta: a tu compañero le brilla dorada.'],
        ['ico_engranaje', 'Cuando llegue a la mesa, elígela y pulsa MONTAR con la aguja en la zona verde.'],
        ['ico_sol', 'En Europa el Sol casi no llega: el panel solar no sirve, usa el RTG. Lo que no sirva, Devuélvelo.'],
      ],
      controles: CTRL_ING, tactil: TAC_ING,
      idea: 'Lejos del Sol, las naves usan generadores nucleares (RTG) en vez de paneles solares.',
    },
    recolector: {
      tema: 'Sistemas de una nave espacial',
      objetivo: 'Encuentra las piezas en la Ciudadela y llévalas a la plataforma naranja del hangar.',
      pasos: [
        ['ico_ruta', 'Sigue la flecha y los faros: cada faro marca un edificio con una pieza.'],
        ['ico_pista', 'Si una pieza brilla dorada, el Ingeniero la pidió: tráela primero.'],
        ['ico_masa', 'Tu carro tiene 2 espacios: las piezas de 150 kg o más ocupan los dos.'],
        ['ico_soltar', 'Párate en la plataforma naranja del hangar y pulsa USAR para entregar.'],
      ],
      controles: CTRL_REC, tactil: TAC_REC,
      idea: 'Cada kilo cuenta: una nave más pesada necesita mucho más combustible.',
    },
  },
  cohete: {
    ingeniero: {
      tema: 'Cohetes por etapas',
      objetivo: 'Monta el cohete en orden: etapa central, los dos propulsores y, arriba, la etapa superior.',
      pasos: [
        ['ico_objetivo', 'Tu mesa está junto a la torre de lanzamiento: ábrela con USAR.'],
        ['ico_equipo', 'Pide la pieza que sigue en el orden: a tu compañero le brilla dorada.'],
        ['ico_engranaje', 'Elige la pieza y pulsa MONTAR con la aguja en la zona verde.'],
        ['ico_pista', 'Si no es la que sigue, una pista te dice cuál va. El tanque de repuesto no va: Devuélvelo.'],
      ],
      controles: CTRL_ING, tactil: TAC_ING,
      idea: 'Un cohete se arma de abajo hacia arriba: primero la etapa que más empuja.',
    },
    recolector: {
      tema: 'Cohetes por etapas',
      objetivo: 'Trae las etapas del cohete desde toda la Ciudadela hasta la plataforma junto a la torre.',
      pasos: [
        ['ico_ruta', 'Las etapas están repartidas por la Ciudadela: sigue la flecha y los faros.'],
        ['ico_pista', 'Trae primero la pieza dorada: es la que el Ingeniero puede montar ya.'],
        ['ico_masa', 'Cada etapa es muy pesada: el carro lleva solo una por viaje.'],
        ['ico_soltar', 'Déjala en la plataforma naranja junto a la torre con USAR.'],
      ],
      controles: CTRL_REC, tactil: TAC_REC,
      idea: 'Los propulsores laterales dan el empujón inicial y después se sueltan para aligerar el cohete.',
    },
  },
};
