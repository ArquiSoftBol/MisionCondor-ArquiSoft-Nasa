// Servidor de Misión Cóndor — sin dependencias (solo Node.js 22.5+; se probó con Node 24):
//   · sirve el juego (si junto a este archivo está index.html, como en dist/)
//   · MULTIJUGADOR por WebSocket en /ws: salas con código, roles Ingeniero / Recolector, estado compartido
//   · base de datos SQLite (node:sqlite, incluida en Node): jugadores (sin correo: clave anónima del navegador), salas y partidas
//   · API: GET /api/salud · GET /api/ranking?escenario=salar
// Uso:  node servir.mjs        → http://localhost:8080   (PORT=xxxx para otro puerto)
// Datos: carpeta datos/ junto a este archivo (o CONDOR_DATOS=/ruta).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = Number(process.env.PORT) || (fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.html')) ? 8080 : 8787);   // 8787: solo multijugador (desarrollo)
const CON_JUEGO = fs.existsSync(path.join(RAIZ, 'index.html'));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

// ───────────────────────── Base de datos ─────────────────────────
const DATOS = process.env.CONDOR_DATOS || path.join(RAIZ, 'datos');
fs.mkdirSync(DATOS, { recursive: true });
const db = new DatabaseSync(path.join(DATOS, 'condor.db'));
// versiones anteriores identificaban por correo: la columna pasa a llamarse «clave»
try { if (db.prepare('PRAGMA table_info(jugadores)').all().some(c => c.name === 'email')) db.exec('ALTER TABLE jugadores RENAME COLUMN email TO clave'); } catch { /* tabla nueva */ }
db.exec(`
  CREATE TABLE IF NOT EXISTS jugadores (clave TEXT PRIMARY KEY, nombre TEXT NOT NULL, creado INTEGER NOT NULL, visto INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS salas (codigo TEXT PRIMARY KEY, escenario TEXT NOT NULL, anfitrion TEXT NOT NULL, creada INTEGER NOT NULL, estado TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS partidas (id INTEGER PRIMARY KEY AUTOINCREMENT, sala TEXT, escenario TEXT, ingeniero TEXT, recolector TEXT,
    segundos INTEGER, errores INTEGER, estrellas INTEGER, fecha INTEGER);
`);
const q = {
  jugador: db.prepare('INSERT INTO jugadores (clave, nombre, creado, visto) VALUES (?, ?, ?, ?) ON CONFLICT(clave) DO UPDATE SET nombre = excluded.nombre, visto = excluded.visto'),
  sala: db.prepare('INSERT OR REPLACE INTO salas (codigo, escenario, anfitrion, creada, estado) VALUES (?, ?, ?, ?, ?)'),
  estadoSala: db.prepare('UPDATE salas SET estado = ? WHERE codigo = ?'),
  partida: db.prepare('INSERT INTO partidas (sala, escenario, ingeniero, recolector, segundos, errores, estrellas, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  mejores: db.prepare('SELECT escenario, MAX(estrellas) AS estrellas, MIN(segundos) AS segundos, COUNT(*) AS partidas FROM partidas WHERE ingeniero = ? OR recolector = ? GROUP BY escenario'),
  ranking: db.prepare(`SELECT p.estrellas, p.segundos, p.errores, ji.nombre AS ingeniero, jr.nombre AS recolector, p.fecha FROM partidas p
    LEFT JOIN jugadores ji ON ji.clave = p.ingeniero LEFT JOIN jugadores jr ON jr.clave = p.recolector
    WHERE p.escenario = ? ORDER BY p.estrellas DESC, p.segundos ASC LIMIT 10`),
};

// ───────────────────────── Escenarios ─────────────────────────
const leerEscenarios = () => {
  for (const f of [path.join(RAIZ, 'coop', 'escenarios.json'), path.join(RAIZ, '..', 'public', 'coop', 'escenarios.json')])
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  throw new Error('No encuentro coop/escenarios.json');
};
const ESCENARIOS = leerEscenarios();

// ───────────────────────── WebSocket mínimo (RFC 6455) ─────────────────────────
const MAX_MENSAJE = 64 * 1024;
function trama(texto) {
  const datos = Buffer.from(texto), n = datos.length;
  const cab = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([cab, datos]);
}
function aceptarWS(req, socket, alConectar) {
  const clave = req.headers['sec-websocket-key'];
  if (!clave) { socket.destroy(); return; }
  const acepta = crypto.createHash('sha1').update(clave + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acepta}\r\n\r\n`);
  socket.setNoDelay(true);
  const con = {
    vivo: true, buf: Buffer.alloc(0), alMensaje: null, alCerrar: null,
    enviar(obj) { if (this.vivo) try { socket.write(trama(JSON.stringify(obj))); } catch { /* cerrada */ } },
    cerrar() { if (!this.vivo) return; this.vivo = false; try { socket.end(Buffer.from([0x88, 0])); } catch { /* */ } this.alCerrar?.(); },
  };
  socket.on('data', d => {
    con.buf = Buffer.concat([con.buf, d]);
    while (con.buf.length >= 2) {
      const b0 = con.buf[0], b1 = con.buf[1], op = b0 & 0x0f, enmascarado = b1 & 0x80;
      let largo = b1 & 0x7f, off = 2;
      if (largo === 126) { if (con.buf.length < 4) return; largo = con.buf.readUInt16BE(2); off = 4; }
      else if (largo === 127) { if (con.buf.length < 10) return; largo = Number(con.buf.readBigUInt64BE(2)); off = 10; }
      if (largo > MAX_MENSAJE) { con.cerrar(); return; }
      const mascara = enmascarado ? con.buf.subarray(off, off + 4) : null;
      if (enmascarado) off += 4;
      if (con.buf.length < off + largo) return;
      const carga = Buffer.from(con.buf.subarray(off, off + largo));
      con.buf = con.buf.subarray(off + largo);
      if (mascara) for (let i = 0; i < carga.length; i++) carga[i] ^= mascara[i & 3];
      if (op === 0x8) { con.cerrar(); return; }
      if (op === 0x9) { try { socket.write(Buffer.concat([Buffer.from([0x8a, carga.length]), carga])); } catch { /* */ } continue; }
      if (op === 0x1) {
        let m;
        try { m = JSON.parse(carga.toString('utf8')); } catch { continue; }   // mensaje inválido: se ignora
        try { con.alMensaje?.(m); } catch (e) { console.error('[ws] error con', m?.t, e); }
      }
    }
  });
  // latido: los proxies de los hostings (Render, Fly, Nginx…) cortan un WebSocket callado a los ~60 s
  const latido = setInterval(() => { if (con.vivo) try { socket.write(Buffer.from([0x89, 0])); } catch { /* */ } }, 25000);
  socket.on('close', () => { clearInterval(latido); if (con.vivo) { con.vivo = false; con.alCerrar?.(); } });
  socket.on('error', () => socket.destroy());
  alConectar(con);
}

// ───────────────────────── Salas y partidas ─────────────────────────
const salas = new Map();   // codigo → sala
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nuevoCodigo = () => { let c; do { c = Array.from({ length: 6 }, () => LETRAS[crypto.randomInt(LETRAS.length)]).join(''); } while (salas.has(c)); return c; };
const claveValida = k => typeof k === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(k);   // la genera el navegador (no es un dato personal)
const limpiar = (s, n = 24) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);

function vistaSala(s) {
  return { codigo: s.codigo, escenario: s.escenario, fase: s.fase, jugadores: s.jugadores.map(j => ({ id: j.id, nombre: j.nombre, rol: j.rol, listo: j.listo, conectado: j.con?.vivo ?? false })) };
}
function difundir(s, msg, salvo) { s.jugadores.forEach(j => { if (j !== salvo) j.con?.enviar(msg); }); }
function avisarSala(s) { difundir(s, { t: 'sala', sala: vistaSala(s) }); }

function estadoJuego(s) {
  const e = s.juego;
  return { t: 'estado', items: e.items, carga: e.carga, bandeja: e.bandeja, montado: e.montado, masa: e.masa, errores: e.errores, pedido: e.pedido, inicio: e.inicio, fin: e.fin ?? null, ahora: Date.now() };
}

function empezar(s) {
  const esc = ESCENARIOS[s.escenario];
  s.fase = 'juego';
  s.juego = {
    inicio: Date.now(), errores: 0, masa: 0, pedido: null, carga: [], bandeja: [], montado: [],
    items: esc.items.map(i => ({ id: i.id, estado: 'libre', x: i.x, y: i.y })),
  };
  q.estadoSala.run('juego', s.codigo);
  s.jugadores.forEach(j => j.con?.enviar({ t: 'inicio', escenario: s.escenario, rol: j.rol, yo: j.id, sala: vistaSala(s) }));
  difundir(s, estadoJuego(s));
}

function terminar(s) {
  const esc = ESCENARIOS[s.escenario], e = s.juego;
  const segundos = Math.round((Date.now() - e.inicio) / 1000);
  let estrellas = segundos <= esc.tiempo * 0.6 ? 3 : segundos <= esc.tiempo ? 2 : 1;
  if (e.errores >= 3) estrellas = Math.max(1, estrellas - 1);
  const ing = s.jugadores.find(j => j.rol === 'ingeniero'), rec = s.jugadores.find(j => j.rol === 'recolector');
  q.partida.run(s.codigo, s.escenario, ing?.clave ?? null, rec?.clave ?? null, segundos, e.errores, estrellas, Date.now());
  q.estadoSala.run('terminada', s.codigo);
  e.fin = { segundos, errores: e.errores, estrellas };
  s.fase = 'fin';
  difundir(s, estadoJuego(s));
  difundir(s, { t: 'fin', segundos, errores: e.errores, estrellas, ranking: q.ranking.all(s.escenario) });
}

/** Reglas del Ingeniero: ¿esta pieza puede montarse ahora? */
function validarMontaje(s, item) {
  const esc = ESCENARIOS[s.escenario], e = s.juego, r = esc.receta;
  if (item.rechazo) return { ok: false, msg: item.rechazo };
  if (r.tipo === 'sistemas') {
    if (!item.sistema) return { ok: false, msg: 'Eso no es un sistema del vehículo.' };
    if (e.montado.some(m => m.sistema === item.sistema)) return { ok: false, msg: `Ya hay una pieza de ${({ energia: 'Energía', control: 'Control', comunicacion: 'Comunicación', propulsion: 'Propulsión' })[item.sistema] ?? item.sistema}.` };
    if (e.masa + item.kg > r.masaMax) return { ok: false, msg: `Con ${item.kg} kg se pasa del límite de ${r.masaMax} kg.` };
    return { ok: true };
  }
  const siguiente = r.orden[e.montado.length];
  if (item.nombre !== siguiente) return { ok: false, msg: r.pistas?.[e.montado.length] ?? `Ahora va: ${siguiente}.` };
  return { ok: true };
}
function completo(s) {
  const r = ESCENARIOS[s.escenario].receta;
  return r.tipo === 'sistemas' ? r.ranuras.every(k => s.juego.montado.some(m => m.sistema === k)) : s.juego.montado.length === r.orden.length;
}

const cerca = (j, x, y, r) => j.pos && Math.hypot(j.pos.x - x, j.pos.y - y) <= r;
const unidades = it => (it.kg >= 150 ? 2 : 1);   // las piezas pesadas ocupan el carro entero

function mensaje(j, m) {
  const s = j.sala;
  switch (m.t) {
    case 'crear': {
      if (!ESCENARIOS[m.escenario] || m.escenario === 'nota') return j.con.enviar({ t: 'error', msg: 'Escenario desconocido.' });
      salir(j);
      const sala = { codigo: nuevoCodigo(), escenario: m.escenario, fase: 'espera', jugadores: [j], creada: Date.now() };
      salas.set(sala.codigo, sala);
      q.sala.run(sala.codigo, sala.escenario, j.clave, sala.creada, 'espera');
      Object.assign(j, { sala, rol: 'ingeniero', listo: false });
      return avisarSala(sala);
    }
    case 'unirse': {
      const sala = salas.get(String(m.codigo ?? '').toUpperCase().trim());
      if (!sala) return j.con.enviar({ t: 'error', msg: 'No existe una sala con ese código.' });
      const antes = sala.jugadores.find(x => x.clave === j.clave);
      if (antes) {   // vuelve a conectarse: recupera su lugar y su rol
        salir(j);
        Object.assign(antes, { con: j.con, id: j.id });
        j.con.duenio = antes;
        avisarSala(sala);
        if (sala.fase !== 'espera') { antes.con.enviar({ t: 'inicio', escenario: sala.escenario, rol: antes.rol, yo: antes.id, sala: vistaSala(sala) }); antes.con.enviar(estadoJuego(sala)); }
        return;
      }
      if (sala.jugadores.length >= 2) return j.con.enviar({ t: 'error', msg: 'La sala ya tiene dos jugadores.' });
      if (sala.fase !== 'espera') return j.con.enviar({ t: 'error', msg: 'Esa partida ya empezó.' });
      salir(j);
      const otro = sala.jugadores[0];
      Object.assign(j, { sala, rol: otro?.rol === 'ingeniero' ? 'recolector' : 'ingeniero', listo: false });
      sala.jugadores.push(j);
      return avisarSala(sala);
    }
    case 'rol': {
      if (!s || s.fase !== 'espera' || !['ingeniero', 'recolector'].includes(m.rol)) return;
      const otro = s.jugadores.find(x => x !== j);
      j.rol = m.rol; j.listo = false;
      if (otro && otro.rol === m.rol) { otro.rol = m.rol === 'ingeniero' ? 'recolector' : 'ingeniero'; otro.listo = false; }   // los roles se intercambian
      return avisarSala(s);
    }
    case 'escenario': {
      if (!s || s.fase !== 'espera' || s.jugadores[0] !== j || !ESCENARIOS[m.escenario] || m.escenario === 'nota') return;
      s.escenario = m.escenario; s.jugadores.forEach(x => { x.listo = false; });
      return avisarSala(s);
    }
    case 'listo': {
      if (!s || s.fase !== 'espera') return;
      j.listo = !!m.v;
      avisarSala(s);
      const [a, b] = s.jugadores;
      if (a && b && a.listo && b.listo && a.rol !== b.rol) empezar(s);
      return;
    }
    case 'otra': {   // revancha: la sala vuelve a la espera con los mismos jugadores
      if (!s || s.fase === 'espera' || (s.juego && !s.juego.fin)) return;
      s.fase = 'espera'; s.juego = null; s.jugadores.forEach(x => { x.listo = false; });
      return avisarSala(s);
    }
    case 'salir': salir(j); return j.con.enviar({ t: 'fuera' });
    case 'pos': {
      if (!s || s.fase === 'espera') return;
      j.pos = { x: +m.x || 0, y: +m.y || 0 };
      return difundir(s, { t: 'pos', id: j.id, x: j.pos.x, y: j.pos.y, dir: m.dir | 0, mov: !!m.mov }, j);
    }
    case 'tomar': {
      if (!s || s.fase !== 'juego' || j.rol !== 'recolector') return;
      const esc = ESCENARIOS[s.escenario], e = s.juego, it = e.items.find(i => i.id === m.item), def = esc.items.find(i => i.id === m.item);
      if (!it || it.estado !== 'libre') return;
      if (!cerca(j, it.x, it.y, 130)) return j.con.enviar({ t: 'aviso', msg: 'Acércate un poco más a la pieza.' });
      const ocupado = e.carga.reduce((n, id) => n + unidades(esc.items.find(i => i.id === id)), 0);
      if (ocupado + unidades(def) > 2) return j.con.enviar({ t: 'aviso', msg: 'El carro está lleno: lleva lo que tienes al hangar.' });
      it.estado = 'carga'; e.carga.push(it.id);
      if (e.pedido === it.id) e.pedido = null;
      return difundir(s, estadoJuego(s));
    }
    case 'entregar': {
      if (!s || s.fase !== 'juego' || j.rol !== 'recolector') return;
      const esc = ESCENARIOS[s.escenario], e = s.juego;
      if (!e.carga.length) return;
      if (!cerca(j, esc.entrega.x, esc.entrega.y, esc.entrega.r + 50)) return j.con.enviar({ t: 'aviso', msg: 'Acércate a la plataforma naranja del hangar.' });
      e.carga.forEach(id => { e.items.find(i => i.id === id).estado = 'bandeja'; e.bandeja.push(id); });
      e.carga = [];
      difundir(s, { t: 'evento', tipo: 'entrega' });
      return difundir(s, estadoJuego(s));
    }
    case 'montar': {
      if (!s || s.fase !== 'juego' || j.rol !== 'ingeniero') return;
      const esc = ESCENARIOS[s.escenario], e = s.juego, def = esc.items.find(i => i.id === m.item);
      if (!def || !e.bandeja.includes(def.id)) return;
      if (!m.calibrado) { e.errores++; difundir(s, { t: 'evento', tipo: 'calibracion', item: def.id }); return difundir(s, estadoJuego(s)); }
      const v = validarMontaje(s, def);
      if (!v.ok) {
        e.errores++;
        difundir(s, { t: 'evento', tipo: 'rechazo', item: def.id, msg: v.msg });
        return difundir(s, estadoJuego(s));
      }
      e.bandeja = e.bandeja.filter(id => id !== def.id);
      e.items.find(i => i.id === def.id).estado = 'montado';
      e.montado.push({ id: def.id, sistema: def.sistema ?? null });
      e.masa += def.kg;
      difundir(s, { t: 'evento', tipo: 'montado', item: def.id });
      difundir(s, estadoJuego(s));
      if (completo(s)) terminar(s);
      return;
    }
    case 'descartar': {   // el ingeniero devuelve una pieza que no sirve (vuelve a su lugar en el mapa)
      if (!s || s.fase !== 'juego' || j.rol !== 'ingeniero') return;
      const e = s.juego, it = e.items.find(i => i.id === m.item);
      if (!it || it.estado !== 'bandeja') return;
      e.bandeja = e.bandeja.filter(id => id !== it.id);
      const def = ESCENARIOS[s.escenario].items.find(i => i.id === it.id);
      Object.assign(it, { estado: 'libre', x: def.x, y: def.y });
      return difundir(s, estadoJuego(s));
    }
    case 'pedir': {
      if (!s || s.fase !== 'juego' || j.rol !== 'ingeniero') return;
      s.juego.pedido = typeof m.item === 'string' ? m.item : null;
      return difundir(s, estadoJuego(s));
    }
    case 'emote': {
      if (!s) return;
      return difundir(s, { t: 'emote', id: j.id, e: limpiar(m.e, 2) }, j);
    }
  }
}

function salir(j) {
  const s = j.sala;
  if (!s) return;
  s.jugadores = s.jugadores.filter(x => x !== j);
  j.sala = null;
  if (!s.jugadores.length) { salas.delete(s.codigo); return; }
  if (s.fase !== 'espera') {
    const abandonada = s.fase === 'juego';
    s.fase = 'espera'; s.juego = null;
    s.jugadores.forEach(x => { x.listo = false; });
    if (abandonada) { q.estadoSala.run('abandonada', s.codigo); difundir(s, { t: 'aviso', msg: 'Tu compañero salió de la partida.' }); }
  }
  avisarSala(s);
}

let siguienteId = 1;
function conectar(con) {
  let jugador = null;
  con.alMensaje = m => {
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'hola') {
      const nombre = limpiar(m.nombre, 18);
      if (nombre.length < 2) return con.enviar({ t: 'error', msg: 'Escribe un nombre de al menos 2 letras.' });
      const clave = claveValida(m.clave) ? m.clave : crypto.randomUUID();
      q.jugador.run(clave, nombre, Date.now(), Date.now());
      jugador = { id: siguienteId++, clave, nombre, con, sala: null, rol: null, listo: false, pos: null };
      con.duenio = jugador;
      return con.enviar({ t: 'bienvenida', id: jugador.id, nombre, mejores: q.mejores.all(clave, clave), escenarios: Object.keys(ESCENARIOS).filter(k => k !== 'nota') });
    }
    const j = con.duenio;
    if (!j) return con.enviar({ t: 'error', msg: 'Primero escribe tu nombre.' });
    mensaje(j, m);
  };
  con.alCerrar = () => {
    const j = con.duenio;
    if (!j?.sala) return;
    const s = j.sala;
    if (s.fase === 'espera') { salir(j); return; }
    avisarSala(s);   // en juego: se le guarda el lugar 2 minutos para que vuelva
    setTimeout(() => { if (!j.con?.vivo && j.sala === s) salir(j); }, 120000);
  };
}

// ───────────────────────── HTTP ─────────────────────────
const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/salud') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, salas: salas.size })); }
  if (url.pathname === '/api/ranking') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(q.ranking.all(url.searchParams.get('escenario') || 'salar'))); }
  if (!CON_JUEGO) { res.writeHead(404); return res.end('Servidor multijugador de Misión Cóndor (el juego se sirve con Vite en desarrollo).'); }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.normalize(path.join(RAIZ, p));
  if (!f.startsWith(RAIZ) || f.startsWith(DATOS)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    // index.html y los datos nunca se guardan en caché (así una versión nueva se ve al recargar); los assets con hash sí
    const fijo = /[\\/]assets[\\/].+-[\w-]{8}\.\w+$/.test(f);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': fijo ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(data);
  });
});
servidor.on('upgrade', (req, socket) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') { socket.destroy(); return; }
  aceptarWS(req, socket, conectar);
});
// apagado limpio (docker stop / redeploy): cierra conexiones y la base de datos
for (const senal of ['SIGTERM', 'SIGINT']) process.on(senal, () => {
  console.log(`[${senal}] cerrando Misión Cóndor…`);
  servidor.close(); try { db.close(); } catch { /* */ }
  setTimeout(() => process.exit(0), 300).unref();
});
servidor.listen(PUERTO, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log(`Misión Cóndor listo: http://localhost:${PUERTO}/   (multijugador en /ws · datos en ${DATOS})`);
  ips.forEach(ip => console.log(`  En otra PC o celular de la misma red: http://${ip}:${PUERTO}/`));
});
