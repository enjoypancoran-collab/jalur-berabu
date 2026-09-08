// engine.js
// Mesin permainan "Jalur Berabu": urutan giliran, perhitungan Poin Paparan Abu
// Vulkanik, dan rute bekerja dari rumah.
//
// KONTRAK: berkas ini tidak memuat satu pun angka atau kalimat dari
// content.json. Seluruh nilai (laju ruas, faktor masker, faktor angin, durasi
// mengemudi, pp_tetap, angka acuan, rute acuan, dsb.) dibaca dari objek
// `content` yang dioper pemanggil saat runtime.
//
// Berkas ini dipakai apa adanya di dua tempat:
//   - browser : dimuat index.html lewat <script type="module">
//   - uji     : diimpor test/acuan.mjs, dijalankan dengan `node test/acuan.mjs`
// Maka di sini tidak ada fetch, tidak ada fs, tidak ada DOM, tidak ada console.

// Penanda segmen mengemudi Bro Cho (C3) di content.json. Panjang menitnya baru
// diketahui setelah C4, C5, dan C6 terpilih, jadi di data ditulis sebagai teks.
export const KODE_MENGEMUDI = 'MENGEMUDI';

/** "07.30" -> 450 (menit sejak tengah malam). */
export function menitDariJam(jam) {
  const [j, m] = String(jam).split('.');
  return Number(j) * 60 + Number(m || 0);
}

/** Pembulatan tampilan: satu desimal. 7.85835 -> 7.9 ; 0.435 -> 0.4 */
export function bulatkanSatuDesimal(nilai) {
  return Math.round(nilai * 10) / 10;
}

/** Undi faktor angin sekali per sesi dari daftar di content. */
export function undiFaktorAngin(content, acak = Math.random) {
  const daftar = content.konstanta.faktor_angin;
  const idx = Math.min(daftar.length - 1, Math.floor(acak() * daftar.length));
  return daftar[idx];
}

/** Urutan 14 keputusan, berselang-seling C1, O1, C2, O2, ... menurut `urutan`. */
export function urutanKeputusan(content) {
  const cho = content.keputusan
    .filter((k) => k.tokoh === 'cho')
    .sort((a, b) => a.urutan - b.urutan);
  const ones = content.keputusan
    .filter((k) => k.tokoh === 'ones')
    .sort((a, b) => a.urutan - b.urutan);
  const out = [];
  for (let i = 0; i < Math.max(cho.length, ones.length); i += 1) {
    if (cho[i]) out.push(cho[i]);
    if (ones[i]) out.push(ones[i]);
  }
  return out;
}

/**
 * Jalankan satu rute lengkap untuk satu tokoh dan kembalikan paparannya.
 *
 * Yang dihitung di sini adalah paparan RANTAI PERJALANAN: segmen + pp_tetap +
 * perjalanan mengemudi Bro Cho (sekali) + kejadian mata + tambahan kabin O7
 * saat kantong plastik tidak dibawa. Penalti epilog (baju ganti, masker kain,
 * atap, selokan) berada di luar angka ini dan ditangani lapisan berikutnya.
 *
 * @param content     objek content.json
 * @param cfg         { faktorAngin:number, faktorMaskerId:string }
 * @param tokoh       'cho' | 'ones'
 * @param pilihanIds  daftar id pilihan, satu untuk tiap keputusan tokoh yang
 *                    punya blok `pilihan` (Cho: C1..C7 ; Ones: O1,O3,O4,O5,O6,O7).
 *                    Boleh sebagian, untuk tampilan berjalan.
 * @param opsi        { barang?:string[], serempet?:boolean,
 *                      pilihanKejadian?:{ mata?:string } }
 * @returns { paparan, menitUdaraTerbuka, menitTambahan, rincian }
 */
