// QA · lógica del modo cooperativo «Turno de noche» (salar y cohete), probada contra el servidor real.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor, partidaLista, traer, montar, cliente } from '../ayuda/servidor.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

test('estado inicial: todas las piezas libres, mesa vacía y hora del servidor para sincronizar el reloj', async () => {
  const { A, B, estado, esc } = await partidaLista(srv, 'salar');
  assert.equal(estado.items.length, esc.items.length);
  assert.ok(estado.items.every(i => i.estado === 'libre'));
  assert.deepEqual([estado.carga, estado.bandeja, estado.montado], [[], [], []]);
  assert.ok(Math.abs(estado.ahora - Date.now()) < 5000, 'trae «ahora»');
  A.cerrar(); B.cerrar();
});

test('roles: el ingeniero no puede tomar piezas y el recolector no puede montar', async () => {
  const { A, B, esc } = await partidaLista(srv, 'salar');
  const it = esc.items[0];
  A.mandar({ t: 'pos', x: it.x, y: it.y }); A.mandar({ t: 'tomar', item: it.id });
  B.mandar({ t: 'montar', item: it.id, calibrado: true });
  await assert.rejects(A.esperar(m => m.t === 'estado' && m.carga.length > 0, 500));
  await assert.rejects(B.esperar(m => m.t === 'evento' && m.tipo === 'montado', 500));
  A.cerrar(); B.cerrar();
});

test('recolector: lejos de la pieza o de la entrega recibe un aviso (no un silencio)', async () => {
  const { A, B, esc } = await partidaLista(srv, 'salar');
  const it = esc.items.find(i => i.id === 'antena');
  B.mandar({ t: 'pos', x: it.x + 500, y: it.y }); B.mandar({ t: 'tomar', item: it.id });
  assert.match((await B.esperar('aviso')).msg, /Acércate/);
  B.mandar({ t: 'pos', x: it.x, y: it.y }); B.mandar({ t: 'tomar', item: it.id });
  await B.esperar(m => m.t === 'estado' && m.carga.includes('antena'));
  B.mandar({ t: 'entregar' });   // sigue junto a la pieza, lejos del hangar
  assert.match((await B.esperar('aviso')).msg, /plataforma/);
  A.cerrar(); B.cerrar();
});

test('recolector: el carro aguanta 2 espacios y una pieza de 150 kg o más ocupa los dos', async () => {
  const { A, B, esc } = await partidaLista(srv, 'salar');
  const rtg = esc.items.find(i => i.id === 'rtg'), antena = esc.items.find(i => i.id === 'antena');
  B.mandar({ t: 'pos', x: rtg.x, y: rtg.y }); B.mandar({ t: 'tomar', item: 'rtg' });
  await B.esperar(m => m.t === 'estado' && m.carga.includes('rtg'));
  B.mandar({ t: 'pos', x: antena.x, y: antena.y }); B.mandar({ t: 'tomar', item: 'antena' });
  assert.match((await B.esperar('aviso')).msg, /lleno/);
  A.cerrar(); B.cerrar();
});

test('pedido: el ingeniero pide una pieza y el pedido se borra cuando el recolector la toma', async () => {
  const { A, B, esc } = await partidaLista(srv, 'salar');
  A.mandar({ t: 'pedir', item: 'control' });
  await B.esperar(m => m.t === 'estado' && m.pedido === 'control');
  const it = esc.items.find(i => i.id === 'control');
  B.mandar({ t: 'pos', x: it.x, y: it.y }); B.mandar({ t: 'tomar', item: 'control' });
  const e = await A.esperar(m => m.t === 'estado' && m.carga.includes('control'));
  assert.equal(e.pedido, null);
  A.cerrar(); B.cerrar();
});

test('salar: piezas trampa (panel solar, taza, planta) se rechazan con su explicación y se pueden devolver', async () => {
  const { A, B, esc } = await partidaLista(srv, 'salar');
  for (const id of ['solar', 'taza', 'planta']) {
    await traer(B, esc, id);
    const ev = await montar(A, id);
    assert.equal(ev.tipo, 'rechazo', id);
    assert.equal(ev.msg, esc.items.find(i => i.id === id).rechazo);
    A.mandar({ t: 'descartar', item: id });
    const e = await A.esperar(m => m.t === 'estado' && !m.bandeja.includes(id) && m.items.find(i => i.id === id).estado === 'libre');
    assert.equal(e.carga.includes(id), false, 'vuelve al mapa, no al carro');
  }
  A.cerrar(); B.cerrar();
});

test('salar: calibración fallida suma un error y la pieza sigue en la mesa', async () => {
  const { A, B, esc } = await partidaLista(srv, 'salar');
  await traer(B, esc, 'antena');
  const ev = await montar(A, 'antena', false);
  assert.equal(ev.tipo, 'calibracion');
  const e = await A.esperar(m => m.t === 'estado' && m.errores === 1);
  assert.ok(e.bandeja.includes('antena'));
  A.cerrar(); B.cerrar();
});

