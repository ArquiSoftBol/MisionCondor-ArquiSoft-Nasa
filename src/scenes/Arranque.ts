// Lee atlas.json, espera las fuentes y pasa a las recomendaciones.
import Phaser from 'phaser';
import { W, H, FUENTE } from '../config';
import { fijarAtlas, cargarIconos, type Atlas } from '../core/sprites';

export class Arranque extends Phaser.Scene {
  constructor() { super('Arranque'); }

  preload(): void {
    const barra = this.add.rectangle(W / 2 - 150, H / 2, 0, 6, 0xffe14d).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2, 300, 6).setStrokeStyle(1, 0x555555);
    this.load.on('progress', (p: number) => barra.setSize(300 * p, 6));
    this.load.json('atlas', 'sprites/atlas.json');
  }

  async create(): Promise<void> {
    fijarAtlas(this.cache.json.get('atlas') as Atlas);
    // íconos de interfaz hechos con nuestro editor de moldes (en vez de emojis del sistema)
    await new Promise<void>(r => { cargarIconos(this); this.load.once('complete', () => r()); this.load.start(); if (!this.load.isLoading()) r(); });
    this.add.text(W / 2, H / 2 + 30, 'cargando…', { fontFamily: FUENTE, fontSize: '14px', color: '#777' }).setOrigin(0.5);
    try {
      await Promise.race([
        Promise.all(['16px "Press Start 2P"', '700 16px "Open Sans"', 'italic 700 16px "Open Sans"', '800 16px "Open Sans"'].map(f => document.fonts.load(f))),
        new Promise(r => setTimeout(r, 2500)),
      ]);
    } catch { /* sin fuentes: se usa la del sistema */ }
    const salto = new URLSearchParams(location.search).get('escena');   // ?escena=Mision2Cohete para probar
    if (salto) this.scene.start(salto, { bloque: new URLSearchParams(location.search).get('bloque') ?? undefined });
    else this.scene.start('Recomendaciones');
  }
}
