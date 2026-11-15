// Contenido del ARCHIVO (escena Archivo): la historia documentada, quiénes somos y el reto de la NASA.
// ⚠ Lo que está entre [corchetes] lo completa el equipo ARQUISOFT.

export interface Capitulo {
  titulo: string;
  etapa: 'PRÓLOGO' | 'NUDO' | 'CLÍMAX' | 'EPÍLOGO';
  /** paso del FLUJO (core/flujo.ts) a partir del cual se desbloquea */
  desde: number;
  /** ids de sprites; «EVA:accion» = el protagonista con su traje según la orientación elegida */
  sprites: string[];
  texto: string;
}

export const CAPITULOS: Capitulo[] = [
  {
    titulo: 'El mundo sin aliento', etapa: 'PRÓLOGO', desde: 1, sprites: ['tierra', 'modulo_habitacional'],
    texto: 'Una anomalía atmosférica consume el oxígeno y congela los océanos. En el Salar de Uyuni resiste la última base: la Ciudadela de la Tierra. Allí vive {NOMBRE}, ingenier@ aeroespacial que eligió quedarse en la superficie.',
  },
  {
    titulo: 'Un hogar pequeño', etapa: 'PRÓLOGO', desde: 1, sprites: ['mascota_perro', 'rover_explorador', 'invernadero'],
    texto: 'Sin familia, su hogar son los pasillos de la base, el Invernadero, su mascota {MASCOTA} y el Rover explorador del Patio de Pruebas. Cada noche caminan sobre la sal bajo la Aurora.',
  },
  {
    titulo: 'Tres mundos en el cielo', etapa: 'PRÓLOGO', desde: 1, sprites: ['venus', 'marte', 'europa'],
    texto: 'Venus: el infierno de CO₂ que la Tierra podría llegar a ser. Marte: un desierto helado de tormentas de óxido. Y Europa, la luna de Júpiter, donde un océano escondido guarda un microorganismo capaz de restaurar nuestra atmósfera.',
  },
  {
    titulo: 'El presupuesto', etapa: 'NUDO', desde: 2, sprites: ['oficina_presupuesto', 'hangar_ensamblaje', 'deposito_combustible'],
    texto: 'Nadie más vendrá. En la Oficina de Presupuesto y el Hangar se calcula cada gramo de masa, cada vatio y cada gota de combustible. (Misión 1: los sistemas vitales de un vehículo.)',
  },
  {
    titulo: 'La promesa', etapa: 'NUDO', desde: 4, sprites: ['mascota_perro', 'torre_lanzamiento'],
    texto: '«Voy a traer aire limpio para ti, y te prometo que voy a volver». Luego: armar el cohete (Misión 2), armar Orión (Misión 3) y despegar (Misión 4).',
  },
  {
    titulo: 'El viaje', etapa: 'NUDO', desde: 8, sprites: ['marte_base_alfa', 'reabastecimiento', 'asteroide_metalico'],
    texto: 'Escala en Marte · Base Tari: la tormenta cubre de polvo los paneles y hay que repararlos con la Llave de torque. Reabastecimiento orbital, cinturón de asteroides y el cinturón magnético de Júpiter.',
  },
  {
    titulo: 'Atrapados en Europa', etapa: 'NUDO', desde: 10, sprites: ['criovolcan', 'EVA:oxigeno', 'rover_explorador'],
    texto: 'Un sismo criovolcánico daña los tanques y corta el enlace con la Tierra. −160 °C, radiación y poco oxígeno. El Rover, con su escudo, se vuelve el héroe: perfora, sella la cepa y trae hielo para el ISRU (Misión 5).',
  },
  {
    titulo: 'La ecuación del cohete', etapa: 'CLÍMAX', desde: 12, sprites: ['capsula_colibri', 'antena_portatil', 'rover_explorador'],
    texto: 'Con los 180 kg del Rover, el combustible fabricado no alcanza para escapar de Júpiter. {NOMBRE} lo deja como faro de telemetría, se despide en silencio y despega: 3, 2, 1...',
  },
  {
    titulo: 'El cielo azul', etapa: 'EPÍLOGO', desde: 13, sprites: ['capsula_colibri', 'mascota_perro', 'sol'],
    texto: 'La cápsula aterriza en el espejo de Uyuni, el Invernadero procesa la muestra y el cielo vuelve a ser azul. {MASCOTA} corre a sus brazos. En Europa, la luz del Rover parpadea por última vez hacia un punto azul.',
  },
];

export const ARQUISOFT = {
  lema: '[Lema del equipo]',
  quienes: 'ARQUISOFT es un equipo boliviano de desarrollo de software que participa en el NASA Space Apps Challenge 2026 con Misión Cóndor: un juego web para aprender cómo se diseña una misión espacial, contado desde el Salar de Uyuni.',
  mision: 'Hacer que la ciencia y la ingeniería espacial se sientan cercanas: que cualquier persona, con un celular y sin instalar nada, entienda por qué cada kilo, cada vatio y cada gota de combustible importan.',
  integrantes: [
    { nombre: '[Nombre 1]', rol: '[Rol · p. ej. Dirección y guion]' },
    { nombre: '[Nombre 2]', rol: '[Rol · p. ej. Programación]' },
    { nombre: '[Nombre 3]', rol: '[Rol · p. ej. Arte y sprites]' },
    { nombre: '[Nombre 4]', rol: '[Rol · p. ej. Ciencia y datos]' },
  ],
  sede: '[Ciudad · sede local del Space Apps]',
};

export const RETO = {
  evento: 'NASA Space Apps Challenge 2026',
  fechas: '14 y 15 de noviembre de 2026 · hackathon internacional de 48 horas',
  nombre: 'Space Mission Design Game',
  categoria: 'Tema: Juegos · nivel Intermedio · apto para principiantes y jóvenes',
  pide: 'Crear un juego en el que el jugador diseñe una misión espacial y aprenda las decisiones de ingeniería que hay detrás: masa, energía, propulsión, comunicaciones y los riesgos del entorno espacial.',
  respuesta: [
    'Misión 1 · Sistemas vitales → energía, control, comunicación y propulsión.',
    'Misiones 2 y 3 · Cohete y Orión → orden de montaje y función de cada pieza.',
    'Misión 4 · Despegue → etapas y por qué se separan (masa muerta).',
    'Misión 5 · Base Tari → tormentas de polvo: sin luz, los paneles solares no dan energía.',
    'Misión 6 · Europa → ISRU: fabricar oxígeno y combustible con hielo.',
    'Clímax → la ecuación del cohete: dejar masa atrás para volver.',
  ],
  datos: 'Datos reales de Venus, Marte, Europa y Júpiter, y tiempos reales de un despegue tipo SLS (propulsores ~2 min, etapa central ~8 min). Sin logos de la NASA: nombres y diseños propios.',
};
