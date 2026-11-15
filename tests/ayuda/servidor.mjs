// Ayudas para probar el servidor real (herramientas/servir.mjs): lo arranca en un puerto libre con una base
// de datos temporal y ofrece un cliente WebSocket que espera mensajes por condición (robusto con la latencia).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ESCENARIOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', 'coop', 'escenarios.json'), 'utf8'));

const puertoLibre = () => new Promise((ok, mal) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }).on('error', mal);
});

/** Arranca el servidor. Devuelve { url, ws, datos, cerrar() }. */
export async function arrancarServidor() {
  const puerto = await puertoLibre();
  const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'condor-qa-'));
  const proc = spawn(process.execPath, [path.join(RAIZ, 'herramientas', 'servir.mjs')], {
    env: { ...process.env, PORT: String(puerto), CONDOR_DATOS: datos }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let salida = '';
  proc.stdout.on('data', d => { salida += d; });
  proc.stderr.on('data', d => { salida += d; });
  const url = `http://127.0.0.1:${puerto}`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`${url}/api/salud`); if (r.ok) break; } catch { /* todavía no */ }
    if (proc.exitCode !== null) throw new Error('El servidor no arrancó:\n' + salida);
    await new Promise(r => setTimeout(r, 100));
  }
  return {
    url, ws: `ws://127.0.0.1:${puerto}/ws`, datos, salida: () => salida,
    cerrar: async () => { proc.kill(); await new Promise(r => setTimeout(r, 150)); fs.rmSync(datos, { recursive: true, force: true }); },
  };
}

/** Cliente de prueba: `esperar(cond)` resuelve con el primer mensaje (pasado o futuro) que cumple la condición. */
export function cliente(urlWs) {
  return new Promise((ok, mal) => {
    const ws = new WebSocket(urlWs);
    const recibidos = [], esperas = [];
    const c = {
      ultimo: {},
      mandar: m => ws.send(JSON.stringify(m)),
      esperar(cond, ms = 4000) {
        const f = typeof cond === 'string' ? (m => m.t === cond) : cond;
        const i = recibidos.findIndex(f);
        if (i >= 0) return Promise.resolve(recibidos.splice(i, 1)[0]);
        return new Promise((r, x) => {
          const e = { f, r };
          esperas.push(e);
          setTimeout(() => { const k = esperas.indexOf(e); if (k >= 0) { esperas.splice(k, 1); x(new Error(`No llegó el mensaje esperado en ${ms} ms: ${f}`)); } }, ms);
        });
      },
      /** Descarta lo recibido hasta ahora (para esperar solo respuestas nuevas). */
      olvidar() { recibidos.length = 0; },
      cerrar() { ws.close(); },
    };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      c.ultimo[m.t] = m;
      const i = esperas.findIndex(w => w.f(m));
      if (i >= 0) esperas.splice(i, 1)[0].r(m); else recibidos.push(m);
    };
    ws.onopen = () => ok(c);
    ws.onerror = () => mal(new Error('No se pudo conectar a ' + urlWs));
  });
}

/** Dos jugadores en una sala del escenario dado, ya en partida. A = ingeniero, B = recolector. */
export async function partidaLista(srv, escenario) {
  const A = await cliente(srv.ws), B = await cliente(srv.ws);
  A.mandar({ t: 'hola', clave: `qa-ing-${escenario}-${Date.now()}`, nombre: 'Ingrid' }); await A.esperar('bienvenida');
  B.mandar({ t: 'hola', clave: `qa-rec-${escenario}-${Date.now()}`, nombre: 'Rolo' }); await B.esperar('bienvenida');
  A.mandar({ t: 'crear', escenario });
  const { sala } = await A.esperar('sala');
  B.mandar({ t: 'unirse', codigo: sala.codigo });
  await B.esperar(m => m.t === 'sala' && m.sala.jugadores.length === 2);
  A.mandar({ t: 'listo', v: true }); B.mandar({ t: 'listo', v: true });
  const [iA, iB] = await Promise.all([A.esperar('inicio'), B.esperar('inicio')]);
  const estado = await A.esperar('estado');
  return { A, B, sala, iA, iB, estado, esc: ESCENARIOS[escenario] };
}

/** El recolector (B) lleva una pieza del mapa a la mesa. Espera la confirmación real del servidor. */
export async function traer(B, esc, id) {
  const it = esc.items.find(i => i.id === id);
  B.mandar({ t: 'pos', x: it.x, y: it.y, dir: 0, mov: false });
  B.mandar({ t: 'tomar', item: id });
  await B.esperar(m => m.t === 'estado' && m.carga.includes(id));
  B.mandar({ t: 'pos', x: esc.entrega.x, y: esc.entrega.y, dir: 0, mov: false });
  B.mandar({ t: 'entregar' });
  await B.esperar(m => m.t === 'estado' && m.bandeja.includes(id));
}

/** El ingeniero (A) intenta montar; devuelve el evento resultante (montado / rechazo / calibracion). */
export async function montar(A, id, calibrado = true) {
  A.mandar({ t: 'montar', item: id, calibrado });
  return A.esperar(m => m.t === 'evento' && ['montado', 'rechazo', 'calibracion'].includes(m.tipo) && m.item === id);
}
