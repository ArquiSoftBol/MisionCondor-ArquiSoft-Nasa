// Orden de la aventura: una sola fuente de verdad. Cada escena termina con siguiente(this).
import Phaser from 'phaser';
import { perfil, guardar } from './estado';

export interface Paso { escena: string; datos?: Record<string, unknown>; titulo: string }

export const FLUJO: Paso[] = [
  { escena: 'Registro', titulo: 'Registro' },
  { escena: 'Cinematica', datos: { bloque: 'prologo' }, titulo: 'Prólogo' },
  { escena: 'Cinematica', datos: { bloque: 'nudo1' }, titulo: 'El presupuesto' },
  { escena: 'Mision1Sistemas', titulo: 'Misión 1 · Sistemas vitales' },
  { escena: 'Cinematica', datos: { bloque: 'nudo2' }, titulo: 'La promesa' },
  { escena: 'Mision2Cohete', titulo: 'Misión 2 · El cohete' },
  { escena: 'Mision3Orion', titulo: 'Misión 3 · La nave Orión' },
  { escena: 'Mision4Despegue', titulo: 'Misión 4 · Despegue' },
  { escena: 'Cinematica', datos: { bloque: 'nudo3' }, titulo: 'El viaje' },
  { escena: 'MisionMarte', titulo: 'Misión 5 · Tormenta en Base Tari' },
  { escena: 'Cinematica', datos: { bloque: 'nudo3b' }, titulo: 'Rumbo a Europa' },
  { escena: 'Mision5Rover', titulo: 'Misión 6 · Rover en Europa' },
  { escena: 'Cinematica', datos: { bloque: 'climax' }, titulo: 'Clímax' },
  { escena: 'Cinematica', datos: { bloque: 'epilogo' }, titulo: 'Epílogo' },
  { escena: 'Fin', titulo: 'Fin' },
];

/** Fundido a negro y arranca la escena del paso indicado. */
export function irAPaso(scene: Phaser.Scene, i: number): void {
  const p = FLUJO[Math.max(0, Math.min(FLUJO.length - 1, i))];
  perfil.paso = FLUJO.indexOf(p);
  guardar();
  scene.cameras.main.fadeOut(400, 0, 0, 0);
  // entre partes de la historia pasa por la pantalla de ruta (Capitulo): dónde estás y qué viene
  const conRuta = p.escena !== 'Registro' && scene.scene.key !== 'Capitulo';
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => conRuta ? scene.scene.start('Capitulo', { i: perfil.paso }) : scene.scene.start(p.escena, p.datos ?? {}));
}

/** Paso siguiente a la escena actual (no al número guardado, que puede quedar desfasado y saltar o cortar la historia). */
export function siguiente(scene: Phaser.Scene): void {
  const bloque = (scene as unknown as { nombreBloque?: string }).nombreBloque;
  const coincide = (p: Paso) => p.escena === scene.scene.key && (p.datos?.bloque === undefined || p.datos.bloque === bloque);
  const desdeGuardado = FLUJO[perfil.paso];
  const aqui = desdeGuardado && coincide(desdeGuardado) ? perfil.paso : FLUJO.findIndex(coincide);
  irAPaso(scene, (aqui >= 0 ? aqui : perfil.paso) + 1);
}

/** Desde el título: continuar donde quedó (o empezar el registro). */
export function continuar(scene: Phaser.Scene): void {
  irAPaso(scene, perfil.nombre ? Math.max(1, perfil.paso) : 0);
}
