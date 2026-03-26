import { PrismaClient, JenisKomponen } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    // 1. Seed Golongan
    const golonganGrad0 = await prisma.golongan.upsert({
        where: { nama: 'Grade 0' },
        update: {},
        create: {
            nama: 'Grade 0',
            tunjanganGolongan: 2250000,
        },
    });

    const golonganStaff = await prisma.golongan.upsert({
        where: { nama: 'Staff Grade' },
        update: {},
        create: {
            nama: 'Staff Grade',
            tunjanganGolongan: 500000,
        },
    });

    console.log('Seeded Golongan');

    // 2. Seed Jabatan
    const jabatanDosen = await prisma.jabatan.upsert({
        where: { nama: 'Dosen' },
        update: {},
        create: { nama: 'Dosen' },
    });

    const jabatanStaff = await prisma.jabatan.upsert({
        where: { nama: 'Administrasi' },
        update: {},
        create: { nama: 'Administrasi' },
    });

    console.log('Seeded Jabatan');

    // 3. Seed Karyawan (Sample from Image)
    const karyawan1 = await prisma.karyawan.upsert({
        where: { nik: '19870101202403' },
        update: {},
        create: {
            nik: '19870101202403',
            nama: 'Budi Setiawan',
            gajiPokok: 2500000,
            tarifMakan: 25000,
            tarifTransport: 25000,
            golonganId: golonganGrad0.id,
            jabatanId: jabatanDosen.id,
            komponenTetap: {
                create: [
                    { nama: 'Tunj. Askes', jenis: JenisKomponen.TUNJANGAN, jumlah: 0 },
                    { nama: 'Tunj. Fungsional (Dosen YAL)', jenis: JenisKomponen.TUNJANGAN, jumlah: 2000000 },
                    { nama: 'Total Honor Mengajar', jenis: JenisKomponen.TUNJANGAN, jumlah: 0 },
                    { nama: 'Tunj. JA', jenis: JenisKomponen.TUNJANGAN, jumlah: 150000 },
                    { nama: 'Tunj. Natura', jenis: JenisKomponen.TUNJANGAN, jumlah: 0 },
                    { nama: 'Tunj. Lain-Lain', jenis: JenisKomponen.TUNJANGAN, jumlah: 0 },
                    { nama: 'Pajak Penghasilan (PPH)', jenis: JenisKomponen.POTONGAN, jumlah: 0 },
                    { nama: 'Potongan BPJS', jenis: JenisKomponen.POTONGAN, jumlah: 0 },
                    { nama: 'Potongan Askes', jenis: JenisKomponen.POTONGAN, jumlah: 0 },
                    { nama: 'Simpanan Wajib Koperasi', jenis: JenisKomponen.POTONGAN, jumlah: 0 },
                    { nama: 'Angsuran Pinjaman', jenis: JenisKomponen.POTONGAN, jumlah: 0 },
                    { nama: 'Angsuran Kredit Bank', jenis: JenisKomponen.POTONGAN, jumlah: 0 },
                    { nama: 'Kasbon', jenis: JenisKomponen.POTONGAN, jumlah: 0 },
                    { nama: 'Potongan Kado', jenis: JenisKomponen.POTONGAN, jumlah: 0 },
                    { nama: 'Potongan Duka', jenis: JenisKomponen.POTONGAN, jumlah: 0 },
                    { nama: 'Potongan THT', jenis: JenisKomponen.POTONGAN, jumlah: 93120 }
                ],
            },
        },
    });

    console.log('Seeded Karyawan');

    // 4. Seed Kehadiran (for testing March 2026)
    await prisma.kehadiran.upsert({
        where: {
            karyawanId_bulan_tahun: {
                karyawanId: karyawan1.id,
                bulan: 3,
                tahun: 2026,
            },
        },
        update: {},
        create: {
            karyawanId: karyawan1.id,
            bulan: 3,
            tahun: 2026,
            jumlahHadir: 18, // 18 * 25k = 450k (match image)
        },
    });

    console.log('Seeded Kehadiran');
    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
