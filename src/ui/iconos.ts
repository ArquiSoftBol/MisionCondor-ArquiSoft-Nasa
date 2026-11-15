// Íconos de interfaz propios (herramientas/moldes/iconos.js → public/sprites/hojas/iconos/).
// Reemplazan a los emojis del sistema: se ven iguales en todas las computadoras y combinan con el pixel art.
import Phaser from 'phaser';
import { Actor } from '../core/sprites';
import { FUENTE } from '../config';

/** ¿Este texto es el nombre de un ícono propio? */
export const esIcono = (s?: string): boolean => !!s && s.startsWith('ico_');

/**
 * Ícono centrado en (x, y) de unos `tam` px. El dibujo del molde mide ~32 px a escala 1.
 * Si la hoja no está cargada, deja un punto para no romper la interfaz.
 */
export function icono(s: Phaser.Scene, x: number, y: number, id: string, tam = 28): Phaser.GameObjects.Container | Phaser.GameObjects.Text {
  if (!s.textures.exists(id)) return s.add.text(x, y, '•', { fontFamily: FUENTE, fontSize: `${tam}px`, color: '#ffffff' }).setOrigin(0.5);
  return new Actor(s, x, y, id, { escala: tam / 32, dir: 0, brillo: 0.7 });
}
