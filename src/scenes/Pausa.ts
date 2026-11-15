// Menú de pausa: se abre encima de la misión (que queda congelada detrás). Continuar · Reiniciar misión · Volver al inicio.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL } from '../config';
import { boton, panel } from '../ui/boton';
import { icono } from '../ui/iconos';
import { perfil, guardar } from '../core/estado';
import { Sonido } from '../core/audio';
import { Musica } from '../core/musica';
import { selectorIdioma } from '../ui/selectorIdioma';
import { retraducir } from '../core/idioma';
import { guiaDe } from '../data/guias';
import { contenidoGuia } from '../ui/guia';
import { cascada } from '../ui/boton';

export class Pausa extends Phaser.Scene {
  private destino = '';
  private soloGuia = false;
  constructor() { super('Pausa'); }

  init(d: { escena: string; guia?: boolean }): void { this.destino = d.escena; this.soloGuia = !!d.guia; }

  create(): void {
    Musica.atenuar(true);
    this.events.once('shutdown', () => Musica.atenuar(false));
    const velo = this.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0).setInteractive();
    this.tweens.add({ targets: velo, fillAlpha: 0.65, duration: 220 });
    this.input.keyboard?.on('keydown-ESC', (e: KeyboardEvent) => { if (!e.repeat) this.seguir(); });
    this.input.keyboard?.on('keydown-P', (e: KeyboardEvent) => { if (!e.repeat) this.seguir(); });
    if (this.soloGuia) { this.verGuia(true); return; }
    const guia = guiaDe(this.destino);
    const alto = guia ? 440 : 380;
    panel(this, W / 2, H / 2, 420, alto, { titulo: 'PAUSA', color: 0x3ff3ff });
    this.add.text(W / 2, H / 2 - alto / 2 + 40, 'EN PAUSA', { fontFamily: FUENTE_PIXEL, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
    if (guia) boton(this, W / 2, H / 2 - 110, 'Cómo se juega', () => this.scene.restart({ escena: this.destino, guia: true }), { ancho: 280, variante: 'primario', icono: '?', retardo: 60 });
    const off = guia ? 32 : 0;
    const vol = this.add.text(W / 2, H / 2 + alto / 2 - 50, '', { fontFamily: FUENTE, fontSize: '14px', fontStyle: '800', color: '#9fdcff' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const icVol = icono(this, 0, vol.y, 'ico_volumen', 20);
    const pintarVol = () => { vol.setText(`Volumen ${Math.round(perfil.volumen * 100)} %  (toca para cambiar)`); icVol.setX(W / 2 - vol.width / 2 - 16); icVol.setAlpha(perfil.volumen > 0 ? 1 : 0.4); };
    pintarVol();
    vol.on('pointerdown', () => { perfil.volumen = perfil.volumen >= 1 ? 0 : Math.min(1, Math.round((perfil.volumen + 0.35) * 100) / 100); guardar(); Sonido.bien(); Musica.volumen(); Musica.atenuar(true); pintarVol(); });

    boton(this, W / 2, H / 2 - 70 + off, 'Continuar', () => this.seguir(), { ancho: 280, variante: 'exito', icono: '▶', retardo: 60 });
    boton(this, W / 2, H / 2 + 2 + off, 'Reiniciar misión', () => this.cerrarY(() => this.scene.get(this.destino).scene.restart()), { ancho: 280, variante: 'aviso', icono: '↻', retardo: 130 });
    boton(this, W / 2, H / 2 + 74 + off, 'Volver al inicio', () => this.cerrarY(() => { this.scene.stop(this.destino); this.scene.start('Titulo'); }), { ancho: 280, variante: 'peligro', icono: '⌂', retardo: 200 });
    // cambiar idioma en pausa: se re-traduce la misión congelada detrás y se redibuja este menú
    selectorIdioma(this, W / 2 + 140, H / 2 - alto / 2 + 20, () => { retraducir(this.scene.get(this.destino)); this.scene.restart({ escena: this.destino }); });
  }

  /** «Cómo se juega» de la misión en pausa (desde el botón «?» o desde el menú). */
  private verGuia(directo: boolean): void {
    const guia = guiaDe(this.destino);
    if (!guia) { this.seguir(); return; }
    panel(this, W / 2, H / 2 + 6, 760, 452, { titulo: 'GUÍA DE LA MISIÓN', color: 0x3ff3ff, alfa: 0.97 });
    const objs = contenidoGuia(this, guia, 82);
    cascada(this, objs, 120, 70);
    boton(this, W / 2 + (directo ? 0 : 130), 456, 'Volver al juego', () => this.seguir(), { ancho: 250, variante: 'exito', icono: '▶', retardo: 300 });
    if (!directo) boton(this, W / 2 - 150, 456, 'Menú', () => this.scene.restart({ escena: this.destino }), { ancho: 150, alto: 42, variante: 'fantasma', icono: '‹', tam: 16, retardo: 300 });
  }

  private seguir(): void { this.cerrarY(() => this.scene.resume(this.destino)); }

  private cerrarY(fn: () => void): void {
    this.input.enabled = false;
    fn();
    this.scene.stop();
  }
}

/** Botón ⏸ arriba a la derecha + teclas Esc / P. Llamar al final de create() de cada misión. */
export function instalarPausa(scene: Phaser.Scene): void {
  Musica.paraEscena(scene.scene.key);   // cada misión pone su música (también lo hace el gancho global)
  const abrir = () => {
    if (scene.scene.isPaused() || !scene.scene.isActive()) return;
    Sonido.click();
    scene.scene.pause();
    scene.scene.launch('Pausa', { escena: scene.scene.key });
  };
  const b = scene.add.container(W - 34, 30).setDepth(9800).setScrollFactor(0, 0, true);
  const g = scene.add.graphics().fillStyle(0x040914, 0.8).fillRoundedRect(-20, -20, 40, 40, 10).lineStyle(2, 0x3ff3ff, 0.8).strokeRoundedRect(-20, -20, 40, 40, 10);
  g.fillStyle(0xffffff).fillRect(-7, -9, 5, 18).fillRect(2, -9, 5, 18);
  b.add(g).setSize(44, 44).setInteractive({ useHandCursor: true });
  b.on('pointerover', () => scene.tweens.add({ targets: b, scale: 1.12, duration: 100 }));
  b.on('pointerout', () => scene.tweens.add({ targets: b, scale: 1, duration: 100 }));
  b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); abrir(); });
  scene.input.keyboard?.on('keydown-ESC', (e: KeyboardEvent) => { if (!e.repeat) abrir(); });
  scene.input.keyboard?.on('keydown-P', (e: KeyboardEvent) => { if (!e.repeat) abrir(); });

