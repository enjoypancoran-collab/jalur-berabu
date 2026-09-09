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
  lencanaDiperoleh,
  spriteCho,
  spriteOnes,
} from './engine.js';
import {
  kartuTerbukaTersimpan,
  simpanKartuTerbuka,
  lencanaTersimpan,
  simpanLencana,
  tambahTamat,
  jumlahTamat,
  introDilihatTersimpan,
  tandaiIntroDilihat,
  papanSkorTersimpan,
  perbaruiPapanSkor,
  simpanKemajuan,
  kemajuanTersimpan,
  hapusKemajuan,
} from './save.js';
import {
  siapkanAudio,
  putarKlip,
  hentikanKlip,
  toggleBisu,
  sedangBisu,
  setOnKlipMulai,
} from './audio.js';

// Satu-satunya dua label tampilan yang tidak ada di content.json: content
// tidak punya field nama tokoh. Semua string lain bersumber dari content.
const NAMA = { cho: 'Bro Cho', ones: 'Si Ones' };

const LAYAR = ['judul', 'kartu', 'main', 'tiba', 'hitung', 'memo', 'koleksi', 'wfh'];

let content;
let P; // content.antarmuka.pintasan
let sesi;

const el = (id) => document.getElementById(id);
const fmt1 = (n) => bulatkanSatuDesimal(n).toFixed(1).replace('.', ',');
const koma = (s) => String(s).replace('.', ',');
const fokus = (node) => {
  if (!node) return;
  requestAnimationFrame(() => {
    try {
      node.focus({ preventScroll: true });
    } catch (e) {
      node.focus();
    }
  });
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
  terapkanPalet();
  // Peta klip + pengaturan suara. Tidak membunyikan apa pun: baris peringatan
  // suara di layar judul tampil dulu, klip pertama menunggu tombol Mulai pagi.
  await siapkanAudio(content);

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
  el('tombol-lanjutkan').textContent = 'Lanjutkan pagi';

  el('tombol-mulai').addEventListener('click', mulaiPagi);
  el('tombol-lanjutkan').addEventListener('click', lanjutkanPagi);
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
  el('tombol-wfh-koleksi').textContent = content.label.tombol.koleksi;
  el('tombol-wfh-koleksi').addEventListener('click', () => bukaKoleksi());
  el('tombol-wfh-ulang').textContent = content.label.tombol.ulang;
  el('tombol-wfh-ulang').addEventListener('click', ulang);

  siapkanBantuan();
  siapkanIntro();
  setOnKlipMulai(onKlipBerubah);

  window.addEventListener('keydown', tekan);
  mulaiAbu();
  pergiKe('judul');
}

// --- lapisan visual ------------------------------------------------------

// Suntik palet content.aset.palet sebagai custom properties di :root.
function terapkanPalet() {
  const pal = content.aset && content.aset.palet;
  const root = document.documentElement;
  if (!pal || !root || !root.style) return;
  for (const [nama, nilai] of Object.entries(pal)) {
    root.style.setProperty('--' + nama, nilai);
  }
}

