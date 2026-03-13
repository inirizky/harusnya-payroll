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
            include: {
                golongan: true,
                jabatan: true,
            },
        });
    }

    static async getById(id: number) {
        return await prisma.karyawan.findUnique({
            where: { id },
            include: {
                komponenTetap: true,
                golongan: true,
                jabatan: true,
                kehadiran: true,
            },
        });
    }
}
