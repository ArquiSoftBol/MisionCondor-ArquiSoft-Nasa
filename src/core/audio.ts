// Sonidos sintetizados con Web Audio: no hace falta ningún archivo.
import { perfil } from './estado';

let ctx: AudioContext | null = null;
const ac = (): AudioContext | null => {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

function tono(freq: number, dur: number, tipo: OscillatorType = 'square', vol = 0.06, desliz = 0): void {
  const a = ac(); if (!a || perfil.volumen <= 0) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = tipo; o.frequency.setValueAtTime(freq, t);
  if (desliz) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + desliz), t + dur);
  g.gain.setValueAtTime(vol * perfil.volumen, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}

function ruido(dur: number, vol = 0.1, corte = 900): void {
  const a = ac(); if (!a || perfil.volumen <= 0) return;
  const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) | 0; d[i] = ((s >>> 0) / 4294967296 * 2 - 1) * (1 - i / n); }
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'lowpass'; f.frequency.value = corte; g.gain.value = vol * perfil.volumen;
  src.buffer = buf; src.connect(f).connect(g).connect(a.destination); src.start();
}

export const Sonido = {
  tecla: () => tono(1400 + Math.random() * 200, 0.025, 'square', 0.025),
  click: () => tono(660, 0.06, 'triangle', 0.08),
  bien: () => { tono(660, 0.1, 'triangle', 0.08); setTimeout(() => tono(990, 0.16, 'triangle', 0.08), 90); },
  mal: () => tono(180, 0.25, 'sawtooth', 0.06, -80),
  alarma: () => { tono(880, 0.18, 'square', 0.05); setTimeout(() => tono(660, 0.18, 'square', 0.05), 200); },
  cuenta: () => tono(520, 0.15, 'sine', 0.1),
  motor: (dur = 2) => ruido(dur, 0.25, 400),
  golpe: () => ruido(0.6, 0.35, 1600),
  /** Desbloquear el audio en el primer toque (los navegadores lo exigen). */
  despertar: () => { ac(); },
};
