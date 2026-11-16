// QA · lógica del modo en equipo (src/core/coopLogica.ts), probada contra el SERVIDOR REAL:
//  - lo que la mesa del Ingeniero dice («va ahora / después / no va») es exactamente lo que el servidor acepta;
//  - siguiendo las sugerencias de la mesa («◀ pídela») se termina cada misión sin errores;
//  - calibración, paseo de los compañeros y datos de los escenarios.
// Node 24 ejecuta el .ts directamente (quita los tipos), sin compilar.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, partidaLista, traer, montar, ESCENARIOS, RAIZ } from '../ayuda/servidor.mjs';
import { veredicto, sugerenciaPedido, piezaParaMontar, calibracionValida, moverAguja, paseo, posicionEn, pisa, tramoLibre } from '../../src/core/coopLogica.ts';

const NOMBRES = Object.keys(ESCENARIOS).filter(k => k !== 'nota');
const vacio = esc => ({ items: esc.items.map(i => ({ id: i.id, estado: 'libre', x: i.x, y: i.y })), carga: [], bandeja: [], montado: [], masa: 0, errores: 0, pedido: null, inicio: 0, fin: null });

describe('mesa del Ingeniero = reglas del servidor', () => {
  let srv;
  before(async () => { srv = await arrancarServidor(); });
  after(async () => { await srv.cerrar(); });

  for (const nombre of NOMBRES) {
    test(`${nombre}: «va ahora» ⇔ el servidor monta la pieza (todas las piezas, en cada paso)`, async () => {
      const { A, B, esc } = await partidaLista(srv, nombre);
      // el recolector trae TODO (también las trampas) y el ingeniero prueba cada pieza en cada momento
      for (const it of esc.items) await traer(B, esc, it.id);
      let estado = await A.esperar(m => m.t === 'estado' && m.bandeja.length === esc.items.length);
      let errores = 0, vueltas = 0;
      const total = esc.receta.tipo === 'sistemas' ? esc.receta.ranuras.length : esc.receta.orden.length;
      while (estado.montado.length < total && vueltas++ < 20) {
        let monto = false;
        for (const id of [...estado.bandeja].reverse()) {   // al revés: así también se prueban las que NO van
          const v = veredicto(esc.items, esc.receta, estado, id);
          A.olvidar();
          const ev = await montar(A, id, true);
          const acepto = ev.tipo === 'montado';
          assert.equal(acepto, v.tipo === 'ahora', `${nombre}/${id}: la mesa dijo «${v.tipo}» y el servidor ${acepto ? 'la montó' : 'la rechazó'} (${ev.msg ?? ''})`);
          if (!acepto) errores++;
          estado = await A.esperar(m => m.t === 'estado');
          if (acepto) { monto = true; break; }
        }
        if (!monto) break;
      }
      assert.equal(estado.montado.length, total, 'montando solo lo que la mesa marca «va ahora» se completa la nave');
      assert.ok(errores > 0, 'las trampas y las piezas fuera de turno se rechazaron');
      A.cerrar(); B.cerrar();
    });

    test(`${nombre}: siguiendo «◀ pídela» y montando lo que «va ahora», la misión termina sin errores`, async () => {
      const { A, B, esc, estado: e0 } = await partidaLista(srv, nombre);
      let estado = e0, pasos = 0;
      const total = esc.receta.tipo === 'sistemas' ? esc.receta.ranuras.length : esc.receta.orden.length;
      while (estado.montado.length < total && pasos++ < 30) {
        const lista = piezaParaMontar(esc.items, esc.receta, estado);
        if (lista) {
          A.olvidar();
          const ev = await montar(A, lista, calibracionValida(0.5, [0.4, 0.62]));
          assert.equal(ev.tipo, 'montado', `${lista}: ${ev.msg ?? ev.tipo}`);
          estado = await A.esperar(m => m.t === 'estado' && m.montado.some(x => x.id === lista));
          continue;
        }
        const pedir = sugerenciaPedido(esc.items, esc.receta, estado);
        assert.ok(pedir, `la mesa siempre sugiere qué pedir mientras falte algo (paso ${pasos})`);
        assert.ok(!esc.items.find(i => i.id === pedir).rechazo, `nunca sugiere una trampa (${pedir})`);
        A.mandar({ t: 'pedir', item: pedir });
        await B.esperar(m => m.t === 'estado' && m.pedido === pedir);
        B.olvidar(); A.olvidar();
        await traer(B, esc, pedir);
        estado = await A.esperar(m => m.t === 'estado' && m.bandeja.includes(pedir));
      }
      const fin = await A.esperar('fin', 6000);
      assert.equal(fin.errores, 0);
      assert.equal(fin.estrellas, 3);
      A.cerrar(); B.cerrar();
    });
  }

  test('el Ingeniero en su mesa: el compañero lo ve «trabajando» (y un Recolector no puede fingirlo)', async () => {
    const { A, B } = await partidaLista(srv, 'salar');
    A.mandar({ t: 'pos', x: 640, y: 1000, dir: 2, mov: false, trab: true });
    const visto = await B.esperar(m => m.t === 'pos' && m.trab === true);
    assert.equal(visto.x, 640);
    A.mandar({ t: 'pos', x: 640, y: 1000, dir: 2, mov: false, trab: false });
    await B.esperar(m => m.t === 'pos' && m.trab === false);
    B.mandar({ t: 'pos', x: 800, y: 1000, dir: 2, mov: false, trab: true });
    const delRec = await A.esperar(m => m.t === 'pos' && m.x === 800);
    assert.equal(delRec.trab, false);
    A.cerrar(); B.cerrar();
  });
});

