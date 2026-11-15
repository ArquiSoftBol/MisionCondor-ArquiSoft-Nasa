// QA · cada pantalla del juego abre sin errores y cabe en la pantalla (PC, celular y tablet).
import { test, expect } from '@playwright/test';
import { abrir, vigilarErrores, lienzoCabe, escenasActivas } from './ayuda';

const ESCENAS = [
  'Logo', 'Recomendaciones', 'Titulo', 'Registro', 'Capitulo', 'Cinematica',
  'Mision1Sistemas', 'Mision2Cohete', 'Mision3Orion', 'Mision4Despegue', 'MisionMarte', 'Mision5Rover',
  'Ecuacion', 'Archivo', 'Fin', 'MultiLobby',
];

for (const escena of ESCENAS) {
  test(`${escena}: abre, cabe en pantalla y no tira errores`, async ({ page }) => {
    const errores = vigilarErrores(page);
    await abrir(page, escena);
    await page.waitForTimeout(2500);   // deja correr animaciones y cargas diferidas
    await lienzoCabe(page);
    expect(await escenasActivas(page)).not.toHaveLength(0);
    expect(errores, errores.join('\n')).toEqual([]);
  });
}

test('el juego en inglés (?idioma=en) abre la portada traducida', async ({ page }) => {
  const errores = vigilarErrores(page);
  await abrir(page, 'Titulo', '&idioma=en');
  await expect.poll(() => page.evaluate(() => {
    const s: any = (window as any).juego.scene.getScene('Titulo'); const out: string[] = [];
    const rec = (o: any) => { if (o.type === 'Text' && o.text) out.push(o.text); (o.list || []).forEach(rec); }; s.children.list.forEach(rec);
    return out.includes('Play') || out.includes('PLAY');
  })).toBe(true);
  expect(errores).toEqual([]);
});
