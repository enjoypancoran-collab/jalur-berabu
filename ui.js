// ui.js
// Lapis 2: peralihan layar, tombol, pintasan papan ketik, dua panel berdampingan.
// Lapis 3: Layar Hitung (mengikuti layar.hitung.urutan; angka dihitung ulang
//          mesin, bukan diambil sebagai teks), kejadian sisipan atap & mata,
//          sistem 14 kartu fakta + layar koleksi, kartu memo + Salin hasil (C).
//
// Semua teks dan angka dibaca dari content.json saat runtime. Perhitungan
// paparan dan penentuan kartu terbuka seluruhnya di engine.js. Berkas ini
// tidak pernah memajukan permainan sendiri kecuali pada rangkaian terjadwal
// Layar Hitung, yang jedanya ditetapkan content.

import {
  jalankanRute,
  hitungWfh,
  urutanKeputusan,
  undiFaktorAngin,
  bulatkanSatuDesimal,
  kartuFaktaTerbuka,
} from './engine.js';
import {
  kartuTerbukaTersimpan,
  simpanKartuTerbuka,
  tambahTamat,
} from './save.js';

// Satu-satunya dua label tampilan yang tidak ada di content.json: content
// tidak punya field nama tokoh. Semua string lain bersumber dari content.
const NAMA = { cho: 'Bro Cho', ones: 'Si Ones' };

const LAYAR = ['judul', 'kartu', 'main', 'tiba', 'hitung', 'memo', 'koleksi'];

let content;
let P; // content.antarmuka.pintasan
let sesi;

const el = (id) => document.getElementById(id);
const fmt1 = (n) => bulatkanSatuDesimal(n).toFixed(1).replace('.', ',');
const koma = (s) => String(s).replace('.', ',');
const fokus = (node) => {
  if (node) requestAnimationFrame(() => node.focus());
};

// --- muat ---------------------------------------------------------------------