function prefersReducedMotion() {
  return !!(
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function bacaVar(nama, fallback) {
  try {
    if (typeof getComputedStyle !== 'function') return fallback;
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(nama)
      .trim();
    return v || fallback;
  } catch (e) {
    return fallback;
  }
}

// Pengarah visual dari content.adegan (blok tata-gambar, bukan angka/kalimat).
function adeganKeputusan(id) {
  const a = content.adegan;
  return (a && a.keputusan && a.keputusan[id]) || {};
}
function adeganKejadian(id) {
  const a = content.adegan;
  return (a && a.kejadian && a.kejadian[id]) || {};
}

// Latar penuh layar (judul, tiba, hitung, memo). Path relatif.
function setLatarLayar(berkas) {
  const n = el('latar-layar');
  if (!n || !n.style) return;
  n.classList.remove('redup-lebih');
  n.style.backgroundPosition = 'center';
  n.style.backgroundSize = 'cover';
  n.style.backgroundRepeat = 'no-repeat';
  n.style.backgroundImage = berkas ? 'url("img/' + berkas + '")' : 'none';
}

// Latar kartu pembuka dari content.adegan.kartu_pembuka_latar[idx], diredupkan.
// Token "wajah:a.png|b.png" -> dua wajah close-up sebagai latar.
function setLatarKartu(idx) {
  const n = el('latar-layar');
  if (!n || !n.style) return;
  const daftar = (content.adegan && content.adegan.kartu_pembuka_latar) || [];
  const spec = daftar[idx] || '';
  n.classList.add('redup-lebih');
  n.style.backgroundRepeat = 'no-repeat';
  const layarKartu = el('layar-kartu');
  if (spec.indexOf('wajah:') === 0) {
    const bagian = spec.slice(6).split('|');
    n.style.backgroundImage = bagian.map((b) => 'url("img/' + b + '")').join(', ');
    n.style.backgroundPosition = '22% 2%, 78% 2%';
    n.style.backgroundSize = 'auto 165%, auto 165%';
    if (layarKartu) layarKartu.classList.add('kartu-wajah');
  } else {
    n.style.backgroundImage = spec ? 'url("img/' + spec + '")' : 'none';
    n.style.backgroundPosition = 'center';
    n.style.backgroundSize = 'cover';
    if (layarKartu) layarKartu.classList.remove('kartu-wajah');
  }
}

// Latar + sprite satu panel. Kalau sprite gagal dimuat, tampilkan kotak palet.
// posisi: 'kiri' | 'tengah' | 'kanan' (default: kiri untuk cho, kanan untuk ones).
function setScene(tokoh, latarBerkas, spriteId, posisi) {
  const scene = el('scene-' + tokoh);
  if (scene && scene.style) {
    scene.style.backgroundImage = latarBerkas
      ? 'url("img/' + latarBerkas + '")'
      : 'none';
  }
  const img = el('sprite-' + tokoh);
  const box = el('spritebox-' + tokoh);
  if (!img || !box) return;
  if (spriteId) {
    box.hidden = true;
    img.hidden = false;
    img.alt = '';
    img.onerror = () => {
      img.hidden = true;
      box.hidden = false;
    };
    img.src = 'img/' + spriteId + '.png';
  } else {
    img.hidden = true;
    box.hidden = true;
  }
  const pos = posisi || (tokoh === 'cho' ? 'kiri' : 'kanan');
  img.classList.remove('pos-kiri', 'pos-tengah', 'pos-kanan');
  img.classList.add('pos-' + pos);
}

// Jam berjalan tiap tokoh di pojok kanan atas scene masing-masing. Nilai jam
// dari keputusan.jam (format 24 jam bertitik, mis. 07.30) dan jam absen dari
// konstanta.jam_absen. Dipanggil tiap render layar main / kejadian sisipan.
function renderJam() {
  const absen = content.konstanta && content.konstanta.jam_absen;
  for (const [tokoh, jam] of [
    ['cho', sesi.jamCho],
    ['ones', sesi.jamOnes],
  ]) {
    const host = el('jam-' + tokoh);
    const waktu = el('jam-' + tokoh + '-waktu');
    const ab = el('jam-' + tokoh + '-absen');
    if (!host || !waktu) continue;
    if (jam) {
      waktu.textContent = jam;
      if (ab) ab.textContent = absen ? 'absen ' + absen : '';
      host.hidden = false;
    } else {
      host.hidden = true;
    }
  }
}

// Kanvas partikel abu: titik 1-2 piksel bertepi tajam, hanyut turun. Hormati
// prefers-reduced-motion (satu bingkai statis, tanpa loop animasi).
function mulaiAbu() {
  if (sesi._abuMulai) return;
  const cv = el('abu');
  if (!cv || typeof cv.getContext !== 'function') return;
  sesi._abuMulai = true;

  const ctx = cv.getContext('2d');
  const warnaGelap = bacaVar('--aspal', '#3a3f45');
  const warnaTerang = bacaVar('--abu', '#dcd6cb');
  let W = 0;
  let H = 0;
  let titik = [];

  const ukur = () => {
    W = cv.width = window.innerWidth || 1024;
    H = cv.height = window.innerHeight || 768;
  };
  const isiUlang = () => {
    const n = Math.max(70, Math.round((W * H) / 11000));
    titik = [];
    for (let i = 0; i < n; i += 1) {
      const dekat = Math.random() < 0.6; // lapisan dekat vs jauh (paralaks)
      titik.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: dekat && Math.random() < 0.5 ? 2 : 1,
        vy: (dekat ? 18 : 7) + Math.random() * (dekat ? 30 : 12),
        goyang: (dekat ? 9 : 4) + Math.random() * 7,
        fase: Math.random() * Math.PI * 2,
        a: (dekat ? 0.16 : 0.07) + Math.random() * 0.24,
        pucat: Math.random() < 0.35, // sebagian abu berwarna pucat
      });
    }
  };
  const gambar = (t) => {
    ctx.clearRect(0, 0, W, H);
    for (const p of titik) {
      ctx.globalAlpha = p.a;
      ctx.fillStyle = p.pucat ? warnaTerang : warnaGelap;
      const x = p.x + Math.sin(t / 1500 + p.fase) * p.goyang;
      // fillRect + koordinat bulat = titik bertepi tajam
      ctx.fillRect(Math.round(x), Math.round(p.y), p.s, p.s);
    }
    ctx.globalAlpha = 1;
  };

  ukur();
  isiUlang();
  window.addEventListener('resize', () => {
    ukur();
    isiUlang();
    if (prefersReducedMotion()) gambar(0);
  });

  if (prefersReducedMotion()) {
    gambar(0); // satu bingkai statis, tanpa loop
    return;
  }

  let last = 0;
  const tick = (now) => {
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const p of titik) {
      p.y += p.vy * dt;
      if (p.y > H + 2) {
        p.y = -2;
        p.x = Math.random() * W;
      }
    }
    gambar(now);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function resetSesi() {
  const urutan = urutanKeputusan(content);
  const jamAwal = (t) => {
    const k = urutan.find((x) => x.tokoh === t);
    return (k && k.jam) || '';
  };
  sesi = {
    layar: 'judul',
    layarSebelum: null,
    angin: undiFaktorAngin(content).nilai,
    // Lapis 2-3 menyamakan asumsi masker dengan angka acuan. Lapisan berikutnya
    // menurunkannya dari barang yang dibawa Si Ones di O2.
    maskerId: 'kn95_rapat',
    urutan,
    langkah: 0,
    // jam berjalan tiap tokoh (pojok kanan atas scene). Diisi jam keputusan
    // pertama masing-masing, lalu diperbarui tiap keputusan tokoh itu.
    jamCho: jamAwal('cho'),
    jamOnes: jamAwal('ones'),
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
    // sorotan pengenalan (lapis 5). introPaksa dipasang oleh R agar sorotan
    // muncul lagi walau sudah pernah dilihat; selain itu gerbangnya localStorage.
    introPaksa: false,
    introDijalankan: false,
    introAktif: false,
    introLangkah: 0,
    bantuanAktif: false,
    // suara (lapis 6): klip pembuka diputar sekali per sesi
    klipPembukaDiputar: false,
    // rute bekerja dari rumah (lapis 7): diambil lewat pilihan tambahan di O1
    ruteWfh: false,
    // status sprite (lapis 4)
    kepChoTerakhir: null,
    choSpriteEfek: null, // dari efek.aset_tokoh (cho_jacket)
    choTiredSprite: null, // dari efek.aset_tokoh_setelah_serempet (cho_tired)
    onesSpriteEfek: null, // dari efek.aset_tokoh kejadian mata (ones_tired)
    _abuMulai: sesi ? sesi._abuMulai : false,
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

  // Rute perjalanan selesai: kemajuan tertunda tak lagi berlaku.
  if (nama === 'tiba' || nama === 'wfh') hapusKemajuan();
  // Wajah close-up hanya hidup di kartu pembuka.
  if (nama !== 'kartu') sembunyikanWajah();

  // Latar penuh layar dari field latar (kalau ada untuk layar ini).
  const latarLayar = {
    judul: content.layar.judul && content.layar.judul.latar,
    tiba: content.layar.tiba && content.layar.tiba.latar,
    hitung: content.layar.hitung && content.layar.hitung.latar,
    memo: content.layar.memo && content.layar.memo.latar,
    wfh: content.layar.wfh && content.layar.wfh.latar,
  }[nama];
  setLatarLayar(latarLayar || '');

  const aktif = el('layar-' + nama);
  if (aktif) {
    aktif.classList.remove('layar-masuk');
    void aktif.offsetWidth; // paksa reflow supaya animasi terpicu ulang
    aktif.classList.add('layar-masuk');
  }
  if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);

  if (nama === 'judul') {
    const adaKemajuan = !!kemajuanTersimpan();
    el('tombol-lanjutkan').hidden = !adaKemajuan;
    fokus(el(adaKemajuan ? 'tombol-lanjutkan' : 'tombol-mulai'));
  } else if (nama === 'kartu') renderKartu();
  else if (nama === 'main') renderMain();
  else if (nama === 'tiba') renderTiba();
  else if (nama === 'hitung') mulaiHitung();
  else if (nama === 'memo') renderMemo();
  else if (nama === 'koleksi') renderKoleksi();
  else if (nama === 'wfh') renderWfh();
}

function bukaKoleksi() {
  sesi.layarSebelum = sesi.layar;
  pergiKe('koleksi');
}

// --- mulai / lanjutkan pagi ------------------------------------------------

// Tombol Mulai pagi: pemicu klip pertama (baris peringatan suara di layar
// judul sudah tampil sejak halaman terbuka).
function mulaiPagi() {
  pergiKe('kartu'); // klip title.intro + brief diputar oleh renderKartu kartu 1
}

// Tombol Lanjutkan pagi: pulihkan sesi dari cuplikan kemajuan tersimpan.
function lanjutkanPagi() {
  const k = kemajuanTersimpan();
  if (!k) {
    mulaiPagi();
    return;
  }
  resetSesi();
  sesi.langkah = k.langkah || 0;
  sesi.fase = 'pilih';
  if (typeof k.angin === 'number') sesi.angin = k.angin;
  if (k.maskerId) sesi.maskerId = k.maskerId;
  sesi.pilihanCho = Array.isArray(k.pilihanCho) ? k.pilihanCho.slice() : [];
  sesi.pilihanOnes = Array.isArray(k.pilihanOnes) ? k.pilihanOnes.slice() : [];
  sesi.barang = Array.isArray(k.barang) ? k.barang.slice() : [];
  sesi.serempet = !!k.serempet;
  sesi.sisipanSelesai = Array.isArray(k.sisipanSelesai)
    ? k.sisipanSelesai.slice()
    : [];
  sesi.pilihanMata = k.pilihanMata || null;
  sesi.pilihanAtap = k.pilihanAtap || null;
  if (k.jamCho) sesi.jamCho = k.jamCho;
  if (k.jamOnes) sesi.jamOnes = k.jamOnes;
  // sorotan pengenalan tidak muncul lagi saat melanjutkan
  sesi.introDijalankan = true;
  sesi.klipPembukaDiputar = true;
  const kepCho = sesi.urutan.filter((x) => x.tokoh === 'cho');
  sesi.kepChoTerakhir = kepCho[sesi.pilihanCho.length - 1] || null;
  pulihkanSpriteEfek();
  for (const id of ['isi-cho', 'isi-ones']) {
    el(id).replaceChildren();
    delete el(id).dataset.terisi;
  }
  bukaKartu();
  pergiKe('main');
}

// Cuplikan sesi secukupnya untuk melanjutkan pagi yang sama.
function buatCuplikanKemajuan() {
  return {
    langkah: sesi.langkah,
    angin: sesi.angin,
    maskerId: sesi.maskerId,
    jamCho: sesi.jamCho,
    jamOnes: sesi.jamOnes,
    pilihanCho: sesi.pilihanCho.slice(),
    pilihanOnes: sesi.pilihanOnes.slice(),
    barang: sesi.barang.slice(),
    serempet: sesi.serempet,
    sisipanSelesai: sesi.sisipanSelesai.slice(),
    pilihanMata: sesi.pilihanMata,
    pilihanAtap: sesi.pilihanAtap,
  };
}

// Susun ulang sprite efek dari pilihan yang tercatat (jaket C1, lelah setelah
// serempet, mata lelah setelah iritasi).
function pulihkanSpriteEfek() {
  const peta = new Map();
  for (const kk of content.keputusan) {
    for (const pp of kk.pilihan || []) peta.set(pp.id, pp);
  }
  for (const id of sesi.pilihanCho) {
    const p = peta.get(id);
    if (!p || !p.efek) continue;
    if (p.efek.aset_tokoh) sesi.choSpriteEfek = p.efek.aset_tokoh;
    if (sesi.serempet && p.efek.aset_tokoh_setelah_serempet) {
      sesi.choTiredSprite = p.efek.aset_tokoh_setelah_serempet;
    }
  }
  const mata = (content.kejadian_sisipan || []).find((e) => e.id === 'mata');
  if (mata && sesi.pilihanMata) {
    const pm = (mata.pilihan || []).find((x) => x.id === sesi.pilihanMata);
    if (pm && pm.efek && pm.efek.aset_tokoh) {
      sesi.onesSpriteEfek = pm.efek.aset_tokoh;
    }
  }
}

// --- kartu pembuka ---------------------------------------------------------

// Wajah close-up di sudut bawah selama narasi tokoh berbunyi (kartu pembuka).
// brief.cho -> wajah kiri bawah; brief.ones -> wajah kanan bawah. Klip lain
// atau berhenti -> kedua wajah disembunyikan.
function onKlipBerubah(kunci) {
  const diKartu = sesi && sesi.layar === 'kartu';
  el('wajah-cho').hidden = !(diKartu && kunci === 'brief.cho');
  el('wajah-ones').hidden = !(diKartu && kunci === 'brief.ones');
}

function sembunyikanWajah() {
  el('wajah-cho').hidden = true;
  el('wajah-ones').hidden = true;
}

function renderKartu() {
  const kartu = content.layar.kartu_pembuka;
  const k = kartu[sesi.kartuIdx];
  el('kartu-nomor').textContent =
    'Kartu ' + (sesi.kartuIdx + 1) + ' dari ' + kartu.length;
  el('kartu-teks').textContent = k.teks;
  el('kartu-gambar').textContent = k.gambar || '';
  el('tombol-kartu').textContent = k.tombol || content.label.tombol.lanjut;
  ilustrasiKartu(sesi.kartuIdx, k);
  setLatarKartu(sesi.kartuIdx);

  // Klip pertama: title.intro lalu narasi kartu pembuka pertama, berurutan.
  // Dipicu oleh tombol Mulai pagi (yang membawa kita ke kartu 1).
  if (sesi.kartuIdx === 0 && !sesi.klipPembukaDiputar) {
    sesi.klipPembukaDiputar = true;
    const runtun = [content.layar.judul.suara].concat(
      Array.isArray(k.suara) ? k.suara : k.suara ? [k.suara] : [],
    );
    putarKlip(runtun);
  } else if (sesi.kartuIdx > 0 && k.suara) {
    putarKlip(k.suara);
  }

  fokus(el('tombol-kartu'));
}

// Ilustrasi kartu pembuka, dibangun dari deskripsi gambar tiap kartu di
// content (bukan salinan angka/kalimat): tokoh berdampingan, dua batang
// Poin Paparan Abu Vulkanik, lalu jam dengan sebuah pilihan bertanda menit.
function ilustrasiKartu(idx, k) {
  const host = el('kartu-ilustrasi');
  if (!host) return;
  host.replaceChildren();
  host.dataset.kartu = String(idx + 1);
  if (idx === 0) host.append(ilusTokoh());
  else if (idx === 1) host.append(ilusBatang());
  else if (idx === 2) host.append(ilusJam(k));
}

// "dua tokoh berdampingan" — sprite pertama tiap tokoh dari content.aset.
function ilusTokoh() {
  const wrap = document.createElement('div');
  wrap.className = 'ilus-tokoh';
  const pasang = [
    [(content.aset.tokoh_cho || [])[0], NAMA.cho],
    [(content.aset.tokoh_ones || [])[0], NAMA.ones],
  ];
  for (const [spriteId, nama] of pasang) {
    const fig = document.createElement('figure');
    fig.className = 'ilus-tokoh-fig';
    const kotak = document.createElement('span');
    kotak.className = 'ilus-kotak';
    kotak.hidden = true;
    if (spriteId) {
      const img = document.createElement('img');
      img.alt = '';
      img.onerror = () => {
        img.hidden = true;
        kotak.hidden = false;
      };
      img.src = 'img/' + spriteId + '.png';
      fig.append(img);
    } else {
      kotak.hidden = false;
    }
    fig.append(kotak);
    const cap = document.createElement('figcaption');
    cap.textContent = nama;
    fig.append(cap);
    wrap.append(fig);
  }
  return wrap;
}

// "dua batang paparan, satu tumbuh sedikit, satu tumbuh lebih banyak" —
// meniru HUD: label penuh sekali di atas, nama tokoh di tiap batang, garis
// batas aman. Tinggi batang ilustratif, tanpa menuliskan angka jawaban.
function ilusBatang() {
  const wrap = document.createElement('div');
  wrap.className = 'ilus-batang';

  const judul = document.createElement('div');
  judul.className = 'ilus-batang-judul';
  judul.textContent = content.label.paparan_penuh;
  wrap.append(judul);

  const ambangPersen =
    (content.konstanta.ambang_aman / 15) * 100; // skala sama dengan HUD (MAKS 15)
  const baris = [
    [NAMA.cho, 22],
    [NAMA.ones, 68],
  ];
  for (const [nama, persen] of baris) {
    const row = document.createElement('div');
    row.className = 'ilus-batang-baris';
    const lab = document.createElement('span');
    lab.className = 'ilus-batang-nama';
    lab.textContent = nama;
    const track = document.createElement('span');
    track.className = 'ilus-batang-track';
    const fill = document.createElement('span');
    fill.className = 'ilus-batang-fill';
    fill.style.width = persen + '%';
    const tanda = document.createElement('span');
    tanda.className = 'ilus-batang-ambang';
    tanda.style.left = ambangPersen.toFixed(1) + '%';
    track.append(fill, tanda);
    row.append(lab, track);
    wrap.append(row);
  }

  const cap = document.createElement('p');
  cap.className = 'ilus-batang-cap';
  cap.textContent =
    'Garis tegak: batas aman ' + fmt1(content.konstanta.ambang_aman) + ' poin';
  wrap.append(cap);
  return wrap;
}

// "jam dan sebuah pilihan bertanda +N menit" — jam menunjuk waktu absen,
// plus satu tombol pilihan contoh dengan biaya menit yang dibaca dari
// deskripsi gambar kartu.
function ilusJam(k) {
  const wrap = document.createElement('div');
  wrap.className = 'ilus-jam';

  const absen = (content.konstanta && content.konstanta.jam_absen) || '07.30';
  const [jamStr, menitStr] = absen.split('.');
  const jam = Number(jamStr) || 0;
  const menit = Number(menitStr) || 0;
  const sudutJam = ((jam % 12) + menit / 60) * 30;
  const sudutMenit = menit * 6;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'ilus-jam-muka');
  const lingkar = document.createElementNS(svgNS, 'circle');
  lingkar.setAttribute('cx', '50');
  lingkar.setAttribute('cy', '50');
  lingkar.setAttribute('r', '44');
  lingkar.setAttribute('class', 'ilus-jam-lingkar');
  svg.append(lingkar);
  for (let i = 0; i < 12; i += 1) {
    const t = document.createElementNS(svgNS, 'line');
    const a = (i * 30 * Math.PI) / 180;
    t.setAttribute('x1', (50 + Math.sin(a) * 40).toFixed(1));
    t.setAttribute('y1', (50 - Math.cos(a) * 40).toFixed(1));
    t.setAttribute('x2', (50 + Math.sin(a) * 44).toFixed(1));
    t.setAttribute('y2', (50 - Math.cos(a) * 44).toFixed(1));
    t.setAttribute('class', 'ilus-jam-tik');
    svg.append(t);
  }
  const buatJarum = (sudut, panjang, kelas) => {
    const l = document.createElementNS(svgNS, 'line');
    const a = (sudut * Math.PI) / 180;
    l.setAttribute('x1', '50');
    l.setAttribute('y1', '50');
    l.setAttribute('x2', (50 + Math.sin(a) * panjang).toFixed(1));
    l.setAttribute('y2', (50 - Math.cos(a) * panjang).toFixed(1));
    l.setAttribute('class', kelas);
    return l;
  };
  svg.append(buatJarum(sudutJam, 22, 'ilus-jam-jarum-jam'));
  svg.append(buatJarum(sudutMenit, 32, 'ilus-jam-jarum-menit'));

  const jamBlok = document.createElement('div');
  jamBlok.className = 'ilus-jam-blok';
  const jamCap = document.createElement('span');
  jamCap.className = 'ilus-jam-cap';
  jamCap.textContent = 'absen ' + absen;
  jamBlok.append(svg, jamCap);

  const contoh = document.createElement('div');
  contoh.className = 'pilih pilih--contoh';
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = '1';
  const lab = document.createElement('span');
  lab.className = 'pilih-label';
  lab.textContent = 'Pilihan yang lebih hati-hati';
  const m = document.createElement('span');
  m.className = 'pilih-menit';
  const cocokMenit = /\+\s*(\d+)\s*menit/i.exec(k && k.gambar ? k.gambar : '');
  m.textContent = '+' + (cocokMenit ? cocokMenit[1] : '8') + ' menit';
  contoh.append(chip, lab, m);

  wrap.append(jamBlok, contoh);
  return wrap;
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

// Pita ambang (mis. "Aman", "Terpapar ringan") supaya warna batang bukan
// satu-satunya pembawa informasi.
function statusAmbang(pp) {
  for (const a of content.konstanta.ambang) {
    if (a.maks === null || pp <= a.maks) return a.status;
  }
  return '';
}

function barisHud(nama, pp) {
  const MAKS = 15;
  const row = document.createElement('div');
  row.className = 'hud-baris';

  const lab = document.createElement('span');
  lab.className = 'hud-nama';
  lab.textContent = nama;

  const track = document.createElement('span');
  track.className = 'hud-track';
  const fill = document.createElement('span');
  fill.className = 'hud-fill';
  fill.style.width = Math.min(100, (pp / MAKS) * 100).toFixed(1) + '%';
  const tanda = document.createElement('span');
  tanda.className = 'hud-ambang';
  tanda.style.left =
    ((content.konstanta.ambang_aman / MAKS) * 100).toFixed(1) + '%';
  tanda.title = 'batas aman ' + fmt1(content.konstanta.ambang_aman) + ' poin';
  track.append(fill, tanda);

  const angka = document.createElement('span');
  angka.className = 'hud-angka';
  // Angka selalu tertulis di sebelah batang.
  angka.textContent = fmt1(pp) + ' poin';

  const stat = document.createElement('span');
  stat.className = 'hud-status';
  stat.textContent = statusAmbang(pp);

  row.append(lab, track, angka, stat);
  return row;
}

function renderHud(targetId) {
  const host = el(targetId);
  if (!host) return;
  const c = hasilCho().paparan;
  const o = hasilOnes().paparan;
  host.replaceChildren();
  const judul = document.createElement('div');
  judul.className = 'hud-judul';
  judul.textContent = content.label.paparan_penuh;
  host.append(judul, barisHud(NAMA.cho, c), barisHud(NAMA.ones, o));
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

  // Awal keputusan: simpan kemajuan (semua keputusan sebelumnya terkunci) dan
  // hentikan narasi kartu pembuka yang mungkin masih berbunyi.
  if (sesi.fase === 'pilih') {
    if (sesi.langkah === 0) hentikanKlip();
    simpanKemajuan(buatCuplikanKemajuan());
  }

  el('kemajuan').textContent =
    'Keputusan ' + (sesi.langkah + 1) + ' dari ' + sesi.urutan.length;
  renderHud('hud');

  // Jam scene tokoh yang sedang giliran ikut keputusan ini; tokoh yang
  // menunggu tetap pada jam terakhirnya.
  if (k.tokoh === 'cho') sesi.jamCho = k.jam || sesi.jamCho;
  else sesi.jamOnes = k.jam || sesi.jamOnes;

  const aktifCho = k.tokoh === 'cho';
  const choPra = !el('isi-cho').dataset.terisi && !aktifCho;
  const onesPra = !el('isi-ones').dataset.terisi && aktifCho;
  el('panel-cho').classList.toggle('pra', choPra);
  el('panel-ones').classList.toggle('pra', onesPra);
  el('panel-cho').classList.toggle('redup', !aktifCho && !choPra);
  el('panel-ones').classList.toggle('redup', aktifCho && !onesPra);

  // Latar keputusan dari field latar; sprite tokoh sesuai aturan aset; lalu
  // ditimpa pengarah visual content.adegan. Panel menunggu tetap pada scene
  // terakhirnya.
  const ad = adeganKeputusan(k.id);
  let latar = k.latar;
  let spriteId = aktifCho
    ? spriteCho(content, k, sesi)
    : spriteOnes(content, sesi);
  let posisi = null;
  if (ad.sprite === false) spriteId = null;

  if (sesi.fase === 'akibat') {
    const pid = sesi.pilihanTerakhir && sesi.pilihanTerakhir.id;
    const ef =
      ad.pilihan && pid && ad.pilihan[pid]
        ? ad.pilihan[pid]
        : ad.semua_pilihan || null;
    if (ef) {
      if (ef.latar) latar = ef.latar;
      if (ef.sprite_posisi) posisi = ef.sprite_posisi;
      if (ef.sprite === false) spriteId = null;
      if (ef.sprite === true && !spriteId) {
        spriteId = aktifCho
          ? spriteCho(content, k, sesi)
          : spriteOnes(content, sesi);
      }
    }
  }

  el('panel-ones').classList.toggle('panel--barang', ad.mode === 'barang_meja');

  if (aktifCho) {
    sesi.kepChoTerakhir = k;
    setScene('cho', latar, spriteId, posisi);
  } else {
    setScene('ones', latar, spriteId, posisi);
  }

  if (ad.mode === 'barang_meja' && !aktifCho) {
    renderBarangMeja(sesi.fase);
  } else {
    hapusBarangMeja();
  }

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

  renderJam();
  mungkinMulaiIntro();
}

// Tombol pilihan: chip nomor, label, dan (untuk keputusan biasa) biaya menit.
// Biaya waktu ditulis di tombol; biaya Poin Paparan Abu Vulkanik TIDAK PERNAH.
function tombolPilih(nomor, label, menit) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pilih';
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = String(nomor);
  const lab = document.createElement('span');
  lab.className = 'pilih-label';
  lab.textContent = label;
  b.append(chip, lab);
  if (menit !== null && menit !== undefined) {
    const m = document.createElement('span');
    m.className = 'pilih-menit';
    m.textContent = '+' + menit + ' menit';
    b.append(m);
  }
  return b;
}

