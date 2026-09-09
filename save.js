// save.js
// Penyimpanan localStorage. Lapis 3: kartu fakta terkumpul dan jumlah tamat.
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

export function resetSimpanan() {
  tulis({});
}
