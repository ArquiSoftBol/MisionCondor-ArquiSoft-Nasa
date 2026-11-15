// Cinemáticas de Misión Cóndor (versión 2): la imagen cuenta EXACTAMENTE lo que dice el texto.
//  · Planos de cámara por cuadro (general → medio → primer plano) con personajes grandes y sombra.
//  · Sincronía: `cue('palabra', fn)` dispara una acción en el instante en que la narración escribe esa palabra;
//    `senal('palabra', objeto, 'Etiqueta')` además lo señala con una etiqueta holográfica.
//  · Interactivo: todo lo señalado se puede tocar para ver su dato (tocar fuera = seguir).
//  · Capa de primer término con paralaje y rótulos de lugar tipo cine.
// Espacio / Enter / clic: adelantar · Esc: saltar el bloque · F: pantalla completa.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { HISTORIA, type Bloque, type Cuadro } from '../data/historia';
import { personalizar } from '../core/texto';
import { t, t as rotular, numero } from '../core/idioma';
import { Voz } from '../core/voz';
import { Actor, cargar } from '../core/sprites';
import { spriteProtagonista, perfil } from '../core/estado';
import { siguiente } from '../core/flujo';
import { Sonido } from '../core/audio';
import { Musica, MOMENTOS } from '../core/musica';
import { degradado, estrellas, nebulosa } from '../ui/fondo';
import { panel, botonSaltar } from '../ui/boton';
import { confeti } from '../ui/tarjeta';
import { vineta, fugaces, luna, horizonte, polvo, escarcha, chispas, hangar } from '../ui/ambiente';
import { DECORADOS, piso, cordillera, utileria, nubes } from '../ui/decorado';
import { colorear, grano, Telon, aurora, rayos, calidadAlta, type Look, type Transicion } from '../ui/cine';
import { esTactil } from '../ui/palanca';

// Color de cada cuadro (por acto) y transición con la que se ENTRA a cada cuadro.
const LOOK: Record<string, Look> = {
  tierra_enferma: 'frio', salar_base: 'frio', protagonista: 'frio', hogar: 'frio', mascota_rover: 'frio', caminata_aurora: 'frio',
  venus: 'fuego', marte: 'oxido', jupiter_europa: 'espacio', antena_cepa: 'frio',
  oficina: 'calido', hangar_calculo: 'calido', promesa: 'calido', promesa_cerca: 'calido',
  viaje: 'espacio', reabastecimiento: 'espacio', asteroides: 'espacio',
  descenso_europa: 'europa', sismo: 'europa', atrapados: 'europa', rover_heroe: 'europa', escudo: 'europa',
  computadora: 'climax', ecuacion: 'climax', dejar_masa: 'climax', despedida: 'climax', faro: 'climax', cuenta: 'climax',
  despegue_colibri: 'fuego', travesia: 'espacio', reentrada: 'fuego', cielo_azul: 'dorado', reencuentro: 'dorado', ultima_luz: 'europa',
};
const TRANS: Record<string, Transicion> = {
  salar_base: 'iris', venus: 'iris', marte: 'iris', jupiter_europa: 'iris', antena_cepa: 'barrido', promesa_cerca: 'iris',
  viaje: 'blanco',  asteroides: 'barrido', sismo: 'blanco', rover_heroe: 'barrido',
  ecuacion: 'barrido', despedida: 'iris', despegue_colibri: 'blanco', travesia: 'barrido', reentrada: 'blanco', cielo_azul: 'blanco',
  reencuentro: 'barrido', ultima_luz: 'iris',
};

const VEL_TEXTO = 34;      // letras por segundo
const PAUSA = 3;           // segundos con el texto completo
const SUELO = 290;         // horizonte
const PISO = 402;          // línea de pies del primer plano
const CY = 235;            // centro vertical de la zona visible (entre las barras de cine)

interface Punto { x: number; y: number }
interface Encuadre { x: number; y: number; z: number }
interface Marca { ref: Punto; alto: number; etiqueta: string; dato?: string; color: number; chip?: Phaser.GameObjects.Container }
type Armar = (s: Cinematica) => void;
interface Escenario { sp: string[] | (() => string[]); armar: Armar }

const prota = () => spriteProtagonista();
/** Científicos, técnicos y tripulantes de la Ciudadela (la ovación del final). */
const GENTE = ['cientifico_mision', 'ingeniero_sistemas', 'tripulante_vuelo'];
/** Pose del protagonista para las cinemáticas: mira (al cielo) · senala · abraza. */
const pose = (p: 'mira' | 'senala' | 'abraza') => `${spriteProtagonista()}_${p}`;
/** El protagonista con su traje EVA (según la orientación): camina, saluda, repara, arrodillado, oxigeno, escarcha, radiacion. */
const eva = (accion: string) => `eva_${perfil.orientacion}_${accion}`;
const NOMBRE = () => personalizar('{NOMBRE}');
const MASCOTA = () => personalizar('{MASCOTA}');
const altoDe = (a: Actor) => a.base.height * a.base.originY * Math.abs(a.scaleY) * 0.8;

// ═════════════════════════ Fondos ═════════════════════════
const espacio = (s: Cinematica, pal: 'carina' | 'azul' | 'rosa' = 'azul') => {
  s.capa.add(degradado(s, 0x02030a, 0x070a18));
  s.capa.add(nebulosa(s, pal).setAlpha(0.7));
  s.capa.add(estrellas(s, 260, 11));
};

/** Salar de Uyuni con cordillera, costra de sal y espejo. */
const salar = (s: Cinematica, hora: 'noche' | 'dia' | 'gris') => {
  const cielo = { noche: [0x050818, 0x1b2550], dia: [0x2f7fe0, 0xbfe3ff], gris: [0x5a5f6a, 0x9aa0a8] }[hora];
  s.capa.add(degradado(s, cielo[0], cielo[1]));
  if (hora === 'noche') { s.capa.add(estrellas(s, 220, 21, 300)); luna(s, 120, 72, s.capa); }
  const tono = { noche: 0x5a6694, dia: 0xffffff, gris: 0xb4b9c4 }[hora];
  const reflejos = cordillera(s, SUELO, s.capa, { escala: 1.3, tinte: tono, reflejo: hora === 'noche' ? 0.3 : 0.22, semilla: 5 });
  piso(s, 'suelo_sal', -160, SUELO, W + 320, H - SUELO + 120, s.capa, 1, { noche: 0x4a5688, dia: 0xffffff, gris: 0xbfc4cc }[hora]);
  reflejos.forEach(r => s.capa.add(r));
  horizonte(s, SUELO, hora === 'noche' ? 0x5a6ad8 : 0xffffff, s.capa, hora === 'noche' ? 0.5 : 0.35);
  if (hora === 'noche') fugaces(s, s.capa, 180);
  s.espejo = true;
  primerTermino(s, 'cactus_gigante', hora === 'noche' ? 0x101630 : 0x3a5a40, [[-60, 470, 2.4], [1010, 480, 2]]);
};

/** Llanura helada de Europa con Júpiter enorme en el cielo. */
const hielo = (s: Cinematica, jupiter = true) => {
  s.capa.add(degradado(s, 0x02030a, 0x0c1424));
  s.capa.add(estrellas(s, 200, 31, 260));
  if (jupiter) s.capa.add(new Actor(s, 770, 128, 'jupiter', { escala: 3.2, dir: 1 }));
  utileria(s, 'penitentes', s.capa, [[60, SUELO + 6, 1.1], [250, SUELO + 2, 0.8], [600, SUELO + 4, 0.9], [900, SUELO + 6, 1.2]], 1, 0x8fb0c8);
  piso(s, 'suelo_hielo', -160, SUELO, W + 320, H - SUELO + 120, s.capa, 1, 0xb4c8d4);
  horizonte(s, SUELO, 0xe8c79a, s.capa, 0.3);
  escarcha(s, s.capa);
  primerTermino(s, 'penitentes', 0x0a1420, [[-30, 500, 2.6], [1000, 510, 2.8]]);
};


const interior = (s: Cinematica) => { hangar(s, 330, s.capa); chispas(s, 880, 300, s.capa); };

/** Interior de la cápsula: paredes con paneles y una ventana a Júpiter. */
const cabina = (s: Cinematica) => {
  s.capa.add(degradado(s, 0x060a14, 0x121a2c));
  const g = s.add.graphics();
  g.fillStyle(0x1a2438).fillRect(-200, 60, W + 400, 300).fillStyle(0x0e1626).fillRect(-200, 360, W + 400, 300);
  g.lineStyle(2, 0x2a3a5a);
  for (let x = -160; x < W + 200; x += 96) g.lineBetween(x, 60, x, 360);
  g.fillStyle(0x02030a).fillRoundedRect(640, 96, 240, 150, 24).lineStyle(6, 0x3a4d74).strokeRoundedRect(640, 96, 240, 150, 24);
  s.capa.add(g);
  const j = new Actor(s, 780, 200, 'jupiter', { escala: 1.9, dir: 1 });
  s.capa.add(j);
  const marco = s.add.graphics().lineStyle(10, 0x1a2438).strokeRoundedRect(634, 90, 252, 162, 28);
  s.capa.add(marco);
  for (let i = 0; i < 5; i++) {
    const l = s.add.rectangle(80 + i * 110, 84, 40, 6, [0x3ff3ff, 0x5cff9c, 0xffd23f][i % 3], 0.9);
    s.capa.add(l);
    s.tweens.add({ targets: l, alpha: 0.3, duration: 500 + i * 170, yoyo: true, repeat: -1 });
  }
};

/** Siluetas oscuras en primer término (se mueven más que el fondo: dan profundidad). */
const primerTermino = (s: Cinematica, id: string, tinte: number, puntos: [number, number, number][]) => {
  for (const [x, y, e] of puntos) {
    const a = new Actor(s, x, y, id, { escala: e, dir: 1, animado: false });
    a.base.setTint(tinte); a.luz?.setVisible(false);
    s.frente.add(a);
  }
};

// ═════════════════════════ Actores ═════════════════════════
const reflejoDe = (s: Cinematica, a: Actor): void => {
  if (!s.espejo || a.y < SUELO) return;
  const r = new Actor(s, a.x, a.y, a.id, { escala: a.scaleX, dir: a.dir }).setAlpha(0.28);
  r.setScale(a.scaleX, -a.scaleX);
  r.base.setTint(0x9ab8ff); r.luz?.setAlpha(0.4);
  s.capa.addAt(r, s.capa.getIndex(a));
  s.reflejos.push([a, r]);
};

/** Objeto del escenario (edificio, nave, utilería). */
const actor = (s: Cinematica, id: string, x: number, y: number, escala = 3, dir = 1): Actor => {
  const a = new Actor(s, x, y, id, { escala, dir });
  s.capa.add(a);
  reflejoDe(s, a);
  return a;
};

/** Personaje (protagonista, mascota, rover): con sombra de contacto; quieto hasta que camina. */
const pers = (s: Cinematica, id: string, x: number, y: number, escala = 5, dir = 1, quieto = true): Actor => {
  const sombra = s.add.ellipse(x, y, 20 * escala, 5 * escala, 0x000000, 0.32);
  s.capa.add(sombra);
  const a = actor(s, id, x, y, escala, dir);
  if (quieto) a.pausar();
  s.sombras.push([a, sombra]);
  return a;
};

/** Camina hasta (x, y) animando el paso y se detiene al llegar. */
const andar = (s: Cinematica, a: Actor, x: number, y: number, ms: number, alLlegar?: () => void): void => {
  a.mirarHacia(x - a.x, (y - a.y) * 2).seguir();
  s.tweens.add({ targets: a, x, y, duration: ms, ease: 'Linear', onComplete: () => { if (a.active) a.pausar(); alLlegar?.(); } });
};

/** Cambia el sprite de un actor (otra pose o estado) conservando lugar, escala, sombra, reflejo y etiqueta. */
const cambiar = (s: Cinematica, v: Actor, id: string, dir = v.dir, animado = true): Actor => {
  const n = new Actor(s, v.x, v.y, id, { escala: v.scaleX, dir });
  if (!animado) n.pausar();
  s.capa.addAt(n, s.capa.getIndex(v));
  s.sombras.forEach(p => { if (p[0] === v) p[0] = n; });
  s.marcas.forEach(m => { if (m.ref === v) m.ref = n; });
  const k = s.reflejos.findIndex(p => p[0] === v);
  if (k >= 0) { s.reflejos[k][1].destroy(); s.reflejos.splice(k, 1); reflejoDe(s, n); }
  v.destroy();
  return n;
};