export function jalankanRute(content, cfg, tokoh, pilihanIds, opsi = {}) {
  const K = content.konstanta;
  const laju = K.laju_ruas;
  const faktorMaskerSesi = K.faktor_masker[cfg.faktorMaskerId];
  const angin = cfg.faktorAngin;
  const barang = opsi.barang || [];
  const kontakKulit = K.kontak_kulit_lengan_terbuka;

  const keputusanTokoh = content.keputusan.filter((k) => k.tokoh === tokoh);
  const petaPilihan = new Map();
  for (const k of keputusanTokoh) {
    for (const p of k.pilihan || []) petaPilihan.set(p.id, { k, p });
  }

  const terpilih = pilihanIds.map((id) => {
    const hit = petaPilihan.get(id);
    if (!hit) throw new Error('Pilihan tidak dikenal: ' + id);
    return hit;
  });

  let paparan = 0;
  let menitUdaraTerbuka = 0;
  let menitTambahan = 0;
  let lenganTerbuka = false;
  const rincian = [];

  // Faktor angin hanya berlaku di segmen luar ruangan (rumus di CLAUDE.md).
  const faktorAnginSegmen = (seg) => (seg.luar_ruangan ? angin : 1);

  const paparanSegmen = (seg) => {
    const fm =
      seg.faktor_masker_paksa !== undefined
        ? seg.faktor_masker_paksa
        : faktorMaskerSesi;
    let nilai = seg.menit * laju[seg.laju] * fm * faktorAnginSegmen(seg);
    // Kontak kulit lengan terbuka: hanya Bro Cho, hanya segmen luar ruangan.
    if (tokoh === 'cho' && lenganTerbuka && seg.luar_ruangan) {
      nilai += seg.menit * kontakKulit.pp_per_menit;
    }
    return nilai;
  };

  // Aturan 3: segmen bertanda hitung_menit_terbuka:false tetap menambah paparan
  // tapi menitnya tidak masuk hitungan menit udara terbuka.
  const catatMenitTerbuka = (seg) => {
    if (seg.luar_ruangan && seg.hitung_menit_terbuka !== false) {
      menitUdaraTerbuka += seg.menit;
    }
  };

  // Aturan 1: perjalanan mengemudi Bro Cho dihitung satu kali. Laju kabin dari
  // C3 berlaku untuk seluruh durasi. Panjang = durasi dasar + menit C4 + menit
  // C6 (+ serempet). Menit jendela terbuka C5 DIPOTONG dari total kabin.
  const kemudi =
    tokoh === 'cho'
      ? {
          dasar: keputusanTokoh.find((k) => k.id === 'C3').durasi_dasar_mengemudi,
          lajuKabin: null,
          menitTambahanKemudi: 0,
          menitJendelaC5: 0,
        }
      : null;

  for (const { k, p } of terpilih) {
    menitTambahan += p.biaya_menit || 0;
    if (p.efek && p.efek.lengan_terbuka !== undefined) {
      lenganTerbuka = p.efek.lengan_terbuka;
    }

    let pp = p.pp_tetap || 0;

    if (tokoh === 'cho' && k.id === 'C3') {
      for (const seg of p.segmen || []) {
        if (seg.menit === KODE_MENGEMUDI) {
          kemudi.lajuKabin = seg.laju;
        } else {
          pp += paparanSegmen(seg);
          catatMenitTerbuka(seg);
        }
      }
      paparan += pp;
      rincian.push({ id: p.id, pp, catatan: 'mengemudi ditunda' });
      continue;
    }

    if (tokoh === 'cho' && (k.id === 'C4' || k.id === 'C6')) {
      // C4 & C6 tak punya segmen sendiri; menitnya memperpanjang mengemudi.
      kemudi.menitTambahanKemudi += p.biaya_menit || 0;
      if (opsi.serempet && p.efek && p.efek.serempet_menit !== undefined) {
        kemudi.menitTambahanKemudi += p.efek.serempet_menit;
        for (const seg of p.efek.serempet_segmen || []) {
          pp += paparanSegmen(seg);
          catatMenitTerbuka(seg);
        }
      }
      paparan += pp;
      rincian.push({ id: p.id, pp });
      continue;
    }

    if (tokoh === 'cho' && k.id === 'C5') {
      // Menit jendela terbuka menggantikan menit kabin, tidak menambah durasi.
      for (const seg of p.segmen || []) {
        pp += paparanSegmen(seg);
        catatMenitTerbuka(seg);
        if (seg.laju === 'mobil_jendela_terbuka') {
          kemudi.menitJendelaC5 += seg.menit;
        }
      }
      paparan += pp;
      rincian.push({ id: p.id, pp });
      continue;
    }

    // Jalur umum: semua keputusan Si Ones, dan C1/C2/C7 Bro Cho.
    for (const seg of p.segmen || []) {
      pp += paparanSegmen(seg);
      catatMenitTerbuka(seg);
    }

    // O7 tanpa kantong plastik: abu di sisi luar masker lepas di kabin.
    if (
      k.id === 'O7' &&
      p.efek &&
      p.efek.tanpa_kantong_plastik &&
      !barang.includes('kantong_plastik')
    ) {
      pp += p.efek.tanpa_kantong_plastik.pp_tetap || 0;
    }

    paparan += pp;
    rincian.push({ id: p.id, pp });
  }

  // Selesaikan perjalanan mengemudi Bro Cho satu kali di akhir.
  if (kemudi && kemudi.lajuKabin) {
    const menitTotal = kemudi.dasar + kemudi.menitTambahanKemudi;
    const menitKabin = menitTotal - kemudi.menitJendelaC5;
    // Kabin selalu dalam ruangan: faktor angin 1, tanpa kontak kulit.
    const ppKabin = menitKabin * laju[kemudi.lajuKabin] * faktorMaskerSesi * 1;
    paparan += ppKabin;
    rincian.push({ id: 'mengemudi', menitKabin, pp: ppKabin });
  }

  // Kejadian mata (hanya Si Ones): terpicu bila goggle tidak dibawa, atau lensa
  // kontak dibawa. Muncul di O3 atau O6, jadi baru dinilai kalau salah satunya
  // sudah terpilih. Tidak terpicu pada rute paling aman.
  if (tokoh === 'ones') {
    const mata = (content.kejadian_sisipan || []).find((e) => e.id === 'mata');
    const adaTitikMuncul = terpilih.some(({ k }) =>
      (mata && mata.muncul_di ? mata.muncul_di : []).includes(k.id),
    );
    const terpicu =
      !barang.includes('goggle') || barang.includes('lensa_kontak');
    const abaikan = opsi.abaikanKejadian || [];
    if (mata && adaTitikMuncul && terpicu && !abaikan.includes('mata')) {
      const idDefault = barang.includes('botol_air') ? 'mata-bilas' : 'mata-tahan';
      const idPilih =
        (opsi.pilihanKejadian && opsi.pilihanKejadian.mata) || idDefault;
      const pil =
        mata.pilihan.find((x) => x.id === idPilih) ||
        mata.pilihan[mata.pilihan.length - 1];
      let ppMata = pil.pp_tetap || 0;
      if (barang.includes('lensa_kontak')) {
        ppMata *= mata.pengali_jika_lensa_kontak;
      }
      paparan += ppMata;
      rincian.push({ id: pil.id, pp: ppMata, kejadian: 'mata' });
    }
  }

  return { paparan, menitUdaraTerbuka, menitTambahan, rincian };
}

