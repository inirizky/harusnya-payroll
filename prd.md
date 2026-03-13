# Product Requirements Document (PRD): Sistem Penggajian Karyawan API

## 1. Ringkasan Proyek

Pengembangan API backend untuk mengelola data karyawan, komponen gaji yang dinamis, otomatisasi perhitungan *Take Home Pay* (THP), dan pembuatan cetak slip gaji berformat PDF. Sistem dirancang agar riwayat slip gaji bulan sebelumnya tidak berubah (*immutable snapshot*) meskipun master data karyawan atau tunjangan diperbarui.

## 2. Tech Stack Utama

* **Framework:** Node.js dengan Hono (ringan & cepat)
* **ORM & Database:** Prisma ORM (PostgreSQL/MySQL)
* **Validasi Data:** Zod & `@hono/zod-validator`
* **Dokumen & Log:** `pdfkit` (PDF Generator), Custom Logger 

---

## 3. Aturan Bisnis (Business Logic)

### A. Komponen Pendapatan

* **Gaji Pokok:** Nominal tetap berdasarkan masing-masing karyawan.
* **Tunjangan Golongan:** Berdasarkan ID Golongan karyawan.
* **Tunjangan Kehadiran:** Dihitung dari `(Tarif Makan + Tarif Transport) * Jumlah Kehadiran`.
* **Tunjangan Tetap:** Melekat pada karyawan (misal: Tunjangan Istri, Tunjangan Jabatan) dan dibayarkan setiap bulan.
* **Tunjangan Lain:** Bersifat insidental/dinamis, diinput manual saat generate slip bulan tersebut (misal: Bonus akhir tahun, Lembur).

### B. Komponen Potongan

* **Potongan Tetap:** Melekat pada karyawan (misal: Iuran BPJS, Asuransi).
* **Potongan Lain:** Bersifat insidental/dinamis (misal: Denda telat, Cicilan kasbon).

### C. Formula Gaji

1. **Gaji Kotor** = Gaji Pokok + Tunj. Golongan + Tunj. Kehadiran + Total Tunj. Tetap + Total Tunj. Lain.
2. **Total Potongan** = Total Pot. Tetap + Total Pot. Lain.
3. **Gaji Bersih (THP)** = Gaji Kotor - Total Potongan.

### D. Aturan Sistem

* **Snapshot:** Slip gaji yang sudah di-*generate* akan menyimpan nilai *hardcopy* di database (`SlipGaji` & `DetailSlipGaji`). Perubahan gaji pokok bulan depan tidak akan merusak data slip gaji bulan ini.
* **Unique Constraint:** 1 Karyawan hanya bisa memiliki 1 Slip Gaji per periode (Bulan & Tahun).

---

## 4. Spesifikasi Entitas (Database Schema)

| Model | Deskripsi Utama |
| --- | --- |
| **Golongan** | Master data golongan beserta `tunjanganGolongan`. |
| **Jabatan** | Master data nama jabatan. |
| **Karyawan** | Menyimpan profil, NIK, `gajiPokok`, tarif makan/transport harian, beserta relasi Golongan & Jabatan. |
| **KomponenTetap** | Relasi 1-to-M dengan Karyawan. Menyimpan daftar tunjangan/potongan yang selalu ada tiap bulan. |
| **Kehadiran** | Rekap total hari masuk (`jumlahHadir`) per karyawan per bulan/tahun. |
| **SlipGaji** | *Snapshot* tabel kalkulasi akhir (Gaji Kotor, Total Potongan, Gaji Bersih). |
| **DetailSlipGaji** | Rincian *snapshot* dari komponen tetap dan komponen lain yang masuk ke slip gaji tersebut. |

---

## 5. Daftar API Endpoint (Fase 1)

### 1. Master Karyawan

* **Endpoint:** `POST /api/karyawan`
* **Fungsi:** Menambah karyawan baru sekaligus merekam `komponenTetap` (Nested Insert Prisma).
* **Payload:** NIK, Nama, Gaji Pokok, Tarif Harian, Golongan, Jabatan, Array Komponen Tetap.

### 2. Generate Slip Gaji

* **Endpoint:** `POST /api/payroll/generate`
* **Fungsi:** Mengambil data Karyawan, Kehadiran, dan Komponen Tetap. Menggabungkannya dengan Tunjangan/Potongan Lain dari payload, lalu menyimpan hasilnya sebagai *snapshot*.
* **Payload:** KaryawanID, Bulan, Tahun, Array Tunjangan Lain, Array Potongan Lain.

### 3. Cetak PDF

* **Endpoint:** `GET /api/payroll/download/:slipId`
* **Fungsi:** Mengambil data *snapshot* dari tabel `SlipGaji` berdasarkan ID, me-render layout menggunakan PDFKit, dan mengembalikan file buffer `application/pdf`.