async function mulai() {
  try {
    const res = await fetch('content.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    content = await res.json();
  } catch (e) {
    el('status').textContent =
      'Tidak bisa memuat content.json (' + e.message + '). ' +
      'Jalankan server lokal: node tools/serve.mjs  lalu buka http://localhost:8000/';
    return;
  }

  el('status').hidden = true;
  P = content.antarmuka.pintasan;

  if (window.matchMedia && window.matchMedia('(max-width: 599px)').matches) {
    document.body.replaceChildren();
    const p = document.createElement('p');
    p.textContent =
      'Layar terlalu sempit. Buka di laptop dengan lebar minimal 1024 piksel.';
    document.body.append(p);
    return;
  }

  resetSesi();

  el('judul').textContent = content.meta.judul;
  el('subjudul').textContent = content.meta.subjudul;
  el('peringatan-suara').textContent = content.layar.judul.baris_peringatan_suara;
  el('tombol-mulai').textContent = content.label.tombol.mulai;
  el('tombol-ulang').textContent = content.label.tombol.ulang;
  el('tombol-koleksi-judul').textContent = content.label.tombol.koleksi;
  el('tombol-koleksi-memo').textContent = content.label.tombol.koleksi;
  el('nama-cho').textContent = NAMA.cho;
  el('nama-ones').textContent = NAMA.ones;
  el('bantuan-pintasan').textContent = teksPintasan();

  el('tombol-mulai').addEventListener('click', () => pergiKe('kartu'));
  el('tombol-kartu').addEventListener('click', lanjutKartu);
  el('tombol-tiba-lanjut').addEventListener('click', () => pergiKe('hitung'));
  el('tombol-tiba-lanjut').textContent = content.label.tombol.lanjut;
  el('hitung-lanjut').addEventListener('click', () => pergiKe('memo'));
  el('hitung-lanjut').textContent = content.label.tombol.lanjut;
  el('tombol-salin').addEventListener('click', salinHasil);
  el('tombol-ulang').addEventListener('click', ulang);
  el('tombol-uji').addEventListener('click', () => {
    el('hasil-uji').textContent = ujiAcuan();
  });
  el('tombol-koleksi-judul').addEventListener('click', () => bukaKoleksi());
  el('tombol-koleksi-memo').addEventListener('click', () => bukaKoleksi());
  el('tombol-koleksi-kembali').addEventListener('click', () =>
    pergiKe(sesi.layarSebelum || 'judul'),
  );

  window.addEventListener('keydown', tekan);
  pergiKe('judul');
}

function resetSesi() {
  sesi = {
    layar: 'judul',
    layarSebelum: null,
    angin: undiFaktorAngin(content).nilai,
    // Lapis 2-3 menyamakan asumsi masker dengan angka acuan. Lapisan berikutnya
    // menurunkannya dari barang yang dibawa Si Ones di O2.
    maskerId: 'kn95_rapat',
    urutan: urutanKeputusan(content),
    langkah: 0,
    fase: 'pilih', // 'pilih' | 'akibat' | 'sisipan-pilih' | 'sisipan-akibat'
    kartuIdx: 0,
    pilihanCho: [],
    pilihanOnes: [],
    barang: [],
    serempet: false,
    pilihanTerakhir: null,
    tombolPilihan: [],
    tombolLanjut: null,
    sisipanAktif: null,
    sisipanSelesai: [],
    sisipanTerakhir: null,
    pilihanMata: null,
    pilihanAtap: null,
    sampaiHitung: false,
    tamatDicatat: false,
    hitung: { antrean: [], idx: 0, selesai: false, timer: null },
    kartuTerbuka: new Set(),
  };
}

// --- peralihan layar --------------------------------------------------------

function pergiKe(nama) {
  if (nama !== 'hitung' && sesi.hitung.timer) {
    clearTimeout(sesi.hitung.timer);
    sesi.hitung.timer = null;
  }
  for (const l of LAYAR) el('layar-' + l).hidden = l !== nama;
  if (nama !== 'koleksi') sesi.layarSebelum = sesi.layar;
  sesi.layar = nama;

  if (nama === 'judul') fokus(el('tombol-mulai'));
  else if (nama === 'kartu') renderKartu();
  else if (nama === 'main') renderMain();
  else if (nama === 'tiba') renderTiba();
  else if (nama === 'hitung') mulaiHitung();
  else if (nama === 'memo') renderMemo();
  else if (nama === 'koleksi') renderKoleksi();
}

function bukaKoleksi() {
  sesi.layarSebelum = sesi.layar;
  pergiKe('koleksi');
}

// --- kartu pembuka ---------------------------------------------------------

function renderKartu() {
  const kartu = content.layar.kartu_pembuka;
  const k = kartu[sesi.kartuIdx];
  el('kartu-nomor').textContent =
    'Kartu ' + (sesi.kartuIdx + 1) + ' dari ' + kartu.length;
  el('kartu-teks').textContent = k.teks;
  el('kartu-gambar').textContent = k.gambar ? '[gambar: ' + k.gambar + ']' : '';
  el('tombol-kartu').textContent = k.tombol || content.label.tombol.lanjut;
  fokus(el('tombol-kartu'));
}

function lanjutKartu() {
  if (sesi.layar !== 'kartu') return;
  if (sesi.kartuIdx < content.layar.kartu_pembuka.length - 1) {
    sesi.kartuIdx += 1;
    renderKartu();
  } else {
    pergiKe('main');
  }
}

// --- permainan -----------------------------------------------------------

function cfg() {
  return { faktorAngin: sesi.angin, faktorMaskerId: sesi.maskerId };
}

function opsiOnes() {
  const o = { barang: sesi.barang };
  if (sesi.pilihanMata) {
    o.pilihanKejadian = { mata: sesi.pilihanMata };
  } else if (sesi.sisipanAktif && sesi.sisipanAktif.id === 'mata') {
    // kejadian mata sedang berjalan tapi belum dipilih: jangan diprediksi di HUD
    o.abaikanKejadian = ['mata'];
  }
  return o;
}

function hasilCho() {
  return jalankanRute(content, cfg(), 'cho', sesi.pilihanCho, {
    serempet: sesi.serempet,
  });
}
function hasilOnes() {
  return jalankanRute(content, cfg(), 'ones', sesi.pilihanOnes, opsiOnes());
}

function batang(pp) {
  const lebar = 20;
  const isi = Math.max(0, Math.min(lebar, Math.round(pp)));
  return '█'.repeat(isi) + '░'.repeat(lebar - isi);
}

function renderHud(targetId) {
  const c = hasilCho().paparan;
  const o = hasilOnes().paparan;
  el(targetId).textContent = [
    content.label.paparan_penuh,
    '  ' + NAMA.cho.padEnd(9) + batang(c) + '  ' + fmt1(c) + ' poin',
    '  ' + NAMA.ones.padEnd(9) + batang(o) + '  ' + fmt1(o) + ' poin',
  ].join('\n');
}

function bukaKartu() {
  const set = kartuFaktaTerbuka(content, {
    pilihanCho: sesi.pilihanCho,
    pilihanOnes: sesi.pilihanOnes,
    barang: sesi.barang,
    sisipanSelesai: sesi.sisipanSelesai,
    sampaiHitung: sesi.sampaiHitung,
  });
  sesi.kartuTerbuka = set;
  simpanKartuTerbuka([...set]);
}

function renderMain() {
  if (sesi.fase === 'sisipan-pilih' || sesi.fase === 'sisipan-akibat') {
    renderSisipan();
    return;
  }
  if (sesi.langkah >= sesi.urutan.length) {
    pergiKe('tiba');
    return;
  }

  const k = sesi.urutan[sesi.langkah];
  el('kemajuan').textContent =
    'Keputusan ' + (sesi.langkah + 1) + ' dari ' + sesi.urutan.length;
  renderHud('hud');

  const aktifCho = k.tokoh === 'cho';
  el('panel-cho').classList.toggle('redup', !aktifCho);
  el('panel-ones').classList.toggle('redup', aktifCho);
  el('kenapa-catatan').hidden = true;

  const isiAktif = el(aktifCho ? 'isi-cho' : 'isi-ones');
  if (sesi.fase === 'pilih') {
    if (k.tipe === 'pilih_barang') renderBarang(k, isiAktif);
    else renderPilihan(k, isiAktif);
  } else {
    renderAkibat(k, isiAktif);
  }

  const isiLain = el(aktifCho ? 'isi-ones' : 'isi-cho');
  if (!isiLain.dataset.terisi) {
    isiLain.textContent =
      'Menunggu giliran ' + (aktifCho ? NAMA.ones : NAMA.cho) + '.';
  }
}

function renderPilihan(k, isi) {
  isi.replaceChildren();
  isi.dataset.terisi = '1';
  sesi.tombolPilihan = [];

  const sit = document.createElement('p');
  sit.textContent = k.kalimat_situasi || '';
  isi.append(sit);

  k.pilihan.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    // Biaya waktu di tombol. Biaya Poin Paparan Abu Vulkanik TIDAK di tombol.
    b.textContent =
      (i + 1) + '. ' + p.label + '  (+' + (p.biaya_menit || 0) + ' menit)';
    b.addEventListener('click', () => pilih(k, p));
    isi.append(b);
    sesi.tombolPilihan.push(b);
  });

  fokus(sesi.tombolPilihan[0]);
}

