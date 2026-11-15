// Perfil del jugador y progreso. Se guarda en localStorage (si el navegador lo permite).

export type Orientacion = 'm' | 'f' | 'x';

export interface Perfil {
  nombre: string;
  orientacion: Orientacion;
  mascota: string;
  paso: number;            // índice en FLUJO (core/flujo.ts) alcanzado
  logros: string[];
  volumen: number;         // 0..1
  idioma?: 'es' | 'en';    // idioma del juego (core/idioma.ts)
  estrellas?: Record<string, number>;   // mejor resultado por misión (m1..m5): 1 a 3
  dificultad?: 'cadete' | 'ingenieria';   // Ajustes → Dificultad
  voz?: boolean;                      // narración por voz en las cinemáticas
  calidad?: 'alta' | 'baja';          // efectos de cine (color, grano, partículas grandes)
  /** versión del orden de la aventura con la que se guardó `paso` (2 = con la misión de Marte) */
  flujo?: number;
}

/** Guarda las estrellas de una misión (se queda con la mejor). Devuelve la mejor marca. */
export function ganarEstrellas(id: string, n: number): number {
  const e = (perfil.estrellas ??= {});
  e[id] = Math.max(e[id] ?? 0, Math.max(1, Math.min(3, n)));
  guardar();
  return e[id];
}

const CLAVE = 'mision-condor:perfil';

const nuevo = (): Perfil => ({ nombre: '', orientacion: 'm', mascota: '', paso: 0, logros: [], volumen: 0.7, flujo: 2 });

function leer(): Perfil {
  try {
    const t = localStorage.getItem(CLAVE);
    if (t) return { ...nuevo(), ...JSON.parse(t) };
  } catch { /* modo privado o almacenamiento bloqueado */ }
  return nuevo();
}

export const perfil: Perfil = leer();
// partidas guardadas antes de la misión de Marte: desde «Misión 5 · Rover en Europa» se corrieron 2 pasos
if ((perfil.flujo ?? 1) < 2) { if (perfil.paso >= 9) perfil.paso += 2; perfil.flujo = 2; }

export function guardar(): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(perfil)); } catch { /* sin guardado */ }
}

export function reiniciar(): void {
  Object.assign(perfil, nuevo(), { volumen: perfil.volumen, idioma: perfil.idioma, calidad: perfil.calidad, voz: perfil.voz, dificultad: perfil.dificultad });   // se borra el progreso, no las preferencias
  guardar();
}

export function lograr(id: string): void {
  if (!perfil.logros.includes(id)) { perfil.logros.push(id); guardar(); }
}

export const spriteProtagonista = (): string => `protagonista_${perfil.orientacion}`;