/**
 * Rute "bekerja dari rumah": Si Ones tidak berangkat. Dari jam keputusan O1
 * sampai jam absen, seluruhnya di dalam rumah tertutup, tanpa masker.
 */
export function hitungWfh(content) {
  const K = content.konstanta;
  const o1 = content.keputusan.find((k) => k.id === 'O1');
  const menit = menitDariJam(K.jam_absen) - menitDariJam(o1.jam);
  const faktorMaskerRumah = K.faktor_masker.tanpa_masker; // di rumah tak bermasker
  const paparan = menit * K.laju_ruas.rumah_tertutup * faktorMaskerRumah * 1;
  return { menit, paparan };
}

/**
 * Sprite Si Ones, dipilih mesin sesuai aset.aturan_aset_ones.
 * state: { barang: string[], onesSpriteEfek?: string }
 */
export function spriteOnes(content, state) {
  const st = state || {};
  if (st.onesSpriteEfek) return st.onesSpriteEfek; // ones_tired setelah iritasi mata
  const b = st.barang || [];
  if (b.includes('lensa_kontak')) return 'ones_lensa';
  if (b.includes('kn95') && b.includes('goggle')) return 'ones_mask';
  if (b.includes('masker_kain')) return 'ones_cloth_loose';
  return 'ones_calm';
}

