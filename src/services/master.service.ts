import prisma from '../configs/database.js';

export class MasterService {
    // --- GOLONGAN ---
    static async getAllGolongan() {
        return await prisma.golongan.findMany();
    }

    static async getGolonganById(id: number) {
        return await prisma.golongan.findUnique({ where: { id } });
    }

    static async createGolongan(data: { nama: string; tunjanganGolongan: number }) {
        return await prisma.golongan.create({ data });
    }

    static async updateGolongan(id: number, data: { nama?: string; tunjanganGolongan?: number }) {
        return await prisma.golongan.update({
            where: { id },
            data,
        });
    }

    static async deleteGolongan(id: number) {
        return await prisma.golongan.delete({ where: { id } });
    }

    // --- JABATAN ---
    static async getAllJabatan() {
        return await prisma.jabatan.findMany();
    }

    static async getJabatanById(id: number) {
        return await prisma.jabatan.findUnique({ where: { id } });
    }

    static async createJabatan(data: { nama: string }) {
        return await prisma.jabatan.create({ data });
    }

    static async updateJabatan(id: number, data: { nama?: string }) {
        return await prisma.jabatan.update({
            where: { id },
            data,
        });
    }

    static async deleteJabatan(id: number) {
        return await prisma.jabatan.delete({ where: { id } });
    }
}