function renderBarang(k, isi) {
  isi.replaceChildren();
  isi.dataset.terisi = '1';

  const sit = document.createElement('p');
  sit.textContent = k.kalimat_situasi || '';
  isi.append(sit);
  const info = document.createElement('p');
  info.textContent = 'Pilih ' + k.slot + ' barang.';
  isi.append(info);

  const dipilih = new Set();
  const lanjut = document.createElement('button');
  lanjut.type = 'button';
  lanjut.textContent = content.label.tombol.lanjut;
  lanjut.disabled = true;

  content.barang.forEach((it, i) => {
    const baris = document.createElement('label');
    baris.style.display = 'block';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.barang = it.id;
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (dipilih.size >= k.slot) {
          cb.checked = false;
          return;
        }
        dipilih.add(it.id);
      } else {
        dipilih.delete(it.id);
      }
      lanjut.disabled = dipilih.size !== k.slot;
      if (!lanjut.disabled) fokus(lanjut);
    });
    baris.append(cb, document.createTextNode(' ' + (i + 1) + '. ' + it.nama));
    isi.append(baris);
  });

  lanjut.addEventListener('click', () => {
    if (dipilih.size !== k.slot) return;
    sesi.barang = [...dipilih];
    sesi.pilihanTerakhir = null; // O2 memakai kalimat_akibat milik keputusan
    sesi.fase = 'akibat';
    bukaKartu();
    renderMain();
  });
  isi.append(lanjut);
  sesi.tombolLanjut = lanjut;
  fokus(isi.querySelector('input'));
}

