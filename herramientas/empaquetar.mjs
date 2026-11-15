// Después de `vite build`: agrega el servidor local y el lanzador a dist/ y crea MisionCondor.zip
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PROY = path.resolve(AQUI, '..');
const DIST = path.join(PROY, 'dist');
const ZIP = path.join(PROY, 'MisionCondor.zip');

fs.copyFileSync(path.join(AQUI, 'servir.mjs'), path.join(DIST, 'servir.mjs'));
fs.writeFileSync(path.join(DIST, 'iniciar.bat'), '@echo off\r\ncd /d "%~dp0"\r\nstart "" http://localhost:8080/\r\nnode servir.mjs\r\n');
fs.writeFileSync(path.join(DIST, 'iniciar.sh'), '#!/bin/sh\ncd "$(dirname "$0")"\n(sleep 1; xdg-open http://localhost:8080/ 2>/dev/null || open http://localhost:8080/) &\nnode servir.mjs\n');
fs.writeFileSync(path.join(DIST, 'LEEME.txt'), [
  'MISIÓN CÓNDOR · ARQUISOFT · NASA Space Apps Challenge 2026',
  '',
  'Jugar sin internet: instala Node.js y haz doble clic en iniciar.bat (Windows)',
  'o ejecuta  sh iniciar.sh  (macOS / Linux). Se abre http://localhost:8080/',
  'En el celular (misma Wi-Fi): http://IP-DE-LA-PC:8080/ y gira el teléfono en horizontal.',
  '',
  'MULTIJUGADOR (2 jugadores): el mismo iniciar.bat ya levanta el servidor de salas.',
  'Cada jugador abre http://IP-DE-LA-PC:8080/ , entra a «Multijugador», escribe su correo,',
  'uno crea la sala y el otro se une con el código de 6 letras. Los datos (correos, partidas,',
  'ranking) se guardan en la carpeta datos/ junto a esta (SQLite local, nada sale de la PC).',
  '',
  'Publicar en internet: sube esta carpeta a un hosting con Node.js 22.5+ (Render Web Service,',
  'Railway, Fly.io) y ejecuta  node servir.mjs . En un hosting estático el multijugador no funciona.',
  '',
].join('\r\n'));

if (fs.existsSync(ZIP)) fs.rmSync(ZIP);
if (process.platform === 'win32') {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${DIST}\*' -DestinationPath '${ZIP}' -Force`], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-qr', ZIP, '.'], { cwd: DIST, stdio: 'inherit' });
}
const mb = (fs.statSync(ZIP).size / 1048576).toFixed(1);
console.log(`Listo: dist/ y MisionCondor.zip (${mb} MB)`);