  // «?»: la guía de la misión, siempre a mano (también con la tecla H)
  if (!guiaDe(scene.scene.key)) return;
  const verGuia = () => {
    if (scene.scene.isPaused() || !scene.scene.isActive()) return;
    Sonido.click();
    scene.scene.pause();
    scene.scene.launch('Pausa', { escena: scene.scene.key, guia: true });
  };
  const q = scene.add.container(W - 84, 30).setDepth(9800).setScrollFactor(0, 0, true);
  const gq = scene.add.graphics().fillStyle(0x040914, 0.8).fillRoundedRect(-20, -20, 40, 40, 10).lineStyle(2, 0xffe14d, 0.85).strokeRoundedRect(-20, -20, 40, 40, 10);
  const tq = scene.add.text(0, 1, '?', { fontFamily: FUENTE, fontSize: '22px', fontStyle: '800', color: '#ffe14d' }).setOrigin(0.5);
  q.add([gq, tq]).setSize(44, 44).setInteractive({ useHandCursor: true });
  q.on('pointerover', () => scene.tweens.add({ targets: q, scale: 1.12, duration: 100 }));
  q.on('pointerout', () => scene.tweens.add({ targets: q, scale: 1, duration: 100 }));
  q.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); verGuia(); });
  scene.input.keyboard?.on('keydown-H', (e: KeyboardEvent) => { if (!e.repeat) verGuia(); });
}