function pilih(k, p) {
  if (sesi.layar !== 'main' || sesi.fase !== 'pilih') return;
  if (k.tokoh === 'cho') sesi.pilihanCho.push(p.id);
  else sesi.pilihanOnes.push(p.id);

  if (p.efek && p.efek.peluang_serempet !== undefined) {
    sesi.serempet = Math.random() < p.efek.peluang_serempet;
  }
  sesi.pilihanTerakhir = p;
  sesi.fase = 'akibat';
  bukaKartu();
  renderMain();
}

function renderAkibat(k, isi) {
  isi.replaceChildren();
  isi.dataset.terisi = '1';
  const p = sesi.pilihanTerakhir;

  const a = document.createElement('p');
  a.textContent = (p && p.kalimat_akibat) || k.kalimat_akibat || '';
  isi.append(a);

  if (sesi.serempet && p && p.efek && p.efek.kalimat_serempet) {
    const s = document.createElement('p');
    s.textContent = p.efek.kalimat_serempet;
    isi.append(s);
  }

  const lanjut = document.createElement('button');
  lanjut.type = 'button';
  lanjut.textContent = content.label.tombol.lanjut;
  lanjut.addEventListener('click', lanjutMain);
  isi.append(lanjut);
  sesi.tombolLanjut = lanjut;
  fokus(lanjut);
}

function lanjutMain() {
  if (sesi.layar !== 'main' || sesi.fase !== 'akibat') return;
  sesi.langkah += 1;
  sesi.fase = 'pilih';
  sesi.pilihanTerakhir = null;
  if (cekSisipan()) return;
  renderMain();
}

// --- kejadian sisipan (atap, mata) ---------------------------------------

function cekSisipan() {
  // atap: selalu, setelah C4 (empat pilihan Cho sudah masuk).
  if (!sesi.sisipanSelesai.includes('atap') && sesi.pilihanCho.length >= 4) {
    return mulaiSisipan('atap');
  }
  // mata: setelah O3, kalau goggle tidak dibawa atau lensa kontak dibawa.
  const mataTerpicu =
    !sesi.barang.includes('goggle') || sesi.barang.includes('lensa_kontak');
  if (
    !sesi.sisipanSelesai.includes('mata') &&
    mataTerpicu &&
    sesi.pilihanOnes.length >= 2
  ) {
    return mulaiSisipan('mata');
  }
  return false;
}

function mulaiSisipan(id) {
  sesi.sisipanAktif = content.kejadian_sisipan.find((e) => e.id === id);
  sesi.sisipanTerakhir = null;
  sesi.fase = 'sisipan-pilih';
  renderSisipan();
  return true;
}

function cocokSyarat(syarat) {
  for (const it of content.barang) {
    if (syarat.includes(it.id)) return sesi.barang.includes(it.id);
  }
  return true;
}

function renderSisipan() {
  const ev = sesi.sisipanAktif;
  el('kemajuan').textContent = 'Kejadian';
  renderHud('hud');

  const aktifCho = ev.tokoh === 'cho';
  el('panel-cho').classList.toggle('redup', !aktifCho);
  el('panel-ones').classList.toggle('redup', aktifCho);
  el('kenapa-catatan').hidden = true;

  const isi = el(aktifCho ? 'isi-cho' : 'isi-ones');
  isi.replaceChildren();
  isi.dataset.terisi = '1';

  const h = document.createElement('p');
  h.textContent = ev.judul;
  isi.append(h);

  if (sesi.fase === 'sisipan-pilih') {
    if (
      sesi.barang.includes('lensa_kontak') &&
      ev.kalimat_tambahan_jika_lensa_kontak
    ) {
      const t = document.createElement('p');
      t.textContent = ev.kalimat_tambahan_jika_lensa_kontak;
      isi.append(t);
    }
    sesi.tombolPilihan = [];
    const opsi = ev.pilihan.filter((p) => !p.syarat || cocokSyarat(p.syarat));
    opsi.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = (i + 1) + '. ' + p.label;
      b.addEventListener('click', () => pilihSisipan(ev, p));
      isi.append(b);
      sesi.tombolPilihan.push(b);
    });
    fokus(sesi.tombolPilihan[0]);
  } else {
    const p = sesi.sisipanTerakhir;
    const a = document.createElement('p');
    a.textContent = (p && p.kalimat_akibat) || ev.kalimat_akibat || '';
    isi.append(a);

    const lanjut = document.createElement('button');
    lanjut.type = 'button';
    lanjut.textContent = content.label.tombol.lanjut;
    lanjut.addEventListener('click', lanjutSisipan);
    isi.append(lanjut);
    fokus(lanjut);
  }
}

