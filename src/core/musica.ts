// Música del juego según la «Guía Maestra Completa en Orden — Proyecto Cóndor» (ARQUISOFT, fases 0 a 6).
// Una pista a la vez, en bucle, con fundido cruzado. Si el navegador bloquea el audio, arranca al primer toque.
//   Fase 0  Menú ........................ MENU.mp3            → menu
//   Fase 1  Prólogo en Uyuni ............ Enero 1V.mp3        → enero
//   Fase 1B Minijuegos tranquilos ....... ROVER / ROVER 2.0   → rover, rover2 (al 35 %, nunca en desastres)
//   Fase 2  Despegue y viaje ............ Despliegue 123.mp3  → despliegue
//   Fase 3  Marte · Base Tari ........... TIC TAC ROVER.mp3   → tictac-marte
//   Fase 4  Europa: choque y perforación  suspenso oscuro generado con Web Audio (sin archivo) → suspenso
//   Fase 5  Sin combustible (cabina) .... TIC TAC ROVER 2.mp3 → tictac-cabina
//   Fase 6  Sacrificio, regreso y final . Sacrificio.mp3      → sacrificio
// La transmisión previa al menú (IntroRadio) sigue con su propia pista: intro-radio.
import { perfil } from './estado';

export type Pista = 'menu' | 'intro-radio' | 'enero' | 'rover' | 'rover2' | 'despliegue' | 'tictac-marte' | 'suspenso' | 'tictac-cabina' | 'sacrificio';

/** Qué pista suena en cada momento (única fuente de verdad). */
export const MOMENTOS = {
  // cinemáticas: «bloque:índice del cuadro» → pista desde ese cuadro en adelante
  cuadros: {
    'prologo:0': 'enero',            // Fase 1 · ritual de la sal, cielo con HUD, la promesa
    'nudo1:0': 'enero',              // … y la entrada al Hangar de Ensamblaje
    'nudo2:0': 'enero',
    'nudo3:0': 'despliegue',         // Fase 2 · el viaje tras el despegue
    'nudo3b:0': 'tictac-marte',      // Fase 3 · tonos oscuros finales: Marte queda atrás (tras el minijuego)
    'nudo3b:2': 'suspenso',          // Fase 4 · descenso violento, sismo y alertas (suspenso oscuro)
    'climax:0': 'tictac-cabina',     // Fase 5 · cabina: la ecuación del cohete falla
    'climax:2': 'sacrificio',        // Fase 6 · dejar masa, despedida, regreso
    'epilogo:0': 'sacrificio',
  } as Record<string, Pista>,
  // qué suena al entrar a cada escena (null = silencio). Las que no están aquí manejan su música solas:
  // IntroRadio (transmisión, una sola vez), Cinematica (por cuadro, arriba), Pausa y Ecuacion (encima de otra escena).
  escenas: {
    Arranque: null, Recomendaciones: null, Logo: null,      // silencio: el logo deja respirar antes de la transmisión
    Titulo: 'menu', Archivo: 'menu', MultiLobby: 'menu',    // Fase 0
    Registro: 'enero',               // al pulsar «Jugar» el menú se apaga y arranca la Fase 1
    Mision1Sistemas: 'rover',        // Fase 1B · construcción tranquila (alternando ROVER / ROVER 2.0)
    Mision2Cohete: 'rover2',
    Mision3Orion: 'rover',
    Coop: 'rover2',                  // multijugador: armado tranquilo en equipo
    Mision4Despegue: 'despliegue',   // Fase 2 · lanzamiento
    MisionMarte: 'tictac-marte',     // Fase 3 · Base Tari: calma, tormenta de óxido y escape (sincronizado)
    Mision5Rover: 'suspenso',        // Fase 4 · perforación en Europa: nunca ROVER aquí
    Fin: 'sacrificio',
  } as Record<string, Pista | null>,
};

