import prisma from '../configs/database.js';
import { KaryawanCreateSchema } from '../types/schemas.js';
import { z } from 'zod';

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
}