function pilihSisipan(ev, p) {
  if (sesi.fase !== 'sisipan-pilih') return;
  if (ev.id === 'mata') sesi.pilihanMata = p.id;
  if (ev.id === 'atap') sesi.pilihanAtap = p.id;
  sesi.sisipanTerakhir = p;
  sesi.fase = 'sisipan-akibat';
  renderSisipan();
}

function lanjutSisipan() {
  if (sesi.fase !== 'sisipan-akibat') return;
  const ev = sesi.sisipanAktif;
  if (!sesi.sisipanSelesai.includes(ev.id)) sesi.sisipanSelesai.push(ev.id);
  sesi.sisipanAktif = null;
  sesi.sisipanTerakhir = null;
  sesi.fase = 'pilih';
  bukaKartu();
  if (cekSisipan()) return;
  renderMain();
}

// --- layar tiba --------------------------------------------------------

function renderTiba() {
  el('tiba-teks').textContent =
    NAMA.cho + ' dan ' + NAMA.ones + ' sampai di Gadog.';
  renderHud('hud-tiba');
  fokus(el('tombol-tiba-lanjut'));
}

// --- Layar Hitung -----------------------------------------------------

// Angka acuan dihitung ULANG oleh mesin pada kondisi kanonik (faktor angin 1,0,
// masker KN95 rapat), tidak diambil sebagai teks dari content.json.
function hitungAngkaHitung() {
  const c = { faktorAngin: 1, faktorMaskerId: 'kn95_rapat' };
  const a = content.angka_acuan;
  const cho = jalankanRute(content, c, 'cho', a.rute_optimal_cho, {});
  const ones = jalankanRute(content, c, 'ones', a.rute_optimal_ones, {
    barang: a.barang_optimal_ones,
  });
  const wfh = hitungWfh(content);
  return {
    cho: cho.paparan,
    ones: ones.paparan,
    menit: ones.menitUdaraTerbuka,
    wfh: wfh.paparan,
    ambang: content.konstanta.ambang_aman,
  };
}

// Indonesia, cukup untuk 0..999 (mis. "empat puluh tujuh").
function angkaKeKata(n) {
  n = Math.round(n);
  const s = [
    'nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan',
    'sembilan', 'sepuluh', 'sebelas',
  ];
  if (n < 12) return s[n];
  if (n < 20) return s[n - 10] + ' belas';
  if (n < 100) {
    const p = Math.floor(n / 10);
    const r = n % 10;
    return s[p] + ' puluh' + (r ? ' ' + s[r] : '');
  }
  if (n < 200) return 'seratus' + (n % 100 ? ' ' + angkaKeKata(n % 100) : '');
  if (n < 1000) {
    const p = Math.floor(n / 100);
    const r = n % 100;
    return s[p] + ' ratus' + (r ? ' ' + angkaKeKata(r) : '');
  }
  return String(n);
}

// Pasangan {cari, ganti}: kunci pencarian diturunkan dari content.angka_acuan
// (bukan ditulis di kode), nilai pengganti dari hasil hitung mesin.
function pasanganAngka(h) {
  const a = content.angka_acuan;
  const f = (x) => fmt1(x);
  return [
    { cari: f(a.cho_optimal), ganti: f(h.cho) },
    { cari: f(a.ones_optimal), ganti: f(h.ones) },
    { cari: f(a.rute_wfh), ganti: f(h.wfh) },
    { cari: koma(String(a.ambang_aman)), ganti: koma(String(bulatkanSatuDesimal(h.ambang))) },
    { cari: angkaKeKata(a.ones_menit_udara_terbuka), ganti: String(h.menit) },
  ];
}

function terapkanAngka(teks, pasangan) {
  let out = teks;
  for (const { cari, ganti } of pasangan) {
    if (!cari) continue;
    if (/[a-z]/i.test(cari)) {
      out = out.split(cari).join(ganti); // frasa kata -> digit
    } else {
      const esc = cari.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp('(?<![\\d,])' + esc + '(?![\\d,])', 'g'), ganti);
    }
  }
  return out;
}

