// Las misiones (minijuegos) del modo historia, en orden. Única fuente para numerarlas y contar estrellas.
// La clave es la que usan ganarEstrellas()/lograr(); se conservan las de siempre para no perder progresos guardados.
export const MISIONES: { clave: string; escena: string }[] = [
  { clave: 'm1', escena: 'Mision1Sistemas' },
  { clave: 'm2', escena: 'Mision2Cohete' },
  { clave: 'm3', escena: 'Mision3Orion' },
  { clave: 'm4', escena: 'Mision4Despegue' },
  { clave: 'marte', escena: 'MisionMarte' },   // Base Tari: tormenta de óxido (Guía Maestra, fase 3)
  { clave: 'm5', escena: 'Mision5Rover' },     // Europa (ahora es la misión 6)
];
export const TOTAL_MISIONES = MISIONES.length;
export const esMision = (escena: string): boolean => MISIONES.some(m => m.escena === escena);
