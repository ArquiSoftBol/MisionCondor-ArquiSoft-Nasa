// Reglas del modo en equipo que el cliente usa para AYUDAR (el servidor sigue siendo la autoridad).
// Sin Phaser ni textos traducidos: así se prueban con node:test (tests/logica/) contra el servidor real.

export type Rol = 'ingeniero' | 'recolector';
export interface ItemDef { id: string; sprite: string; nombre: string; kg: number; sistema?: string | null; x: number; y: number; zona: string; rechazo?: string }
export interface Receta { tipo: 'sistemas' | 'orden'; ranuras?: string[]; masaMax?: number; orden?: string[] }
export interface EstadoCoop {
  items: { id: string; estado: string; x: number; y: number }[];
  carga: string[]; bandeja: string[]; montado: { id: string; sistema: string | null }[];
  masa: number; errores: number; pedido: string | null; inicio: number; ahora?: number;
  fin: { segundos: number; errores: number; estrellas: number } | null;
}

export const SISTEMA_NOMBRE: Record<string, string> = { energia: 'Energía', control: 'Control', comunicacion: 'Comunicación', propulsion: 'Propulsión' };

/** Mensaje sin traducir: clave + valores para t(). */
export interface Msg { k: string; p?: Record<string, string | number> }
export interface Veredicto { tipo: 'ahora' | 'despues' | 'no'; msg: Msg | null }

/** ¿Esta pieza de la bandeja se puede montar ya? Misma regla que validarMontaje() del servidor. */
export function veredicto(items: ItemDef[], receta: Receta, e: EstadoCoop, id: string): Veredicto {
  const d = items.find(i => i.id === id);
  if (!d) return { tipo: 'no', msg: { k: 'Esa pieza no existe.' } };
  if (d.rechazo) return { tipo: 'no', msg: { k: d.rechazo } };
  if (receta.tipo === 'sistemas') {
    if (!d.sistema) return { tipo: 'no', msg: { k: 'Eso no es un sistema del vehículo.' } };
    if (e.montado.some(m => m.sistema === d.sistema)) return { tipo: 'no', msg: { k: 'Ya hay una pieza de {s}.', p: { s: SISTEMA_NOMBRE[d.sistema] ?? d.sistema } } };
    if (receta.masaMax && e.masa + d.kg > receta.masaMax) return { tipo: 'no', msg: { k: 'Con {k} kg se pasa del límite de {m} kg.', p: { k: d.kg, m: receta.masaMax } } };
    return { tipo: 'ahora', msg: null };
  }
  const orden = receta.orden ?? [], sigue = orden[e.montado.length];
  if (d.nombre === sigue) return { tipo: 'ahora', msg: null };
  if (orden.slice(e.montado.length).includes(d.nombre)) return { tipo: 'despues', msg: { k: 'primero va: {p}.', p: { p: sigue } } };
  return { tipo: 'no', msg: { k: 'Esa pieza no va en el cohete.' } };
}

/** La pieza que conviene pedir: una que falta, que nadie trae todavía y que no es trampa. */
export function sugerenciaPedido(items: ItemDef[], receta: Receta, e: EstadoCoop): string | null {
  const def = (id: string) => items.find(i => i.id === id)!;
  const enCamino = (id: string) => e.carga.includes(id) || e.bandeja.includes(id) || e.montado.some(m => m.id === id);
  const libres = items.filter(d => !d.rechazo && !enCamino(d.id) && e.items.find(i => i.id === d.id)?.estado === 'libre');
  const vienen = e.bandeja.concat(e.carga).map(def).filter(d => !d.rechazo);
  if (receta.tipo === 'sistemas') {
    const falta = (receta.ranuras ?? []).filter(k => !e.montado.some(m => m.sistema === k) && !vienen.some(d => d.sistema === k));
    const masaLibre = (receta.masaMax ?? Infinity) - e.masa - vienen.reduce((n, d) => n + d.kg, 0);
    // primero la que cabe en el límite de masa; si ninguna cabe, igual la que falta (el Ingeniero verá por qué no)
    const candidatas = libres.filter(d => d.sistema && falta.includes(d.sistema));
    return (candidatas.find(d => d.kg <= masaLibre) ?? candidatas[0])?.id ?? null;
  }
  const pendientes = (receta.orden ?? []).slice(e.montado.length);
  for (const n of pendientes) {
    const yaVienen = vienen.filter(d => d.nombre === n).length;
    const necesarias = pendientes.filter(x => x === n).length;
    if (yaVienen < necesarias) { const d = libres.find(x => x.nombre === n); if (d) return d.id; }
  }
  return null;
}

