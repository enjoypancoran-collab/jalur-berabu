# Kontrak Proyek: Jalur Berabu

Berkas ini dibaca otomatis oleh Claude Code setiap sesi. Isinya aturan yang tidak boleh
dilanggar. Kalau ragu, baca `README.md` untuk penjelasan panjangnya dan `content.json`
untuk angka dan kalimatnya.

## Sumber kebenaran

`content.json` adalah satu-satunya sumber kebenaran. Seluruh angka, kalimat situasi,
kalimat akibat, kartu fakta, lencana, teks layar, dan peta aset ada di sana.

- Jangan pernah menyalin angka atau kalimat dari `content.json` ke dalam kode.
- Baca semuanya saat runtime lewat `fetch('content.json')`.
- Kalau ada yang perlu diubah, ubah di `content.json`, jangan di JavaScript.
- Kalau `content.json` berbeda dengan dokumen konsep mana pun, `content.json` yang menang.

## Empat angka yang mengikat

Uji otomatis harus menjalankan `angka_acuan.rute_optimal_cho` dan
`angka_acuan.rute_optimal_ones` lewat mesin permainan, pada faktor angin 1,0 dan
masker KN95 rapat 0,09, lalu membandingkan hasilnya dengan tabel ini:

| Yang diukur | Nilai |
|---|---|
| Rute paling aman Bro Cho | 2,4 |
| Rute paling aman Si Ones | 7,9 |
| Ambang aman | 5,0 |
| Rute bekerja dari rumah | 0,4 |
| Menit Si Ones di udara terbuka | 47 |

Kalau meleset, yang salah adalah kodenya, bukan rancangannya. Uji ini harus lulus
sebelum satu baris CSS pun ditulis, dan harus tetap lulus di setiap commit sesudahnya.

## Rumus

```
pp_segmen = menit x laju_ruas x faktor_masker x faktor_angin
```

Faktor angin hanya berlaku pada segmen dengan `luar_ruangan: true`. Diundi sekali per
sesi dari tiga nilai di `konstanta.faktor_angin`, dan hanya terungkap ke pemain kalau
pilihan `c1-info` diambil.

Setiap pilihan membawa daftar `segmen`. Jumlahkan semuanya, tambahkan `pp_tetap`, itu
paparan keputusan tersebut. Batang tidak pernah menyusut.

## Tiga aturan mesin yang mudah salah dibaca

1. **Perjalanan mengemudi Bro Cho dihitung sekali.** C3 memilih laju kabin, dan laju itu
   berlaku untuk seluruh waktu mengemudi. Panjangnya adalah `durasi_dasar_mengemudi`
   45 menit ditambah menit dari C4, C6, dan kejadian serempet. Dua menit jendela terbuka
   di C5 dipotong dari total itu, bukan ditambahkan. C4 dan C6 sendiri tidak punya
   segmen; keduanya bekerja lewat menit dan efek.
2. **Waktu di dalam ruangan dibebankan di keputusan pertama tiap tokoh.** C1 memikul
   25 menit Bro Cho di kamar. O1 memikul 25 menit Si Ones di kos dan sudah mencakup O2.
   Jangan menghitung ulang di keputusan berikutnya.
3. **Segmen parkiran ke pintu gedung tidak dihitung sebagai menit udara terbuka.**
   Segmen itu bertanda `hitung_menit_terbuka: false`. Paparannya tetap dihitung, tapi
   menitnya tidak masuk angka 47.

## Penamaan yang tidak boleh diubah

Angka paparan **selalu** disebut **Poin Paparan Abu Vulkanik**, ditulis lengkap, di
setiap tempat pemain bisa melihatnya: HUD dua panel, Layar Hitung, kartu memo, layar
gagal, layar rute WFH, papan skor, layar koleksi, dan kartu pembuka kedua.

Jangan pernah menampilkan singkatan PP, PPAV, atau kata "Paparan" sendirian di teks yang
dilihat pemain. Singkatan hanya boleh hidup di dalam kode dan nama variabel.

Angka ditulis satu desimal dengan koma sebagai pemisah, misalnya 7,9. Kalau disebut
dalam kalimat penuh, ikutkan satuannya: "7,9 poin". Jam ditulis format 24 jam dengan
titik, misalnya 07.30.

