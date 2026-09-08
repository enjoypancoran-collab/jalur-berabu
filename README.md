# Jalur Berabu
### Bagaimana Si Ones dan Bro Cho Mencapai Gadog Dalam Kondisi Abu Vulkanik

Game edukasi browser tentang mitigasi abu vulkanik untuk pegawai Pusdiklat Anggaran dan Perbendaharaan, BPPK, Kementerian Keuangan. Satu halaman, JavaScript polos, tanpa proses build, di-hosting di GitHub Pages. Durasi main 5 sampai 10 menit.

## Apa yang dibangun

Pemain memegang dua tokoh bergantian di pagi yang sama. Bro Cho berangkat dari Cibubur naik mobil sendiri. Si Ones berangkat dari kamar kos di Jakarta Barat lewat ojek, Transjakarta, jalan kaki, lalu mobil rombongan. Empat belas keputusan, tiga pilihan masing-masing, dua batang paparan berjalan berdampingan.

Kesimpulannya muncul sebagai aritmatika, bukan ceramah. Setelah keduanya absen, mesin menghitung seluruh ruang kemungkinan dan menunjukkan bahwa rute teraman Si Ones pun tetap di atas ambang aman, sementara Bro Cho jauh di bawahnya. Lalu opsi keempat muncul: bekerja dari rumah, 0,4 poin.

## Sumber kebenaran

`content.json` adalah satu-satunya sumber kebenaran. Seluruh angka, kalimat situasi, kalimat akibat, kartu fakta, lencana, teks layar, dan peta aset ada di sana.

Jangan menyalin angka atau kalimat ke dalam kode. Baca dari `content.json` saat runtime. Kalau ada yang perlu diubah, ubah di `content.json`, jangan di JavaScript.

Kalau `content.json` berbeda dengan dokumen konsep, `content.json` yang menang. Dokumen konsep sekarang berstatus catatan perancangan, bukan spesifikasi.

## Empat angka yang mengikat

Ini kontrak. Angka-angka ini sudah diverifikasi dengan menjalankan model di `content.json` pada faktor angin 1,0 dan masker KN95 rapat 0,09.

| Yang diukur | Nilai |
|---|---|
| Rute paling aman Bro Cho | 2,4 |
| Rute paling aman Si Ones | 7,9 |
| Ambang aman | 5,0 |
| Rute bekerja dari rumah | 0,4 |
| Menit Si Ones di udara terbuka | 47 |

Tulis uji otomatis yang menjalankan `angka_acuan.rute_optimal_cho` dan `angka_acuan.rute_optimal_ones` melalui mesin permainan dan membandingkan hasilnya dengan tabel ini. Kalau meleset, yang salah adalah kodenya, bukan rancangannya. Uji ini harus lulus sebelum satu baris CSS pun ditulis.

## Penamaan yang tidak boleh diubah

Angka paparan **selalu** disebut **Poin Paparan Abu Vulkanik**, ditulis lengkap, di setiap tempat pemain bisa melihatnya: HUD dua panel, Layar Hitung, kartu memo, layar gagal, layar rute WFH, papan skor, layar koleksi, dan kartu pembuka kedua.

Jangan pernah menampilkan singkatan PP, PPAV, atau kata "Paparan" sendirian di teks yang dilihat pemain. Singkatan hanya boleh hidup di dalam kode dan nama variabel. Pemain yang membuka tautan di sela pekerjaan tidak punya konteks untuk menebak apa itu PP, dan game yang harus dijelaskan lebih dulu tidak akan dibaca.

Di HUD yang sempit, tulis labelnya sekali di atas kedua batang, lalu nama tokoh di bawah masing-masing batang. Kalau tidak muat, kecilkan hurufnya. Jangan potong labelnya.

Aturan selengkapnya ada di blok `label` dalam `content.json`.

## Rumus

```
pp_segmen = menit × laju_ruas × faktor_masker × faktor_angin
```

Faktor angin hanya berlaku pada segmen dengan `luar_ruangan: true`. Diundi sekali per sesi dari tiga nilai, dan hanya terungkap ke pemain kalau C1 pilihan pertama diambil.

Setiap pilihan membawa daftar `segmen`. Jumlahkan semuanya, tambahkan `pp_tetap`, itu paparan keputusan tersebut. Batang tidak pernah menyusut.

## Tiga aturan mesin yang mudah salah dibaca

**Perjalanan mengemudi Bro Cho dihitung sekali.** C3 memilih laju kabin, dan laju itu berlaku untuk seluruh waktu mengemudi. Panjangnya adalah `durasi_dasar_mengemudi` 45 menit ditambah menit dari C4, C6, dan kejadian serempet. Dua menit jendela terbuka di C5 dipotong dari total itu, bukan ditambahkan. C4 dan C6 sendiri tidak punya segmen; keduanya bekerja lewat menit dan efek.

