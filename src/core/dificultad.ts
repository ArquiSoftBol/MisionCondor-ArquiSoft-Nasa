// Dificultad: Cadete (para aprender, con más margen) o Ingeniería (presupuestos y tiempos más estrictos).
// Se cambia en Ajustes. Cada misión pide sus números con segun(cadete, ingenieria).
import { perfil } from './estado';

export type Dificultad = 'cadete' | 'ingenieria';
export const dificultad = (): Dificultad => (perfil.dificultad === 'ingenieria' ? 'ingenieria' : 'cadete');
export const segun = <T>(cadete: T, ingenieria: T): T => (dificultad() === 'ingenieria' ? ingenieria : cadete);
export const nombreDificultad = (): string => (dificultad() === 'ingenieria' ? 'MODO INGENIERÍA' : 'MODO CADETE');