/** Volumen de cada pista respecto del general (las de construcción van suaves, al 35 %). */
const VOL_PISTA: Partial<Record<Pista, number>> = { rover: 0.35, rover2: 0.35 };
const VOL = 0.55;                    // la música va por debajo de los efectos
const nivelDe = (id: Pista) => (VOL_PISTA[id] ?? VOL) * perfil.volumen;

/** Una pista sonando: un archivo (HTMLAudioElement) o el sintetizador de suspenso. */
interface Sonando { id: Pista; volumen: number; fijar(v: number): void; parar(): void; get tiempo(): number; get terminada(): boolean }
let actual: Sonando | null = null;
let pendiente: (() => void) | null = null;

/** Fundido de volumen (con reloj además de rAF: con la pestaña en segundo plano rAF no corre). */
function fundir(s: Sonando, hasta: number, ms: number, alFinal?: () => void): void {
  const desde = s.volumen, t0 = performance.now();
  let hecho = false;
  const fin = () => { if (hecho) return; hecho = true; s.fijar(hasta); alFinal?.(); };
  const paso = () => {
    if (hecho) return;
    const k = Math.min(1, (performance.now() - t0) / ms);
    s.fijar(Math.max(0, Math.min(1, desde + (hasta - desde) * k)));
    if (k < 1) requestAnimationFrame(paso); else fin();
  };
  const reloj = setInterval(() => { if (performance.now() - t0 >= ms) { clearInterval(reloj); fin(); } }, 100);
  paso();
}

function archivo(id: Pista, bucle: boolean): Sonando & { el: HTMLAudioElement } {
  const el = new Audio(`audio/${id}.mp3`);
  el.loop = bucle; el.volume = 0; el.preload = 'auto';
  return {
    id, el, volumen: 0,
    fijar(v) { this.volumen = v; el.volume = v; },
    parar() { el.pause(); el.src = ''; },
    get tiempo() { return !el.paused ? el.currentTime : 0; },
    get terminada() { return el.ended; },
  };
}

// ───────── Suspenso oscuro (Fase 4): se genera en vivo con Web Audio ─────────
// Drones graves tipo órgano, sub-bajo que late, cuerdas tensas que crecen y, de vez en cuando, hielo que cruje.
let ctx: AudioContext | null = null;
function suspenso(): Sonando {
  ctx ??= new AudioContext();
  const c = ctx, t0 = c.currentTime;
  const salida = c.createGain(); salida.gain.value = 0; salida.connect(c.destination);
  const nodos: AudioScheduledSourceNode[] = [];
  const osc = (tipo: OscillatorType, f: number, g: number, destino: AudioNode | AudioParam, detune = 0) => {
    const o = c.createOscillator(), v = c.createGain();
    o.type = tipo; o.frequency.value = f; o.detune.value = detune; v.gain.value = g;
    o.connect(v);
    if (destino instanceof AudioParam) v.connect(destino); else v.connect(destino);
    o.start(); nodos.push(o);
    return { o, v };
  };
  // órgano grave: La1 + Mi2 + armónicos, por un filtro paso bajo que respira
  const filtro = c.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 420; filtro.Q.value = 4; filtro.connect(salida);
  [[55, 0.22], [82.41, 0.14], [110, 0.08], [164.8, 0.05]].forEach(([f, g], i) => { osc('sawtooth', f, g, filtro, -6); osc('sine', f, g * 0.8, filtro, 5 + i); });
  const lfoF = osc('sine', 0.05, 180, filtro.frequency).o; void lfoF;
  // sub-bajo que late como un corazón lento
  const sub = osc('sine', 36.7, 0, salida);
  const latido = osc('sine', 0.75, 0.32, sub.v.gain); void latido;
  // cuerdas tensas: cluster agudo con trémolo que sube y baja muy lento
  const cuerdas = c.createGain(); cuerdas.gain.value = 0.0; cuerdas.connect(salida);
  [659.3, 698.5, 987.8].forEach((f, i) => osc('triangle', f, 0.025, cuerdas, i * 7 - 7));
  osc('sine', 0.03, 0.5, cuerdas.gain);
  // hielo que cruje: ráfagas de ruido filtrado cada 5–9 s
  const ruido = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate), d = ruido.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  let crujido = 0;
  const crujir = () => {
    if (!vivo) return;
    const s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = ruido; s.playbackRate.value = 0.5 + Math.random() * 0.6; hp.type = 'bandpass'; hp.frequency.value = 900 + Math.random() * 1800; hp.Q.value = 2; g.gain.value = 0.5;
    s.connect(hp).connect(g).connect(salida); s.start();
    crujido = window.setTimeout(crujir, 5000 + Math.random() * 4000);
  };
  let vivo = true;
  crujido = window.setTimeout(crujir, 2500);
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  return {
    id: 'suspenso', volumen: 0,
    fijar(v) { this.volumen = v; salida.gain.setTargetAtTime(v, c.currentTime, 0.05); },
    parar() { vivo = false; clearTimeout(crujido); nodos.forEach(n => { try { n.stop(); } catch { /* */ } }); setTimeout(() => salida.disconnect(), 200); },
    get tiempo() { return c.currentTime - t0; },
    get terminada() { return false; },
  };
}