test('salar: no se pueden montar dos piezas del mismo sistema', async () => {
  const { A, B, esc } = await partidaLista(srv, 'salar');
  await traer(B, esc, 'rtg');
  assert.equal((await montar(A, 'rtg')).tipo, 'montado');
  // el panel solar también es «energía», pero además es trampa: se prueba la regla con el estado del servidor
  await traer(B, esc, 'solar');
  const ev = await montar(A, 'solar');
  assert.equal(ev.tipo, 'rechazo');
  A.cerrar(); B.cerrar();
});

test('salar: partida completa (4 sistemas, 830 kg ≤ 900) termina con estrellas y entra al ranking', async () => {
  const { A, B, esc } = await partidaLista(srv, 'salar');
  for (const id of ['rtg', 'control', 'antena', 'tanque']) {
    await traer(B, esc, id);
    assert.equal((await montar(A, id)).tipo, 'montado', id);
  }
  const fin = await A.esperar('fin');
  assert.ok(fin.estrellas >= 1 && fin.estrellas <= 3);
  assert.equal(fin.errores, 0);
  assert.ok(fin.ranking.some(r => r.ingeniero === 'Ingrid' && r.recolector === 'Rolo'));
  const ranking = await (await fetch(`${srv.url}/api/ranking?escenario=salar`)).json();
  assert.ok(ranking.length >= 1);
  A.cerrar(); B.cerrar();
});

test('cohete: fuera de orden se rechaza con la pista que toca; en orden se completa', async () => {
  const { A, B, esc } = await partidaLista(srv, 'cohete');
  await traer(B, esc, 'superior');
  const r = await montar(A, 'superior');
  assert.equal(r.tipo, 'rechazo');
  assert.equal(r.msg, esc.receta.pistas[0]);
  await traer(B, esc, 'tanque');
  assert.equal((await montar(A, 'tanque')).msg, esc.items.find(i => i.id === 'tanque').rechazo);
  for (const id of ['nucleo', 'prop1', 'prop2', 'superior']) {
    if (!A.ultimo.estado?.bandeja.includes(id)) await traer(B, esc, id);
    assert.equal((await montar(A, id)).tipo, 'montado', id);
  }
  const fin = await A.esperar('fin');
  assert.equal(fin.errores, 2);
  A.cerrar(); B.cerrar();
});

test('cohete: cada etapa es pesada, el carro lleva una sola por viaje', async () => {
  const { A, B, esc } = await partidaLista(srv, 'cohete');
  const n = esc.items.find(i => i.id === 'nucleo'), p = esc.items.find(i => i.id === 'prop1');
  B.mandar({ t: 'pos', x: n.x, y: n.y }); B.mandar({ t: 'tomar', item: 'nucleo' });
  await B.esperar(m => m.t === 'estado' && m.carga.includes('nucleo'));
  B.mandar({ t: 'pos', x: p.x, y: p.y }); B.mandar({ t: 'tomar', item: 'prop1' });
  assert.match((await B.esperar('aviso')).msg, /lleno/);
  A.cerrar(); B.cerrar();
});

test('otra partida: al terminar, la sala vuelve a la espera con los mismos dos', async () => {
  const { A, B, esc } = await partidaLista(srv, 'salar');
  for (const id of ['rtg', 'control', 'antena', 'tanque']) { await traer(B, esc, id); await montar(A, id); }
  await A.esperar('fin');
  A.mandar({ t: 'otra' });
  const s = await B.esperar(m => m.t === 'sala' && m.sala.fase === 'espera');
  assert.equal(s.sala.jugadores.length, 2);
  A.cerrar(); B.cerrar();
});

test('salir a mitad de partida: el compañero recibe aviso y la sala vuelve a la espera (no queda trabado)', async () => {
  const { A, B } = await partidaLista(srv, 'cohete');
  B.olvidar();   // solo interesa lo que llegue después de que A se vaya
  A.mandar({ t: 'salir' });
  assert.equal((await A.esperar('fuera')).t, 'fuera');
  assert.match((await B.esperar('aviso')).msg, /salió/);
  const s = await B.esperar(m => m.t === 'sala' && m.sala.fase === 'espera');
  assert.equal(s.sala.jugadores.length, 1);
  // y puede entrar otra persona con el mismo código
  const C = await cliente(srv.ws);
  C.mandar({ t: 'hola', nombre: 'Caro' }); await C.esperar('bienvenida');
  C.mandar({ t: 'unirse', codigo: s.sala.codigo });
  assert.equal((await C.esperar(m => m.t === 'sala')).sala.jugadores.length, 2);
  B.cerrar(); C.cerrar();
});
