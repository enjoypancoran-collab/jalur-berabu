// sfx.js
// Lapis 9: efek suara antarmuka (hover & klik) dan soundtrack ambient yang
// tenang, semuanya DISINTESIS dengan Web Audio API -- tidak ada berkas aset.
//
// Aturan:
//   - Konteks audio dibuat & di-resume pada gestur pemain pertama (kebijakan
//     autoplay peramban). Sebelum itu semua fungsi ini diam.
//   - Soundtrack ambient meredup saat ada voice over berbunyi, kembali penuh
//     saat senyap (redupAmbient dipanggil dari callback klip di ui.js).
//   - Semua tunduk pada pilihan bisu yang sama dengan voice over (setSfxBisu).
//   - Klip TIDAK PERNAH menahan permainan; ini murni dekorasi.

let ctx = null;
let masterSfx = null; // gain untuk hover/klik
let ambGain = null; // gain soundtrack ambient (dipakai untuk meredup & bisu)
let ambJalan = false;
let bisu = false;
let redup = false; // true selama voice over berbunyi
let hoverTerakhir = 0;

const AMB_PENUH = 0.05;
const AMB_REDUP = 0.013;

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

/** Dipanggil dari gestur pemain pertama: buka konteks & mulai ambient. */
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
  const t = ctx.currentTime;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 70;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 430;
  lp.Q.value = 0.5;

  // tremolo sangat pelan di jalur sinyal (bukan di ambGain, supaya ambGain
  // tetap bersih untuk kontrol redup/bisu)
  const trem = ctx.createGain();
  trem.gain.value = 1;

  hp.connect(lp).connect(trem).connect(ambGain);

  // pad rendah: nada dasar + kuint + oktaf yang sedikit meleset (beating pelan)
  const suara = [
    [110, 0.5],
    [110 * 1.5, 0.3],
    [110 * 2.004, 0.22],
  ];
  for (const [f, g] of suara) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const og = ctx.createGain();
    og.gain.value = g;
    o.connect(og).connect(hp);
    o.start(t);
  }

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.12;
  lfo.connect(lfoDepth).connect(trem.gain);
  lfo.start(t);
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

/** Blip lembut saat kursor masuk ke elemen interaktif. Dibatasi lajunya. */
export function sfxHover() {
  const now =
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  if (now - hoverTerakhir < 60) return;
  hoverTerakhir = now;
  blip({ freq: 880, dur: 0.04, gain: 0.028, type: 'sine' });
}

/** Blip klik: sedikit lebih penuh, turun nada. */
export function sfxKlik() {
  blip({ freq: 300, slideTo: 170, dur: 0.09, gain: 0.055, type: 'triangle' });
}

/** VO berbunyi -> ambient meredup; VO senyap -> ambient kembali penuh. */
export function redupAmbient(aktif) {
  redup = !!aktif;
  terapkanAmbGain();
}

/** Setel bisu untuk SFX & ambient (mengikuti pilihan bisu voice over). */
export function setSfxBisu(nilai) {
  bisu = !!nilai;
  terapkanMaster();
  terapkanAmbGain();
}
