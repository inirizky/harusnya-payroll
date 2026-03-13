import { PrismaClient, JenisKomponen } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    // 1. Seed Golongan
    const golongan1 = await prisma.golongan.upsert({
        where: { nama: 'Golongan I' },
        update: {},
        create: {
            nama: 'Golongan I',
            tunjanganGolongan: 500000,
        },
    });

    const golongan2 = await prisma.golongan.upsert({
        where: { nama: 'Golongan II' },
        update: {},
        create: {
            nama: 'Golongan II',
            tunjanganGolongan: 1000000,
        },
    });

    console.log('Seeded Golongan');

    // 2. Seed Jabatan
    const jabatanManager = await prisma.jabatan.upsert({
        where: { nama: 'Manager' },
        update: {},
        create: { nama: 'Manager' },
    });

    const jabatanStaff = await prisma.jabatan.upsert({
        where: { nama: 'Staff' },
        update: {},
        create: { nama: 'Staff' },
    });

    console.log('Seeded Jabatan');

    // 3. Seed Karyawan
    const karyawan1 = await prisma.karyawan.upsert({
        where: { nik: '12345678' },
        update: {},
        create: {
            nik: '12345678',
            nama: 'Budi Santoso',
            gajiPokok: 5000000,
            tarifMakan: 25000,
            tarifTransport: 15000,
            golonganId: golongan2.id,
            jabatanId: jabatanManager.id,
            komponenTetap: {
                create: [
                    {
                        nama: 'BPJS Kesehatan',
                        jenis: JenisKomponen.POTONGAN,
                        jumlah: 150000,
                    },
                    {
                        nama: 'Tunjangan Jabatan',
                        jenis: JenisKomponen.TUNJANGAN,
                        jumlah: 500000,
                    },
                ],
            },
        },
    });

    const karyawan2 = await prisma.karyawan.upsert({
        where: { nik: '87654321' },
        update: {},
        create: {
            nik: '87654321',
            nama: 'Siti Aminah',
            gajiPokok: 3500000,
            tarifMakan: 20000,
            tarifTransport: 10000,
            golonganId: golongan1.id,
            jabatanId: jabatanStaff.id,
            komponenTetap: {
                create: [
                    {
                        nama: 'Iuran Koperasi',
                        jenis: JenisKomponen.POTONGAN,
                        jumlah: 50000,
                    },
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
            jumlahHadir: 22,
        },
    });

    await prisma.kehadiran.upsert({
        where: {
            karyawanId_bulan_tahun: {
                karyawanId: karyawan2.id,
                bulan: 3,
                tahun: 2026,
            },
        },
        update: {},
        create: {
            karyawanId: karyawan2.id,
            bulan: 3,
            tahun: 2026,
            jumlahHadir: 20,
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
