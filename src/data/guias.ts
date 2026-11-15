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
  /** Controles en una línea. */
  controles: string;
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
  },
  Mision5Rover: {
    tema: 'Exploración de Europa y recursos locales (ISRU)',
    idea: 'Con el hielo de Europa se puede fabricar oxígeno y combustible.',
    objetivo: 'Sella la cepa en el contenedor y lleva 3 bloques de hielo al electrolizador.',
    pasos: [
      ['ico_ruta', 'Sigue la flecha: te lleva al objetivo que toca.'],
      ['ico_taladro', 'Perfora la grieta con USAR; si la broca se calienta, suéltalo un momento.'],
      ['ico_escanear', 'Escanea con Q para encontrar el hielo escondido.'],
      ['ico_bateria', 'Vuelve a la nave para cargar batería; evita los géiseres.'],
    ],
    controles: 'Flechas / WASD o dedo: manejar  ·  E / Espacio: usar  ·  Q: escanear  ·  Esc: pausa',
  },
};

/** Guía de una escena (si tiene). */
export const guiaDe = (escena: string): Guia | undefined => GUIAS[escena];