function mulaiHitung() {
  sesi.sampaiHitung = true;
  bukaKartu(); // membuka kartu layar.hitung.kartu_fakta_terbuka

  const psg = pasanganAngka(hitungAngkaHitung());
  const kurangiGerak =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ms = (detik) => (kurangiGerak ? 0 : Math.round((detik || 0) * 1000));

  const antrean = [];
  for (const bagian of content.layar.hitung.urutan) {
    const baris = (bagian.teks || []).map((t) => terapkanAngka(t, psg));
    baris.forEach((teks, i) => {
      let jeda = 0;
      if (bagian.bagian === 'tiga_baris_angka' && i > 0) {
        jeda = ms(bagian.jeda_antarbaris_detik);
      } else if (bagian.bagian === 'vonis' && i === 0) {
        jeda = ms(bagian.jeda_sebelum_detik);
      } else if (bagian.bagian === 'opsi_keempat' && i === 1) {
        jeda = ms(bagian.jeda_di_tengah_detik);
      }
      antrean.push({ teks, jeda });
    });
  }

  sesi.hitung = { antrean, idx: 0, selesai: false, timer: null };
  el('hitung-teks').replaceChildren();
  // Dua batang Poin Paparan Abu Vulkanik milik pemain tetap terlihat.
  renderHud('hitung-hud');
  el('hitung-lanjut').hidden = true;
  langkahHitung();
}

function langkahHitung() {
  const h = sesi.hitung;
  if (h.idx >= h.antrean.length) {
    h.selesai = true;
    el('hitung-lanjut').hidden = false;
    fokus(el('hitung-lanjut'));
    return;
  }
  const item = h.antrean[h.idx++];
  h.timer = setTimeout(() => {
    h.timer = null;
    const p = document.createElement('p');
    p.textContent = item.teks;
    el('hitung-teks').append(p);
    langkahHitung();
  }, item.jeda);
}

function lewatiHitung() {
  const h = sesi.hitung;
  if (h.timer) {
    clearTimeout(h.timer);
    h.timer = null;
  }
  while (h.idx < h.antrean.length) {
    const p = document.createElement('p');
    p.textContent = h.antrean[h.idx++].teks;
    el('hitung-teks').append(p);
  }
  h.selesai = true;
  el('hitung-lanjut').hidden = false;
  fokus(el('hitung-lanjut'));
}

// --- kartu memo -------------------------------------------------------

function ringkasanMemo() {
  const s = { cho: hasilCho(), ones: hasilOnes() };
  const acu = hitungAngkaHitung();
  const L = content.label.paparan_penuh;
  return [
    L + ' ' + NAMA.cho + ' (rutemu): ' + fmt1(s.cho.paparan) + ' poin',
    L + ' ' + NAMA.ones + ' (rutemu): ' + fmt1(s.ones.paparan) + ' poin',
    'Rute paling aman ' + NAMA.cho + ': ' + fmt1(acu.cho) + ' poin',
    'Rute paling aman ' + NAMA.ones + ': ' + fmt1(acu.ones) + ' poin',
    'Batas aman: ' + fmt1(acu.ambang) + ' poin',
    'Rute bekerja dari rumah: ' + fmt1(acu.wfh) + ' poin',
  ];
}

function tigaTindakan() {
  const petaP = new Map();
  for (const k of content.keputusan) {
    for (const p of k.pilihan || []) petaP.set(p.id, p);
  }
  const kontrib = [];
  for (const [tokoh, hasil] of [
    ['cho', hasilCho()],
    ['ones', hasilOnes()],
  ]) {
    for (const it of hasil.rincian) {
      if (!(it.pp > 0)) continue;
      let label;
      if (it.id === 'mengemudi') label = 'Perjalanan mengemudi ' + NAMA.cho;
      else if (petaP.has(it.id)) label = petaP.get(it.id).label;
      else label = it.id;
      kontrib.push({
        nama: tokoh === 'cho' ? NAMA.cho : NAMA.ones,
        label,
        pp: it.pp,
      });
    }
  }
  kontrib.sort((a, b) => b.pp - a.pp);
  return kontrib
    .slice(0, 3)
    .map((c) => c.nama + ': ' + c.label + ' — ' + fmt1(c.pp) + ' poin');
}

function teksMemo() {
  const m = content.layar.memo;
  return [
    content.meta.judul + ' — memo',
    '',
    m.narasi,
    '',
    m.isi[0],
    ...ringkasanMemo(),
    '',
    m.isi[1],
    ...tigaTindakan().map((t, i) => i + 1 + '. ' + t),
    '',
    m.isi[2],
  ].join('\n');
}