**Waktu di dalam ruangan dibebankan di keputusan pertama tiap tokoh.** C1 memikul 25 menit Bro Cho di kamar, O1 memikul 25 menit Si Ones di kos dan sudah mencakup O2. Jangan menghitung ulang di keputusan berikutnya.

**Segmen parkiran ke pintu gedung tidak dihitung sebagai menit udara terbuka.** Segmen itu bertanda `hitung_menit_terbuka: false`. Paparannya tetap dihitung, tapi menitnya tidak masuk angka 47, karena kalimat vonis bicara tentang rantai perjalanan, dan berjalan di halaman kantor bukan bagian dari rantai itu.

## Urutan pembangunan

Jangan bangun semuanya sekaligus. Uji tiap lapis di browser sebelum lanjut.

1. Muat `content.json` dan jalankan mesin dengan tampilan teks polos, tanpa gambar dan tanpa CSS. Lulus uji empat angka acuan.
2. Peralihan layar, tombol, dan pintasan papan ketik. Selesaikan satu permainan penuh memakai papan ketik saja, tanpa menyentuh tetikus.
3. Layar Hitung dan kartu memo, lengkap dengan tombol Salin hasil.
4. Lapisan visual: kanvas, partikel abu, vignette.
5. Tiga kartu pembuka, sorotan pengenalan bertahap, layar bantuan.
6. Audio, lencana, papan skor, penyimpanan kemajuan.
7. Rute WFH yang terkunci.

## Struktur berkas

```
/jalur-berabu
  index.html      kerangka, dua panel, HUD
  style.css       palet, tipografi, tata letak, vignette
  content.json    seluruh isi permainan  ← jangan duplikasi isinya ke kode
  vo.json         peta klip suara
  engine.js       mesin giliran, perhitungan, kondisi menang dan gagal
  ui.js           peralihan layar, tombol, pintasan, tindihan
  render.js       kanvas, partikel abu, animasi
  audio.js        pemutar klip
  save.js         localStorage: skor, lencana, kartu terbuka, kemajuan tertunda
  /img            43 aset gambar
  /audio          12 klip suara
```

Untuk GitHub Pages: taruh di akar cabang `main`, aktifkan Pages dari Settings. Tidak ada proses build. `localStorage` berfungsi normal di sana.

## Yang tidak boleh dilanggar

Tidak ada kata benar, salah, bagus, atau seharusnya di mana pun yang dilihat pemain. Kalimat akibat menceritakan apa yang terjadi, tidak menilai.

Biaya waktu ditulis di tombol. Biaya Poin Paparan Abu Vulkanik tidak pernah ditulis di tombol. Pemain baru boleh tahu setelah memilih.

Permainan tidak pernah maju sendiri. Selalu tunggu pemain menekan Lanjut. Ini terasa lambat saat mendesain, tapi tanpa jeda itu pemain tidak sempat menghubungkan pilihannya dengan angka yang bergerak.

Panel yang menunggu giliran diredupkan tapi tetap terlihat. Jangan pernah menyembunyikan salah satu panel; perbandingan berdampingan itulah inti gamenya.

Setiap kalimat yang diucapkan narasi harus juga ada sebagai teks di layar, kata per kata sama. Satu-satunya perbedaan yang diperbolehkan: angka ditulis sebagai angka di layar, dibaca sebagai kata oleh narator.

Suara hidup secara bawaan, tapi baris peringatan di layar judul harus tampil sebelum ada bunyi apa pun. Klip pertama dipicu oleh tombol Mulai pagi, karena peramban melarang suara diputar sebelum pemain melakukan tindakan.

Lebar minimum 1024 piksel. Di bawah 600 piksel, tampilkan satu kalimat yang menyarankan membukanya di laptop.

Hormati `prefers-reduced-motion`. Warna bukan satu-satunya pembawa informasi.

## Status aset

Empat puluh tiga aset gambar dan dua belas klip suara **belum ada**. Bangun dengan kotak berwarna dan tanpa suara lebih dulu; nama berkasnya sudah tercatat di `content.json` sehingga aset asli tinggal dijatuhkan ke `/img` dan `/audio` belakangan tanpa menyentuh kode.

## Kartu fakta

Ada 14 kartu fakta, dan kartunya menempel pada pilihan yang mengajarkannya, bukan satu kartu per keputusan. Beberapa keputusan membuka kartu yang sama, beberapa pilihan tidak membuka kartu apa pun, dan tiga kartu dibuka oleh kejadian sisipan dan Layar Hitung. Ini berbeda dari dokumen konsep, dan disengaja: memaksakan satu kartu per keputusan berarti menempelkan fakta ke tempat yang tidak diajarkannya.

Kartu hanya terbuka kalau pilihan terkait pernah diambil, termasuk pilihan yang buruk. Untuk melengkapi koleksi, pemain harus sengaja mencoba pilihan buruk minimal sekali.