## Yang tidak boleh dilanggar

- Tidak ada kata benar, salah, bagus, atau seharusnya di mana pun yang dilihat pemain.
  Kalimat akibat menceritakan apa yang terjadi, tidak menilai.
- Biaya waktu ditulis di tombol. Biaya Poin Paparan Abu Vulkanik tidak pernah ditulis
  di tombol. Pemain baru boleh tahu setelah memilih.
- Permainan tidak pernah maju sendiri. Selalu tunggu pemain menekan Lanjut.
- Panel yang menunggu giliran diredupkan tapi tetap terlihat. Jangan pernah
  menyembunyikan salah satu panel.
- Setiap kalimat yang diucapkan narasi harus juga ada sebagai teks di layar, kata per
  kata sama. Satu-satunya perbedaan: angka ditulis sebagai angka di layar, dibaca
  sebagai kata oleh narator.
- Suara hidup secara bawaan, tapi baris peringatan di layar judul harus tampil sebelum
  ada bunyi apa pun. Klip pertama dipicu oleh tombol Mulai pagi.
- Lebar minimum 1024 piksel. Di bawah 600 piksel, tampilkan satu kalimat yang
  menyarankan membukanya di laptop.
- Hormati `prefers-reduced-motion`. Warna bukan satu-satunya pembawa informasi.

## Aturan teknis hosting

Game ini di-hosting di GitHub Pages di bawah subpath `/<nama-repo>/`. Karena itu:

- **Semua path harus relatif.** Tulis `img/bg_cho_kamar.png`, jangan `/img/bg_cho_kamar.png`.
  Path absolut akan 404 di GitHub Pages walaupun jalan di localhost.
- **Nama berkas peka huruf besar kecil.** Server GitHub Pages berjalan di Linux.
  `IMG/Bg_Cho_Kamar.PNG` tidak sama dengan `img/bg_cho_kamar.png`. Nama berkas di folder
  harus persis sama dengan yang tertulis di `content.json` dan `vo.json`.
- **Tanpa proses build.** JavaScript polos, tanpa bundler, tanpa npm install untuk
  menjalankan game. Berkas bisa dibuka langsung oleh peramban.
- Kalau memakai ES module (`<script type="module">`), game harus diuji lewat server
  lokal (`python3 -m http.server`), bukan `file://`, karena `fetch` dan module diblokir
  oleh CORS di protokol berkas.
- Aset yang belum ada digantikan kotak berwarna, jangan bikin game gagal muat.
  Kalau gambar 404, tampilkan kotak dari `aset.palet` dan lanjutkan.

## Urutan pembangunan

Jangan bangun semuanya sekaligus. Uji tiap lapis di browser sebelum lanjut, dan commit
di setiap lapis yang lulus.

1. Muat `content.json` dan jalankan mesin dengan tampilan teks polos, tanpa gambar dan
   tanpa CSS. Lulus uji empat angka acuan.
2. Peralihan layar, tombol, dan pintasan papan ketik. Selesaikan satu permainan penuh
   memakai papan ketik saja.
3. Layar Hitung dan kartu memo, lengkap dengan tombol Salin hasil.
4. Lapisan visual: kanvas, partikel abu, vignette.
5. Tiga kartu pembuka, sorotan pengenalan bertahap, layar bantuan.
6. Audio, lencana, papan skor, penyimpanan kemajuan.
7. Rute WFH yang terkunci.

## Struktur berkas

```
index.html      kerangka, dua panel, HUD
style.css       palet, tipografi, tata letak, vignette
content.json    seluruh isi permainan  <- jangan duplikasi isinya ke kode
vo.json         peta klip suara
engine.js       mesin giliran, perhitungan, kondisi menang dan gagal
ui.js           peralihan layar, tombol, pintasan, tindihan
render.js       kanvas, partikel abu, animasi
audio.js        pemutar klip
save.js         localStorage: skor, lencana, kartu terbuka, kemajuan tertunda
/img            aset gambar
/audio          klip suara
/test           uji angka acuan
```
