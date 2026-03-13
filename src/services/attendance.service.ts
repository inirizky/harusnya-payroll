import prisma from '../configs/database.js';

export class AttendanceService {
    static async getAll() {
        return await prisma.kehadiran.findMany({
            include: {
                karyawan: true,
            },
            orderBy: [
                { tahun: 'desc' },
                { bulan: 'desc' },
            ],
        });
    }

    static async getById(id: number) {
        return await prisma.kehadiran.findUnique({
            where: { id },
            include: {
                karyawan: true,
            },
        });
    }

    static async upsert(data: { karyawanId: number; bulan: number; tahun: number; jumlahHadir: number }) {
        return await prisma.kehadiran.upsert({
            where: {
                karyawanId_bulan_tahun: {
                    karyawanId: data.karyawanId,
                    bulan: data.bulan,
                    tahun: data.tahun,
                },
            },
            update: {
                jumlahHadir: data.jumlahHadir,
            },
            create: data,
        });
    }

    static async delete(id: number) {
        return await prisma.kehadiran.delete({
            where: { id },
        });
    }
}