---

## 6. Checklist Eksekusi (Coding Vibe)

* [ ] Inisialisasi Project (`npm init`, install dependencies).
* [ ] Konfigurasi `schema.prisma` dan migrasi database awal.
* [ ] Buat custom logger sederhana.
* [ ] Buat file validasi Zod untuk payload request.
* [ ] Implementasi routing & controller `POST /api/karyawan`.
* [ ] Implementasi routing kalkulasi `POST /api/payroll/generate`.
* [ ] Desain layout `pdfkit` untuk fungsi *generate* dokumen.
* [ ] Implementasi endpoint `GET /api/payroll/download/:slipId`.
* [ ] Uji coba flow penuh menggunakan cURL/Postman.

---
refer to https://hono.dev/llms.txt

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // Ubah ke "mysql" jika menggunakan MySQL
  url      = env("DATABASE_URL")
}

// --- MASTER DATA ---

model Golongan {
  id                Int        @id @default(autoincrement())
  nama              String     @unique // cth: "Golongan I", "Golongan II"
  tunjanganGolongan Float      // Tunjangan spesifik tiap golongan
  karyawan          Karyawan[]
}

model Jabatan {
  id       Int        @id @default(autoincrement())
  nama     String     @unique // cth: "Manager", "Staff"
  karyawan Karyawan[]
}

model Karyawan {
  id             Int       @id @default(autoincrement())
  nik            String    @unique
  nama           String
  gajiPokok      Float     // Gaji pokok spesifik untuk karyawan ini
  tarifMakan     Float     // Tarif tunjangan makan per hari/kehadiran
  tarifTransport Float     // Tarif tunjangan transport per hari/kehadiran
  
  golonganId     Int
  golongan       Golongan  @relation(fields: [golonganId], references: [id])
  jabatanId      Int
  jabatan        Jabatan   @relation(fields: [jabatanId], references: [id])

  komponenTetap  KomponenTetap[]
  kehadiran      Kehadiran[]
  slipGaji       SlipGaji[]
}

enum JenisKomponen {
  TUNJANGAN
  POTONGAN
}

// Tunjangan & Potongan Tetap yang berlaku setiap bulan (bisa ditambah/diedit)
model KomponenTetap {
  id         Int           @id @default(autoincrement())
  karyawanId Int
  karyawan   Karyawan      @relation(fields: [karyawanId], references: [id], onDelete: Cascade)
  jenis      JenisKomponen // TUNJANGAN atau POTONGAN
  nama       String        // cth: "BPJS Kesehatan", "Potongan Koperasi"
  jumlah     Float
}

// --- DATA TRANSAKSIONAL ---

// Rekap kehadiran untuk pengali tunjangan makan & transport
model Kehadiran {
  id          Int      @id @default(autoincrement())
  karyawanId  Int
  karyawan    Karyawan @relation(fields: [karyawanId], references: [id], onDelete: Cascade)
  bulan       Int      // 1-12
  tahun       Int
  jumlahHadir Int

  @@unique([karyawanId, bulan, tahun]) // 1 karyawan 1 rekap per bulan
}

// Data historis penggajian (Snapshot)
model SlipGaji {
  id                   Int      @id @default(autoincrement())
  karyawanId           Int
  karyawan             Karyawan @relation(fields: [karyawanId], references: [id])
  bulan                Int
  tahun                Int
  
  // Snapshot Data Utama (Di-copy saat generate)
  gajiPokok            Float
  tunjanganGolongan    Float
  tunjanganMakan       Float    // Hasil: tarifMakan * jumlahHadir
  tunjanganTransport   Float    // Hasil: tarifTransport * jumlahHadir
  
  // Rincian Komponen Tetap & Lainnya pada bulan tersebut
  detailKomponen       DetailSlipGaji[]

  // Hasil Kalkulasi Akhir
  gajiKotor            Float    // Total semua pendapatan (Gaji Pokok + Semua Tunjangan)
  totalPotongan        Float    // Total semua potongan
  gajiBersih           Float    // Gaji Kotor - Total Potongan

  createdAt            DateTime @default(now())

  @@unique([karyawanId, bulan, tahun])
}

// Rincian tambahan untuk Slip Gaji (Mengakomodasi Tetap + Lain-lain)
model DetailSlipGaji {
  id         Int           @id @default(autoincrement())
  slipGajiId Int
  slipGaji   SlipGaji      @relation(fields: [slipGajiId], references: [id], onDelete: Cascade)
  jenis      JenisKomponen // TUNJANGAN atau POTONGAN
  kategori   String        // "TETAP" atau "LAINNYA" (Untuk membedakan asal usul input)
  nama       String
  jumlah     Float
}