function renderMemo() {
  if (!sesi.tamatDicatat) {
    sesi.tamatDicatat = true;
    tambahTamat();
  }
  const m = content.layar.memo;
  const box = el('memo-isi');
  box.replaceChildren();

  const nar = document.createElement('p');
  nar.textContent = m.narasi;
  box.append(nar);

  const j1 = document.createElement('h3');
  j1.textContent = m.isi[0];
  box.append(j1);
  const pre = document.createElement('pre');
  pre.textContent = ringkasanMemo().join('\n');
  box.append(pre);

  const j2 = document.createElement('h3');
  j2.textContent = m.isi[1];
  box.append(j2);
  const ol = document.createElement('ol');
  for (const t of tigaTindakan()) {
    const li = document.createElement('li');
    li.textContent = t;
    ol.append(li);
  }
  box.append(ol);

  const j3 = document.createElement('h3');
  j3.textContent = m.isi[2];
  box.append(j3);

  el('tombol-salin').textContent = m.tombol_salin;
  el('salin-status').hidden = true;
  el('salin-status').textContent = '';
  el('memo-kartu-hitung').textContent =
    'Kartu fakta terkumpul: ' +
    kartuTerbukaTersimpan().size +
    ' dari ' +
    content.kartu_fakta.length;

  fokus(el('tombol-salin'));
}

