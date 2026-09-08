// ui.js
// Lapis 2: peralihan layar, tombol, pintasan papan ketik, dua panel berdampingan.
//
// Semua teks dan angka dibaca dari content.json saat runtime. Perhitungan
// paparan seluruhnya dilakukan engine.js. Berkas ini hanya menata dan menerima
// masukan pemain; ia tidak pernah memajukan permainan sendiri.

import {
  jalankanRute,
  hitungWfh,
  urutanKeputusan,
  undiFaktorAngin,
  bulatkanSatuDesimal,
} from './engine.js';

// Satu-satunya dua label tampilan yang tidak ada di content.json: content
// tidak punya field nama tokoh. Semua string lain bersumber dari content.
const NAMA = { cho: 'Bro Cho', ones: 'Si Ones' };

const LAYAR = ['judul', 'kartu', 'main', 'tiba'];

let content;
let P; // content.antarmuka.pintasan
let sesi;

const el = (id) => document.getElementById(id);
const fmt1 = (n) => bulatkanSatuDesimal(n).toFixed(1).replace('.', ',');
const koma = (n) => String(n).replace('.', ',');
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

  // Aturan antarmuka CLAUDE.md: di bawah 600 piksel, satu kalimat saja.
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
  // Baris peringatan suara tampil sebelum ada bunyi apa pun (belum ada suara).
  el('peringatan-suara').textContent = content.layar.judul.baris_peringatan_suara;
  el('tombol-mulai').textContent = content.label.tombol.mulai;
  el('tombol-ulang').textContent = content.label.tombol.ulang;
  el('nama-cho').textContent = NAMA.cho;
  el('nama-ones').textContent = NAMA.ones;
  el('bantuan-pintasan').textContent = teksPintasan();

  el('tombol-mulai').addEventListener('click', () => pergiKe('kartu'));
  el('tombol-kartu').addEventListener('click', lanjutKartu);
  el('tombol-ulang').addEventListener('click', ulang);
  el('tombol-uji').addEventListener('click', () => {
    el('hasil-uji').textContent = ujiAcuan();
  });
  window.addEventListener('keydown', tekan);

  pergiKe('judul');
}

function resetSesi() {
  sesi = {
    layar: 'judul',
    angin: undiFaktorAngin(content).nilai,
    // Lapis 2 menyamakan asumsi masker dengan angka acuan. Lapisan berikutnya
    // menurunkannya dari barang yang dibawa Si Ones di O2.
    maskerId: 'kn95_rapat',
    urutan: urutanKeputusan(content),
    langkah: 0,
    fase: 'pilih', // 'pilih' | 'akibat'
    kartuIdx: 0,
    pilihanCho: [],
    pilihanOnes: [],
    barang: [],
    serempet: false,
    pilihanTerakhir: null,
    tombolPilihan: [],
  };
}

// --- peralihan layar --------------------------------------------------------

function pergiKe(nama) {
  for (const l of LAYAR) el('layar-' + l).hidden = l !== nama;
  sesi.layar = nama;
  if (nama === 'judul') fokus(el('tombol-mulai'));
  else if (nama === 'kartu') renderKartu();
  else if (nama === 'main') renderMain();
  else if (nama === 'tiba') renderTiba();
}

// --- kartu pembuka ---------------------------------------------------------

