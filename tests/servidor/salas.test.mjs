// QA · servidor: API, identidad sin correo, salas por código, roles, reconexión y robustez.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { arrancarServidor, cliente } from '../ayuda/servidor.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const entrar = async (nombre, clave) => {
  const c = await cliente(srv.ws);
  c.mandar({ t: 'hola', nombre, ...(clave ? { clave } : {}) });
  const b = await c.esperar(m => m.t === 'bienvenida' || m.t === 'error');
  return { c, b };
};

test('API: /api/salud responde ok', async () => {
  const r = await fetch(`${srv.url}/api/salud`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(typeof j.salas, 'number');
});

test('API: /api/ranking devuelve una lista', async () => {
  const j = await (await fetch(`${srv.url}/api/ranking?escenario=salar`)).json();
  assert.ok(Array.isArray(j));
});

test('identidad: se entra solo con nombre (sin correo) y la bienvenida trae los escenarios', async () => {
  const { c, b } = await entrar('Ana', 'clave-ana-qa-0001');
  assert.equal(b.t, 'bienvenida');
  assert.equal(b.nombre, 'Ana');
  assert.deepEqual(b.escenarios.sort(), ['cohete', 'salar']);
  c.cerrar();
});

test('identidad: nombre de menos de 2 letras se rechaza', async () => {
  const { c, b } = await entrar('X');
  assert.equal(b.t, 'error');
  assert.match(b.msg, /nombre/);
  c.cerrar();
});

test('identidad: sin clave o con clave inválida el servidor asigna una y deja jugar', async () => {
  for (const clave of [undefined, 'corta', '<script>']) {
    const { c, b } = await entrar('Beto', clave);
    assert.equal(b.t, 'bienvenida', `clave ${clave}`);
    c.cerrar();
  }
});

test('identidad: el nombre se limpia de < > y se recorta a 18 letras', async () => {
  const { c, b } = await entrar('<b>Nombre muy muy largo de prueba</b>');
  assert.ok(!/[<>]/.test(b.nombre));
  assert.ok(b.nombre.length <= 18);
  c.cerrar();
});

test('sin identificarse no se puede crear sala', async () => {
  const c = await cliente(srv.ws);
  c.mandar({ t: 'crear', escenario: 'salar' });
  const e = await c.esperar('error');
  assert.match(e.msg, /nombre/);
  c.cerrar();
});

test('salas: crear da un código de 6 caracteres sin letras confusas (O, I, 0, 1)', async () => {
  const { c } = await entrar('Ana');
  for (let i = 0; i < 10; i++) {
    c.mandar({ t: 'crear', escenario: i % 2 ? 'salar' : 'cohete' });
    const { sala } = await c.esperar('sala');
    assert.match(sala.codigo, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(sala.jugadores.length, 1);
    assert.equal(sala.jugadores[0].rol, 'ingeniero');
  }
  c.cerrar();
});

test('salas: escenario desconocido se rechaza', async () => {
  const { c } = await entrar('Ana');
  c.mandar({ t: 'crear', escenario: 'nota' });
  assert.match((await c.esperar('error')).msg, /Escenario/);
  c.cerrar();
});

test('salas: unirse con código (minúsculas y espacios valen), toma el otro rol', async () => {
  const a = await entrar('Ana'), b = await entrar('Beto');
  a.c.mandar({ t: 'crear', escenario: 'salar' });
  const { sala } = await a.c.esperar('sala');
  b.c.mandar({ t: 'unirse', codigo: `  ${sala.codigo.toLowerCase()} ` });
  const s2 = await b.c.esperar(m => m.t === 'sala' && m.sala.jugadores.length === 2);
  assert.deepEqual(s2.sala.jugadores.map(j => j.rol).sort(), ['ingeniero', 'recolector']);
  a.c.cerrar(); b.c.cerrar();
});

test('salas: código inexistente y sala llena se rechazan', async () => {
  const a = await entrar('Ana'), b = await entrar('Beto'), c = await entrar('Caro');
  b.c.mandar({ t: 'unirse', codigo: 'ZZZZZZ' });
  assert.match((await b.c.esperar('error')).msg, /No existe/);
  a.c.mandar({ t: 'crear', escenario: 'salar' });
  const { sala } = await a.c.esperar('sala');
  b.c.mandar({ t: 'unirse', codigo: sala.codigo }); await b.c.esperar(m => m.t === 'sala' && m.sala.jugadores.length === 2);
  c.c.mandar({ t: 'unirse', codigo: sala.codigo });
  assert.match((await c.c.esperar('error')).msg, /dos jugadores/);
  [a, b, c].forEach(x => x.c.cerrar());
});

test('salas: tomar el rol del otro intercambia los roles y quita el «listo»', async () => {
  const a = await entrar('Ana'), b = await entrar('Beto');
  a.c.mandar({ t: 'crear', escenario: 'salar' });
  const { sala } = await a.c.esperar('sala');
  b.c.mandar({ t: 'unirse', codigo: sala.codigo }); await b.c.esperar(m => m.t === 'sala' && m.sala.jugadores.length === 2);
  b.c.mandar({ t: 'listo', v: true }); await a.c.esperar(m => m.t === 'sala' && m.sala.jugadores.some(j => j.listo));
  a.c.mandar({ t: 'rol', rol: 'recolector' });
  const s = await b.c.esperar(m => m.t === 'sala' && m.sala.jugadores.find(j => j.nombre === 'Ana')?.rol === 'recolector');
  assert.equal(s.sala.jugadores.find(j => j.nombre === 'Beto').rol, 'ingeniero');
  assert.ok(s.sala.jugadores.every(j => !j.listo));
  a.c.cerrar(); b.c.cerrar();
});

test('salas: la partida empieza solo cuando los dos están listos', async () => {
  const a = await entrar('Ana'), b = await entrar('Beto');
  a.c.mandar({ t: 'crear', escenario: 'cohete' });
  const { sala } = await a.c.esperar('sala');
  a.c.mandar({ t: 'listo', v: true });
  await assert.rejects(a.c.esperar('inicio', 600));   // solo, no empieza
  b.c.mandar({ t: 'unirse', codigo: sala.codigo }); await b.c.esperar(m => m.t === 'sala' && m.sala.jugadores.length === 2);
  b.c.mandar({ t: 'listo', v: true });
  const [ia, ib] = await Promise.all([a.c.esperar('inicio'), b.c.esperar('inicio')]);
  assert.equal(ia.escenario, 'cohete');
  assert.notEqual(ia.rol, ib.rol);
  a.c.cerrar(); b.c.cerrar();
});

test('reconexión: con la misma clave se recupera el lugar en la sala', async () => {
  const a = await entrar('Ana', 'clave-recon-qa-01'), b = await entrar('Beto');
  a.c.mandar({ t: 'crear', escenario: 'salar' });
  const { sala } = await a.c.esperar('sala');
  b.c.mandar({ t: 'unirse', codigo: sala.codigo }); await b.c.esperar(m => m.t === 'sala' && m.sala.jugadores.length === 2);
  a.c.mandar({ t: 'listo', v: true }); b.c.mandar({ t: 'listo', v: true });
  await a.c.esperar('inicio');
  a.c.cerrar();   // se corta
  const a2 = await entrar('Ana', 'clave-recon-qa-01');
  a2.c.mandar({ t: 'unirse', codigo: sala.codigo });
  const ini = await a2.c.esperar('inicio');
  assert.equal(ini.rol, 'ingeniero');
  assert.equal(ini.sala.jugadores.length, 2);
  a2.c.cerrar(); b.c.cerrar();
});

test('robustez: JSON inválido, mensajes raros y desconocidos no tumban el servidor', async () => {
  const c = await cliente(srv.ws);
  const crudo = new WebSocket(srv.ws);
  await new Promise(r => { crudo.onopen = r; });
  crudo.send('esto no es json');
  crudo.send(JSON.stringify({ t: 42 }));
  crudo.send(JSON.stringify({ t: 'montar', item: '../../etc' }));
  crudo.send(JSON.stringify({ sin: 'tipo' }));
  crudo.close();
  c.mandar({ t: 'hola', nombre: 'Sigue vivo' });
  assert.equal((await c.esperar('bienvenida')).nombre, 'Sigue vivo');
  assert.equal((await fetch(`${srv.url}/api/salud`)).status, 200);
  c.cerrar();
});

test('robustez: un mensaje gigante (> 64 KB) no tumba el servidor', async () => {
  const crudo = new WebSocket(srv.ws);
  await new Promise(r => { crudo.onopen = r; });
  crudo.send(JSON.stringify({ t: 'hola', nombre: 'x'.repeat(200 * 1024) }));
  await new Promise(r => setTimeout(r, 300));
  assert.equal((await fetch(`${srv.url}/api/salud`)).status, 200);
});

test('robustez: una conexión que no es WebSocket en /ws no tumba el servidor', async () => {
  await new Promise(r => { const s = net.connect(new URL(srv.url).port, '127.0.0.1', () => { s.write('GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n'); setTimeout(() => { s.destroy(); r(); }, 200); }); s.on('error', r); });
  assert.equal((await fetch(`${srv.url}/api/salud`)).status, 200);
});
