import prisma from '../configs/database.js';
import { PayrollGenerateSchema } from '../types/schemas.js';
import { z } from 'zod';

export type PayrollGenerateInput = z.infer<typeof PayrollGenerateSchema>;

export class PayrollService {
    static async generate(data: PayrollGenerateInput) {
        const { karyawanId, bulan, tahun, tunjanganLain = [], potonganLain = [] } = data;

        // 1. Fetch Master Data & Attendance
        const employee = await prisma.karyawan.findUnique({
            where: { id: karyawanId },
            include: {
                golongan: true,
                komponenTetap: true,
            },
        });

        if (!employee) throw new Error('Employee not found');

        const attendance = await prisma.kehadiran.findUnique({
            where: {
                karyawanId_bulan_tahun: {
                    karyawanId,
                    bulan,
                    tahun,
                },
            },
        });

        const jumlahHadir = attendance?.jumlahHadir || 0;

        // 2. Calculate Base Components
        const tunjanganMakan = employee.tarifMakan * jumlahHadir;
        const tunjanganTransport = employee.tarifTransport * jumlahHadir;
        const tunjanganGolongan = employee.golongan.tunjanganGolongan;

        // 3. Process All Details (Snapshot)
        const details: any[] = [];

        // Map Komponen Tetap
        employee.komponenTetap.forEach((kt) => {
            details.push({
                nama: kt.nama,
                jenis: kt.jenis,
                kategori: 'TETAP',
                jumlah: kt.jumlah,
            });
        });

        // Map Komponen Lain
        tunjanganLain.forEach((tl) => {
            details.push({
                nama: tl.nama,
                jenis: 'TUNJANGAN',
                kategori: 'LAINNYA',
                jumlah: tl.jumlah,
            });
        });

        potonganLain.forEach((pl) => {
            details.push({
                nama: pl.nama,
                jenis: 'POTONGAN',
                kategori: 'LAINNYA',
                jumlah: pl.jumlah,
            });
        });

        // 4. Final Calculation
        const totalTunjanganTetap = details
            .filter((d) => d.jenis === 'TUNJANGAN' && d.kategori === 'TETAP')
            .reduce((sum, d) => sum + d.jumlah, 0);
        const totalTunjanganLain = details
            .filter((d) => d.jenis === 'TUNJANGAN' && d.kategori === 'LAINNYA')
            .reduce((sum, d) => sum + d.jumlah, 0);
        const totalPotonganTetap = details
            .filter((d) => d.jenis === 'POTONGAN' && d.kategori === 'TETAP')
            .reduce((sum, d) => sum + d.jumlah, 0);
        const totalPotonganLain = details
            .filter((d) => d.jenis === 'POTONGAN' && d.kategori === 'LAINNYA')
            .reduce((sum, d) => sum + d.jumlah, 0);

        const gajiKotor =
            employee.gajiPokok +
            tunjanganGolongan +
            tunjanganMakan +
            tunjanganTransport +
            totalTunjanganTetap +
            totalTunjanganLain;

        const totalPotongan = totalPotonganTetap + totalPotonganLain;
        const gajiBersih = gajiKotor - totalPotongan;

        // 5. Create Snapshot
        return await prisma.slipGaji.create({
            data: {
                karyawanId,
                bulan,
                tahun,
                gajiPokok: employee.gajiPokok,
                tunjanganGolongan,
                tunjanganMakan,
                tunjanganTransport,
                gajiKotor,
                totalPotongan,
                gajiBersih,
                detailKomponen: {
                    create: details,
                },
            },
            include: {
                detailKomponen: true,
            },
        });
    }

    static async getAll() {
        return await prisma.slipGaji.findMany({
            include: {
                karyawan: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    static async getById(id: number) {
        return await prisma.slipGaji.findUnique({
            where: { id },
            include: {
                karyawan: {
                    include: {
                        golongan: true,
                        jabatan: true,
                    },
                },
                detailKomponen: true,
            },
        });
    }
}
