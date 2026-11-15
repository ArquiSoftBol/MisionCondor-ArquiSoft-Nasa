// «Modo escenario» para las pantallas de interfaz: en vez de un fondo plano, la pantalla ocurre DENTRO del mundo
// del juego (el Salar de noche, el hangar, el espacio) con su vida propia: estrellas fugaces, nubes, luces.
import Phaser from 'phaser';
import { W, H } from '../config';
import { Actor } from '../core/sprites';
import { degradado, estrellas, nebulosa } from './fondo';
import { piso, cordillera, nubes, DECORADOS } from './decorado';
import { fugaces, luna, horizonte, hangar, vineta, escarcha } from './ambiente';

/** Hojas que necesitan los fondos de interfaz (sumar en preload). */
export const HOJAS_ESCENARIO = [...DECORADOS, 'modulo_habitacional', 'invernadero', 'antena_espacio_profundo', 'torre_lanzamiento', 'tierra', 'luna', 'orion_completa'];

/** Salar de Uyuni (noche o día) con la base al fondo, reflejos y cielo vivo. */
export function fondoSalar(s: Phaser.Scene, o: { hora?: 'noche' | 'dia'; suelo?: number; base?: boolean } = {}): Phaser.GameObjects.Container {
  const hora = o.hora ?? 'noche', suelo = o.suelo ?? 320;
  const c = s.add.container(0, 0).setDepth(-50);
  c.add(hora === 'noche' ? degradado(s, 0x040716, 0x1d2a5c) : degradado(s, 0x3d86d8, 0xcfe8ff));
  if (hora === 'noche') { c.add(estrellas(s, 220, 41, suelo)); luna(s, W - 110, 74, c, 24); fugaces(s, c, 170); }
  else nubes(s, c, 5, 50, 170, 1.7);
  const tono = hora === 'noche' ? 0x5a6694 : 0xffffff;
  const refl = cordillera(s, suelo, c, { escala: 1.3, tinte: tono, reflejo: hora === 'noche' ? 0.3 : 0.22, semilla: 13 });
  if (o.base !== false) {
    [['torre_lanzamiento', 120, 1.3], ['modulo_habitacional', 760, 1.3], ['invernadero', 880, 1.1], ['antena_espacio_profundo', 40, 1.0]]
      .forEach(([id, x, e]) => { const a = new Actor(s, x as number, suelo + 6, id as string, { escala: e as number, dir: 1 }); a.base.setTint(hora === 'noche' ? 0x8a94c0 : 0xffffff); c.add(a); });
  }
  piso(s, 'suelo_sal', -20, suelo, W + 40, H - suelo + 20, c, 1, hora === 'noche' ? 0x4a5688 : 0xffffff);
  refl.forEach(r => c.add(r));
  horizonte(s, suelo, hora === 'noche' ? 0x5a6ad8 : 0xffffff, c, hora === 'noche' ? 0.5 : 0.3);
  vineta(s, hora === 'noche' ? 0.6 : 0.3, -40);
  return c;
}

/** Interior del Hangar de Ensamblaje (vigas, conos de luz, grúa, estanterías, piso de placas). */
export function fondoHangar(s: Phaser.Scene, suelo = 360): Phaser.GameObjects.Container {
  const c = s.add.container(0, 0).setDepth(-50);
  hangar(s, suelo, c);
  vineta(s, 0.5, -40);
  return c;
}

/** Espacio profundo: nebulosa, estrellas, la Tierra que gira lento y la nave Orión cruzando. */
export function fondoEspacio(s: Phaser.Scene, o: { tierra?: boolean; nave?: boolean } = {}): Phaser.GameObjects.Container {
  const c = s.add.container(0, 0).setDepth(-50);
  c.add(degradado(s, 0x02030a, 0x070a18));
  c.add(nebulosa(s, 'azul', 23).setAlpha(0.55));
  c.add(estrellas(s, 260, 17));
  if (o.tierra !== false) {
    const t = new Actor(s, W - 120, H - 70, 'tierra', { escala: 2.6, dir: 1 }).setAlpha(0.9);
    c.add(t);
    s.tweens.add({ targets: t, y: H - 80, duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
  if (o.nave !== false) {
    const n = new Actor(s, -80, 120, 'orion_completa', { escala: 0.9, dir: 2 });
    c.add(n);
    s.tweens.add({ targets: n, x: W + 100, y: 60, duration: 30000, repeat: -1 });
  }
  vineta(s, 0.55, -40);
  return c;
}

/** Europa: hielo con lineae, Júpiter enorme y escarcha. */
export function fondoEuropa(s: Phaser.Scene, suelo = 330): Phaser.GameObjects.Container {
  const c = s.add.container(0, 0).setDepth(-50);
  c.add(degradado(s, 0x02030a, 0x0c1424));
  c.add(estrellas(s, 200, 31, suelo));
  c.add(new Actor(s, W - 200, 150, 'jupiter', { escala: 3.2, dir: 1 }));
  piso(s, 'suelo_hielo', -20, suelo, W + 40, H - suelo + 20, c, 1, 0xb4c8d4);
  escarcha(s, c);
  vineta(s, 0.55, -40);
  return c;
}
