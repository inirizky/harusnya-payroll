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

    // --- KOMPONEN TETAP ---
    static async getKomponenTetapByEmployee(karyawanId: number) {
        return await prisma.komponenTetap.findMany({
            where: { karyawanId }
        });
    }

    static async createKomponenTetap(data: { karyawanId: number; nama: string; jenis: 'TUNJANGAN' | 'POTONGAN'; jumlah: number }) {
        return await prisma.komponenTetap.create({ data });
    }

    static async updateKomponenTetap(id: number, data: { nama?: string; jenis?: 'TUNJANGAN' | 'POTONGAN'; jumlah?: number }) {
        return await prisma.komponenTetap.update({
            where: { id },
            data,
        });
    }

    static async deleteKomponenTetap(id: number) {
        return await prisma.komponenTetap.delete({ where: { id } });
    }

    // --- KOMPONEN DEFAULT ---
    static async getAllKomponenDefault() {
        return await prisma.komponenDefault.findMany();
    }

    static async getKomponenDefaultById(id: number) {
        return await prisma.komponenDefault.findUnique({ where: { id } });
    }

    static async createKomponenDefault(data: { nama: string; jenis: 'TUNJANGAN' | 'POTONGAN'; jumlah: number }) {
        return await prisma.komponenDefault.create({ data });
    }

    static async updateKomponenDefault(id: number, data: { nama?: string; jenis?: 'TUNJANGAN' | 'POTONGAN'; jumlah?: number }) {
        return await prisma.komponenDefault.update({
            where: { id },
            data,
        });
    }

    static async deleteKomponenDefault(id: number) {
        return await prisma.komponenDefault.delete({ where: { id } });
    }
}