describe('veredicto (sin servidor)', () => {
  const salar = ESCENARIOS.salar, cohete = ESCENARIOS.cohete;
  test('salar: trampas «no va» con su explicación, sistema repetido y límite de masa', () => {
    const e = vacio(salar);
    assert.equal(veredicto(salar.items, salar.receta, e, 'taza').tipo, 'no');
    assert.match(veredicto(salar.items, salar.receta, e, 'solar').msg.k, /RTG/);
    assert.equal(veredicto(salar.items, salar.receta, e, 'rtg').tipo, 'ahora');
    const conRtg = { ...e, montado: [{ id: 'rtg', sistema: 'energia' }], masa: 150 };
    assert.equal(veredicto(salar.items, salar.receta, conRtg, 'rtg').tipo, 'no');
    const pesado = { ...e, masa: 500 };
    const v = veredicto(salar.items, salar.receta, pesado, 'tanque');
    assert.equal(v.tipo, 'no'); assert.equal(v.msg.p.m, 900);
  });
  test('cohete: orden estricto, «después» para lo que viene y los dos propulsores', () => {
    const e = vacio(cohete);
    assert.equal(veredicto(cohete.items, cohete.receta, e, 'nucleo').tipo, 'ahora');
    assert.equal(veredicto(cohete.items, cohete.receta, e, 'prop1').tipo, 'despues');
    assert.equal(veredicto(cohete.items, cohete.receta, e, 'tanque').tipo, 'no');
    const e1 = { ...e, montado: [{ id: 'nucleo', sistema: null }, { id: 'prop2', sistema: null }] };
    assert.equal(veredicto(cohete.items, cohete.receta, e1, 'prop1').tipo, 'ahora', 'el segundo propulsor también va');
    assert.equal(veredicto(cohete.items, cohete.receta, e1, 'superior').tipo, 'despues');
  });
  test('sugerencia: no repite lo que ya viene en el carro o en la mesa', () => {
    const e = vacio(salar);
    const primera = sugerenciaPedido(salar.items, salar.receta, e);
    const e2 = { ...e, carga: [primera], items: e.items.map(i => i.id === primera ? { ...i, estado: 'carga' } : i) };
    assert.notEqual(sugerenciaPedido(salar.items, salar.receta, e2), primera);
  });
});

describe('calibración', () => {
  test('margen de 0,03 a cada lado de la zona verde', () => {
    assert.ok(calibracionValida(0.5, [0.4, 0.62]));
    assert.ok(calibracionValida(0.375, [0.4, 0.62]));
    assert.ok(!calibracionValida(0.36, [0.4, 0.62]));
    assert.ok(!calibracionValida(0.66, [0.4, 0.62]));
  });
  test('la aguja rebota en los bordes y nunca sale de 0..1', () => {
    let a = { aguja: 0.9, dir: 1 };
    for (let i = 0; i < 500; i++) { a = moverAguja(a.aguja, a.dir, 0.05); assert.ok(a.aguja >= 0 && a.aguja <= 1); }
    assert.deepEqual(moverAguja(0.99, 1, 0.1), { aguja: 1, dir: -1 });
    assert.deepEqual(moverAguja(0.01, -1, 0.1), { aguja: 0, dir: 1 });
  });
  test('es lenta: una pasada completa tarda más de 1,5 s (se puede con el dedo)', () => {
    let a = { aguja: 0, dir: 1 }, t = 0;
    while (a.dir === 1) { a = moverAguja(a.aguja, a.dir, 1 / 60); t += 1 / 60; }
    assert.ok(t > 1.5, `${t.toFixed(2)} s`);
  });
});

