import prisma from '../configs/database.js';
import { KaryawanCreateSchema } from '../types/schemas.js';
import { z } from 'zod';
import * as XLSX from 'xlsx';

export type KaryawanCreateInput = z.infer<typeof KaryawanCreateSchema>;

export class EmployeeService {
    static async create(data: KaryawanCreateInput) {
        const { komponenTetap, ...employeeData } = data;

        return await prisma.karyawan.create({
            data: {
                ...employeeData,
                komponenTetap: komponenTetap ? {
                    createMany: {
                        data: komponenTetap,
                    },
                } : undefined,
            },
            include: {
                komponenTetap: true,
                golongan: true,
                jabatan: true,
            },
        });
    }

    static async getAll() {
        return await prisma.karyawan.findMany({

            select: {
                id: true,
                nik: true,
                nama: true,
                jabatan: {
                    select: {
                        id: true,
                        nama: true,
                    },
                },
                gajiPokok: true,
                golongan: {
                    select: {
                        id: true,
                        nama: true,
                    },
                },
                tarifMakan: true,
                tarifTransport: true,
                komponenTetap: {
                    select: {
                        id: true,
                        nama: true,
                        jenis: true,
                        jumlah: true,
                    },

                },

            },
            orderBy: {
                nama: 'asc',
            },


        });
    }

    static async getById(id: number) {
        return await prisma.karyawan.findUnique({
            where: { id },
            include: {
                slipGaji: true,
                komponenTetap: true,
                golongan: true,
                jabatan: true,
                kehadiran: true,
            },
        });
    }
    static async update(id: number, data: KaryawanCreateInput) {
        // Pindahkan business logic (pengecekan eksistensi data) ke Service
        const existingEmployee = await prisma.karyawan.findUnique({ where: { id } });

        if (!existingEmployee) {
            // Lempar error spesifik jika data tidak ada
            throw new Error("EMPLOYEE_NOT_FOUND");
        }

        const { komponenTetap, ...employeeData } = data;

        return await prisma.karyawan.update({
            where: { id },
            data: {
                ...employeeData,
                komponenTetap: komponenTetap ? {
                    deleteMany: {},
                    create: komponenTetap,
                } : undefined,
            },
            include: {
                komponenTetap: true,
                golongan: true,
                jabatan: true,
            },
        });
    }

    static async delete(id: number) {
        return await prisma.karyawan.delete({ where: { id } });
    }

    static async importFromCSV(fileBuffer: Buffer) {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

        // Cache lookup sekali saja, tidak perlu query per-baris
        const [allJabatan, allGolongan] = await Promise.all([
            prisma.jabatan.findMany({ select: { id: true, nama: true } }),
            prisma.golongan.findMany({ select: { id: true, nama: true } }),
        ]);

        const jabatanMap = new Map(allJabatan.map(j => [j.nama.toLowerCase(), j.id]));
        const golonganMap = new Map(allGolongan.map(g => [g.nama.toLowerCase(), g.id]));

        const results = {
            success: 0,
            failed: 0,
            errors: [] as { row: number; message: string }[],
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            try {
                const namaJabatan = String(row['Jabatan'] ?? '').toLowerCase();
                const namaGolongan = String(row['Golongan'] ?? '').toLowerCase();

                const jabatanId = jabatanMap.get(namaJabatan);
                const golonganId = golonganMap.get(namaGolongan);

                const rowErrors: string[] = [];
                if (!jabatanId) rowErrors.push(`Jabatan "${row['Jabatan']}" tidak ditemukan`);
                if (!golonganId) rowErrors.push(`Golongan "${row['Golongan']}" tidak ditemukan`);

                if (rowErrors.length > 0) {
                    results.failed++;
                    results.errors.push({ row: rowNum, message: rowErrors.join(', ') });
                    continue;
                }

                const data: KaryawanCreateInput = {
                    nik: String(row['NIK'] ?? ''),
                    nama: String(row['Nama'] ?? ''),
                    jabatanId: jabatanId!,
                    golonganId: golonganId!,
                    gajiPokok: Number(row['Gaji Pokok']),
                    tarifMakan: Number(row['Tarif Makan'] ?? 0),
                    tarifTransport: Number(row['Tarif Transport'] ?? 0),
                    komponenTetap: [],
                };

                const parsed = KaryawanCreateSchema.safeParse(data);
                if (!parsed.success) {
                    results.failed++;
                    results.errors.push({
                        row: rowNum,
                        message: parsed.error.errors.map(e => e.message).join(', '),
                    });
                    continue;
                }

                await EmployeeService.create(parsed.data);
                results.success++;
            } catch (err: any) {
                results.failed++;
                results.errors.push({ row: rowNum, message: err.message });
            }
        }

        return results;
    }
}