function renderPilihan(k, isi) {
  isi.replaceChildren();
  isi.dataset.terisi = '1';
  sesi.tombolPilihan = [];

  const sit = document.createElement('p');
  sit.textContent = k.kalimat_situasi || '';
  isi.append(sit);

  k.pilihan.forEach((p, i) => {
    const b = tombolPilih(i + 1, p.label, p.biaya_menit || 0);
    b.addEventListener('click', () => pilih(k, p));
    isi.append(b);
    sesi.tombolPilihan.push(b);
  });

  // Rute bekerja dari rumah: pilihan tambahan di O1, hanya kalau terbuka.
  if (k.id === 'O1' && wfhTerbuka()) {
    const w = content.layar.wfh;
    const b = tombolPilih(
      sesi.tombolPilihan.length + 1,
      w.pilihan_tambahan_di_O1,
      null,
    );
    b.classList.add('pilih--wfh');
    b.addEventListener('click', pilihWfh);
    isi.append(b);
    sesi.tombolPilihan.push(b);
  }

  fokus(sesi.tombolPilihan[0]);
}

function renderBarang(k, isi) {
  isi.replaceChildren();
  isi.dataset.terisi = '1';

  const sit = document.createElement('p');
  sit.textContent = k.kalimat_situasi || '';
  isi.append(sit);

  const hitung = document.createElement('p');
  hitung.className = 'barang-hitung';
  isi.append(hitung);

  const dipilih = new Set();
  const lanjut = document.createElement('button');
  lanjut.type = 'button';
  lanjut.textContent = content.label.tombol.lanjut;
  lanjut.disabled = true;

  const perbarui = () => {
    hitung.textContent =
      'Barang terpilih: ' + dipilih.size + ' dari ' + k.slot +
      ' — klik barang di meja';
  };

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
      perbarui();
      syncMeja();
      if (!lanjut.disabled) fokus(lanjut);
    });
    baris.append(cb, document.createTextNode(' ' + (i + 1) + '. ' + it.nama));
    isi.append(baris);
  });
  perbarui();

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
}