/**
 * Sprite Bro Cho. Basis diambil dari keputusan.tokoh_aset (token pertama
 * sebelum tanda '|'), lalu ditimpa sesuai aturan_aset_cho:
 * cho_mask_tense selama C4/C6 (menang atas semua), cho_tired setelah serempet
 * (menang di scene lain), cho_mask di C3/C5/C7, cho_jacket dari efek.aset_tokoh
 * c1-info, sisanya cho_calm.
 * state: { choSpriteEfek?: string, choTiredSprite?: string }
 */
export function spriteCho(content, keputusan, state) {
  const st = state || {};
  const id = keputusan ? keputusan.id : '';
  const base = ((keputusan && keputusan.tokoh_aset) || 'cho_calm')
    .split('|')[0]
    .trim();
  if (id === 'C4' || id === 'C6') return base; // cho_mask_tense
  if (st.choTiredSprite) return st.choTiredSprite; // cho_tired, berlaku sampai akhir
  if (id === 'C3' || id === 'C5' || id === 'C7') return base; // cho_mask
  if (st.choSpriteEfek) return st.choSpriteEfek; // cho_jacket
  return base; // cho_calm
}

/**
 * Kumpulan id kartu fakta yang terbuka dari keadaan sesi. Semua sumber
 * ditelusuri dari content, tidak ada id yang ditulis di kode.
 *
 * Sumber: kartu_fakta pada pilihan keputusan yang diambil, kartu_fakta_jika_lensa
 * pada O2, efek.tanpa_kantong_plastik.kartu_fakta di O7, kartu_fakta pada
 * kejadian sisipan yang sudah dijalani, dan layar.hitung.kartu_fakta_terbuka.
 *
 * @param data { pilihanCho, pilihanOnes, barang, sisipanSelesai, sampaiHitung }
 */
export function kartuFaktaTerbuka(content, data) {
  const ids = new Set();
  const barang = data.barang || [];
  const diambil = new Set([...(data.pilihanCho || []), ...(data.pilihanOnes || [])]);

  for (const k of content.keputusan) {
    for (const p of k.pilihan || []) {
      if (!diambil.has(p.id)) continue;
      if (p.kartu_fakta) ids.add(p.kartu_fakta);
      if (
        p.efek &&
        p.efek.tanpa_kantong_plastik &&
        p.efek.tanpa_kantong_plastik.kartu_fakta &&
        !barang.includes('kantong_plastik')
      ) {
        ids.add(p.efek.tanpa_kantong_plastik.kartu_fakta);
      }
    }
    if (k.kartu_fakta_jika_lensa && barang.includes('lensa_kontak')) {
      ids.add(k.kartu_fakta_jika_lensa);
    }
  }

  const sudah = new Set(data.sisipanSelesai || []);
  for (const ev of content.kejadian_sisipan || []) {
    if (sudah.has(ev.id) && ev.kartu_fakta) ids.add(ev.kartu_fakta);
  }

  if (
    data.sampaiHitung &&
    content.layar.hitung &&
    content.layar.hitung.kartu_fakta_terbuka
  ) {
    ids.add(content.layar.hitung.kartu_fakta_terbuka);
  }

  return ids;
}