// ═════════════════════════ Efectos de cine (Fase 2) ═════════════════════════
const puntoTex = (s: Cinematica) => { if (!s.textures.exists('amb-punto')) s.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('amb-punto', 2, 2).destroy(); };
const cuantas = (n: number) => (calidadAlta() ? n : Math.ceil(n / 3));

/** Casquete polar: recorte exacto de un círculo por encima (o por debajo) de `lim`. */
const casquete = (g: Phaser.GameObjects.Graphics, cx: number, cy: number, R: number, lim: number, arriba: boolean) => {
  const pts: Phaser.Math.Vector2[] = [];
  for (let a = 0; a <= 360; a += 4) {
    const r = Phaser.Math.DegToRad(a), x = Math.cos(r) * R, y = Math.sin(r) * R;
    if (arriba ? y < lim : y > lim) pts.push(new Phaser.Math.Vector2(cx + x, cy + y));
  }
  if (pts.length > 2) g.fillPoints(pts, true);
};

/** Ráfaga de corazones que suben (momentos de cariño). */
const corazones = (s: Cinematica, x: number, y: number, n = 10) => {
  if (!s.textures.exists('cine-corazon')) {
    const g = s.make.graphics({}, false).fillStyle(0xffffff);
    g.fillCircle(5, 5, 5).fillCircle(13, 5, 5).fillTriangle(0.5, 7, 17.5, 7, 9, 17);
    g.generateTexture('cine-corazon', 18, 18).destroy();
  }
  const e = s.add.particles(x, y, 'cine-corazon', {
    speedY: { min: -140, max: -60 }, speedX: { min: -70, max: 70 }, lifespan: 2200, scale: { start: 0.9, end: 0.3 },
    alpha: { start: 1, end: 0 }, tint: [0xff5f7a, 0xff8ab0, 0xffc0d0], emitting: false,
  });
  s.capa.add(e);
  e.explode(cuantas(n));
};

/** Columna de vapor (géiser criovolcánico) con esquirlas de hielo. */
const geiser = (s: Cinematica, x: number, y: number) => {
  puntoTex(s);
  const vapor = s.add.particles(x, y, 'amb-punto', {
    speedY: { min: -420, max: -220 }, speedX: { min: -50, max: 50 }, lifespan: 1600, quantity: cuantas(5), frequency: 30,
    scale: { start: 5, end: 16 }, alpha: { start: 0.6, end: 0 }, tint: [0xffffff, 0xcfefff, 0x9fdcff],
  });
  const hielo = s.add.particles(x, y, 'amb-punto', {
    speed: { min: 160, max: 380 }, angle: { min: 220, max: 320 }, gravityY: 520, lifespan: 1400, scale: { start: 2.5, end: 1 },
    tint: [0xe8f6ff, 0x9fdcff], emitting: false,
  });
  s.capa.add([vapor, hielo]);
  hielo.explode(cuantas(40));
  s.time.delayedCall(4200, () => vapor.stop());
};