// Barang tergeletak di meja pada scene Si Ones (keputusan O2). Klik gambar =
// toggle checkbox tersembunyi di konsol. Pada fase akibat, yang diambil pergi.
function renderBarangMeja(fase) {
  const host = el('barang-meja-ones');
  if (!host) return;
  host.hidden = false;

  if (fase !== 'akibat' && host.children.length !== content.barang.length) {
    host.replaceChildren();
    content.barang.forEach((it) => {
      const img = document.createElement('img');
      img.className = 'item-meja';
      img.dataset.barang = it.id;
      img.alt = it.nama;
      img.src = 'img/' + it.ikon;
      img.tabIndex = 0;
      const toggle = () => {
        const cb = el('isi-ones').querySelector(
          'input[data-barang="' + it.id + '"]',
        );
        if (cb) cb.click();
      };
      img.addEventListener('click', toggle);
      img.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
      host.append(img);
    });
  }

  if (fase === 'akibat') {
    for (const img of [...host.children]) {
      img.classList.remove('diambil');
      if ((sesi.barang || []).includes(img.dataset.barang)) {
        img.classList.add('pergi');
        setTimeout(() => img.remove(), 360);
      }
    }
    return;
  }
  syncMeja();
}

function syncMeja() {
  const host = el('barang-meja-ones');
  if (!host || host.hidden) return;
  for (const img of host.children) {
    const cb = el('isi-ones').querySelector(
      'input[data-barang="' + img.dataset.barang + '"]',
    );
    img.classList.toggle('diambil', !!(cb && cb.checked));
  }
}

