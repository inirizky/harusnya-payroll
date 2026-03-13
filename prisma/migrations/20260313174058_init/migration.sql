-- CreateEnum
CREATE TYPE "JenisKomponen" AS ENUM ('TUNJANGAN', 'POTONGAN');

-- CreateTable
CREATE TABLE "Golongan" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "tunjanganGolongan" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Golongan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jabatan" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,

    CONSTRAINT "Jabatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Karyawan" (
    "id" SERIAL NOT NULL,
    "nik" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "gajiPokok" DOUBLE PRECISION NOT NULL,
    "tarifMakan" DOUBLE PRECISION NOT NULL,
    "tarifTransport" DOUBLE PRECISION NOT NULL,
    "golonganId" INTEGER NOT NULL,
    "jabatanId" INTEGER NOT NULL,

    CONSTRAINT "Karyawan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KomponenTetap" (
    "id" SERIAL NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "jenis" "JenisKomponen" NOT NULL,
    "nama" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "KomponenTetap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kehadiran" (
    "id" SERIAL NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "jumlahHadir" INTEGER NOT NULL,

    CONSTRAINT "Kehadiran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlipGaji" (
    "id" SERIAL NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "gajiPokok" DOUBLE PRECISION NOT NULL,
    "tunjanganGolongan" DOUBLE PRECISION NOT NULL,
    "tunjanganMakan" DOUBLE PRECISION NOT NULL,
    "tunjanganTransport" DOUBLE PRECISION NOT NULL,
    "gajiKotor" DOUBLE PRECISION NOT NULL,
    "totalPotongan" DOUBLE PRECISION NOT NULL,
    "gajiBersih" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlipGaji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetailSlipGaji" (
    "id" SERIAL NOT NULL,
    "slipGajiId" INTEGER NOT NULL,
    "jenis" "JenisKomponen" NOT NULL,
    "kategori" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DetailSlipGaji_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Golongan_nama_key" ON "Golongan"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "Jabatan_nama_key" ON "Jabatan"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "Karyawan_nik_key" ON "Karyawan"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "Kehadiran_karyawanId_bulan_tahun_key" ON "Kehadiran"("karyawanId", "bulan", "tahun");

-- CreateIndex
CREATE UNIQUE INDEX "SlipGaji_karyawanId_bulan_tahun_key" ON "SlipGaji"("karyawanId", "bulan", "tahun");

-- AddForeignKey
ALTER TABLE "Karyawan" ADD CONSTRAINT "Karyawan_golonganId_fkey" FOREIGN KEY ("golonganId") REFERENCES "Golongan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Karyawan" ADD CONSTRAINT "Karyawan_jabatanId_fkey" FOREIGN KEY ("jabatanId") REFERENCES "Jabatan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KomponenTetap" ADD CONSTRAINT "KomponenTetap_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "Karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kehadiran" ADD CONSTRAINT "Kehadiran_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "Karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlipGaji" ADD CONSTRAINT "SlipGaji_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "Karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailSlipGaji" ADD CONSTRAINT "DetailSlipGaji_slipGajiId_fkey" FOREIGN KEY ("slipGajiId") REFERENCES "SlipGaji"("id") ON DELETE CASCADE ON UPDATE CASCADE;