const flotar = (s: Cinematica, o: Punto, amp = 6, ms = 1800) =>
  s.tweens.add({ targets: o, y: o.y - amp, duration: ms, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

/** Lente holográfica en el cielo: lo que el protagonista mira cuando señala un astro. */
const mirador = (s: Cinematica, planeta: string, esc: number): { astro: Actor; cx: number; cy: number } => {
  salar(s, 'noche');
  const cx = 470, cy = 186, r = 140;
  const g = s.add.graphics().fillStyle(0x02030a, 0.94).fillCircle(cx, cy, r);
  for (let i = 0; i < 40; i++) g.fillStyle(0xdbe8ff, 0.3 + (i % 5) * 0.12).fillRect(cx + Math.cos(i * 2.4) * ((i * 37) % r) * 0.9, cy + Math.sin(i * 2.4) * ((i * 53) % r) * 0.9, 1.5, 1.5);
  // haz de la mirada: del protagonista a la lente
  g.fillStyle(0x3ff3ff, 0.07).fillTriangle(160, PISO - 92, cx - r * 0.8, cy + r * 0.6, cx + r * 0.2, cy + r);
  s.capa.add(g);
  const astro = new Actor(s, cx, cy, planeta, { escala: esc, dir: 1 });
  s.capa.add(astro);
  const aro = s.add.graphics().lineStyle(4, 0x3ff3ff, 0.9).strokeCircle(cx, cy, r + 2).lineStyle(2, 0x3ff3ff, 0.5);
  for (let i = 0; i < 24; i++) { const a = (i * Math.PI) / 12; aro.lineBetween(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6), cx + Math.cos(a) * (r + (i % 6 ? 11 : 18)), cy + Math.sin(a) * (r + (i % 6 ? 11 : 18))); }
  s.capa.add(aro);
  s.tweens.add({ targets: aro, alpha: 0.55, duration: 1200, yoyo: true, repeat: -1 });
  pers(s, 'mascota_sentada', 212, PISO + 4, 2.6, 4, false);
  pers(s, pose('senala'), 150, PISO, 3.1, 4);     // de espaldas, señalando el astro en el cielo
  s.plano({ x: 430, y: 250, z: 1 }, { x: 450, y: 232, z: 1.1 }, 9000);
  return { astro, cx, cy };
};

// ═════════════════════════ Los 36 cuadros ═════════════════════════
const ESC: Record<string, Escenario> = {
  // ─────────── PRÓLOGO ───────────
  tierra_enferma: {
    sp: ['tierra'],
    armar: s => {
      espacio(s, 'azul');
      const t = actor(s, 'tierra', 560, 225, 4.4);
      const anomalia = s.add.graphics().lineStyle(6, 0xb07cff, 0.9).strokeCircle(560, 225, 150).lineStyle(2, 0xb07cff, 0.5).strokeCircle(560, 225, 166);
      anomalia.setAlpha(0).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(anomalia);
      const hieloT = s.add.graphics(); s.capa.add(hieloT);
      const R = 35 * 4.4, hk = { k: 0 };
      const pintarHielo = () => {
        hieloT.clear().fillStyle(0xeef8ff, 0.92);
        casquete(hieloT, 560, 225, R, -R + 16 + hk.k * R * 0.8, true);
        casquete(hieloT, 560, 225, R, R - 14 - hk.k * R * 0.72, false);
        for (let i = 0; i < 5; i++) {   // bandas de nubes grises que cubren los océanos
          const y = -R * 0.55 + i * R * 0.27, ancho = 2 * Math.sqrt(Math.max(0, R * R - y * y)) * 0.45;
          hieloT.fillStyle(0x8f9bb0, 0.2 + hk.k * 0.35).fillEllipse(560 + Math.sin(i * 1.7 + hk.k * 4) * R * 0.3, 225 + y, ancho, 15);
        }
      };
      pintarHielo();
      // medidor de oxígeno de la atmósfera
      const med = s.add.container(290, 170).setAlpha(0);
      const barra = s.add.rectangle(-60, 26, 120, 14, 0x5cff9c).setOrigin(0, 0.5);
      const num = s.add.text(0, -8, 'O2  21 %', { fontFamily: FUENTE_PIXEL, fontSize: '16px', color: '#5cff9c' }).setOrigin(0.5);
      med.add([s.add.rectangle(0, 26, 126, 20, 0x04121a).setStrokeStyle(2, 0xffffff, 0.7), barra, num]); s.capa.add(med);
      s.cue('anomalía', () => { s.tweens.add({ targets: anomalia, alpha: 1, duration: 600 }); s.tweens.add({ targets: anomalia, scale: 1.03, duration: 900, yoyo: true, repeat: -1 }); Sonido.alarma(); });
      s.cue('oxígeno', () => {
        s.tweens.add({ targets: med, alpha: 1, duration: 300 });
        const v = { o: 21 };
        s.tweens.add({ targets: v, o: 14, duration: 3500, onUpdate: () => { num.setText(`O2  ${v.o.toFixed(0)} %`); barra.width = 120 * (v.o / 21); if (v.o < 17) { barra.setFillStyle(0xff4a3d); num.setColor('#ff4a3d'); } } });
      });
      s.cue('congela', () => { s.tweens.add({ targets: hk, k: 1, duration: 4500, ease: 'Sine.in', onUpdate: pintarHielo }); s.tweens.add({ targets: t, alpha: 0.85, duration: 3500 }); });
      s.senal('océanos', t, 'Océanos que se congelan', { dato: 'Sin oxígeno ni calor, la vida en la Tierra tiene los días contados.' });
      s.plano({ x: 480, y: 235, z: 1 }, { x: 540, y: 230, z: 1.22 }, 10000);
    },
  },
  salar_base: {
    sp: ['modulo_habitacional', 'invernadero', 'antena_espacio_profundo', 'torre_lanzamiento', 'hangar_ensamblaje', 'cohete_completo', 'oficina_presupuesto', 'patio_pruebas', 'pasarela_tubo', 'planta', 'rover_explorador'],
    armar: s => {
      salar(s, 'noche');
      // fila de atrás (lejos) y fila de adelante (cerca): la Ciudadela como un pequeño pueblo
      actor(s, 'antena_espacio_profundo', 20, SUELO + 40, 3);
      actor(s, 'torre_lanzamiento', 230, SUELO + 44, 3.4);
      actor(s, 'cohete_completo', 300, SUELO + 40, 2.5, 0);
      actor(s, 'oficina_presupuesto', 520, SUELO + 40, 2.8);
      actor(s, 'patio_pruebas', 990, SUELO + 46, 3);
      actor(s, 'pasarela_tubo', 470, PISO - 26, 3.2);
      actor(s, 'hangar_ensamblaje', 150, PISO + 6, 4.2);
      const mod = actor(s, 'modulo_habitacional', 640, PISO + 10, 4.4);
      actor(s, 'invernadero', 900, PISO + 8, 4);
      [[330, PISO + 4], [420, PISO - 4], [770, PISO + 6]].forEach(([x, y], i) => pers(s, i === 1 ? 'rover_explorador' : 'planta', x, y, i === 1 ? 2 : 1.8, 1));
      s.senal('Ciudadela de la Tierra', mod, 'Ciudadela de la Tierra', { dato: 'La última base en la superficie: hangar, invernadero, antena y torre de lanzamiento.' });
      s.cue('UYUNI', () => s.rotulo('SALAR DE UYUNI', 'Bolivia · 3 656 m sobre el mar'));
      s.plano({ x: 300, y: 262, z: 1.15 }, { x: 660, y: 262, z: 1.15 }, 10000);
    },
  },
  protagonista: {
    sp: () => [prota(), 'modulo_habitacional', 'invernadero'],
    armar: s => {
      salar(s, 'noche');
      actor(s, 'invernadero', 120, SUELO + 50, 3);
      actor(s, 'modulo_habitacional', 670, PISO + 10, 5);
      // escotilla al refugio subterráneo: su luz se apaga
      const esc = s.add.graphics().fillStyle(0x1a2238).fillRect(300, PISO - 20, 80, 12).fillStyle(0xffd27a, 0.9).fillRect(310, PISO - 32, 60, 12);
      s.capa.add(esc);
      const p = pers(s, prota(), 460, PISO + 4, 3.2, 1);
      s.senal(NOMBRE(), p, NOMBRE(), { dato: personalizar(t('Ingenier@ aeroespacial. Eligió quedarse arriba.')), color: 0xffe14d });
      s.cue('bajo tierra', () => { s.tweens.add({ targets: esc, alpha: 0.25, duration: 1200 }); s.senal(null, { x: 340, y: PISO - 20 }, 'Refugio subterráneo', { alto: 26, dato: 'Todos los demás bajaron. La escotilla se cerró.' }); });
      s.cue('superficie', () => p.mirar(4));   // mira hacia el cielo
      s.plano({ x: 480, y: 255, z: 1 }, { x: 500, y: 275, z: 1.2 }, 9000);
    },
  },
  hogar: {
    sp: () => [prota(), 'invernadero', 'planta', 'pasarela_tubo', 'modulo_habitacional'],
    armar: s => {
      salar(s, 'noche');
      actor(s, 'modulo_habitacional', 40, PISO - 6, 4.2);
      const pas = actor(s, 'pasarela_tubo', 330, PISO - 20, 4.6);
      const inv = actor(s, 'invernadero', 720, PISO + 10, 5.2);
      const pl = [540, 590, 890].map((x, i) => actor(s, 'planta', x, PISO + 4 + i * 3, 2.4));
      const p = pers(s, prota(), 160, PISO + 6, 3, 7);
      andar(s, p, 470, PISO + 6, 7000);
      s.senal('pasillos', pas, 'Pasillos de la base', { dato: 'Tubos presurizados que unen los módulos.' });
      s.senal('Invernadero', inv, 'Invernadero', { dato: 'Produce comida y oxígeno. Aquí se procesará la cura.', color: 0x5cff9c });
      s.cue('plantas', () => pl.forEach((a, i) => s.tweens.add({ targets: a, scale: 2.9, duration: 300, yoyo: true, delay: i * 150 })));
      s.plano({ x: 330, y: 265, z: 1.08 }, { x: 600, y: 265, z: 1.12 }, 9000);
    },
  },
  mascota_rover: {
    sp: () => [prota(), 'mascota_perro', 'mascota_sentada', 'rover_explorador', 'patio_pruebas', 'hangar_ensamblaje'],
    armar: s => {
      salar(s, 'noche');
      actor(s, 'hangar_ensamblaje', 60, SUELO + 50, 3.2);
      const patio = actor(s, 'patio_pruebas', 780, PISO - 6, 4.8);
      const r = pers(s, 'rover_explorador', 1010, PISO + 8, 3, 1, false);
      const p = pers(s, prota(), 330, PISO + 4, 3.2, 1);
      let m = pers(s, 'mascota_perro', 60, PISO + 10, 2.7, 7, false);
      andar(s, m, 262, PISO + 10, 2600, () => { m = cambiar(s, m, 'mascota_sentada', 7); });
      s.senal(MASCOTA(), { get x() { return m.x; }, get y() { return m.y; } }, MASCOTA(), { alto: 56, dato: 'Le sigue a todas partes.', color: 0xff8ab0 });
      s.senal('Patio de Pruebas', patio, 'Patio de Pruebas');
      s.cue('Rover explorador', () => { andar(s, r, 560, PISO + 8, 2600); p.mirar(7); });
      s.senal('Rover explorador', r, 'Rover explorador', { dato: '6 ruedas · 180 kg · su creación más querida.', color: 0x3ff3ff });
      s.plano({ x: 340, y: 275, z: 1.2 }, { x: 520, y: 268, z: 1.1 }, 9000);
    },
  },
  caminata_aurora: {
    sp: () => [prota(), pose('mira'), 'mascota_perro', 'mascota_sentada', 'modulo_habitacional', 'hangar_ensamblaje'],
    armar: s => {
      salar(s, 'noche');
      // cortinas de aurora (detrás de la cordillera) y su reflejo en el espejo de sal
      const auA = aurora(s, 40, W + 320).setPosition(-160, 0).setAlpha(0.15);
      s.capa.addAt(auA, 2);
      const auR = aurora(s, 40, W + 320, 0.5).setPosition(-160, SUELO * 2).setScale(1, -1).setAlpha(0.05);
      s.capa.add(auR);
      const au: [Phaser.GameObjects.Graphics, number][] = [[auA, 1], [auR, 0.45]];
      actor(s, 'modulo_habitacional', 60, SUELO + 44, 3);
      actor(s, 'hangar_ensamblaje', 250, SUELO + 40, 2.8);
      let p = pers(s, prota(), 330, PISO, 3.1, 7);
      let m = pers(s, 'mascota_perro', 260, PISO + 6, 2.6, 7, false);
      andar(s, p, 640, PISO, 6500);
      andar(s, m, 572, PISO + 6, 6500, () => { m = cambiar(s, m, 'mascota_sentada', 4); });
      s.cue('Aurora', () => { au.forEach(([a, al]) => s.tweens.add({ targets: a, alpha: al, duration: 1800 })); s.senal(null, { x: 480, y: 190 }, 'Aurora', { alto: 60, dato: 'Partículas del Sol chocando con lo que queda de la atmósfera.', color: 0x5cff9c }); });
      s.cue('estrellas', () => { s.tweens.killTweensOf(p); p = cambiar(s, p, pose('mira'), 4); s.plano({ x: 560, y: 255, z: 1.1 }, { x: 580, y: 235, z: 1.14 }, 3500); });
      s.plano({ x: 400, y: 262, z: 1.12 }, { x: 560, y: 255, z: 1.1 }, 7000);
    },
  },
  venus: {
    sp: () => [prota(), pose('senala'), 'mascota_sentada', 'venus', 'tierra', 'cactus_gigante'],
    armar: s => {
      const { astro, cx, cy } = mirador(s, 'venus', 3.9);
      s.senal('Venus', astro, 'Venus', { dato: '465 °C y nubes de ácido: un efecto invernadero sin freno.', color: 0xffd27a });
      const rojo = s.add.circle(cx, cy, 126, 0xff3a1a, 0).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(rojo);
      s.cue('infierno', () => s.tweens.add({ targets: rojo, fillAlpha: 0.35, duration: 500, yoyo: true, repeat: 3 }));
      s.cue('espejo', () => {
        const t = actor(s, 'tierra', cx + 215, cy + 96, 0).setAlpha(0);
        s.tweens.add({ targets: t, scale: 1.3, alpha: 1, duration: 600, ease: 'Back.out' });
        const lin = s.add.graphics().lineStyle(2, 0xffffff, 0.7); for (let k = 0; k < 5; k++) lin.lineBetween(cx + 100 + k * 16, cy + 74 + k * 4, cx + 108 + k * 16, cy + 76 + k * 4);
        s.capa.add(lin);
        s.senal(null, t, '¿Nuestro futuro?', { alto: 50, color: 0xff4a3d });
      });
    },
  },
  marte: {
    sp: () => [prota(), pose('senala'), 'mascota_sentada', 'marte', 'cactus_gigante'],
    armar: s => {
      const { astro, cx, cy } = mirador(s, 'marte', 3.9);
      s.senal('Marte', astro, 'Marte · Valle del polvo', { dato: 'Atmósfera cien veces más fina que la terrestre.', color: 0xff8a5a });
      s.cue('tormentas', () => {
        const p = polvo(s, s.capa); p.setPosition(cx - 150, cy - 110); p.setScale(0.32, 0.42);
        const velo = s.add.circle(cx, cy, 126, 0xd88a50, 0).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(velo);
        s.tweens.add({ targets: velo, fillAlpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
      });
    },
  },
  jupiter_europa: {
    sp: () => [prota(), pose('senala'), 'mascota_sentada', 'jupiter', 'europa', 'cactus_gigante'],
    armar: s => {
      const { cx, cy } = mirador(s, 'jupiter', 3.3);
      s.senal('Júpiter', { x: cx - 10, y: cy + 60 }, 'Júpiter', { alto: 150, dato: 'El gigante: más de 1 300 Tierras cabrían dentro.', color: 0xe8c79a });
      const e = actor(s, 'europa', cx + 96, cy - 62, 0.5);
      const orb = { a: -0.6 };
      s.tweens.add({ targets: orb, a: 0.5, duration: 9000, onUpdate: () => e.setPosition(cx + Math.cos(orb.a) * 122, cy + Math.sin(orb.a) * 82) });
      s.cue('Europa', () => { s.tweens.add({ targets: e, scale: 1.05, duration: 900, ease: 'Back.out' }); s.plano({ x: 450, y: 232, z: 1.1 }, { x: 500, y: 200, z: 1.35 }, 3800); });
      s.senal('Europa', e, 'Europa', { alto: 44, dato: 'Luna helada de 3 122 km de diámetro.', color: 0x9fdcff });
    },
  },
  antena_cepa: {
    sp: () => [prota(), 'antena_espacio_profundo', 'cepa_vial'],
    armar: s => {
      salar(s, 'noche');
      const ant = actor(s, 'antena_espacio_profundo', 240, PISO + 10, 5, 3);
      pers(s, prota(), 440, PISO + 6, 3, 6);
      // corte de Europa: hielo, océano y fondo rocoso
      const X = 560, Y = 96, A = 300;
      const g = s.add.graphics();
      g.fillStyle(0x040914, 0.9).fillRoundedRect(X - 14, Y - 14, A + 28, 268, 14).lineStyle(2, 0x3ff3ff, 0.7).strokeRoundedRect(X - 14, Y - 14, A + 28, 268, 14);
      g.fillStyle(0xdcedf3).fillRect(X, Y, A, 62).fillStyle(0x1d5a9a).fillRect(X, Y + 62, A, 130).fillStyle(0x4a3a2e).fillRect(X, Y + 192, A, 48);
      g.lineStyle(2, 0x8a5444, 0.9); [[40, 30], [150, 44], [240, 26]].forEach(([dx, l]) => g.lineBetween(X + dx, Y, X + dx + 8, Y + l));
      s.capa.add(g);
      const onda = s.add.rectangle(X + A / 2, Y + 130, A, 130, 0x5ab4ff, 0).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(onda);
      s.cue('Antena', () => { for (let i = 0; i < 3; i++) { const o = s.add.circle(250, PISO - 250, 10).setStrokeStyle(3, 0x3ff3ff, 1); s.capa.add(o); s.tweens.add({ targets: o, radius: 150, alpha: 0, duration: 1800, delay: i * 500, repeat: -1 }); } Sonido.cuenta(); });
      s.senal('Antena', ant, 'Antena de espacio profundo', { dato: 'Capta señales de sondas a cientos de millones de km.' });
      s.cue('océano', () => { s.tweens.add({ targets: onda, fillAlpha: 0.35, duration: 700, yoyo: true, repeat: -1 }); s.senal(null, { x: X + 80, y: Y + 150 }, 'Océano de agua salada', { alto: 40, dato: 'Hasta 100 km de profundidad.', color: 0x5ab4ff }); });
      s.cue('hielo', () => s.senal(null, { x: X + 230, y: Y + 50 }, 'Hielo: 15–25 km', { alto: 56, color: 0xdcedf3 }));
      s.cue('microorganismo', () => {
        const v = actor(s, 'cepa_vial', X + 170, Y + 180, 0);
        s.tweens.add({ targets: v, scale: 2.6, duration: 600, ease: 'Back.out' });
        s.senal(null, v, 'Extremófilo', { alto: 80, dato: 'Vive sin luz ni oxígeno. Puede reparar nuestra atmósfera.', color: 0x5cff9c });
        Sonido.bien();
      });
      s.plano({ x: 400, y: 245, z: 1.02 }, { x: 580, y: 235, z: 1.12 }, 11000);
    },
  },

  // ─────────── NUDO 1 ───────────
  oficina: {
    sp: () => [prota(), 'oficina_presupuesto', 'hangar_ensamblaje'],
    armar: s => {
      salar(s, 'noche');
      const of = actor(s, 'oficina_presupuesto', 280, PISO, 4.8);
      const ha = actor(s, 'hangar_ensamblaje', 760, PISO + 4, 5);
      const p = pers(s, prota(), 40, PISO + 10, 3, 7);
      andar(s, p, 330, PISO + 10, 4200);
      s.senal('Oficina de Presupuesto', of, 'Oficina de Presupuesto', { dato: 'Aquí se decide cuánta masa, energía y combustible puede llevar la misión.', color: 0xffd23f });
      s.cue('Hangar', () => andar(s, p, 660, PISO + 10, 3600));
      s.senal('Hangar de Ensamblaje', ha, 'Hangar de Ensamblaje', { dato: 'Donde se arma el cohete pieza por pieza.' });
      s.plano({ x: 320, y: 262, z: 1.1 }, { x: 640, y: 262, z: 1.1 }, 8500);
    },
  },
  hangar_calculo: {
    sp: () => [prota(), 'deposito_combustible', 'mesa_holo', 'panel_control', 'cohete_completo'],
    armar: s => {
      interior(s);
      const cohete = actor(s, 'cohete_completo', 700, PISO - 34, 3, 0);
      const dep = actor(s, 'deposito_combustible', 880, PISO - 6, 4);
      actor(s, 'panel_control', 150, PISO - 10, 2.8);
      const mesa = actor(s, 'mesa_holo', 400, PISO, 3.2);
      pers(s, prota(), 500, PISO + 6, 3.1, 2);
      s.senal(null, cohete, 'El cohete, por armar', { alto: 300 });
      const cuenta = (y: number, color: string, tope: number, uni: string, nombre: string) => {
        const t = s.add.text(400, y + 24, '', { fontFamily: FUENTE_PIXEL, fontSize: '13px', color, stroke: '#04121a', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
        s.capa.add(t);
        return () => { const v = { n: 0 }; t.setAlpha(1); s.tweens.add({ targets: v, n: tope, duration: 1800, ease: 'Cubic.out', onUpdate: () => t.setText(`${rotular(nombre)} ${numero(Math.round(v.n))} ${uni}`) }); Sonido.tecla(); };
      };
      s.cue('masa', cuenta(176, CSS.amarillo, 26400, 'kg', 'MASA'));
      s.cue('potencia', cuenta(204, CSS.cian, 11200, 'W', 'POTENCIA'));
      s.cue('combustible', cuenta(232, CSS.naranja, 733000, 'L', 'COMBUSTIBLE'));
      s.senal('Depósito de Combustible', dep, 'Depósito de Combustible', { dato: 'Hidrógeno y oxígeno líquidos, a −253 °C y −183 °C.', color: 0xff6b2c });
            void mesa;
      s.plano({ x: 460, y: 245, z: 1 }, { x: 520, y: 245, z: 1.1 }, 9000);
    },
  },

  // ─────────── NUDO 2 ───────────
  promesa: {
    sp: () => [prota(), 'mascota_sentada', 'modulo_habitacional', 'torre_lanzamiento', 'cohete_completo'],
    armar: s => {
      salar(s, 'noche');
      const torre = actor(s, 'torre_lanzamiento', 800, PISO - 20, 4.6);
      actor(s, 'cohete_completo', 900, PISO - 24, 3.4, 0);
      actor(s, 'modulo_habitacional', 230, PISO + 10, 5);
      const p = pers(s, prota(), 500, PISO + 8, 3.3, 1);
      const m = pers(s, 'mascota_sentada', 420, PISO + 12, 2.8, 7, false);
      s.senal('Torre de Lanzamiento', torre, 'Torre de Lanzamiento', { dato: 'Allí espera el cohete armado.', color: 0xff6b2c });
      s.cue('se agacha', () => s.tweens.add({ targets: p, scaleY: 2.75, duration: 500, ease: 'Sine.out' }));
      s.senal(MASCOTA(), m, MASCOTA(), { color: 0xff8ab0 });
      s.cue('promesa', () => s.plano({ x: 500, y: 265, z: 1.08 }, { x: 470, y: 300, z: 1.4 }, 2600));
      s.plano({ x: 640, y: 250, z: 1 }, { x: 500, y: 265, z: 1.08 }, 6000);
    },
  },
  promesa_cerca: {
    sp: () => [prota(), 'mascota_sentada', 'modulo_habitacional'],
    armar: s => {
      salar(s, 'noche');
      actor(s, 'modulo_habitacional', 820, PISO + 80, 7);
      const luzCalida = rayos(s, 760, PISO - 190, 0xffd9a0, 560, 12, 0.06);
      s.capa.addAt(luzCalida, 3);
      const p = pers(s, prota(), 560, PISO + 10, 4.6, 1);
      p.setScale(4.6, 3.9);
      pers(s, 'mascota_sentada', 440, PISO + 14, 4, 7, false);
      const cor = s.add.text(500, 270, '♥', { fontFamily: FUENTE, fontSize: '46px', color: '#ff5f7a', stroke: '#3a0010', strokeThickness: 6 }).setOrigin(0.5).setScale(0);
      s.capa.add(cor);
      s.cue('aire limpio', () => { const d = s.add.circle(495, 180, 6, 0x9fdcff, 0.9); s.capa.add(d); s.tweens.add({ targets: d, radius: 90, alpha: 0, duration: 1600, repeat: 2 }); });
      s.cue('volver', () => { s.tweens.add({ targets: cor, scale: 1, duration: 500, ease: 'Back.out' }); s.tweens.add({ targets: cor, y: 258, duration: 900, yoyo: true, repeat: -1, delay: 500 }); Sonido.bien(); corazones(s, 500, 290, 12); });
      s.plano({ x: 520, y: 290, z: 1.1 }, { x: 500, y: 300, z: 1.25 }, 7000);
    },
  },

  // ─────────── NUDO 3 ───────────
  viaje: {
    sp: ['orion_completa', 'tierra', 'marte', 'cohete_nucleo'],
    armar: s => {
      espacio(s, 'azul');
      const t = actor(s, 'tierra', 130, 330, 3);
      const m = actor(s, 'marte', 830, 150, 2.4);
      const curva = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(190, 300), new Phaser.Math.Vector2(430, 60), new Phaser.Math.Vector2(770, 170));
      const ruta = s.add.graphics(); s.capa.add(ruta);
      const o = actor(s, 'orion_completa', 190, 300, 2.3, 6);
      const av = { t: 0 };
      s.tweens.add({ targets: av, t: 1, duration: 9500, ease: 'Sine.inOut', onUpdate: () => {
        const pt = curva.getPoint(av.t); o.setPosition(pt.x, pt.y);
        ruta.clear().lineStyle(2, 0x3ff3ff, 0.8);
        for (let k = 0; k < av.t; k += 0.03) { const a = curva.getPoint(k), b = curva.getPoint(Math.min(av.t, k + 0.015)); ruta.lineBetween(a.x, a.y, b.x, b.y); }
      } });
      s.senal('Sistema Solar', t, 'Tierra', { alto: 80 });
      s.cue('separación de etapas', () => {
        const e = actor(s, 'cohete_nucleo', o.x, o.y + 10, 1.1, 0);
        s.tweens.add({ targets: e, x: e.x - 90, y: e.y + 160, angle: -140, alpha: 0, duration: 2600, ease: 'Quad.in' });
        Sonido.golpe();
      });
      s.senal('Marte: Base Tari', m, 'Marte · Base Tari', { dato: 'Primera escala: reparar y reabastecer.', color: 0xff8a5a });
      s.plano({ x: 380, y: 250, z: 1.1 }, { x: 640, y: 200, z: 1.2 }, 10000);
    },
  },
  reabastecimiento: {
    sp: ['reabastecimiento', 'marte', 'jupiter', 'orion_completa'],
    armar: s => {
      espacio(s, 'rosa');
      actor(s, 'marte', 150, 370, 3.4);
      const est = actor(s, 'reabastecimiento', 470, 260, 4.6);
      flotar(s, est);
      s.rotulo('ÓRBITA DE MARTE', 'Depósito orbital');
      const med = s.add.container(470, 96).setAlpha(0);
      const barra = s.add.rectangle(-80, 0, 20, 14, 0xff6b2c).setOrigin(0, 0.5);
      med.add([s.add.rectangle(0, 0, 166, 20, 0x04121a).setStrokeStyle(2, 0xffffff, 0.8), barra, s.add.text(0, -22, 'TANQUES', { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: '#ffffff' }).setOrigin(0.5)]);
      s.capa.add(med);
      s.cue('Reabastecimiento orbital', () => { s.tweens.add({ targets: med, alpha: 1, duration: 300 }); s.tweens.add({ targets: barra, width: 160, duration: 3200 }); });
      s.senal('Reabastecimiento orbital', est, 'Reabastecimiento orbital', { alto: 66, dato: 'Cargar combustible en el espacio evita despegar con todo el peso.', color: 0xff6b2c });
      s.cue('tanques llenos', () => { barra.setFillStyle(0x5cff9c); Sonido.bien(); });
      s.cue('Júpiter', () => {
        const j = actor(s, 'jupiter', 900, 110, 0.2).setAlpha(0);
        s.tweens.add({ targets: j, alpha: 1, scale: 1, duration: 1500 });
        const o = actor(s, 'orion_completa', 520, 240, 1.9, 6);
        s.tweens.add({ targets: o, x: 860, y: 130, scale: 0.4, duration: 4000, ease: 'Quad.in' });
        s.senal(null, j, 'Rumbo a Júpiter', { alto: 50, color: 0xe8c79a });
      });
      s.plano({ x: 430, y: 250, z: 1.15 }, { x: 560, y: 220, z: 1.05 }, 9000);
    },
  },
  asteroides: {
    sp: ['orion_completa', 'asteroide_metalico', 'jupiter', 'rayo_tesla'],
    armar: s => {
      espacio(s, 'carina');
      const j = actor(s, 'jupiter', 860, 170, 3.2);
      const campo = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0); s.capa.add(campo);
      for (let k = 0; k < 4; k++) campo.lineStyle(3, 0xb07cff, 0.7 - k * 0.12).strokeEllipse(860, 170, 300 + k * 90, 150 + k * 60);
      const rocas = [[220, 120, 1.3], [430, 330, 1.9], [640, 90, 1], [330, 210, 0.8], [120, 310, 1.1], [560, 250, 1.2]].map(([x, y, e], i) => {
        const a = actor(s, 'asteroide_metalico', x, y, e, i);
        s.tweens.add({ targets: a, x: x - 300, y: y + 50, duration: 10000, ease: 'Linear' });
        return a;
      });
      const o = actor(s, 'orion_completa', 60, 250, 2.3, 6);
      s.tweens.add({ targets: o, x: 560, duration: 9500, ease: 'Sine.inOut' });
      s.tweens.add({ targets: o, y: 190, duration: 1200, yoyo: true, repeat: 3, ease: 'Sine.inOut' });   // esquiva
      s.senal('cinturón de asteroides', rocas[1], 'Cinturón de asteroides', { alto: 70, dato: 'Rocas y metal entre Marte y Júpiter.' });
      s.cue('cinturón magnético', () => {
        s.tweens.add({ targets: campo, alpha: 1, duration: 600 }); s.tweens.add({ targets: campo, scale: 1.04, duration: 500, yoyo: true, repeat: -1 });
        const r = actor(s, 'rayo_tesla', 650, 250, 2.6);
        s.tweens.add({ targets: r, alpha: 0.2, duration: 180, yoyo: true, repeat: -1 });
        Sonido.alarma(); s.cameras.main.shake(700, 0.004);
        s.senal(null, j, 'Radiación letal', { alto: 110, dato: 'El campo magnético de Júpiter atrapa partículas a enorme energía.', color: 0xb07cff });
      });
      s.plano({ x: 380, y: 235, z: 1.08 }, { x: 640, y: 220, z: 1.2 }, 10000);
    },
  },
  descenso_europa: {
    sp: ['capsula_colibri', 'europa', 'jupiter'],
    armar: s => {
      espacio(s, 'azul');
      actor(s, 'jupiter', 170, 130, 2.6);
      const e = actor(s, 'europa', 400, 330, 3.2);
      s.tweens.add({ targets: e, scale: 6.4, y: 600, duration: 9000, ease: 'Quad.in' });
      const c = actor(s, 'capsula_colibri', 420, 70, 2.2, 0);
      const fuego = s.add.ellipse(420, 100, 84, 46, 0xff8a3d, 0).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(fuego);
      s.tweens.add({ targets: c, y: 250, duration: 6000, ease: 'Quad.in', onUpdate: () => fuego.setPosition(c.x, c.y + 6) });
      s.rotulo('EUROPA', 'Luna de Júpiter · perforación «¿Estamos solos?»');
      s.cue('violento', () => {
        puntoTex(s);
        const plasma = s.add.particles(0, 0, 'amb-punto', { follow: c, followOffset: { x: 0, y: 20 }, speedY: { min: -260, max: -120 }, speedX: { min: -60, max: 60 }, lifespan: 600, quantity: cuantas(4), frequency: 25, scale: { start: 4, end: 0.5 }, tint: [0xffd23f, 0xff8a3d, 0xff4a3d], blendMode: 'ADD' });
        s.capa.add(plasma);
        s.cameras.main.shake(3000, 0.008); s.tweens.add({ targets: fuego, fillAlpha: 0.8, scale: 1.6, duration: 300, yoyo: true, repeat: -1 }); s.tweens.add({ targets: c, x: '+=6', duration: 50, yoyo: true, repeat: -1 }); Sonido.motor(3); });
      s.plano({ x: 420, y: 220, z: 1.05 }, { x: 420, y: 250, z: 1.35 }, 8000);
    },
  },
  sismo: {
    sp: ['criovolcan', 'explosion', 'capsula_colibri', 'antena_portatil', 'humo_despegue'],
    armar: s => {
      hielo(s);
      const vol = actor(s, 'criovolcan', 780, PISO - 10, 4.2);
      vol.setAlpha(0.35);
      const grietas = s.add.graphics(); s.capa.add(grietas);
      const cap = actor(s, 'capsula_colibri', 420, PISO - 10, 4.8);
      const ant = actor(s, 'antena_portatil', 220, PISO + 4, 2.6);
      const ondas = s.add.circle(220, PISO - 76, 10).setStrokeStyle(3, 0x5cff9c, 1); s.capa.add(ondas);
      s.tweens.add({ targets: ondas, radius: 90, alpha: 0, duration: 1400, repeat: -1 });
      s.cue('tocan la superficie', () => { const h = actor(s, 'humo_despegue', 420, PISO, 3.4); s.tweens.add({ targets: h, alpha: 0, duration: 2500 }); });
      s.cue('sismo', () => {
        s.cameras.main.shake(2800, 0.014); Sonido.golpe(); Sonido.motor(2.5);
        s.tweens.add({ targets: vol, alpha: 1, duration: 500 });
        geiser(s, 780, PISO - 150);
        const pr = { k: 0 };
        s.tweens.add({ targets: pr, k: 1, duration: 1400, onUpdate: () => {
          grietas.clear().lineStyle(4, 0x1a2a3a, 1);
          [[-1, 0.2], [-0.6, -0.5], [0.3, 0.6], [1, -0.2], [0.7, 0.9]].forEach(([dx, dy]) => grietas.lineBetween(420, PISO - 4, 420 + dx * 260 * pr.k, PISO - 4 + dy * 70 * pr.k).lineBetween(420 + dx * 130 * pr.k, PISO - 4 + dy * 35 * pr.k, 420 + dx * 190 * pr.k, PISO + 20 * pr.k));
        } });
        s.senal(null, vol, 'Criovolcán', { alto: 120, dato: 'El océano escapa a presión por las grietas del hielo.', color: 0x9fdcff });
      });
      s.cue('tanques', () => {
        const ex = actor(s, 'explosion', 480, PISO - 30, 3.2);
        s.tweens.add({ targets: ex, alpha: 0, duration: 400, delay: 1800 });
        s.tweens.add({ targets: cap, angle: 5, duration: 300 });
        Sonido.golpe();
        s.senal(null, cap, 'Tanques dañados', { alto: 230, color: 0xff4a3d });
      });
      s.cue('enlace', () => {
        s.tweens.killTweensOf(ondas); ondas.setStrokeStyle(3, 0xff4a3d, 1).setAlpha(0);
        s.tweens.add({ targets: ant, angle: -22, duration: 400 });
        s.senal(null, ant, 'Enlace con la Tierra: perdido', { alto: 90, color: 0xff4a3d });
        Sonido.alarma();
      });
      s.plano({ x: 480, y: 250, z: 1 }, { x: 460, y: 255, z: 1.1 }, 9000);
    },
  },
  atrapados: {
    sp: () => [eva('camina'), eva('oxigeno'), eva('escarcha'), eva('radiacion'), 'capsula_colibri'],
    armar: s => {
      hielo(s);
      actor(s, 'capsula_colibri', 760, PISO - 4, 5).setAngle(5);
      let p = pers(s, eva('camina'), 440, PISO + 12, 4.2, 0);
      // visor del casco: marco oscuro alrededor de la pantalla
      const visor = s.add.graphics().lineStyle(60, 0x0a0e18, 1).strokeEllipse(W / 2, CY + 10, W + 60, 470).lineStyle(4, 0x3ff3ff, 0.35).strokeEllipse(W / 2, CY + 10, W - 4, 412);
      s.fijo.add(visor);
      const dist = s.add.text(W / 2, 62, '', { fontFamily: FUENTE_PIXEL, fontSize: '13px', color: '#9fdcff', stroke: '#04121a', strokeThickness: 5 }).setOrigin(0.5);
      s.extra.add(dist);
      s.cue('seiscientos millones', () => { const v = { n: 0 }; s.tweens.add({ targets: v, n: 628, duration: 2200, ease: 'Cubic.out', onUpdate: () => dist.setText(`DISTANCIA A CASA  ${Math.round(v.n)} 000 000 km`) }); });
      const alerta = (k: number, txt: string, estado: string) => () => {
        p = cambiar(s, p, eva(estado), 0);
        const t = s.add.text(70, 110 + k * 46, '! ' + txt, { fontFamily: FUENTE_PIXEL, fontSize: '13px', color: '#ffffff', backgroundColor: '#b3141c', padding: { x: 10, y: 8 } });
        s.extra.add(t);
        s.tweens.add({ targets: t, alpha: 0.45, duration: 350, yoyo: true, repeat: -1 });
        Sonido.alarma(); s.cameras.main.flash(250, 180, 20, 20);
      };
      s.cue('poco oxígeno', alerta(0, 'POCO OXÍGENO', 'oxigeno'));
      s.cue('escarcha', alerta(1, 'ESCARCHA -160 °C', 'escarcha'));
      s.cue('radiación', alerta(2, 'RADIACIÓN', 'radiacion'));
      s.plano({ x: 500, y: 262, z: 1.05 }, { x: 470, y: 270, z: 1.2 }, 10000);
    },
  },
  rover_heroe: {
    sp: () => ['rover_explorador', eva('escarcha'), 'capsula_colibri'],
    armar: s => {
      hielo(s);
      actor(s, 'capsula_colibri', 160, PISO - 6, 5).setAngle(5);
      const p = pers(s, eva('escarcha'), 340, PISO + 8, 3, 6);
      const r = pers(s, 'rover_explorador', 470, PISO + 8, 3.2, 6);
      const faro = s.add.triangle(0, 0, 0, 0, 220, -46, 220, 46, 0xfff2c0, 0).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD);
      s.capa.add(faro);
      s.cue('sentencia de muerte', () => { s.tweens.add({ targets: p, alpha: 0.6, duration: 400, yoyo: true, repeat: 2 }); s.senal(null, p, 'Minutos de vida afuera', { color: 0xff4a3d }); });
      s.cue('Rover explorador', () => {
        andar(s, r, 740, PISO + 8, 4200);
        s.tweens.add({ targets: faro, fillAlpha: 0.22, duration: 500 });
        s.tweens.addCounter({ from: 0, to: 1, duration: 6000, onUpdate: () => faro.setPosition(r.x + 36, r.y - 44) });
      });
      s.senal('Rover explorador', r, 'Rover explorador', { dato: 'No respira y aguanta el frío: puede salir.', color: 0x3ff3ff });
      s.plano({ x: 340, y: 262, z: 1.12 }, { x: 600, y: 268, z: 1.1 }, 9000);
    },
  },
  escudo: {
    sp: ['rover_explorador', 'escudo', 'capsula_colibri'],
    armar: s => {
      hielo(s);
      const cap = actor(s, 'capsula_colibri', 170, PISO - 6, 5).setAngle(5);
      const r = pers(s, 'rover_explorador', 560, PISO + 6, 3.6, 7, false);
      const e = actor(s, 'escudo', 560, PISO + 18, 0).setAlpha(0.8);
      const guia = s.add.graphics(); s.capa.add(guia);
      s.cue('Escudo de radiación', () => { s.tweens.add({ targets: e, scale: 2.3, duration: 700, ease: 'Back.out' }); Sonido.bien(); });
      s.senal('Escudo de radiación', { x: 560, y: PISO - 60 }, 'Escudo de radiación', { alto: 110, dato: 'Desvía las partículas cargadas de Júpiter.', color: 0x3ff3ff });
      s.cue('guiado', () => {
        const d = { k: 0 };
        s.tweens.add({ targets: d, k: 1, duration: 900, onUpdate: () => { guia.clear().lineStyle(2, 0x5cff9c, 0.9); for (let x = 230; x < 230 + (r.x - 250) * d.k; x += 18) guia.lineBetween(x, PISO - 120, x + 9, PISO - 120 + (x - 230) * 0.12); } });
        s.senal(null, cap, 'Nave: control remoto', { alto: 240, color: 0x5cff9c });
      });
      s.cue('héroe', () => s.plano({ x: 480, y: 262, z: 1.08 }, { x: 540, y: 290, z: 1.35 }, 2600));
      s.plano({ x: 400, y: 255, z: 1 }, { x: 480, y: 262, z: 1.08 }, 7500);
    },
  },

  // ─────────── CLÍMAX ───────────
  computadora: {
    sp: () => ['panel_control', 'contenedor_muestras', eva('camina'), 'europa', 'tierra', 'cepa_vial'],
    armar: s => {
      cabina(s);
      const cont = actor(s, 'contenedor_muestras', 170, PISO, 3.2);
      actor(s, 'cepa_vial', 172, PISO - 62, 1.4);
      actor(s, 'panel_control', 430, PISO, 4.2);
      pers(s, eva('camina'), 570, PISO + 8, 3.3, 2);
      // pantalla de ruta: Europa → Tierra
      const px = 300, py = 96;
      const pant = s.add.graphics().fillStyle(0x02101a, 0.95).fillRoundedRect(px, py, 280, 130, 10).lineStyle(2, 0x3ff3ff, 0.8).strokeRoundedRect(px, py, 280, 130, 10);
      s.capa.add(pant);
      actor(s, 'europa', px + 40, py + 95, 0.42); actor(s, 'tierra', px + 240, py + 40, 0.42);
      const ruta = s.add.graphics(); s.capa.add(ruta);
      const err = s.add.text(px + 140, py + 66, 'RUTA IMPOSIBLE', { fontFamily: FUENTE_PIXEL, fontSize: '13px', color: '#ff4a3d', backgroundColor: '#1a0004', padding: { x: 8, y: 6 } }).setOrigin(0.5).setAlpha(0);
      s.capa.add(err);
      const curva = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(px + 52, py + 88), new Phaser.Math.Vector2(px + 110, py + 6), new Phaser.Math.Vector2(px + 230, py + 44));
      const dib = (k: number, col: number) => { ruta.clear().lineStyle(3, col, 1); for (let t = 0; t < k; t += 0.04) { const a = curva.getPoint(t), b = curva.getPoint(Math.min(k, t + 0.02)); ruta.lineBetween(a.x, a.y, b.x, b.y); } };
      s.senal('cura', cont, 'La cura, a salvo', { alto: 110, dato: 'La cepa viaja sellada en el Contenedor de muestras.', color: 0x5cff9c });
      s.cue('ruta de regreso', () => { const v = { k: 0 }; s.tweens.add({ targets: v, k: 0.62, duration: 2400, onUpdate: () => dib(v.k, 0x3ff3ff) }); });
      s.cue('golpe devastador', () => { dib(0.62, 0xff4a3d); s.tweens.add({ targets: err, alpha: 1, duration: 150, yoyo: true, repeat: -1, hold: 300 }); Sonido.mal(); s.cameras.main.shake(400, 0.006); });
      s.plano({ x: 420, y: 250, z: 1 }, { x: 450, y: 240, z: 1.15 }, 10000);
    },
  },
  ecuacion: {
    sp: () => ['rover_explorador', 'capsula_colibri', 'contenedor_muestras', eva('camina')],
    armar: s => {
      cabina(s);
      // balanza de masas: lo que la cápsula debe levantar
      const cap = actor(s, 'capsula_colibri', 170, PISO - 10, 4.2);
      const items: [string, number, string, number][] = [[eva('camina'), 2.7, `${NOMBRE()} + traje`, 330], ['contenedor_muestras', 2, 'Contenedor', 440], ['rover_explorador', 2.9, 'Rover · 180 kg', 570]];
      const obj = items.map(([id, e, n, x]) => { const a = pers(s, id, x, PISO, e, 1); const t = s.add.text(x, PISO + 14, n, { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: '#e8f6ff' }).setOrigin(0.5, 0); s.capa.add(t); return a; });
      const x0 = 110, y0 = 150, ancho = 420;
      const g = s.add.graphics().fillStyle(0x1b2236).fillRect(x0, y0, ancho, 24).lineStyle(2, 0xffffff, 0.6).strokeRect(x0, y0, ancho, 24);
      const meta = x0 + ancho * (2.8 / 3.2);
      g.lineStyle(3, 0x3cff6a).lineBetween(meta, y0 - 12, meta, y0 + 36);
      const barra = s.add.rectangle(x0, y0 + 12, 1, 20, 0x3ff3ff).setOrigin(0, 0.5);
      const lec = s.add.text(x0, y0 - 28, 'VELOCIDAD DE ESCAPE (Δv)', { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: '#9fdcff' });
      const nec = s.add.text(meta, y0 + 40, 'necesario 2,80', { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: CSS.verde }).setOrigin(0.5, 0);
      s.capa.add([g, barra, lec, nec]);
      s.cue('combustible fabricado', () => s.tweens.add({ targets: barra, width: ancho * (2.89 / 3.2), duration: 1600, ease: 'Cubic.out' }));
      s.senal('cápsula viaja ligera', cap, 'Cápsula ligera: sí llega', { alto: 200, color: 0x3cff6a });
      s.cue('180 kilos', () => { s.tweens.add({ targets: obj[2], y: PISO + 8, duration: 200, yoyo: true, repeat: 2 }); s.senal(null, obj[2], '+180 kg', { color: 0xff4a3d }); });
      s.cue('falla', () => { s.tweens.add({ targets: barra, width: ancho * (2.67 / 3.2), duration: 900, ease: 'Bounce.out' }); barra.setFillStyle(0xff4a3d); Sonido.mal(); s.cameras.main.shake(300, 0.005); });
      s.plano({ x: 330, y: 262, z: 1 }, { x: 340, y: 266, z: 1.1 }, 10000);
    },
  },
  dejar_masa: {
    sp: () => ['capsula_colibri', 'rover_explorador', eva('camina')],
    armar: s => {
      hielo(s);
      const cap = actor(s, 'capsula_colibri', 220, PISO - 6, 5.2);
      const p = pers(s, eva('camina'), 450, PISO + 8, 3, 6);
      const r = pers(s, 'rover_explorador', 700, PISO + 8, 3.3, 2);
      const marco = s.add.graphics().setAlpha(0); s.capa.add(marco);
      for (let a = 0; a < Math.PI * 2; a += 0.3) marco.lineStyle(3, 0xffe14d, 1).lineBetween(700 + Math.cos(a) * 92, PISO - 42 + Math.sin(a) * 66, 700 + Math.cos(a + 0.15) * 92, PISO - 42 + Math.sin(a + 0.15) * 66);
      s.senal('órbita de escape', cap, 'No alcanza para escapar', { alto: 250, color: 0xff4a3d });
      s.cue('promesa', () => p.mirar(4));
      s.cue('dejar masa atrás', () => { s.tweens.add({ targets: marco, alpha: 1, duration: 400 }); s.tweens.add({ targets: marco, alpha: 0.35, duration: 500, yoyo: true, repeat: -1, delay: 400 }); p.mirar(6); s.senal(null, r, '180 kg', { color: 0xffe14d }); s.plano({ x: 480, y: 258, z: 1.05 }, { x: 620, y: 285, z: 1.3 }, 3000); });
      s.plano({ x: 380, y: 250, z: 1 }, { x: 480, y: 258, z: 1.05 }, 7000);
    },
  },
  despedida: {
    sp: () => ['estado_rover_escarcha', eva('camina'), eva('arrodillado'), 'capsula_colibri'],
    armar: s => {
      hielo(s);
      actor(s, 'capsula_colibri', 860, PISO - 6, 5);
      const r = pers(s, 'estado_rover_escarcha', 380, PISO + 8, 3.4, 7, false);
      r.pausar();
      let p = pers(s, eva('camina'), 780, PISO + 10, 3.2, 2);
      s.cue('sale por última vez', () => andar(s, p, 500, PISO + 10, 2600));
      s.cue('se arrodilla', () => { s.tweens.killTweensOf(p); p.setPosition(500, PISO + 10); p = cambiar(s, p, eva('arrodillado'), 1); Sonido.click(); });
      s.senal('Rover', r, 'Su compañero de metal', { dato: 'Escarcha y cicatrices de todo el viaje.', color: 0x9fdcff });
      s.plano({ x: 620, y: 255, z: 1 }, { x: 450, y: 295, z: 1.4 }, 10000);
    },
  },
  faro: {
    sp: () => ['rover_explorador', 'antena_portatil', eva('arrodillado'), eva('saluda'), 'capsula_colibri'],
    armar: s => {
      hielo(s);
      actor(s, 'capsula_colibri', 880, PISO - 6, 5);
      const r = pers(s, 'rover_explorador', 430, PISO + 8, 3.4, 7);
      const ant = actor(s, 'antena_portatil', 280, PISO + 4, 3);
      let p = pers(s, eva('arrodillado'), 560, PISO + 10, 3.2, 1, false);
      const cable = s.add.graphics(); s.capa.add(cable);
      const luzRover = s.add.circle(r.x - 14, r.y - 96, 22, 0x9fdcff, 0.55).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(luzRover);
      s.tweens.add({ targets: luzRover, alpha: 0.12, scale: 0.6, duration: 11000, ease: 'Sine.in' });
      s.cue('Antena portátil', () => {
        const d = { k: 0 };
        s.tweens.add({ targets: d, k: 1, duration: 900, onUpdate: () => { cable.clear().lineStyle(4, 0xff6b2c, 1); cable.beginPath(); cable.moveTo(400, PISO + 2); cable.lineTo(400 - 110 * d.k, PISO + 6 + Math.sin(d.k * Math.PI) * 8); cable.strokePath(); } });
        for (let i = 0; i < 3; i++) { const o = s.add.circle(280, PISO - 92, 10).setStrokeStyle(3, 0x3ff3ff, 1); s.capa.add(o); s.tweens.add({ targets: o, radius: 110, alpha: 0, duration: 1700, delay: 900 + i * 500, repeat: -1 }); }
      });
      s.senal('faro de telemetría', ant, 'Faro de telemetría', { alto: 110, dato: 'Su señal guía el despegue de la cápsula.', color: 0x3ff3ff });
      s.cue('limpia el visor', () => { const b = s.add.star(446, PISO - 86, 4, 4, 12, 0xffffff).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(b); s.tweens.add({ targets: b, angle: 180, scale: 0, duration: 900, repeat: 2 }); });
      s.cue('saludo silencioso', () => { p = cambiar(s, p, eva('saluda'), 1); r.mirar(6); });
      s.plano({ x: 480, y: 258, z: 1.05 }, { x: 450, y: 290, z: 1.3 }, 10000);
    },
  },
  cuenta: {
    sp: ['capsula_colibri', 'rover_explorador', 'antena_portatil'],
    armar: s => {
      hielo(s);
      actor(s, 'capsula_colibri', 420, PISO - 6, 5.2);
      pers(s, 'rover_explorador', 740, PISO + 8, 3.2, 2);
      actor(s, 'antena_portatil', 850, PISO + 4, 2.8);
      const n = s.add.text(640, 190, '', { fontFamily: FUENTE_PIXEL, fontSize: '84px', color: CSS.amarillo, stroke: '#000', strokeThickness: 10 }).setOrigin(0.5);
      s.capa.add(n);
      const luz = s.add.ellipse(420, PISO - 14, 120, 30, 0xffb04d, 0).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(luz);
      const tic = (k: string) => () => { n.setText(k).setScale(1.7); s.tweens.add({ targets: n, scale: 1, duration: 320, ease: 'Back.out' }); Sonido.cuenta(); s.tweens.add({ targets: luz, fillAlpha: 0.25 + (3 - Number(k)) * 0.25, duration: 300 }); };
      s.cue('3,', tic('3')); s.cue(' 2,', tic('2')); s.cue(' 1', tic('1'));
      s.plano({ x: 480, y: 250, z: 1 }, { x: 470, y: 250, z: 1.12 }, 6000);
    },
  },
  despegue_colibri: {
    sp: ['capsula_colibri', 'humo_despegue', 'rover_explorador', 'estado_rover_escarcha', 'antena_portatil'],
    armar: s => {
      hielo(s);
      const humo = actor(s, 'humo_despegue', 300, PISO + 6, 4.6);
      const c = actor(s, 'capsula_colibri', 300, PISO - 6, 5);
      const llama = s.add.ellipse(300, PISO, 64, 120, 0xffb04d, 0.85).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(llama);
      s.tweens.add({ targets: c, y: -260, duration: 6500, ease: 'Quad.in', onUpdate: () => llama.setPosition(c.x, c.y + 40) });
      s.tweens.add({ targets: llama, scaleY: 1.5, duration: 90, yoyo: true, repeat: -1 });
      s.tweens.add({ targets: humo, alpha: 0, duration: 6000, delay: 2000 });
      actor(s, 'antena_portatil', 650, PISO + 4, 2.8);
      let r = pers(s, 'rover_explorador', 760, PISO + 8, 3.4, 3, false);
      const baliza = s.add.circle(772, PISO - 72, 6, 0xff5a3c, 1).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(baliza);
      const lat = s.tweens.add({ targets: baliza, alpha: 0.1, duration: 400, yoyo: true, repeat: -1 });
      Sonido.motor(3.5); s.cameras.main.shake(2600, 0.007);
      s.cue('se queda solo', () => { s.plano({ x: 480, y: 220, z: 1 }, { x: 720, y: 290, z: 1.35 }, 3200); s.senal(null, { get x() { return r.x; }, get y() { return r.y; } }, 'Señal firme', { alto: 120, color: 0x5cff9c }); });
      s.cue('congelarse', () => { r = cambiar(s, r, 'estado_rover_escarcha', 3, false); lat.timeScale = 0.35; });
      s.plano({ x: 400, y: 260, z: 1.05 }, { x: 480, y: 220, z: 1 }, 5000);
    },
  },

  // ─────────── EPÍLOGO ───────────
  travesia: {
    sp: ['capsula_colibri', 'jupiter', 'asteroide_metalico', 'marte', 'tierra'],
    armar: s => {
      espacio(s, 'azul');
      const c = actor(s, 'capsula_colibri', 280, 270, 3.2, 6);
      flotar(s, c, 8);
      const estela = s.add.rectangle(160, 222, 180, 5, 0x9fdcff, 0.5).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(estela);
      s.tweens.add({ targets: estela, scaleX: 0.5, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
      const pasa = (id: string, y: number, esc: number, etiqueta: string) => () => {
        const o = actor(s, id, 1150, y, esc);
        s.tweens.add({ targets: o, x: -220, duration: 4200, ease: 'Sine.inOut' });
        s.senal(null, o, etiqueta, { alto: 30 + esc * 20 });
      };
      s.cue('Júpiter', pasa('jupiter', 180, 2.6, 'Júpiter'));
      s.cue('cinturón de asteroides', () => [0, 1, 2].forEach(i => { const o = actor(s, 'asteroide_metalico', 1100 + i * 140, 120 + i * 110, 0.9 + i * 0.3, i); s.tweens.add({ targets: o, x: -200, duration: 3600 + i * 400 }); }));
      s.cue('Marte', pasa('marte', 330, 1.7, 'Marte'));
      s.cue('punto azul', () => {
        const t = actor(s, 'tierra', 820, 190, 0.1);
        s.tweens.add({ targets: t, scale: 2.6, duration: 5000, ease: 'Quad.in' });
        s.senal(null, t, 'Casa', { alto: 60, color: 0x5ab4ff });
        Sonido.bien();
      });
      s.plano({ x: 480, y: 235, z: 1.05 }, { x: 540, y: 225, z: 1.15 }, 11000);
    },
  },
  reentrada: {
    sp: ['capsula_colibri', 'polvo_aterrizaje', 'nube_bloques'],
    armar: s => {
      salar(s, 'gris');
      const nb = nubes(s, s.capa, 6, 70, 190, 2.4, 0.9);
      nb.forEach(n => n.base.setTint(0xc8ccd4));
      const c = actor(s, 'capsula_colibri', 520, -160, 4.6);
      const fuego = s.add.ellipse(520, -110, 100, 56, 0xff8a3d, 0.8).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(fuego);
      s.tweens.add({ targets: fuego, scale: 1.4, duration: 120, yoyo: true, repeat: -1 });
      s.cue('nubes', () => {
        s.tweens.add({ targets: c, y: 200, duration: 2600, ease: 'Quad.out', onUpdate: () => fuego.setPosition(c.x, c.y + 10) });
        nb.forEach((n, i) => s.tweens.add({ targets: n, x: n.x + (i % 2 ? 260 : -260), alpha: 0.4, duration: 2600 }));
        Sonido.motor(2);
      });
      s.cue('aterriza suavemente', () => {
        s.tweens.add({ targets: fuego, alpha: 0, duration: 500 });
        s.tweens.add({ targets: c, y: PISO - 6, duration: 2200, ease: 'Sine.out', onComplete: () => { const p = actor(s, 'polvo_aterrizaje', 520, PISO + 4, 4.4); s.tweens.add({ targets: p, alpha: 0, duration: 2200 }); s.cameras.main.shake(300, 0.005); Sonido.golpe(); } });
      });
      s.cue('Uyuni', () => s.rotulo('SALAR DE UYUNI', 'Meses después'));
      s.plano({ x: 500, y: 200, z: 1 }, { x: 510, y: 262, z: 1.1 }, 9000);
    },
  },
  cielo_azul: {
    sp: ['invernadero', 'sol', 'cepa_vial', 'capsula_colibri', 'nube_bloques', 'modulo_habitacional'],
    armar: s => {
      salar(s, 'gris');
      const azul = degradado(s, 0x2f7fe0, 0xbfe3ff).setAlpha(0);
      s.capa.addAt(azul, 1);
      const sol = actor(s, 'sol', 820, 270, 1.7).setAlpha(0);
      actor(s, 'modulo_habitacional', 860, PISO - 10, 4);
      actor(s, 'capsula_colibri', 150, PISO - 6, 4.6);
      const inv = actor(s, 'invernadero', 520, PISO + 8, 5.4);
      const vial = actor(s, 'cepa_vial', 520, PISO - 250, 0);
      s.cue('Invernadero', () => {
        s.tweens.add({ targets: vial, scale: 2.4, duration: 500, ease: 'Back.out' });
        s.tweens.add({ targets: vial, y: PISO - 150, alpha: 0, duration: 1400, delay: 700 });
        for (let i = 0; i < 4; i++) { const o = s.add.circle(520, PISO - 100, 20).setStrokeStyle(4, 0x5cff9c, 1); s.capa.add(o); s.tweens.add({ targets: o, radius: 620, alpha: 0, duration: 3200, delay: 1500 + i * 700, repeat: -1 }); }
        Sonido.bien();
      });
      s.senal('Invernadero', inv, 'El Invernadero libera la cura', { alto: 250, color: 0x5cff9c });
      s.cue('color azul', () => s.tweens.add({ targets: azul, alpha: 1, duration: 3500 }));
      s.cue('Sol radiante', () => {
        const ry = rayos(s, 820, 110, 0xfff2c0, 700, 14, 0.08).setAlpha(0);
        s.capa.addAt(ry, 2);
        s.tweens.add({ targets: ry, alpha: 1, duration: 3000 });
        s.tweens.add({ targets: sol, alpha: 1, y: 110, duration: 3000, ease: 'Sine.out' }); s.senal(null, sol, 'Cielo limpio', { alto: 60, color: 0xffe14d });
      });
      s.plano({ x: 480, y: 265, z: 1.1 }, { x: 520, y: 225, z: 1 }, 10000);
    },
  },
  reencuentro: {
    sp: () => [prota(), pose('abraza'), 'mascota_corre', 'mascota_salta', 'capsula_colibri', ...GENTE],
    armar: s => {
      salar(s, 'dia');
      nubes(s, s.capa, 4, 60, 170, 1.8);
      const cap = actor(s, 'capsula_colibri', 190, PISO - 4, 5);
      const puerta = s.add.rectangle(240, PISO - 70, 34, 80, 0xfff2c0, 0).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(puerta);
      let p = pers(s, prota(), 270, PISO + 8, 3.3, 7).setAlpha(0);
      let m = pers(s, 'mascota_corre', 1100, PISO + 12, 2.9, 2, false);
      const cor = s.add.text(455, 262, '♥', { fontFamily: FUENTE, fontSize: '46px', color: '#ff5f7a', stroke: '#3a0010', strokeThickness: 6 }).setOrigin(0.5).setScale(0);
      s.capa.add(cor);
      s.cue('compuerta se abre', () => { s.tweens.add({ targets: puerta, fillAlpha: 0.9, duration: 500 }); Sonido.click(); });
      s.senal('compuerta', cap, 'Cápsula Colibrí', { alto: 240 });
      s.cue('baja', () => { p.setAlpha(1); andar(s, p, 410, PISO + 8, 2200, () => p.mirar(7)); });
      s.cue('corre a sus brazos', () => {
        s.tweens.add({ targets: m, x: 478, duration: 1900, ease: 'Sine.in', onComplete: () => {
          m = cambiar(s, m, 'mascota_salta', 1);
          p = cambiar(s, p, pose('abraza'), 7);
          s.tweens.add({ targets: cor, scale: 1, duration: 500, ease: 'Back.out' }); s.tweens.add({ targets: cor, y: 250, duration: 800, yoyo: true, repeat: -1, delay: 500 });
          corazones(s, 455, 300, 16);
          Sonido.bien();
        } });
        s.plano({ x: 420, y: 262, z: 1.08 }, { x: 440, y: 300, z: 1.4 }, 3500);
      });
      s.senal(MASCOTA(), { get x() { return m.x; }, get y() { return m.y; } }, MASCOTA(), { alto: 64, color: 0xff8ab0 });
      // la ovación (Guía Maestra, fase 6): la gente de la Ciudadela llega corriendo a rodearle entre aplausos
      s.cue('Ciudadela', () => {
        s.time.delayedCall(1800, () => s.plano({ x: 440, y: 300, z: 1.4 }, { x: 600, y: 262, z: 1.0 }, 2600));   // primero el abrazo, después la gente
        [[560, 6], [625, 18], [690, 4], [755, 16], [820, 2], [885, 14]].forEach(([x, dy], k) => {
          const g = pers(s, GENTE[k % GENTE.length], 1040 + k * 46, PISO + dy, 2.6, 2, false);
          andar(s, g, x, PISO + dy, 1500 + k * 160, () => {
            g.mirar(2);   // miran hacia {NOMBRE}
            s.tweens.add({ targets: g, y: g.y - 9, duration: 230, yoyo: true, repeat: -1, ease: 'Sine.out', delay: k * 90 });   // saltan y aplauden
          });
        });
        s.time.delayedCall(1700, () => { confeti(s, 58); Sonido.bien(); });
      });
      s.plano({ x: 340, y: 255, z: 1.05 }, { x: 420, y: 262, z: 1.08 }, 6000);
    },
  },
  ultima_luz: {
    sp: ['estado_rover_escarcha', 'antena_portatil'],
    armar: s => {
      hielo(s, false);
      const punto = s.add.circle(300, 96, 3.5, 0x6ab8ff); s.capa.add(punto);
      s.tweens.add({ targets: punto, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
      actor(s, 'antena_portatil', 620, PISO + 4, 2.8).setAngle(-8);
      const r = pers(s, 'estado_rover_escarcha', 500, PISO + 8, 3.6, 3, false);
      r.pausar();
      puntoTex(s);
      s.capa.add(s.add.particles(0, -10, 'amb-punto', { x: { min: 0, max: W + 200 }, speedY: { min: 20, max: 50 }, speedX: { min: -15, max: 10 }, lifespan: 9000, frequency: calidadAlta() ? 60 : 180, scale: { min: 1, max: 2 }, alpha: { start: 0.8, end: 0.2 } }));
      const luz = s.add.circle(482, PISO - 104, 7, 0xff5a3c, 1).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(luz);
      const halo = s.add.circle(482, PISO - 104, 26, 0xff5a3c, 0.25).setBlendMode(Phaser.BlendModes.ADD); s.capa.add(halo);
      const lat = s.tweens.add({ targets: [luz, halo], alpha: 0.1, duration: 700, yoyo: true, repeat: -1 });
      s.rotulo('EUROPA', 'A 628 millones de kilómetros');
      s.senal('Rover', r, 'Rover explorador', { dato: 'Mantuvo la señal hasta el final.', color: 0x9fdcff });
      s.cue('última vez', () => { lat.stop(); s.tweens.add({ targets: [luz, halo], alpha: 1, duration: 300, yoyo: true, hold: 500, onComplete: () => s.tweens.add({ targets: [luz, halo], alpha: 0, duration: 1800 }) }); });
      s.cue('punto azul', () => { s.senal(null, punto, 'La Tierra', { alto: 14, color: 0x6ab8ff }); s.tweens.add({ targets: punto, radius: 6, duration: 1200 }); });
      s.plano({ x: 500, y: 295, z: 1.4 }, { x: 420, y: 225, z: 1 }, 11000);
    },
  },
};

// ═════════════════════════ Motor ═════════════════════════
export class Cinematica extends Phaser.Scene {
  capa!: Phaser.GameObjects.Container;      // el cuadro (se mueve con la cámara)
  frente!: Phaser.GameObjects.Container;    // primer término: se mueve más (paralaje)
  extra!: Phaser.GameObjects.Container;     // sobre la pantalla: tarjetas, rótulos, alertas
  fijo!: Phaser.GameObjects.Container;      // fijo a la pantalla pero por debajo de la franja de texto (visor del casco)
  espejo = false;
  reflejos: [Actor, Actor][] = [];
  sombras: [Actor, Phaser.GameObjects.Ellipse][] = [];
  marcas: Marca[] = [];
  private chips!: Phaser.GameObjects.Container;
  private cues: { idx: number; fn: () => void; hecho: boolean }[] = [];
  private cam = { de: { x: 480, y: CY, z: 1 } as Encuadre, a: { x: 480, y: CY, z: 1.08 } as Encuadre, t0: 0, dur: 9 };
  private bloque!: Bloque;
  private nombreBloque = '';
  private i = -1;
  private t = 0;
  private letras = 0;
  private texto!: Phaser.GameObjects.Text;
  private puntos: Phaser.GameObjects.Arc[] = [];
  private telon!: Telon;
  private resueltos = new Set<number>();   // cuadros interactivos ya jugados
  private flecha!: Phaser.GameObjects.Text;
  private ocupado = false;
  private completo = '';
  /** Texto ya cortado en renglones y, para cada letra de `completo`, cuántas letras de él mostrar. */
  private renglones = '';
  private mapa: number[] = [];
  private original = '';   // texto en español (para sincronizar las señales cuando se juega en inglés)
  private gracia = 0;       // segundos extra en pantalla cuando el jugador toca algo

  constructor() { super('Cinematica'); }

  init(d: { bloque?: string }): void {
    this.nombreBloque = d.bloque ?? 'prologo';
    this.bloque = HISTORIA[this.nombreBloque];
    this.i = -1; this.ocupado = false; this.resueltos = new Set();
  }

  preload(): void {
    const ids = new Set<string>(['jupiter', ...DECORADOS]);
    for (const c of this.bloque.cuadros) {
      const e = ESC[c.escenario];
      if (!e) throw new Error(`Escenario sin armar: ${c.escenario}`);
      (typeof e.sp === 'function' ? e.sp() : e.sp).forEach(id => ids.add(id));
    }
    cargar(this, [...ids]);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000');
    this.capa = this.add.container(0, 0).setDepth(0);
    this.chips = this.add.container(0, 0).setDepth(10);
    this.frente = this.add.container(0, 0).setDepth(20);
    // barras de cine, franja del texto en degradado y chip de la etapa
    this.add.rectangle(W / 2, 14, W, 28, 0x000000).setDepth(50);
    const franja = this.add.graphics().setDepth(50);
    franja.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.92, 0.92).fillRect(0, H - 150, W, 40);
    franja.fillStyle(0x000000, 0.92).fillRect(0, H - 110, W, 110);
    franja.lineStyle(1, 0x3ff3ff, 0.35).lineBetween(40, H - 112, W - 40, H - 112);
    // chip de la etapa, a la medida de su texto (en inglés es más largo)
    const etapa = this.add.text(20, 14, this.bloque.etapa, { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#1a1200' }).setOrigin(0, 0.5).setDepth(52);
    this.add.graphics().setDepth(51).fillStyle(0xffe14d, 1).fillRoundedRect(10, 4, etapa.width + 20, 20, 6);
    this.add.text(W - 14, 8, esTactil() ? 'Toca lo señalado · toca la pantalla para seguir' : 'Toca lo señalado · Espacio: seguir · Esc: saltar · F: pantalla completa', { fontFamily: FUENTE, fontSize: '11px', color: '#9aa3b5' }).setOrigin(1, 0).setDepth(51);
    const n = this.bloque.cuadros.length;
    this.puntos = Array.from({ length: n }, (_, k) => this.add.circle(W / 2 + (k - (n - 1) / 2) * 14, 14, 3.5, 0x33405a).setDepth(52));
    this.flecha = this.add.text(W - 40, H - 22, '▼', { fontFamily: FUENTE, fontSize: '16px', color: '#ffe14d' }).setOrigin(0.5).setDepth(53).setVisible(false);
    this.texto = this.add.text(W / 2, H - 60, '', {
      fontFamily: FUENTE, fontSize: '21px', fontStyle: 'italic 700', color: '#ffffff', align: 'left',
      wordWrap: { width: W - 120 }, lineSpacing: 5, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0).setDepth(52);
    this.extra = this.add.container(0, 0).setDepth(55);
    this.fijo = this.add.container(0, 0).setDepth(46);
    vineta(this, 0.5, 45);
    grano(this, 47);
    this.telon = new Telon(this, 60);

    this.input.keyboard?.on('keydown-ESC', () => this.terminar());
    botonSaltar(this, () => this.terminar());   // en celular no hay Esc
    this.input.keyboard?.on('keydown-SPACE', () => this.adelantar());
    this.input.keyboard?.on('keydown-ENTER', () => this.adelantar());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { Sonido.despertar(); if (!this.tocar(p)) this.adelantar(); });
    this.cameras.main.fadeIn(400);
    const desde = Number(new URLSearchParams(location.search).get('cuadro'));   // ?cuadro=N (pruebas)
    if (desde > 0 && desde < this.bloque.cuadros.length) this.i = desde - 1;
    this.siguienteCuadro(true);
  }

  // ───────────── API para los cuadros ─────────────
  /** Ejecuta `fn` cuando la narración termina de escribir `palabra`. */
  cue(palabra: string, fn: () => void): void {
    // En inglés la palabra (en español) se ubica en el texto original y se lleva a la misma proporción del traducido.
    let k = this.completo.indexOf(palabra), idx = k + palabra.length;
    if (k < 0) {
      const ko = this.original.indexOf(palabra);
      if (ko >= 0) { idx = Math.round(((ko + palabra.length) / this.original.length) * this.completo.length); k = ko; }
      else idx = 40;
    }
    this.cues.push({ idx, fn, hecho: false });
    if (k < 0 && import.meta.env.DEV) console.warn(`[cinemática] «${palabra}» no está en el texto de «${this.bloque.cuadros[this.i].escenario}»`);
  }

  /** Señala un objeto con una etiqueta cuando se escribe `palabra` (o ya mismo si es null). Se puede tocar para ver el dato. */
  senal(palabra: string | null, ref: Punto, etiqueta: string, o: { alto?: number; dato?: string; color?: number } = {}): void {
    const m: Marca = { ref, etiqueta, dato: o.dato, color: o.color ?? 0x3ff3ff, alto: o.alto ?? (ref instanceof Actor ? altoDe(ref) : 60) };
    this.marcas.push(m);
    if (palabra === null) this.mostrar(m); else this.cue(palabra, () => this.mostrar(m));
  }

  /** Encuadre de cámara: de `de` a `a` en `ms` (x, y = punto que queda al centro; z = acercamiento). */
  plano(de: Encuadre, a: Encuadre, ms: number): void { this.cam = { de, a, t0: this.t, dur: ms / 1000 }; }

  /** Rótulo de lugar tipo cine, abajo a la izquierda. */
  rotulo(titulo: string, sub: string): void {
    const c = this.add.container(40, H - 176);
    const linea = this.add.rectangle(0, 0, 4, 44, 0xffe14d).setOrigin(0, 0);
    const t = this.add.text(14, -2, titulo, { fontFamily: FUENTE_PIXEL, fontSize: '16px', color: '#ffffff', stroke: '#000', strokeThickness: 5 });
    const s2 = this.add.text(14, 26, sub, { fontFamily: FUENTE, fontSize: '14px', fontStyle: 'italic 700', color: '#ffe14d', stroke: '#000', strokeThickness: 4 });
    c.add([linea, t, s2]).setAlpha(0).setX(10);
    this.extra.add(c);
    this.tweens.add({ targets: c, alpha: 1, x: 40, duration: 500, ease: 'Cubic.out' });
    this.tweens.add({ targets: c, alpha: 0, duration: 600, delay: 5200 });
  }

  private mostrar(m: Marca): void {
    if (!m.chip) {
      const t = this.add.text(0, 0, m.etiqueta, { fontFamily: FUENTE, fontSize: '13px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);
      const w = t.width + 20;
      const g = this.add.graphics().fillStyle(0x040914, 0.9).fillRoundedRect(-w / 2, -12, w, 24, 9).lineStyle(2, m.color, 1).strokeRoundedRect(-w / 2, -12, w, 24, 9);
      g.lineStyle(1.5, m.color, 0.8).lineBetween(0, 12, 0, 26).fillStyle(m.color, 1).fillCircle(0, 28, 3);
      m.chip = this.add.container(0, 0, [g, t]);
      this.chips.add(m.chip);
      m.chip.setScale(0);
      this.tweens.add({ targets: m.chip, scale: 1, duration: 320, ease: 'Back.out' });
    } else this.tweens.add({ targets: m.chip, scale: 1.25, duration: 130, yoyo: true });
    const aro = this.add.circle(m.ref.x, m.ref.y - m.alto * 0.5, 14).setStrokeStyle(3, m.color, 1).setBlendMode(Phaser.BlendModes.ADD);
    this.capa.add(aro);
    this.tweens.add({ targets: aro, radius: Math.max(50, m.alto * 0.7), alpha: 0, duration: 700, onComplete: () => aro.destroy() });
    Sonido.tecla();
  }

  /** ¿El toque cayó sobre algo señalado? Muestra su dato. */
  private tocar(p: Phaser.Input.Pointer): boolean {
    const z = this.capa.scaleX, lx = (p.x - this.capa.x) / z, ly = (p.y - this.capa.y) / z;
    const m = this.marcas.find(k => k.chip && Math.abs(lx - k.ref.x) < Math.max(46, k.alto * 0.45) && ly < k.ref.y + 10 && ly > k.ref.y - k.alto - 44);
    if (!m) return false;
    this.mostrar(m);
    Sonido.click();
    this.gracia += 2.5;
    if (m.dato) {
      this.children.getByName('dato')?.destroy();
      const t = this.add.text(W / 2, 54, m.dato, { fontFamily: FUENTE, fontSize: '15px', fontStyle: '700', color: '#ffffff', backgroundColor: '#040914e6', padding: { x: 14, y: 8 }, align: 'center', wordWrap: { width: 620 } })
        .setOrigin(0.5, 0).setDepth(60).setName('dato').setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 200 });
      this.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 3600, onComplete: () => t.destroy() });
    }
    return true;
  }

  update(_: number, dt: number): void {
    if (this.i < 0 || this.i >= this.bloque.cuadros.length || this.ocupado) return;
    const s = dt / 1000;
    this.t += s;
    const antes = Math.floor(this.letras);
    this.letras = Math.min(this.completo.length, this.letras + s * VEL_TEXTO);
    const ahora = Math.floor(this.letras);
    if (ahora !== antes) {
      this.texto.setText(this.parcial(ahora));
      if (Math.floor(ahora / 3) > Math.floor(antes / 3)) Sonido.tecla();
    }
    // sincronía: lo que la narración nombra, ocurre
    for (const c of this.cues) if (!c.hecho && this.letras >= c.idx) { c.hecho = true; c.fn(); }
    // sombras, reflejos y etiquetas siguen a sus actores
    for (const [a, r] of this.reflejos) { if (!a.active) continue; r.setPosition(a.x, a.y).setAlpha(a.alpha * 0.28); if (r.dir !== a.dir) r.mirar(a.dir); }
    for (const [a, so] of this.sombras) { if (a.active) so.setPosition(a.x, a.y).setAlpha(a.alpha); }
    // cámara: interpola el encuadre
    const k = Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp((this.t - this.cam.t0) / this.cam.dur, 0, 1));
    const z = Phaser.Math.Linear(this.cam.de.z, this.cam.a.z, k);
    const fx = Phaser.Math.Linear(this.cam.de.x, this.cam.a.x, k), fy = Phaser.Math.Linear(this.cam.de.y, this.cam.a.y, k);
    const px = Phaser.Math.Clamp(W / 2 - fx * z, W - (W + 150) * z, 150 * z);
    const py = Phaser.Math.Clamp(CY - fy * z, H - (H + 100) * z, 60 * z);
    this.capa.setScale(z).setPosition(px, py);
    this.frente.setScale(z * 1.06).setPosition(px * 1.5 - W * 0.03 * z, py * 1.2);
    for (const m of this.marcas) if (m.chip) m.chip.setPosition(Phaser.Math.Clamp(px + m.ref.x * z, 90, W - 90), Phaser.Math.Clamp(py + (m.ref.y - m.alto) * z - 30, 48, H - 150));   // siempre dentro de la zona visible
    const extra = (this.bloque.cuadros[this.i].segundos ?? 0) + this.gracia;
    const completo = this.letras >= this.completo.length;
    this.flecha.setVisible(completo);
    if (completo && this.t > this.completo.length / VEL_TEXTO + PAUSA + extra && !Voz.hablando()) this.siguienteCuadro();
  }

  private adelantar(): void {
    if (this.ocupado) return;
    if (this.letras < this.completo.length) { this.letras = this.completo.length; this.texto.setText(this.parcial(this.completo.length)); }
    else this.siguienteCuadro();
  }

  private siguienteCuadro(primero = false): void {
    if (this.ocupado) return;
    // cuadro con decisión del jugador: se abre su escena encima y la historia sigue al terminar
    const actual = this.bloque.cuadros[this.i];
    if (!primero && actual?.interactivo && !this.resueltos.has(this.i)) {
      this.resueltos.add(this.i);
      this.ocupado = true;
      this.scene.launch(actual.interactivo, { alTerminar: () => { this.scene.resume(); this.ocupado = false; this.siguienteCuadro(); } });
      this.scene.pause();
      return;
    }
    this.ocupado = true;
    const sig = this.bloque.cuadros[this.i + 1];
    const tr: Transicion = sig ? TRANS[sig.escenario] ?? 'fundido' : 'fundido';
    const cambio = () => {
      this.i++;
      if (this.i >= this.bloque.cuadros.length) { this.terminar(); return; }
      this.armar(this.bloque.cuadros[this.i]);
      this.telon.abrir(primero ? 'fundido' : tr);
      this.ocupado = false;
    };
    if (primero) { cambio(); return; }
    this.telon.cerrar(tr, cambio);
  }

  private armar(c: Cuadro): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.cameras.main.resetFX();
    this.capa.removeAll(true); this.frente.removeAll(true); this.extra.removeAll(true); this.fijo.removeAll(true); this.chips.removeAll(true);
    this.children.getByName('dato')?.destroy();
    this.capa.setScale(1).setPosition(0, 0);
    this.espejo = false; this.reflejos = []; this.sombras = []; this.marcas = []; this.cues = [];
    this.original = personalizar(c.texto);
    this.completo = personalizar(t(c.texto));
    Voz.decir(this.completo);
    this.letras = 0; this.t = 0; this.gracia = 0;
    const pista = MOMENTOS.cuadros[`${this.nombreBloque}:${this.i}`];   // la música cambia en los momentos que marcan las directrices
    if (pista) Musica.poner(pista);
    else if (!Musica.sonando) { const previas = Object.keys(MOMENTOS.cuadros).filter(k => k.startsWith(this.nombreBloque + ':') && Number(k.split(':')[1]) <= this.i); if (previas.length) Musica.poner(MOMENTOS.cuadros[previas[previas.length - 1]]); }
    this.cam = { de: { x: 480, y: CY, z: 1 }, a: { x: 480, y: CY, z: 1.08 }, t0: 0, dur: 9 };
    colorear(this, LOOK[c.escenario] ?? 'neutro');
    ESC[c.escenario].armar(this);
    this.flecha.setY(H - 22).setAlpha(1);
    this.tweens.add({ targets: this.flecha, y: H - 16, alpha: 0.3, duration: 450, yoyo: true, repeat: -1 });
    this.puntos.forEach((p, k) => p.setFillStyle(k < this.i ? 0x3ff3ff : k === this.i ? 0xffe14d : 0x33405a).setRadius(k === this.i ? 5 : 3.5));
    this.prepararTexto();
    if (c.datos) this.tarjetaDatos(c.datos.titulo, c.datos.lineas, c.datos.izquierda);
  }

  /**
   * Subtítulo estable: se corta en renglones con el texto COMPLETO y el bloque se centra una sola vez en la franja.
   * Así, mientras se escribe letra por letra, nada salta ni se re-centra (antes cada letra movía la línea).
   */
  private prepararTexto(): void {
    const tx = this.texto;
    tx.setFontSize(21).setWordWrapWidth(W - 120);
    tx.setText(this.completo);
    if (tx.getWrappedText().length > 3) { tx.setFontSize(18); tx.setText(this.completo); }
    const lineas = tx.getWrappedText(), alto = tx.height, ancho = tx.width;
    this.renglones = lineas.join('\n');
    // mapa letra de `completo` → letras de `renglones` (los cortes cambian un espacio por un salto)
    this.mapa = [0];
    let j = 0;
    for (let i = 0; i < this.completo.length; i++) {
      while (j < this.renglones.length && this.renglones[j] === '\n' && this.completo[i] !== ' ' && this.completo[i] !== '\n') j++;
      j++;
      this.mapa.push(Math.min(j, this.renglones.length));
    }
    tx.setWordWrapWidth(null as unknown as number);   // ya viene cortado: que no lo vuelva a cortar distinto
    tx.setPosition(Math.round(W / 2 - ancho / 2), Math.round(H - 56 - alto / 2));
    tx.setText('');
  }

  private parcial(n: number): string { return this.renglones.slice(0, this.mapa[Math.min(n, this.mapa.length - 1)] ?? 0); }

  private tarjetaDatos(titulo: string, lineas: string[], izquierda = false): void {
    const x = izquierda ? 20 : W - 310, y = 62;
    const l = this.add.text(x + 16, y + 24, lineas.map(s => '▸ ' + t(s)).join('\n'), { fontFamily: FUENTE, fontSize: '14px', fontStyle: '700', color: '#ffffff', lineSpacing: 7, wordWrap: { width: 262 } });
    const alto = l.height + 42;
    const marco = panel(this, x + 145, y + alto / 2, 290, alto, { titulo, abrir: false, alfa: 0.88 });
    const c = this.add.container(izquierda ? -40 : 40, 0, [marco, l]).setAlpha(0);
    this.extra.add(c);
    this.tweens.add({ targets: c, alpha: 1, x: 0, duration: 500, delay: 900, ease: 'Cubic.out' });
  }

  private terminar(): void {
    Voz.callar();
    if (this.registry.get('terminando')) return;
    this.registry.set('terminando', true);
    this.ocupado = true;
    this.time.delayedCall(0, () => { this.registry.set('terminando', false); siguiente(this); });
  }
}
