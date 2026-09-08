// test/acuan.mjs
// Uji empat angka acuan. Jalankan: node test/acuan.mjs
//
// Menjalankan angka_acuan.rute_optimal_cho dan angka_acuan.rute_optimal_ones
// lewat mesin yang sama dengan yang dipakai game, pada kondisi yang ditetapkan
// CLAUDE.md: faktor angin 1,0 dan masker KN95 rapat. Lalu membandingkan
// hasilnya dengan cho_optimal, ones_optimal, rute_wfh, dan
// ones_menit_udara_terbuka di content.json.
//
// Tidak ada satu pun angka content.json yang disalin ke berkas ini: rute,
// daftar barang, dan nilai yang diharapkan semuanya dibaca saat runtime.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { jalankanRute, hitungWfh, bulatkanSatuDesimal } from '../engine.js';

const dir = dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(await readFile(join(dir, '..', 'content.json'), 'utf8'));

// Kondisi uji (CLAUDE.md): faktor angin 1,0 dan masker KN95 rapat.
const cfg = { faktorAngin: 1, faktorMaskerId: 'kn95_rapat' };
const a = content.angka_acuan;

const cho = jalankanRute(content, cfg, 'cho', a.rute_optimal_cho, {});
const ones = jalankanRute(content, cfg, 'ones', a.rute_optimal_ones, {
  barang: a.barang_optimal_ones,
});
const wfh = hitungWfh(content);

const koma = (n) => String(n).replace('.', ',');

const baris = [
  ['Rute paling aman Bro Cho (poin)', bulatkanSatuDesimal(cho.paparan), a.cho_optimal],
  ['Rute paling aman Si Ones (poin)', bulatkanSatuDesimal(ones.paparan), a.ones_optimal],
  ['Rute bekerja dari rumah (poin)', bulatkanSatuDesimal(wfh.paparan), a.rute_wfh],
  ['Menit Si Ones di udara terbuka', ones.menitUdaraTerbuka, a.ones_menit_udara_terbuka],
];

let gagal = 0;
for (const [nama, dapat, harap] of baris) {
  const lulus = dapat === harap;
  if (!lulus) gagal += 1;
  console.log((lulus ? '  OK   ' : 'GAGAL  ') + nama);
  console.log('         didapat    : ' + koma(dapat));
  console.log('         diharapkan : ' + koma(harap));
}

console.log('');
if (gagal === 0) {
  console.log('Empat angka acuan cocok. Lapis 1 lulus.');
  process.exit(0);
}
console.log(
  gagal + ' dari ' + baris.length +
    ' baris meleset. Yang salah adalah kodenya, bukan rancangannya.',
);
process.exit(1);