function hapusBarangMeja() {
  const host = el('barang-meja-ones');
  if (host) {
    host.replaceChildren();
    host.hidden = true;
  }
}

function pilih(k, p) {
  if (sesi.layar !== 'main' || sesi.fase !== 'pilih') return;
  if (k.tokoh === 'cho') {
    sesi.pilihanCho.push(p.id);
    sesi.kepChoTerakhir = k;
  } else {
    sesi.pilihanOnes.push(p.id);
  }

  if (p.efek && p.efek.peluang_serempet !== undefined) {
    sesi.serempet = Math.random() < p.efek.peluang_serempet;
  }
  // sprite Bro Cho: baca dari efek.aset_tokoh (dan varian setelah serempet)
  if (p.efek && p.efek.aset_tokoh) sesi.choSpriteEfek = p.efek.aset_tokoh;
  if (
    sesi.serempet &&
    p.efek &&
    p.efek.aset_tokoh_setelah_serempet
  ) {
    sesi.choTiredSprite = p.efek.aset_tokoh_setelah_serempet;
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

  const adEv = adeganKejadian(ev.id);
  let spEv;
  if (adEv.sprite === false) {
    spEv = null;
  } else if (aktifCho) {
    spEv = spriteCho(content, sesi.kepChoTerakhir, sesi);
  } else {
    spEv = spriteOnes(content, sesi);
  }
  // Pengarah visual per pilihan kejadian pada fase akibat (mis. atap-sekarang
  // -> latar terpeleset). Selaras dengan pola content.adegan.keputusan.
  let latarEv = ev.latar;
  if (sesi.fase === 'sisipan-akibat') {
    const pid = sesi.sisipanTerakhir && sesi.sisipanTerakhir.id;
    const ef =
      (adEv.pilihan && pid && adEv.pilihan[pid]) || adEv.semua_pilihan || null;
    if (ef) {
      if (ef.latar) latarEv = ef.latar;
      if (ef.sprite === false) spEv = null;
    }
  }
  setScene(aktifCho ? 'cho' : 'ones', latarEv, spEv);
  renderJam();

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
      const b = tombolPilih(i + 1, p.label, null); // kejadian sisipan tanpa biaya menit
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
  // sprite Si Ones: baca dari efek.aset_tokoh kejadian (mis. ones_tired)
  if (p.efek && p.efek.aset_tokoh) sesi.onesSpriteEfek = p.efek.aset_tokoh;
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

// --- rute bekerja dari rumah (lapis 7) -------------------------------

// Ambang syarat_terbuka dibaca dari kalimat di content, bukan ditulis di kode.
// "pemain menamatkan permainan dua kali ATAU mengumpulkan 10 kartu fakta".
function wfhSyarat() {
  const s = (content.layar.wfh && content.layar.wfh.syarat_terbuka) || '';
  const kata = { se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6 };
  const kartuM = s.match(/(\d+)\s*kartu/i);
  const kaliM = s.match(/(\d+|se|dua|tiga|empat|lima|enam)\s*kali/i);
  const tamatMin = kaliM
    ? Number(kaliM[1]) || kata[kaliM[1].toLowerCase()] || 2
    : 2;
  const kartuMin = kartuM ? Number(kartuM[1]) : 10;
  return { tamatMin, kartuMin };
}

function wfhTerbuka() {
  const { tamatMin, kartuMin } = wfhSyarat();
  return (
    jumlahTamat() >= tamatMin || kartuTerbukaTersimpan().size >= kartuMin
  );
}

// Pilihan tambahan di O1: Si Ones tidak berangkat. Pagi ditutup di sini.
function pilihWfh() {
  if (sesi.layar !== 'main' || sesi.fase !== 'pilih') return;
  sesi.ruteWfh = true;
  hentikanKlip();
  pergiKe('wfh');
}

// "0.4" -> "nol koma empat" (bentuk yang diucapkan narator). Dipakai untuk
// mengganti bentuk kata di w.teks dengan bentuk angka hasil hitung mesin.
function angkaSatuDesimalKeKata(n) {
  const v = bulatkanSatuDesimal(n);
  const bulat = Math.floor(v);
  const pecahan = Math.round((v - bulat) * 10);
  return angkaKeKata(bulat) + ' koma ' + angkaKeKata(pecahan);
}

function renderWfh() {
  const w = content.layar.wfh;
  const lc = (content.lencana || []).find((l) => l.id === w.lencana);
  el('wfh-judul').textContent = (lc && lc.nama) || '';

  // Angka paparan dihitung ULANG oleh mesin (145 menit x laju rumah_tertutup),
  // lalu bentuk kata di teks diganti bentuk angka. Tidak ada "0,4" di kode.
  const paparanWfh = hitungWfh(content).paparan;
  const angka = fmt1(paparanWfh);
  let teks = w.teks || '';
  teks = teks.split(angkaSatuDesimalKeKata(paparanWfh)).join(angka);
  teks = teks.split(fmt1(content.angka_acuan.rute_wfh)).join(angka);
  el('wfh-teks').textContent = teks;

  if (!sesi.tamatDicatat) {
    sesi.tamatDicatat = true;
    tambahTamat();
  }

  const lencanaRute = lencanaDiperoleh(content, {
    pilihanCho: [],
    pilihanOnes: [],
    barang: [],
    selesai: false,
    ruteWfh: true,
  });
  simpanLencana(lencanaRute);
  renderLencana('wfh-lencana', lencanaRute, { semua: false });

  putarKlip(w.suara); // end.wfh
  fokus(el('tombol-wfh-koleksi'));
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

  // Klip tiap bagian diputar BERURUTAN penuh (tally.open -> numbers -> verdict
  // -> wfh), tidak saling memotong. Teks tetap muncul di tempo sendiri; tombol
  // Lanjut tidak menunggu klip.
  const klipUrut = content.layar.hitung.urutan
    .map((b) => b.suara)
    .filter(Boolean);
  putarKlip(klipUrut);

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
    tambahBarisHitung(item.teks);
    langkahHitung();
  }, item.jeda);
}

