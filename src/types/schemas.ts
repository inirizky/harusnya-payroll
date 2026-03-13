import { z } from 'zod';

export const KomponenTetapSchema = z.object({
    nama: z.string(),
    jenis: z.enum(['TUNJANGAN', 'POTONGAN']),
    jumlah: z.number().min(0),
});

export const KaryawanCreateSchema = z.object({
    nik: z.string(),
    nama: z.string(),
    gajiPokok: z.number().min(0),
    tarifMakan: z.number().min(0),
    tarifTransport: z.number().min(0),
    golonganId: z.number(),
    jabatanId: z.number(),
    komponenTetap: z.array(KomponenTetapSchema).optional(),
});

export const KomponenLainSchema = z.object({
    nama: z.string(),
    jenis: z.enum(['TUNJANGAN', 'POTONGAN']),
    jumlah: z.number().min(0),
});

export const PayrollGenerateSchema = z.object({
    karyawanId: z.number(),
    bulan: z.number().min(1).max(12),
    tahun: z.number(),
    tunjanganLain: z.array(KomponenLainSchema).optional(),
    potonganLain: z.array(KomponenLainSchema).optional(),
});

export const GolonganSchema = z.object({
    nama: z.string(),
    tunjanganGolongan: z.number().min(0),
});

export const JabatanSchema = z.object({
    nama: z.string(),
});

export const KehadiranSchema = z.object({
    karyawanId: z.number(),
    bulan: z.number().min(1).max(12),
    tahun: z.number(),
    jumlahHadir: z.number().min(0).max(31),
});
