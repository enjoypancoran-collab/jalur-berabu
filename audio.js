// audio.js
// Lapis 6: pemutar klip suara.
//
// Peta klip dibaca dari berkas yang ditunjuk content.suara.berkas_peta (vo.json),
// dengan content.suara.peta sebagai cadangan kalau berkas itu gagal dimuat.
// Pengaturan (hidup secara bawaan, volume) dari content.suara.
//
// Aturan yang dijaga di sini:
//   - Suara hidup secara bawaan. Pilihan bisu disimpan di localStorage.
//   - Klip TIDAK PERNAH menahan permainan: putarKlip() kembali seketika, tidak
//     pernah di-await, tidak pernah melempar. Tombol Lanjut tetap hidup sejak
//     detik pertama klip.
//   - Berkas audio yang belum ada -> game jalan terus tanpa suara.
//
// Baris peringatan suara di layar judul dan pemicu klip pertama (tombol Mulai
// pagi) diatur di ui.js; berkas ini tidak memutar apa pun sampai diminta.

import { bisuTersimpan, simpanBisu } from './save.js';

let peta = {};
let volume = 0.7;
let bisu = false;
let siap = false;
let klipSekarang = null; // Audio yang sedang berbunyi
let antre = []; // sisa kunci dari panggilan array (mis. ["brief.cho","brief.ones"])

/**
 * Muat peta klip dan pengaturan. Dipanggil sekali setelah content.json siap.
 * Aman dipanggil ulang. Tidak memutar apa pun.
 */
export async function siapkanAudio(content) {
  const s = (content && content.suara) || {};
  volume =
    typeof s.volume_bawaan === 'number' ? s.volume_bawaan : 0.7;

  // Hidup secara bawaan; localStorage boleh menon-aktifkan.
  const tersimpan = bisuTersimpan(); // true | false | null
  if (tersimpan === true || tersimpan === false) {
    bisu = tersimpan;
  } else {
    bisu = s.hidup_secara_bawaan === false; // hidup -> tidak bisu
  }

  const berkas = s.berkas_peta || 'vo.json';
  try {
    const res = await fetch(berkas, { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      peta = j && j.peta && typeof j.peta === 'object' ? j.peta : j;
    }
  } catch (e) {
    /* abaikan: pakai cadangan di bawah */
  }
  if (!peta || typeof peta !== 'object' || !Object.keys(peta).length) {
    peta = s.peta || {};
  }
  siap = true;
}

function mainkan(src) {
  try {
    if (klipSekarang) {
      klipSekarang.pause();
      klipSekarang = null;
    }
    const a = new Audio(src); // path relatif dari content, mis. "audio/vo_01_judul.mp3"
    a.volume = volume;
    a.addEventListener('ended', () => {
      if (klipSekarang === a) klipSekarang = null;
      lanjutAntre();
    });
    a.addEventListener('error', () => {
      if (klipSekarang === a) klipSekarang = null;
      lanjutAntre();
    });
    klipSekarang = a;
    // play() menolak kalau berkas 404 atau autoplay diblokir. Telan; jangan
    // biarkan menahan atau melempar ke pemanggil.
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        if (klipSekarang === a) klipSekarang = null;
        lanjutAntre();
      });
    }
  } catch (e) {
    /* aset audio belum ada: lanjut tanpa suara */
    lanjutAntre();
  }
}

function lanjutAntre() {
  if (bisu || !antre.length) return;
  const kunci = antre.shift();
  const src = peta[kunci];
  if (src) mainkan(src);
  else lanjutAntre();
}

/**
 * Putar satu klip (kunci string) atau rangkaian klip (array kunci, dibunyikan
 * berurutan). Kembali seketika. Tidak pernah menahan permainan.
 */
export function putarKlip(kunci) {
  if (bisu || !siap || !kunci) return;
  antre = Array.isArray(kunci) ? kunci.slice() : [kunci];
  lanjutAntre();
}

/** Hentikan klip yang sedang berbunyi dan kosongkan antrean. */
export function hentikanKlip() {
  antre = [];
  if (klipSekarang) {
    try {
      klipSekarang.pause();
    } catch (e) {
      /* abaikan */
    }
    klipSekarang = null;
  }
}

/** true kalau suara sedang dibisukan. */
export function sedangBisu() {
  return bisu;
}

/** Setel bisu, simpan ke localStorage, hentikan bunyi kalau dibisukan. */
export function setBisu(nilai) {
  bisu = !!nilai;
  simpanBisu(bisu);
  if (bisu) hentikanKlip();
  return bisu;
}

/** Balik keadaan bisu. Mengembalikan keadaan baru (true = bisu). */
export function toggleBisu() {
  return setBisu(!bisu);
}
