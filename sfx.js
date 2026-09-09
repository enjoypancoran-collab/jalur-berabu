// sfx.js
// Lapis 9: efek suara antarmuka (hover & klik) + soundtrack tenang saat tidak
// ada voice over.
//
//   - Hover/klik: blip pendek disintesis dengan Web Audio API (tanpa aset).
//   - Soundtrack: berkas audio/Magical-Moments-chosic.com_.mp3, di-loop,
//     volume pelan, dirutekan lewat Web Audio supaya bisa diredupkan halus.
//   - Konteks audio dibuka pada gestur pemain pertama (kebijakan autoplay).
//   - Soundtrack meredup saat voice over berbunyi, kembali saat senyap.
//   - Semua tunduk pada pilihan bisu yang sama dengan voice over (setSfxBisu).
//   - Murni dekorasi; tidak pernah menahan permainan.

const TRAK_AMBIENT = 'audio/Magical-Moments-chosic.com_.mp3';

// "Pelan saja": gain akhir soundtrack di jalur Web Audio.
const AMB_PENUH = 0.11;
const AMB_REDUP = 0.03; // saat voice over berbunyi

let ctx = null;
let masterSfx = null; // gain untuk hover/klik
let ambGain = null; // gain soundtrack (dipakai untuk meredup & bisu)
let trakEl = null; // <audio> soundtrack
let ambJalan = false;
let bisu = false;
let redup = false; // true selama voice over berbunyi
let hoverTerakhir = 0;

function buatKonteks() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    masterSfx = ctx.createGain();
    masterSfx.gain.value = bisu ? 0 : 1;
    masterSfx.connect(ctx.destination);
    ambGain = ctx.createGain();
    ambGain.gain.value = 0; // dinaikkan halus di mulaiAmbient
    ambGain.connect(ctx.destination);
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

/** Dipanggil dari gestur pemain pertama: buka konteks & mulai soundtrack. */
export function bukaSfx() {
  const c = buatKonteks();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  mulaiAmbient();
  terapkanMaster();
  terapkanAmbGain();
}

function mulaiAmbient() {
  if (!ctx || ambJalan) return;
  ambJalan = true;
  try {
    trakEl = new Audio(TRAK_AMBIENT);
    trakEl.loop = true;
    trakEl.preload = 'auto';
    const src = ctx.createMediaElementSource(trakEl);
    src.connect(ambGain);
    const p = trakEl.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    // Berkas 404 / gagal dekode: soundtrack tak berbunyi, game jalan terus.
    trakEl.addEventListener('error', () => {});
  } catch (e) {
    trakEl = null;
  }
  terapkanAmbGain();
}

function terapkanMaster() {
  if (!ctx || !masterSfx) return;
  masterSfx.gain.setTargetAtTime(bisu ? 0 : 1, ctx.currentTime, 0.03);
}

function terapkanAmbGain() {
  if (!ctx || !ambGain) return;
  const target = bisu ? 0 : redup ? AMB_REDUP : AMB_PENUH;
  ambGain.gain.setTargetAtTime(target, ctx.currentTime, 0.45);
}

// Satu blip pendek beramplop halus.
function blip(opsi) {
  if (!ctx || bisu) return;
  const t = ctx.currentTime;
  const dur = opsi.dur || 0.06;
  const o = ctx.createOscillator();
  o.type = opsi.type || 'sine';
  o.frequency.setValueAtTime(opsi.freq, t);
  if (opsi.slideTo) {
    o.frequency.exponentialRampToValueAtTime(opsi.slideTo, t + dur);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opsi.gain || 0.04, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(masterSfx);
  o.start(t);
  o.stop(t + dur + 0.03);
}

/** Blip saat kursor masuk ke elemen interaktif. Dibatasi lajunya. */
export function sfxHover() {
  const now =
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  if (now - hoverTerakhir < 55) return;
  hoverTerakhir = now;
  blip({ freq: 900, dur: 0.05, gain: 0.13, type: 'sine' });
}

/** Blip klik: lebih penuh, turun nada. */
export function sfxKlik() {
  blip({ freq: 300, slideTo: 165, dur: 0.1, gain: 0.22, type: 'triangle' });
}

/** VO berbunyi -> soundtrack meredup; VO senyap -> kembali penuh. */
export function redupAmbient(aktif) {
  redup = !!aktif;
  terapkanAmbGain();
}

/** Setel bisu untuk SFX & soundtrack (mengikuti pilihan bisu voice over). */
export function setSfxBisu(nilai) {
  bisu = !!nilai;
  terapkanMaster();
  terapkanAmbGain();
}