async function salinHasil() {
  if (sesi.layar !== 'memo') return;
  const teks = teksMemo();
  let ok = false;
  try {
    await navigator.clipboard.writeText(teks);
    ok = true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = teks;
      document.body.append(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch (e2) {
      ok = false;
    }
  }
  const s = el('salin-status');
  s.textContent = ok
    ? content.layar.memo.pemberitahuan_salin
    : 'Salin gagal. Pilih teks memo secara manual.';
  s.hidden = false;
}

// --- layar koleksi kartu --------------------------------------------

function renderKoleksi() {
  const terbuka = kartuTerbukaTersimpan();
  el('koleksi-hitung').textContent =
    terbuka.size + ' dari ' + content.kartu_fakta.length + ' kartu fakta terkumpul';

  const box = el('koleksi-daftar');
  box.replaceChildren();
  for (const kf of content.kartu_fakta) {
    const div = document.createElement('div');
    div.className = 'kartu';
    if (terbuka.has(kf.id)) {
      const t = document.createElement('p');
      t.textContent = 'Kartu ' + kf.id + '. ' + kf.teks;
      const su = document.createElement('p');
      su.className = 'catatan-gambar';
      su.textContent = 'Sumber: ' + kf.sumber;
      div.append(t, su);
    } else {
      div.classList.add('terkunci');
      const t = document.createElement('p');
      t.textContent = 'Kartu ' + kf.id + '. (belum terbuka)';
      div.append(t);
    }
    box.append(div);
  }
  fokus(el('tombol-koleksi-kembali'));
}

// --- mulai ulang ----------------------------------------------------

function ulang() {
  if (sesi.layar === 'judul') return;
  if (sesi.hitung.timer) clearTimeout(sesi.hitung.timer);
  resetSesi();
  for (const id of ['isi-cho', 'isi-ones']) {
    el(id).replaceChildren();
    delete el(id).dataset.terisi;
  }
  el('hitung-teks').replaceChildren();
  el('hasil-uji').textContent = '';
  el('salin-status').hidden = true;
  pergiKe('judul');
}

// --- pintasan papan ketik --------------------------------------------------

function cocok(key, spec) {
  const alias = { escape: 'esc', ' ': 'space', spacebar: 'space' };
  const k = key.toLowerCase();
  const kk = alias[k] || k;
  return spec
    .split('/')
    .map((s) => s.trim().toLowerCase())
    .some((s) => s === kk || s === k);
}

function teksPintasan() {
  return (
    'Pintasan: pilihan ' + P.pilihan +
    ' | lanjut ' + P.lanjut +
    ' | ' + P.kenapa + ' ' + content.label.tombol.kenapa +
    ' | ulang ' + P.ulang +
    ' | ' + P.salin + ' salin (di memo)' +
    ' | tutup ' + P.tutup
  );
}

function tekan(ev) {
  if (!sesi) return;
  const key = ev.key;
  const layar = sesi.layar;

  if (cocok(key, P.lanjut)) {
    if (layar === 'kartu') {
      ev.preventDefault();
      lanjutKartu();
      return;
    }
    if (layar === 'main') {
      if (sesi.fase === 'akibat') {
        ev.preventDefault();
        lanjutMain();
        return;
      }
      if (sesi.fase === 'sisipan-akibat') {
        ev.preventDefault();
        lanjutSisipan();
        return;
      }
      if (sesi.fase === 'pilih') {
        const k = sesi.urutan[sesi.langkah];
        if (
          k && k.tipe === 'pilih_barang' &&
          sesi.tombolLanjut && !sesi.tombolLanjut.disabled
        ) {
          ev.preventDefault();
          sesi.tombolLanjut.click();
          return;
        }
      }
    }
    if (layar === 'tiba') {
      ev.preventDefault();
      pergiKe('hitung');
      return;
    }
    if (layar === 'hitung') {
      ev.preventDefault();
      if (!sesi.hitung.selesai) lewatiHitung();
      else pergiKe('memo');
      return;
    }
  }

  if (cocok(key, P.ulang) && layar !== 'judul') {
    ev.preventDefault();
    ulang();
    return;
  }

  if (cocok(key, P.tutup)) {
    if (layar === 'koleksi') {
      pergiKe(sesi.layarSebelum || 'judul');
      return;
    }
    el('kenapa-catatan').hidden = true;
    return;
  }

  if (cocok(key, P.salin) && layar === 'memo') {
    ev.preventDefault();
    salinHasil();
    return;
  }

  if (
    cocok(key, P.kenapa) &&
    layar === 'main' &&
    (sesi.fase === 'pilih' || sesi.fase === 'akibat')
  ) {
    ev.preventDefault();
    const k = sesi.urutan[sesi.langkah];
    const c = el('kenapa-catatan');
    if (c.hidden) {
      c.textContent = k.catatan_mesin || 'Tidak ada catatan untuk keputusan ini.';
      c.hidden = false;
    } else {
      c.hidden = true;
    }
    return;
  }

  if (
    layar === 'main' &&
    (sesi.fase === 'pilih' || sesi.fase === 'sisipan-pilih') &&
    /^[1-9]$/.test(key)
  ) {
    const n = Number(key) - 1;
    const k = sesi.urutan[sesi.langkah];
    if (sesi.fase === 'pilih' && k && k.tipe === 'pilih_barang') {
      const cbs = el('isi-ones').querySelectorAll('input[type=checkbox]');
      if (cbs[n]) cbs[n].click();
      return;
    }
    const b = sesi.tombolPilihan[n];
    if (b) {
      ev.preventDefault();
      b.click();
    }
    return;
  }

  // P.bisu (M), P.bantuan (H): menyusul di lapisan berikutnya.
}

// --- uji angka acuan di browser (alat bantu, bukan bagian alur) ------------

function ujiAcuan() {
  const a = content.angka_acuan;
  const c = { faktorAngin: 1, faktorMaskerId: 'kn95_rapat' };
  const cho = jalankanRute(content, c, 'cho', a.rute_optimal_cho, {});
  const ones = jalankanRute(content, c, 'ones', a.rute_optimal_ones, {
    barang: a.barang_optimal_ones,
  });
  const wfh = hitungWfh(content);
  const baris = [
    ['Rute paling aman Bro Cho (poin)', bulatkanSatuDesimal(cho.paparan), a.cho_optimal],
    ['Rute paling aman Si Ones (poin)', bulatkanSatuDesimal(ones.paparan), a.ones_optimal],
    ['Rute bekerja dari rumah (poin)', bulatkanSatuDesimal(wfh.paparan), a.rute_wfh],
    ['Menit Si Ones di udara terbuka', ones.menitUdaraTerbuka, a.ones_menit_udara_terbuka],
  ];
  const semua = baris.every(([, d, h]) => d === h);
  const teks = baris
    .map(
      ([n, d, h]) =>
        (d === h ? '  OK   ' : 'GAGAL  ') + n +
        '\n         didapat    : ' + koma(d) +
        '\n         diharapkan : ' + koma(h),
    )
    .join('\n');
  return (semua ? 'Empat angka acuan cocok.' : 'Ada baris yang meleset.') + '\n\n' + teks;
}

mulai();