function reintentar(): void {
  if (pendiente) return;
  const ir = () => {
    window.removeEventListener('pointerdown', ir); window.removeEventListener('keydown', ir);
    const p = pendiente; pendiente = null; p?.();
  };
  pendiente = () => {
    if (!actual) return;
    if ('el' in actual) void (actual as Sonando & { el: HTMLAudioElement }).el.play().catch(() => reintentar());
    else void ctx?.resume();
  };
  window.addEventListener('pointerdown', ir); window.addEventListener('keydown', ir);
}

export const Musica = {
  /** Pone una pista (si ya suena, no hace nada). La anterior se apaga en 1 s. */
  poner(id: Pista, bucle = true): void {
    if (actual?.id === id) return;
    this.parar(1000);
    if (id === 'suspenso') {
      const s = suspenso();
      actual = s;
      fundir(s, nivelDe(id), 2200);
      if (ctx?.state === 'suspended') reintentar();
      return;
    }
    const s = archivo(id, bucle);
    actual = s;
    void s.el.play().then(() => fundir(s, nivelDe(id), 1400)).catch(() => { s.fijar(nivelDe(id)); reintentar(); });
  },
  /** Vuelve la pista actual al segundo `seg` (para sincronizar un minijuego con su música). */
  desde(seg = 0): void { if (actual && 'el' in actual) (actual as Sonando & { el: HTMLAudioElement }).el.currentTime = seg; },
  parar(ms = 700): void {
    const v = actual; actual = null;
    if (v) fundir(v, 0, ms, () => v.parar());
  },
  /** Música que corresponde a una escena al entrar (la llama un gancho global en main.ts). */
  paraEscena(clave: string): void {
    if (!(clave in MOMENTOS.escenas)) return;
    const p = MOMENTOS.escenas[clave];
    if (p === null) this.parar(600); else this.poner(p);
  },
  /** Aplicar el volumen de los ajustes. */
  volumen(): void { if (actual) actual.fijar(nivelDe(actual.id)); },
  /** Baja la música mientras el juego está en pausa. */
  atenuar(si: boolean): void { if (actual) actual.fijar(nivelDe(actual.id) * (si ? 0.35 : 1)); },
  get sonando(): Pista | null { return actual?.id ?? null; },
  /** Segundos reproducidos de la pista actual (0 si no suena todavía). Sirve para sincronizar imagen y sonido. */
  get tiempo(): number { return actual?.tiempo ?? 0; },
  /** ¿La pista actual (sin bucle) ya terminó? */
  get terminada(): boolean { return !!actual?.terminada; },
};