/** La pieza de la bandeja que conviene montar primero (la primera que «va ahora»). */
export function piezaParaMontar(items: ItemDef[], receta: Receta, e: EstadoCoop): string | null {
  return e.bandeja.find(id => veredicto(items, receta, e, id).tipo === 'ahora') ?? null;
}

/** Calibración: la aguja vale si cae en la zona verde (con un margen por la demora del toque). */
export const MARGEN_CALIBRACION = 0.03;
export const calibracionValida = (aguja: number, zona: [number, number]): boolean => aguja >= zona[0] - MARGEN_CALIBRACION && aguja <= zona[1] + MARGEN_CALIBRACION;

/** Avance de la aguja (rebota en 0 y 1). */
export function moverAguja(aguja: number, dir: number, dt: number, vel = 0.55): { aguja: number; dir: number } {
  let a = aguja + dir * dt * vel, d = dir;
  if (a > 1) { a = 1; d = -1; } else if (a < 0) { a = 0; d = 1; }
  return { aguja: a, dir: d };
}

// ───────── compañeros (NPC) ─────────
export interface Companero { sprite: string; nombre: string; x: number; y: number; radio?: number; frases: string[]; escala?: number }
export interface Cuerpo { x: number; y: number; rx: number; ry: number }

/** ¿El punto pisa algún cuerpo sólido (con un margen r)? */
export function pisa(cuerpos: Cuerpo[], x: number, y: number, r = 20): boolean {
  return cuerpos.some(c => Math.hypot((x - c.x) / (c.rx + r), (y - c.y) / (c.ry + r * 0.5)) < 1);
}

/** ¿El tramo recto a→b está libre de sólidos? (se revisa cada 12 px) */
export function tramoLibre(cuerpos: Cuerpo[], ax: number, ay: number, bx: number, by: number, r = 20): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 12));
  for (let k = 0; k <= n; k++) if (pisa(cuerpos, ax + (bx - ax) * k / n, ay + (by - ay) * k / n, r)) return false;
  return true;
}

/**
 * Paseo de un compañero: puntos alrededor de su casa a los que se llega en línea recta sin atravesar edificios.
 * Casa → punto 1 → casa → punto 2 → … (siempre vuelve a casa, así ningún tramo cruza un edificio).
 */
export function paseo(c: Companero, cuerpos: Cuerpo[], ancho: number, alto: number): [number, number][] {
  const r = c.radio ?? 140, pts: [number, number][] = [];
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + 0.3, d = r * (k % 2 ? 0.6 : 1);
    const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.6;
    if (x < 60 || y < 90 || x > ancho - 60 || y > alto - 40) continue;
    if (tramoLibre(cuerpos, c.x, c.y, x, y)) pts.push([x, y]);
  }
  const ruta: [number, number][] = [];
  pts.forEach(p => { ruta.push([c.x, c.y], p); });
  return ruta.length ? ruta : [[c.x, c.y]];
}

/**
 * Dónde está el compañero en el instante t (ms, hora del servidor): igual en los dos aparatos.
 * Camina a `vel` px/s entre los puntos y se queda `pausa` ms en cada uno.
 */
export function posicionEn(ruta: [number, number][], t: number, desfase = 0, vel = 55, pausa = 2600): { x: number; y: number; dx: number; dy: number; camina: boolean } {
  if (ruta.length < 2) return { x: ruta[0][0], y: ruta[0][1], dx: 0, dy: 1, camina: false };
  const tramos = ruta.map((p, i) => { const q = ruta[(i + 1) % ruta.length]; return { p, q, ms: Math.hypot(q[0] - p[0], q[1] - p[1]) / vel * 1000 }; });
  const total = tramos.reduce((n, s) => n + s.ms + pausa, 0);
  let u = (((t + desfase) % total) + total) % total;
  for (const s of tramos) {
    if (u < pausa) return { x: s.p[0], y: s.p[1], dx: s.q[0] - s.p[0], dy: s.q[1] - s.p[1], camina: false };
    u -= pausa;
    if (u < s.ms) { const f = u / s.ms; return { x: s.p[0] + (s.q[0] - s.p[0]) * f, y: s.p[1] + (s.q[1] - s.p[1]) * f, dx: s.q[0] - s.p[0], dy: s.q[1] - s.p[1], camina: true }; }
    u -= s.ms;
  }
  return { x: ruta[0][0], y: ruta[0][1], dx: 0, dy: 1, camina: false };
}
