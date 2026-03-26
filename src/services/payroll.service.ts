import prisma from '../configs/database.js';
import { PayrollGenerateSchema, PayrollUpdateSchema } from '../types/schemas.js';
import { z } from 'zod';

export type PayrollGenerateInput = z.infer<typeof PayrollGenerateSchema>;
export type PayrollUpdateInput = z.infer<typeof PayrollUpdateSchema>;

export class PayrollService {
    private static async calculatePayrollDetails(data: PayrollGenerateInput) {
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

        // 3. Process All Details
        const details: any[] = [];

        // --- Basic Components (as Detail) ---
        details.push({
            nama: 'Gaji Pokok',
            jenis: 'TUNJANGAN',
            kategori: 'TETAP',
            jumlah: employee.gajiPokok,
        });

        details.push({
            nama: `Tunjangan Golongan (${employee.golongan.nama})`,
            jenis: 'TUNJANGAN',
            kategori: 'TETAP',
            jumlah: tunjanganGolongan,
        });

        if (tunjanganMakan > 0) {
            details.push({
                nama: `Tunjangan Makan (${jumlahHadir} hari)`,
                jenis: 'TUNJANGAN',
                kategori: 'TETAP',
                jumlah: tunjanganMakan,
            });
        }

        if (tunjanganTransport > 0) {
            details.push({
                nama: `Tunjangan Transport (${jumlahHadir} hari)`,
                jenis: 'TUNJANGAN',
                kategori: 'TETAP',
                jumlah: tunjanganTransport,
            });
        }

        // Map Komponen Tetap (from Master Karyawan)
        employee.komponenTetap.forEach((kt) => {
            details.push({
                nama: kt.nama,
                jenis: kt.jenis,
                kategori: 'TETAP',
                jumlah: kt.jumlah,
            });
        });

        // Map Komponen Manual (from Input)
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
        const gajiKotor = details
            .filter((d) => d.jenis === 'TUNJANGAN')
            .reduce((sum, d) => sum + d.jumlah, 0);

        const totalPotongan = details
            .filter((d) => d.jenis === 'POTONGAN')
            .reduce((sum, d) => sum + d.jumlah, 0);

        const gajiBersih = gajiKotor - totalPotongan;

        return {
            employee,
            details,
            gajiKotor,
            totalPotongan,
            gajiBersih,
            attendance: attendance || { jumlahHadir: 0 }
        };
    }

    static async preview(data: PayrollGenerateInput) {
        const result = await this.calculatePayrollDetails(data);
        return {
            karyawan: {
                nik: result.employee.nik,
                nama: result.employee.nama,
                golongan: result.employee.golongan.nama,
            },
            bulan: data.bulan,
            tahun: data.tahun,
            gajiKotor: result.gajiKotor,
            totalPotongan: result.totalPotongan,
            gajiBersih: result.gajiBersih,
            details: result.details,
            jumlahHadir: result.attendance.jumlahHadir
        };
    }

    static async generate(data: PayrollGenerateInput) {
        const { karyawanId, bulan, tahun } = data;
        const result = await this.calculatePayrollDetails(data);

        // 5. Create Snapshot
        return await prisma.slipGaji.create({
            data: {
                karyawanId,
                bulan,
                tahun,
                gajiKotor: result.gajiKotor,
                totalPotongan: result.totalPotongan,
                gajiBersih: result.gajiBersih,
                detailKomponen: {
                    create: result.details,
                },
            },
            include: {
                detailKomponen: true,
            },
        });
    }

    static async getAll() {
        return await prisma.slipGaji.findMany({
            select: {
                id: true,
                bulan: true,
                tahun: true,
                gajiBersih: true,
                gajiKotor: true,
                totalPotongan: true,
                createdAt: true,
                karyawan: {
                    select: {
                        id: true,
                        nama: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    static async getById(id: number) {
        const slip = await prisma.slipGaji.findUnique({
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

        if (!slip) return null;

        const attendance = await prisma.kehadiran.findUnique({
            where: {
                karyawanId_bulan_tahun: {
                    karyawanId: slip.karyawanId,
                    bulan: slip.bulan,
                    tahun: slip.tahun,
                },
            },
        });

        return {
            ...slip,
            attendance,
        };
    }

    static async update(id: number, data: PayrollUpdateInput) {
        // Fetch existing slip
        const existingSlip = await prisma.slipGaji.findUnique({
            where: { id },
        });

        if (!existingSlip) throw new Error('Slip Gaji not found');

        let newGajiKotor = existingSlip.gajiKotor;
        let newTotalPotongan = existingSlip.totalPotongan;
        let newGajiBersih = existingSlip.gajiBersih;

        // check if any component lists are provided
        const hasComponents = data.tunjanganTetap !== undefined || 
                             data.potonganTetap !== undefined || 
                             data.tunjanganLain !== undefined || 
                             data.potonganLain !== undefined;

        if (hasComponents) {
            // Delete ALL existing components for this slip to rebuild
            await prisma.detailSlipGaji.deleteMany({
                where: { slipGajiId: id }
            });

            const newDetails: any[] = [];
            
            // Re-map all provided components
            data.tunjanganTetap?.forEach(t => newDetails.push({ slipGajiId: id, nama: t.nama, jenis: 'TUNJANGAN', kategori: 'TETAP', jumlah: t.jumlah }));
            data.potonganTetap?.forEach(p => newDetails.push({ slipGajiId: id, nama: p.nama, jenis: 'POTONGAN', kategori: 'TETAP', jumlah: p.jumlah }));
            data.tunjanganLain?.forEach(t => newDetails.push({ slipGajiId: id, nama: t.nama, jenis: 'TUNJANGAN', kategori: 'LAINNYA', jumlah: t.jumlah }));
            data.potonganLain?.forEach(p => newDetails.push({ slipGajiId: id, nama: p.nama, jenis: 'POTONGAN', kategori: 'LAINNYA', jumlah: p.jumlah }));

            if (newDetails.length > 0) {
                await prisma.detailSlipGaji.createMany({
                    data: newDetails
                });
            }

            // Recalculate totals
            let totalTunjangan = 0;
            let totalPot = 0;

            newDetails.forEach(d => {
                if (d.jenis === 'TUNJANGAN') totalTunjangan += d.jumlah;
                if (d.jenis === 'POTONGAN') totalPot += d.jumlah;
            });

            newGajiKotor = totalTunjangan;
            newTotalPotongan = totalPot;
            newGajiBersih = newGajiKotor - newTotalPotongan;
        }

        // Final update to slip
        return await prisma.slipGaji.update({
            where: { id },
            data: {
                ...(data.status && { status: data.status as any }),
                ...(data.catatanBanding !== undefined && { catatanBanding: data.catatanBanding }),
                gajiKotor: newGajiKotor,
                totalPotongan: newTotalPotongan,
                gajiBersih: newGajiBersih,
            },
            include: {
                detailKomponen: true
            }
        });
    }
}