function renderKartu() {
  const kartu = content.layar.kartu_pembuka;
  const k = kartu[sesi.kartuIdx];
  el('kartu-nomor').textContent =
    'Kartu ' + (sesi.kartuIdx + 1) + ' dari ' + kartu.length;
  el('kartu-teks').textContent = k.teks;
  el('kartu-gambar').textContent = k.gambar ? '[gambar: ' + k.gambar + ']' : '';
  // Kartu ketiga membawa tombol "Mulai pagi"; selebihnya "Lanjut".
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

function totalSekarang() {
  return {
    cho: jalankanRute(content, cfg(), 'cho', sesi.pilihanCho, {
      serempet: sesi.serempet,
    }),
    ones: jalankanRute(content, cfg(), 'ones', sesi.pilihanOnes, {
      barang: sesi.barang,
    }),
  };
}

function batang(pp) {
  const lebar = 20;
  const isi = Math.max(0, Math.min(lebar, Math.round(pp)));
  return '█'.repeat(isi) + '░'.repeat(lebar - isi);
}

function renderHud(targetId) {
  const t = totalSekarang();
  // Label penuh sekali di atas kedua batang; angka selalu di sebelah batang.
  el(targetId).textContent = [
    content.label.paparan_penuh,
    '  ' + NAMA.cho.padEnd(9) + batang(t.cho.paparan) + '  ' + fmt1(t.cho.paparan) + ' poin',
    '  ' + NAMA.ones.padEnd(9) + batang(t.ones.paparan) + '  ' + fmt1(t.ones.paparan) + ' poin',
  ].join('\n');
}

function renderMain() {
  const total = sesi.urutan.length; // 14
  if (sesi.langkah >= total) {
    pergiKe('tiba');
    return;
  }

  const k = sesi.urutan[sesi.langkah];
  // Penunjuk kemajuan: angka, bukan batang.
  el('kemajuan').textContent = 'Keputusan ' + (sesi.langkah + 1) + ' dari ' + total;
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

  // Panel yang menunggu: kalau belum pernah diisi, beri penanda; kalau sudah,
  // biarkan isinya (akibat terakhirnya) tetap terlihat, hanya diredupkan.
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
      // Begitu genap, arahkan fokus ke Lanjut supaya bisa lewat papan ketik saja.
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
  renderMain();
}

// --- layar tiba --------------------------------------------------------

function renderTiba() {
  el('tiba-teks').textContent = NAMA.cho + ' dan ' + NAMA.ones + ' sampai di Gadog.';
  renderHud('hud-tiba');
  fokus(el('tombol-ulang'));
}

function ulang() {
  if (sesi.layar === 'judul') return;
  const anginBaru = undiFaktorAngin(content).nilai;
  resetSesi();
  sesi.angin = anginBaru;
  for (const id of ['isi-cho', 'isi-ones']) {
    el(id).replaceChildren();
    delete el(id).dataset.terisi;
  }
  el('hasil-uji').textContent = '';
  pergiKe('judul');
}

// --- pintasan papan ketik --------------------------------------------------

// Cocokkan tombol yang ditekan dengan nilai dari content.antarmuka.pintasan.
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
    'Pintasan: ' +
    'pilihan ' + P.pilihan + ' | ' +
    'lanjut ' + P.lanjut + ' | ' +
    P.kenapa + ' ' + content.label.tombol.kenapa + ' | ' +
    'ulang ' + P.ulang + ' | ' +
    'tutup ' + P.tutup
  );
}

function tekan(ev) {
  if (!sesi) return;
  const key = ev.key;
  const layar = sesi.layar;

  // Lanjut / maju satu langkah (tidak pernah otomatis).
  if (cocok(key, P.lanjut)) {
    if (layar === 'kartu') {
      ev.preventDefault();
      lanjutKartu();
      return;
    }
    if (layar === 'main' && sesi.fase === 'akibat') {
      ev.preventDefault();
      lanjutMain();
      return;
    }
    // Pemilihan barang O2: kalau sudah genap, Lanjut menutup pemilihan.
    if (layar === 'main' && sesi.fase === 'pilih') {
      const k = sesi.urutan[sesi.langkah];
      if (k.tipe === 'pilih_barang' && sesi.tombolLanjut && !sesi.tombolLanjut.disabled) {
        ev.preventDefault();
        sesi.tombolLanjut.click();
        return;
      }
    }
    if (layar === 'tiba') {
      ev.preventDefault();
      ulang();
      return;
    }
  }

  // Mulai ulang.
  if (cocok(key, P.ulang) && layar !== 'judul') {
    ev.preventDefault();
    ulang();
    return;
  }

  // Tutup: sembunyikan catatan "Kenapa?".
  if (cocok(key, P.tutup)) {
    el('kenapa-catatan').hidden = true;
    return;
  }

  // "Kenapa?": tampilkan catatan_mesin keputusan yang sedang berjalan.
  if (cocok(key, P.kenapa) && layar === 'main') {
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

  // Pilihan 1/2/3 (dan 1..9 saat memilih barang).
  if (layar === 'main' && sesi.fase === 'pilih' && /^[1-9]$/.test(key)) {
    const k = sesi.urutan[sesi.langkah];
    const n = Number(key) - 1;
    if (k.tipe === 'pilih_barang') {
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

  // P.bisu (M), P.bantuan (H), P.salin (C): menyusul di lapisan berikutnya.
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