function tambahBarisHitung(teks) {
  const p = document.createElement('p');
  p.className = 'hitung-baris';
  p.textContent = teks;
  el('hitung-teks').append(p);
}

function lewatiHitung() {
  const h = sesi.hitung;
  if (h.timer) {
    clearTimeout(h.timer);
    h.timer = null;
  }
  while (h.idx < h.antrean.length) {
    tambahBarisHitung(h.antrean[h.idx++].teks);
  }
  hentikanKlip(); // dilewati: jangan bunyikan sisa klip bagian
  h.selesai = true;
  el('hitung-lanjut').hidden = false;
  fokus(el('hitung-lanjut'));
}

// --- kartu memo -------------------------------------------------------

// Satuan di kartu memo, ditulis lengkap sesuai permintaan.
const SATUAN_MEMO = ' poin paparan abu vulkanik';

// Pasangan [label, nilai] untuk ringkasan memo.
function ringkasanMemo() {
  const c = hasilCho().paparan;
  const o = hasilOnes().paparan;
  const acu = hitungAngkaHitung();
  const L = content.label.paparan_penuh;
  const U = SATUAN_MEMO;
  return [
    [L + ' ' + NAMA.cho + ' (rutemu)', fmt1(c) + U],
    [L + ' ' + NAMA.ones + ' (rutemu)', fmt1(o) + U],
    ['Rute paling aman ' + NAMA.cho, fmt1(acu.cho) + U],
    ['Rute paling aman ' + NAMA.ones, fmt1(acu.ones) + U],
    ['Batas aman', fmt1(acu.ambang) + U],
    ['WFH', fmt1(acu.wfh) + U],
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
    .map((c) => c.nama + ': ' + c.label + ' — ' + fmt1(c.pp) + SATUAN_MEMO);
}

function teksMemo() {
  const m = content.layar.memo;
  return [
    content.meta.judul + ' — memo',
    '',
    m.narasi,
    '',
    m.isi[0],
    ...ringkasanMemo().map(([k, v]) => '- ' + k + ': ' + v),
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
  const dl = document.createElement('dl');
  dl.className = 'ringkas';
  for (const [k, v] of ringkasanMemo()) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    row.append(dt, dd);
    dl.append(row);
  }
  box.append(dl);

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
  j3.textContent = 'Usulan';
  box.append(j3);
  const par = document.createElement('p');
  par.textContent = m.isi[2];
  box.append(par);

  el('tombol-salin').textContent = m.tombol_salin;
  el('salin-status').hidden = true;
  el('salin-status').textContent = '';
  el('memo-kartu-hitung').textContent =
    'Kartu fakta terkumpul: ' +
    kartuTerbukaTersimpan().size +
    ' dari ' +
    content.kartu_fakta.length;

  const lencanaRute = lencanaDiperoleh(content, {
    pilihanCho: sesi.pilihanCho,
    pilihanOnes: sesi.pilihanOnes,
    barang: sesi.barang,
    selesai: true,
    ruteWfh: false,
  });
  simpanLencana(lencanaRute);
  renderLencana('memo-lencana', lencanaRute, { semua: false });

  catatPapanSkor();
  renderPapanSkor('memo-papan-skor');

  putarKlip(content.layar.memo.suara);
  fokus(el('tombol-salin'));
}

// --- papan skor (lapis 6) -------------------------------------------------

// Tiga metrik di content.papan_skor.metrik, disimpan di localStorage:
//   1. Poin Paparan Abu Vulkanik gabungan (Bro Cho + Si Ones) terendah
//   2. Poin Paparan Abu Vulkanik Si Ones terendah
//   3. menit tambahan tersingkat pada rute yang tetap di bawah ambang aman
//      (Bro Cho; Si Ones memang tidak bisa turun ke bawah ambang)
function catatPapanSkor() {
  const c = hasilCho();
  const o = hasilOnes();
  const aman = c.paparan <= content.konstanta.ambang_aman;
  perbaruiPapanSkor({
    ppGabungan: bulatkanSatuDesimal(c.paparan + o.paparan),
    ppOnes: bulatkanSatuDesimal(o.paparan),
    menitAman: aman ? c.menitTambahan + o.menitTambahan : undefined,
  });
}

function renderPapanSkor(hostId) {
  const host = el(hostId);
  if (!host) return;
  host.replaceChildren();
  const metrik = (content.papan_skor && content.papan_skor.metrik) || [];
  const p = papanSkorTersimpan();
  const nilai = [
    typeof p.ppGabungan === 'number' ? fmt1(p.ppGabungan) + SATUAN_MEMO : '—',
    typeof p.ppOnes === 'number' ? fmt1(p.ppOnes) + SATUAN_MEMO : '—',
    typeof p.menitAman === 'number' ? p.menitAman + ' menit' : '—',
  ];

  const judul = document.createElement('h3');
  judul.textContent = 'Papan skor';
  host.append(judul);

  const dl = document.createElement('dl');
  dl.className = 'ringkas';
  metrik.forEach((label, i) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = nilai[i] || '—';
    row.append(dt, dd);
    dl.append(row);
  });
  host.append(dl);
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
  toast(
    ok
      ? content.layar.memo.pemberitahuan_salin
      : 'Salin gagal. Pilih teks memo secara manual.',
  );
}

