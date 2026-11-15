// «Cómo se juega» del multijugador: la guía de TU rol en el escenario elegido (data/guias.ts → GUIAS_COOP).
// Se abre al empezar la misión, con el botón «?» durante la partida y desde la sala de espera.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL } from '../config';
import { t } from '../core/idioma';
import { GUIAS_COOP } from '../data/guias';
import { contenidoGuia, chipTema } from './guia';
import { boton, panel, fijarEnPantalla } from './boton';

const COLOR = { ingeniero: 0x3ff3ff, recolector: 0xffb33f } as const;
const NOMBRE = { ingeniero: 'Ingeniero', recolector: 'Recolector' } as const;

export type Rol = 'ingeniero' | 'recolector';

export function guiaCoop(s: Phaser.Scene, escenario: string, rol: Rol, o: { boton?: string; nombreEscenario?: string; alCerrar: () => void }): Phaser.GameObjects.Container {
  const g = GUIAS_COOP[escenario]?.[rol] ?? GUIAS_COOP.salar[rol];
  const color = COLOR[rol], hex = '#' + color.toString(16).padStart(6, '0');
  const c = s.add.container(0, 0).setScrollFactor(0).setDepth(99500);
  c.add(s.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0.8).setInteractive());   // bloquea lo de atrás
  c.add(panel(s, W / 2, H / 2 + 2, 880, 516, { color, abrir: false }));
  // quién eres y dónde
  c.add(s.add.text(W / 2, 28, `${t('TU ROL')}: ${t(NOMBRE[rol]).toUpperCase()}`, { fontFamily: FUENTE_PIXEL, fontSize: '12px', color: hex }).setOrigin(0.5));
  if (o.nombreEscenario) c.add(s.add.text(W / 2, 47, t(o.nombreEscenario), { fontFamily: FUENTE, fontSize: '12px', fontStyle: '700', color: '#9fb3d1' }).setOrigin(0.5));
  // la guía (mismo formato que las misiones del modo historia)
  const objs = contenidoGuia(s, g, 82);
  objs.forEach((ob, i) => { c.add(ob); ob.setAlpha(0); s.tweens.add({ targets: ob, alpha: 1, duration: 260, delay: 60 + i * 70 }); });
  c.add(chipTema(s, W / 2, 440, g.tema, color));
  c.add(s.add.text(W / 2, 466, t('★ Menos tiempo y menos errores = más estrellas. Hablen entre ustedes: solo juntos se termina.'), { fontFamily: FUENTE, fontSize: '12px', fontStyle: '700', color: '#ffe14d', align: 'center', wordWrap: { width: 780 } }).setOrigin(0.5));
  const cerrar = () => { c.destroy(); o.alCerrar(); };
  c.add(boton(s, W / 2, 504, o.boton ?? '¡A jugar!', cerrar, { ancho: 230, alto: 40, tam: 15, variante: 'exito', icono: '➜', retardo: 0 }));
  fijarEnPantalla(c);
  c.setAlpha(0);
  s.tweens.add({ targets: c, alpha: 1, duration: 220 });
  return c;
}
