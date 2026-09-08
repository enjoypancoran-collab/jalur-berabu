// tools/serve.mjs
// Server statis untuk pengembangan lokal. Bukan proses build, bukan bagian game.
// Pakai kalau tidak ada `python -m http.server`.
//
//   node tools/serve.mjs [port]
//
// Default port 8000. Menyajikan berkas dari akar repo (folder induk tools/).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.argv[2]) || 8000;

const TIPE = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    if (rel === sep || rel === '/' || rel === '') rel = 'index.html';
    const berkas = join(AKAR, rel);
    if (!berkas.startsWith(AKAR)) {
      res.writeHead(403).end('403');
      return;
    }
    const data = await readFile(berkas);
    res.writeHead(200, {
      'Content-Type': TIPE[extname(berkas).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch (e) {
    const kode = e && e.code === 'ENOENT' ? 404 : 500;
    res.writeHead(kode).end(String(kode));
  }
});

server.listen(port, () => {
  console.log('Jalur Berabu — server lokal di http://localhost:' + port + '/');
  console.log('Akar: ' + AKAR);
  console.log('Ctrl+C untuk berhenti.');
});