// Pesan singkat mengambang (dipakai untuk salin hasil & tombol bisu).
function toast(pesan, ms) {
  const s = el('salin-status');
  if (!s) return;
  s.textContent = pesan;
  s.hidden = false;
  clearTimeout(sesi._toastTimer);
  sesi._toastTimer = setTimeout(() => {
    s.hidden = true;
    s.textContent = '';
  }, ms || 2600);
}

// --- lencana ------------------------------------------------------------

// Barisan lencana. Nama & ikon dari content.lencana. mode.semua = tampilkan
// semua lencana (yang belum diperoleh diredupkan); selain itu hanya yang
// diperoleh. Lencana dengan field `nada` (mis. Tangan Kosong) ditandai kelam,
// bukan pujian.
function renderLencana(hostId, diperoleh, mode = {}) {
  const host = el(hostId);
  if (!host) return;
  host.replaceChildren();
  const daftar = content.lencana || [];
  const punya = diperoleh instanceof Set ? diperoleh : new Set(diperoleh || []);

  const judul = document.createElement('h3');
  judul.textContent = 'Lencana';
  host.append(judul);

  const tampil = mode.semua ? daftar : daftar.filter((l) => punya.has(l.id));
  if (!tampil.length) {
    const p = document.createElement('p');
    p.className = 'lencana-kosong';
    p.textContent = 'Belum ada lencana dari rute ini.';
    host.append(p);
    return;
  }

  const baris = document.createElement('div');
  baris.className = 'lencana-baris';
  for (const l of tampil) {
    const item = document.createElement('div');
    item.className = 'lencana-item';
    if (!punya.has(l.id)) item.classList.add('terkunci');
    if (l.nada) item.classList.add('kelam');

    const img = document.createElement('img');
    img.className = 'lencana-ikon';
    img.alt = '';
    const kotak = document.createElement('span');
    kotak.className = 'lencana-kotak';
    kotak.hidden = true;
    img.onerror = () => {
      img.hidden = true;
      kotak.hidden = false;
    };
    img.src = 'img/' + l.ikon;

    const teks = document.createElement('div');
    teks.className = 'lencana-teks';
    const nama = document.createElement('span');
    nama.className = 'lencana-nama';
    nama.textContent = l.nama;
    teks.append(nama);
    if (l.nada) {
      const nada = document.createElement('span');
      nada.className = 'lencana-nada';
      nada.textContent = l.nada;
      teks.append(nada);
    }

    item.append(img, kotak, teks);
    baris.append(item);
  }
  host.append(baris);
}

// --- layar koleksi kartu --------------------------------------------

function renderKoleksi() {
  const terbuka = kartuTerbukaTersimpan();
  const total = content.kartu_fakta.length;
  el('koleksi-hitung').textContent =
    terbuka.size + ' dari ' + total + ' kartu fakta terkumpul';
  const bar = el('koleksi-bar-isi');
  if (bar && bar.style) {
    bar.style.width = ((terbuka.size / total) * 100).toFixed(1) + '%';
  }

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

  const lencanaPunya = new Set([
    ...lencanaTersimpan(),
    ...lencanaDiperoleh(content, {
      pilihanCho: sesi.pilihanCho,
      pilihanOnes: sesi.pilihanOnes,
      barang: sesi.barang,
      selesai: sesi.sampaiHitung,
      ruteWfh: false,
    }),
  ]);
  renderLencana('koleksi-lencana', lencanaPunya, { semua: true });
  renderPapanSkor('koleksi-papan-skor');

  fokus(el('tombol-koleksi-kembali'));
}

// --- mulai ulang ----------------------------------------------------

function ulang() {
  if (sesi.layar === 'judul') return;
  if (sesi.hitung.timer) clearTimeout(sesi.hitung.timer);
  hentikanKlip();
  hapusKemajuan(); // Mulai ulang membuang pagi yang sedang berjalan
  resetSesi();
  // R selalu memunculkan sorotan pengenalan lagi, walau sudah pernah dilihat.
  sesi.introPaksa = true;
  el('intro').hidden = true;
  el('bantuan').hidden = true;
  for (const id of ['isi-cho', 'isi-ones']) {
    el(id).replaceChildren();
    delete el(id).dataset.terisi;
  }
  setScene('cho', '', null);
  setScene('ones', '', null);
  el('jam-cho').hidden = true;
  el('jam-ones').hidden = true;
  el('memo-lencana').replaceChildren();
  el('koleksi-lencana').replaceChildren();
  el('panel-ones').classList.remove('panel--barang');
  hapusBarangMeja();
  el('hitung-teks').replaceChildren();
  el('hasil-uji').textContent = '';
  el('salin-status').hidden = true;
  pergiKe('judul');
}

// --- sorotan pengenalan bertahap (lapis 5) ----------------------------------

// Langkah sorotan: tiap langkah menyorot satu elemen yang sudah ada di layar
// dan menempelkan kotak penjelasan. Angka & label diambil dari content.
function introLangkahDaftar() {
  const L = content.label.paparan_penuh;
  const ambang = fmt1(content.konstanta.ambang_aman);
  const absen = content.konstanta.jam_absen;
  return [
    {
      target: () => document.querySelector('.panel-panel'),
      teks:
        'Dua panel berjalan berdampingan: ' + NAMA.cho + ' di kiri, ' +
        NAMA.ones + ' di kanan. Kamu memegang keduanya bergantian. Panel yang ' +
        'sedang menunggu giliran diredupkan, tetapi tidak pernah disembunyikan.',
    },
    {
      target: () => el('hud'),
      teks:
        L + '. Dua batang ini naik setiap keputusan dan tidak pernah turun. ' +
        'Garis tegak pada tiap batang menandai batas aman ' + ambang + ' poin.',
    },
    {
      target: () => el('jam-cho'),
      teks:
        'Jam di pojok tiap panel berjalan sendiri-sendiri menuju waktu absen ' +
        absen + ' di Gadog. Pilihan yang lebih hati-hati biasanya memakan ' +
        'lebih banyak menit.',
    },
  ];
}

function siapkanIntro() {
  el('intro-lanjut').addEventListener('click', introMaju);
  el('intro-lewati').addEventListener('click', introSelesai);
  el('intro-lewati').textContent = 'Lewati';
  window.addEventListener('resize', () => {
    if (sesi && sesi.introAktif) taruhSorotan();
  });
}

// Gerbang: muncul di keputusan pertama, fase pilih, dan hanya sekali —
// kecuali introPaksa (dipasang oleh R) memaksanya tampil lagi.
function mungkinMulaiIntro() {
  if (!sesi || sesi.layar !== 'main') return;
  if (sesi.langkah !== 0 || sesi.fase !== 'pilih') return;
  if (sesi.introDijalankan || sesi.introAktif) return;
  if (!sesi.introPaksa && introDilihatTersimpan()) return;
  sesi.introDijalankan = true;
  sesi.introLangkah = 0;
  requestAnimationFrame(() => mulaiIntro());
}