describe('compañeros del mapa', () => {
  const casa = { sprite: 'x', nombre: 'X', x: 500, y: 500, radio: 150, frases: ['hola'] };
  test('el paseo nunca atraviesa un edificio y siempre vuelve a casa', () => {
    const edificio = [{ x: 620, y: 500, rx: 60, ry: 30 }];
    const ruta = paseo(casa, edificio, 2000, 2000);
    assert.ok(ruta.length >= 2);
    for (let i = 0; i < ruta.length; i++) {
      const [a, b] = [ruta[i], ruta[(i + 1) % ruta.length]];
      assert.ok(tramoLibre(edificio, a[0], a[1], b[0], b[1]), `tramo ${i} cruza el edificio`);
      assert.ok(!pisa(edificio, b[0], b[1]));
    }
    ruta.forEach((p, i) => { if (i % 2 === 0) assert.deepEqual(p, [500, 500]); });
  });
  test('no sale del mapa', () => {
    const ruta = paseo({ ...casa, x: 80, y: 100 }, [], 2000, 2000);
    ruta.forEach(([x, y]) => assert.ok(x >= 60 && y >= 90, `${x},${y}`));
  });
  test('la posición depende solo de la hora (los dos jugadores lo ven igual) y se mueve sin saltos', () => {
    const ruta = paseo(casa, [], 2000, 2000);
    const t0 = 1_800_000_000_000;
    assert.deepEqual(posicionEn(ruta, t0), posicionEn(ruta, t0));
    let prev = posicionEn(ruta, t0);
    for (let k = 1; k < 2000; k++) {
      const p = posicionEn(ruta, t0 + k * 16);
      assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 3, `salto en ${k}`);
      prev = p;
    }
  });
  test('alguien solo, sin lugar a dónde ir, se queda en casa', () => {
    const p = posicionEn([[10, 20]], 123456);
    assert.deepEqual([p.x, p.y, p.camina], [10, 20, false]);
  });
});

describe('datos de los escenarios', () => {
  const atlas = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', 'sprites', 'atlas.json'), 'utf8')).sprites;
  for (const nombre of NOMBRES) {
    const esc = ESCENARIOS[nombre];
    test(`${nombre}: sprites existen, compañeros con frases y dentro del mapa`, () => {
      for (const s of [esc.mesa.sprite, ...esc.items.map(i => i.sprite), ...esc.decorados.map(d => d.id)]) assert.ok(atlas[s], `falta el sprite ${s}`);
      assert.ok((esc.companeros ?? []).length >= 3, 'tiene compañeros');
      for (const c of esc.companeros) {
        assert.ok(atlas[c.sprite], `falta el sprite ${c.sprite}`);
        assert.ok(c.frases.length >= 2 && c.frases.every(f => f.length > 3), `${c.nombre}: frases`);
        assert.ok(c.x > 60 && c.y > 90 && c.x < esc.mapa.ancho - 60 && c.y < esc.mapa.alto - 40, `${c.nombre} fuera del mapa`);
        for (const it of esc.items) assert.ok(Math.hypot(it.x - c.x, it.y - c.y) > 80, `${c.nombre} tapa la pieza ${it.id}`);
      }
      // la receta se puede completar con las piezas que hay (sin trampas)
      const utiles = esc.items.filter(i => !i.rechazo);
      if (esc.receta.tipo === 'sistemas') for (const k of esc.receta.ranuras) assert.ok(utiles.some(i => i.sistema === k), `falta pieza de ${k}`);
      else for (const n of esc.receta.orden) assert.ok(utiles.filter(i => i.nombre === n).length >= esc.receta.orden.filter(x => x === n).length, `faltan piezas «${n}»`);
    });
  }
  test('el Ingeniero tiene sus tres poses (quieto, caminando, trabajando)', () => {
    for (const s of ['ingeniero_sistemas', 'ingeniero_camina', 'ingeniero_trabaja']) assert.ok(atlas[s], s);
  });
});
