// save.js
// Penyimpanan localStorage. Lapis 3: kartu fakta terkumpul dan jumlah tamat.
// Lapis 5: flag sorotan pengenalan sudah dilihat.
// Lapis 6: pilihan bisu, papan skor tiga metrik, dan kemajuan tertunda
//          (kembali lewat tombol "Lanjutkan pagi" di layar judul).
// Setiap akses dibungkus try/catch - mode privat atau storage yang diblokir
// tidak boleh membuat game gagal muat.

const KUNCI = 'jalur-berabu:v1';

function baca() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function tulis(data) {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(data));
  } catch (e) {
    /* abaikan: penyimpanan tidak tersedia */
  }
}

export function kartuTerbukaTersimpan() {
  return new Set(baca().kartu || []);
}

export function simpanKartuTerbuka(ids) {
  const data = baca();
  const gabung = new Set([...(data.kartu || []), ...ids]);
  data.kartu = [...gabung].sort((a, b) => a - b);
  tulis(data);
  return new Set(data.kartu);
}

export function lencanaTersimpan() {
  return new Set(baca().lencana || []);
}

export function simpanLencana(ids) {
  const data = baca();
  const gabung = new Set([...(data.lencana || []), ...ids]);
  data.lencana = [...gabung];
  tulis(data);
  return new Set(data.lencana);
}

export function introDilihatTersimpan() {
  return baca().intro === true;
}

export function tandaiIntroDilihat() {
  const data = baca();
  data.intro = true;
  tulis(data);
}

export function jumlahTamat() {
  return Number(baca().tamat || 0);
}

export function tambahTamat() {
  const data = baca();
  data.tamat = Number(data.tamat || 0) + 1;
  tulis(data);
  return data.tamat;
}

// --- pilihan bisu (lapis 6) -------------------------------------------------

// null = belum pernah dipilih (pakai bawaan content); true/false = pilihan pemain.
export function bisuTersimpan() {
  const v = baca().bisu;
  return v === true || v === false ? v : null;
}

export function simpanBisu(nilai) {
  const data = baca();
  data.bisu = !!nilai;
  tulis(data);
}

// --- papan skor (lapis 6) -------------------------------------------------

// { ppGabungan, ppOnes, menitAman } - masing-masing nilai terbaik sejauh ini,
// atau tak ada kalau belum pernah tercatat. Urutan metrik mengikuti
// content.papan_skor.metrik; berkas ini hanya menyimpan angkanya.
export function papanSkorTersimpan() {
  const p = baca().skor;
  return p && typeof p === 'object' ? p : {};
}

// kandidat: { ppGabungan, ppOnes, menitAman } - nilai null/undefined dilewati.
// Yang lebih kecil menang (paparan terendah, menit tersingkat).
export function perbaruiPapanSkor(kandidat) {
  const data = baca();
  const p = data.skor && typeof data.skor === 'object' ? data.skor : {};
  for (const kunci of ['ppGabungan', 'ppOnes', 'menitAman']) {
    const nilai = kandidat ? kandidat[kunci] : undefined;
    if (typeof nilai !== 'number' || Number.isNaN(nilai)) continue;
    if (typeof p[kunci] !== 'number' || nilai < p[kunci]) p[kunci] = nilai;
  }
  data.skor = p;
  tulis(data);
  return p;
}

// --- kemajuan tertunda (lapis 6) ---------------------------------------

// Cuplikan sesi secukupnya untuk melanjutkan pagi yang sama: nomor keputusan,
// undian angin, daftar pilihan, barang, dan jejak kejadian sisipan.
export function simpanKemajuan(cuplikan) {
  const data = baca();
  data.kemajuan = cuplikan;
  tulis(data);
}

export function kemajuanTersimpan() {
  const k = baca().kemajuan;
  if (k && typeof k.langkah === 'number' && k.langkah > 0) return k;
  return null;
}

export function hapusKemajuan() {
  const data = baca();
  delete data.kemajuan;
  tulis(data);
}

export function resetSimpanan() {
  tulis({});
}