function mulaiIntro() {
  if (!sesi || sesi.layar !== 'main') return;
  sesi.introAktif = true;
  el('intro').hidden = false;
  renderSorotan();
}

function renderSorotan() {
  const daftar = introLangkahDaftar();
  const langkah = daftar[sesi.introLangkah];
  if (!langkah) {
    introSelesai();
    return;
  }
  el('intro-langkah').textContent =
    'Pengenalan ' + (sesi.introLangkah + 1) + ' dari ' + daftar.length;
  el('intro-teks').textContent = langkah.teks;
  el('intro-lanjut').textContent =
    sesi.introLangkah === daftar.length - 1
      ? 'Selesai'
      : content.label.tombol.lanjut;
  taruhSorotan();
  fokus(el('intro-lanjut'));
}

function taruhSorotan() {
  const daftar = introLangkahDaftar();
  const langkah = daftar[sesi.introLangkah];
  const node = langkah && langkah.target();
  const cincin = el('intro-cincin');
  const kotak = el('intro-kotak');
  if (!node || typeof node.getBoundingClientRect !== 'function') {
    cincin.hidden = true;
    return;
  }
  const r = node.getBoundingClientRect();
  const vw = window.innerWidth || 1024;
  const vh = window.innerHeight || 768;
  const pad = 8;
  cincin.hidden = false;
  cincin.style.left = Math.max(2, r.left - pad) + 'px';
  cincin.style.top = Math.max(2, r.top - pad) + 'px';
  cincin.style.width = Math.min(vw - 4, r.width + pad * 2) + 'px';
  cincin.style.height = r.height + pad * 2 + 'px';

  // Kotak penjelasan: coba di bawah sasaran, lalu di atas, lalu jepit ke
  // dalam viewport supaya tidak pernah terpotong (mis. saat sasaran lebih
  // tinggi dari layar, seperti kedua panel).
  const lebarKotak = 340;
  kotak.style.bottom = 'auto';
  kotak.style.left =
    Math.max(12, Math.min(r.left, vw - lebarKotak - 12)) + 'px';
  const tinggiKotak = kotak.offsetHeight || 160;
  const bawah = r.bottom + pad + 12;
  const atas = r.top - pad - 12 - tinggiKotak;
  let top;
  if (bawah + tinggiKotak <= vh - 12) top = bawah;
  else if (atas >= 12) top = atas;
  else top = Math.max(12, vh - tinggiKotak - 12);
  kotak.style.top = Math.round(top) + 'px';
}

function introMaju() {
  if (!sesi.introAktif) return;
  sesi.introLangkah += 1;
  renderSorotan();
}

function introSelesai() {
  if (!sesi) return;
  sesi.introAktif = false;
  el('intro').hidden = true;
  tandaiIntroDilihat();
  sesi.introPaksa = false;
  const b = sesi.tombolPilihan && sesi.tombolPilihan[0];
  if (b) fokus(b);
}

// --- layar bantuan (lapis 5) ----------------------------------------------

function siapkanBantuan() {
  el('bantuan-judul').textContent = content.label.tombol.bantuan;
  el('bantuan-tutup').textContent = 'Tutup';
  el('bantuan-tutup').addEventListener('click', tutupBantuan);

  const P = content.antarmuka.pintasan;
  const T = content.label.tombol;
  const cara = [
    NAMA.cho + ' berangkat naik mobil sendiri; ' + NAMA.ones + ' naik ojek, ' +
      'Transjakarta, jalan kaki, lalu mobil rombongan. Kamu memilih untuk ' +
      'keduanya, satu keputusan tiap giliran, di panel yang sedang aktif.',
    'Setiap tombol pilihan menuliskan biaya waktunya. Biaya ' +
      content.label.paparan_penuh + ' baru terlihat setelah kamu memilih, ' +
      'lewat dua batang di atas panel. Batang itu tidak pernah turun.',
    'Tujuannya sampai di Gadog sebelum absen ' + content.konstanta.jam_absen +
      '. Setelah keduanya tiba, layar hitung menjumlahkan ulang seluruh ' +
      'kemungkinan rute dan menutup dengan satu opsi terakhir.',
    'Permainan tidak pernah maju sendiri: selalu tekan ' + T.lanjut + '.',
  ];
  const box = el('bantuan-caramain');
  box.replaceChildren();
  for (const t of cara) {
    const p = document.createElement('p');
    p.textContent = t;
    box.append(p);
  }

  const baris = [
    [P.pilihan, 'Ambil pilihan yang sesuai nomornya'],
    [P.lanjut, T.lanjut],
    [P.bantuan, T.bantuan + ' — buka atau tutup layar ini'],
    [P.bisu, T.suara + ' — bisukan atau hidupkan'],
    [P.ulang, T.ulang + ' — kembali ke layar judul'],
    [P.salin, T.salin + ' (di layar memo)'],
    [P.tutup, 'Tutup catatan atau layar yang sedang terbuka'],
  ];
  const dl = el('bantuan-pintasan-daftar');
  dl.replaceChildren();
  for (const [tombol, arti] of baris) {
    const dt = document.createElement('dt');
    const kbd = document.createElement('kbd');
    kbd.textContent = tombol;
    dt.append(kbd);
    const dd = document.createElement('dd');
    dd.textContent = arti;
    dl.append(dt, dd);
  }
}

function bukaBantuan() {
  if (!sesi || sesi.bantuanAktif) return;
  sesi.bantuanAktif = true;
  sesi._fokusSebelumBantuan =
    document.activeElement && document.activeElement.focus
      ? document.activeElement
      : null;
  el('bantuan').hidden = false;
  fokus(el('bantuan-tutup'));
}

function tutupBantuan() {
  if (!sesi || !sesi.bantuanAktif) return;
  sesi.bantuanAktif = false;
  el('bantuan').hidden = true;
  const kembali = sesi._fokusSebelumBantuan;
  sesi._fokusSebelumBantuan = null;
  if (kembali && document.contains(kembali)) fokus(kembali);
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
    ' | ' + P.bantuan + ' ' + content.label.tombol.bantuan +
    ' | ' + P.bisu + ' ' + content.label.tombol.suara +
    ' | ulang ' + P.ulang +
    ' | ' + P.salin + ' salin (di memo)' +
    ' | tutup ' + P.tutup
  );
}

function tekan(ev) {
  if (!sesi) return;
  const key = ev.key;
  const layar = sesi.layar;

  // Bisu (M): berlaku di layar mana pun, termasuk saat tindihan terbuka.
  if (cocok(key, P.bisu)) {
    ev.preventDefault();
    const dibisukan = toggleBisu();
    toast(dibisukan ? 'Suara dibisukan' : 'Suara dihidupkan');
    return;
  }

  // Layar bantuan menindih segalanya: hanya H atau Esc yang berlaku.
  if (sesi.bantuanAktif) {
    if (cocok(key, P.bantuan) || cocok(key, P.tutup)) {
      ev.preventDefault();
      tutupBantuan();
    }
    return;
  }

  // Sorotan pengenalan menindih permainan: Lanjut maju, Esc melewati.
  if (sesi.introAktif) {
    if (cocok(key, P.lanjut)) {
      ev.preventDefault();
      introMaju();
    } else if (cocok(key, P.tutup)) {
      ev.preventDefault();
      introSelesai();
    }
    return;
  }

  // H membuka layar bantuan dari layar mana pun.
  if (cocok(key, P.bantuan)) {
    ev.preventDefault();
    bukaBantuan();
    return;
  }

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
    return;
  }

  if (cocok(key, P.salin) && layar === 'memo') {
    ev.preventDefault();
    salinHasil();
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
