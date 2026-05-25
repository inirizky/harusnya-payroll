import prisma from '../configs/database.js';
import * as XLSX from 'xlsx';

export class PayrollExcelService {
    // ── MAIN EXPORT FUNCTION ──────────────────────────────────────────────────────
    static async exportToExcel(bulan: number, tahun: number): Promise<Buffer> {
        const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const periodeTitle = `Data Gaji Karyawan Periode ${BULAN_NAMES[bulan]} ${tahun}`;

        const employees = await prisma.karyawan.findMany({
            include: {
                golongan: true,
                jabatan: true,
                komponenTetap: true,
                kehadiran: { where: { bulan, tahun } },
            },
            orderBy: { nik: 'asc' },
        });

        const dynamicHeaders = Array.from(new Set(
            employees.flatMap(emp => emp.komponenTetap.map(comp => comp.nama))
        ));

        const sheetDataGaji: any[][] = [[periodeTitle]];
        const standardHeaders = [
            'NIK', 'Nama', 'Jabatan', 'Golongan', 'Jumlah Hadir',
            'Gaji Pokok', 'Tunjangan Golongan', 'Tunjangan Makan', 'Tunjangan Transport'
        ];
        sheetDataGaji.push([...standardHeaders, ...dynamicHeaders]);

        employees.forEach(emp => {
            const attendance = emp.kehadiran[0]?.jumlahHadir ?? 0;
            const tunjanganMakan = emp.tarifMakan * attendance;
            const tunjanganTransport = emp.tarifTransport * attendance;

            const rowData: any[] = [
                emp.nik, emp.nama, emp.jabatan.nama, emp.golongan.nama, attendance,
                emp.gajiPokok, emp.golongan.tunjanganGolongan, tunjanganMakan, tunjanganTransport
            ];

            dynamicHeaders.forEach(headerName => {
                const matchedComponent = emp.komponenTetap.find(c => c.nama === headerName);
                // PERUBAHAN: Gunakan null jika tidak punya komponen ini, agar cell kosong di Excel
                rowData.push(matchedComponent ? matchedComponent.jumlah : null);
            });

            sheetDataGaji.push(rowData);
        });

        const sheetKomponenTambahan: any[][] = [
            ['Tunjangan', '', '', '', '', 'Potongan', '', '', ''],
            ['NIK', 'Nama', 'Nominal', 'Bulan', '', 'NIK', 'Nama', 'Nominal', 'Bulan']
        ];

        const wb = XLSX.utils.book_new();
        const wsDataGaji = XLSX.utils.aoa_to_sheet(sheetDataGaji);
        const wsTambahan = XLSX.utils.aoa_to_sheet(sheetKomponenTambahan);

        const wscols = [
            { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
        ];

        dynamicHeaders.forEach(header => {
            wscols.push({ wch: Math.max(header.length + 2, 12) });
        });

        wsDataGaji['!cols'] = wscols;

        wsTambahan['!cols'] = [
            { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 4 },
            { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 8 }
        ];

        XLSX.utils.book_append_sheet(wb, wsDataGaji, 'Data Gaji');
        XLSX.utils.book_append_sheet(wb, wsTambahan, 'Komponen Tambahan');

        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    // ── MAIN IMPORT FUNCTION ──────────────────────────────────────────────────────
    // ── MAIN IMPORT FUNCTION ──────────────────────────────────────────────────────
    static async importFromExcel(buffer: Buffer, bulan: number, tahun: number) {
        const wb = XLSX.read(buffer, { type: 'buffer' });

        const wsDataGaji = wb.Sheets[wb.SheetNames[0]];
        const wsTambahan = wb.SheetNames.length > 1 ? wb.Sheets[wb.SheetNames[1]] : null;

        const data1: any[] = XLSX.utils.sheet_to_json(wsDataGaji, { range: 1 });
        if (!data1 || data1.length === 0) throw new Error('Format Excel tidak valid atau data kosong.');

        const importedNiks = data1.map(row => row['NIK']?.toString().trim()).filter(Boolean);

        // 1. Fetch data dari database
        const employees = await prisma.karyawan.findMany({
            where: { nik: { in: importedNiks } },
            include: { komponenTetap: true, golongan: true }
        });
        const empMap = new Map(employees.map(e => [e.nik, e]));

        // 🌟 PERBAIKAN UTAMA: Buat kamus untuk mengingat mana Tunjangan & Potongan
        const masterKomponenMap = new Map<string, string>();
        employees.forEach(emp => {
            emp.komponenTetap.forEach(comp => {
                // Simpan nama komponen huruf kecil sebagai key agar tidak case-sensitive
                masterKomponenMap.set(comp.nama.trim().toLowerCase(), comp.jenis);
            });
        });

        const payrollMap = new Map<string, any>();
        const errors: string[] = [];

        const standardHeaders = [
            'NIK', 'Nama', 'Jabatan', 'Golongan', 'Jumlah Hadir',
            'Gaji Pokok', 'Tunjangan Golongan', 'Tunjangan Makan', 'Tunjangan Transport'
        ];

        const getNumVal = (val: any, fallback: number) => {
            return (val !== undefined && val !== null && val !== '') ? Number(val) : fallback;
        };

        // 2. Proses Sheet 1
        for (let i = 0; i < data1.length; i++) {
            const row = data1[i];
            const nik = row['NIK']?.toString().trim();
            if (!nik) continue;

            const employee = empMap.get(nik);
            if (!employee) {
                errors.push(`Sheet 1 (Baris ${i + 3}): NIK ${nik} tidak terdaftar di database.`);
                continue;
            }

            const jmlHadir = getNumVal(row['Jumlah Hadir'], 0);

            const komponenDetail: any[] = [
                { nama: 'Gaji Pokok', jenis: 'TUNJANGAN', kategori: 'TETAP', jumlah: getNumVal(row['Gaji Pokok'], employee.gajiPokok) },
                { nama: `Tunjangan Golongan`, jenis: 'TUNJANGAN', kategori: 'TETAP', jumlah: getNumVal(row['Tunjangan Golongan'], employee.golongan.tunjanganGolongan) },
                { nama: `Tunjangan Makan`, jenis: 'TUNJANGAN', kategori: 'TETAP', jumlah: getNumVal(row['Tunjangan Makan'], employee.tarifMakan * jmlHadir) },
                { nama: `Tunjangan Transport`, jenis: 'TUNJANGAN', kategori: 'TETAP', jumlah: getNumVal(row['Tunjangan Transport'], employee.tarifTransport * jmlHadir) }
            ];

            // 🌟 PROSES KOLOM DINAMIS
            Object.keys(row).forEach(key => {
                if (!standardHeaders.includes(key)) {
                    const rawValue = row[key];
                    if (rawValue === undefined || rawValue === null || rawValue === '') return;

                    const nominal = Number(rawValue);
                    if (!isNaN(nominal)) {
                        const namaKomponen = key.trim();

                        // Cek jenisnya (TUNJANGAN/POTONGAN) dari database berdasarkan nama kolom
                        const jenisDariDB = masterKomponenMap.get(namaKomponen.toLowerCase());

                        // Jika ketemu di DB, gunakan jenis dari DB. 
                        // Jika tidak ketemu (kolom baru yg blm ada di DB), fallback: minus = potongan
                        const jenisKomponen = jenisDariDB ? jenisDariDB : (nominal < 0 ? 'POTONGAN' : 'TUNJANGAN');

                        komponenDetail.push({
                            nama: namaKomponen,
                            jenis: jenisKomponen,
                            kategori: 'TETAP',
                            jumlah: Math.abs(nominal) // Simpan nilai absolutnya (selalu positif)
                        });
                    }
                }
            });

            payrollMap.set(nik, { employee, jmlHadir, komponenDetail });
        }

        // 3. Proses Sheet 2: Komponen Tambahan 
        if (wsTambahan) {
            const data2: any[][] = XLSX.utils.sheet_to_json(wsTambahan, { header: 1 });

            for (let i = 2; i < data2.length; i++) {
                const row = data2[i];
                if (!row || row.length === 0) continue;

                // Tunjangan (Kiri)
                const nikTunjangan = row[0]?.toString().trim();
                const namaTunjangan = row[1]?.toString().trim();
                const nominalTunjangan = Number(row[2]) || 0;

                if (nikTunjangan && namaTunjangan && nominalTunjangan > 0) {
                    const payroll = payrollMap.get(nikTunjangan);
                    if (payroll) payroll.komponenDetail.push({ nama: namaTunjangan, jenis: 'TUNJANGAN', kategori: 'LAINNYA', jumlah: nominalTunjangan });
                    else errors.push(`Sheet 2 (Tunjangan Baris ${i + 1}): NIK ${nikTunjangan} tidak ada di Sheet 1.`);
                }

                // Potongan (Kanan)
                const nikPotongan = row[5]?.toString().trim();
                const namaPotongan = row[6]?.toString().trim();
                const nominalPotongan = Number(row[7]) || 0;

                if (nikPotongan && namaPotongan && nominalPotongan > 0) {
                    const payroll = payrollMap.get(nikPotongan);
                    if (payroll) payroll.komponenDetail.push({ nama: namaPotongan, jenis: 'POTONGAN', kategori: 'LAINNYA', jumlah: nominalPotongan });
                    else errors.push(`Sheet 2 (Potongan Baris ${i + 1}): NIK ${nikPotongan} tidak ada di Sheet 1.`);
                }
            }
        }

        // 4. KALKULASI & SIMPAN KE DB (VERSI OPTIMASI)
        const payrollArray = Array.from(payrollMap.values());
        let successCount = 0;

        if (payrollArray.length > 0) {
            // Gunakan Interactive Transaction agar bisa mengatur timeout
            await prisma.$transaction(async (tx) => {

                // BATAS CHUNK: Proses 50 Karyawan sekaligus secara paralel.
                // Angka ini bisa dinaikkan/diturunkan tergantung spek database.
                const CHUNK_SIZE = 50;

                for (let i = 0; i < payrollArray.length; i += CHUNK_SIZE) {
                    const chunk = payrollArray.slice(i, i + CHUNK_SIZE);

                    // Promise.all membuat proses upsert dalam 1 chunk berjalan PARALEL (bersamaan),
                    // bukan mengantre satu-satu. Ini akan mempercepat import hingga 10x lipat.
                    await Promise.all(chunk.map(async (data) => {
                        const { employee, jmlHadir, komponenDetail } = data;

                        const gajiKotor = komponenDetail.filter((d: any) => d.jenis === 'TUNJANGAN').reduce((sum: number, d: any) => sum + d.jumlah, 0);
                        const totalPotongan = komponenDetail.filter((d: any) => d.jenis === 'POTONGAN').reduce((sum: number, d: any) => sum + d.jumlah, 0);
                        const gajiBersih = gajiKotor - totalPotongan;

                        // Eksekusi Kehadiran
                        await tx.kehadiran.upsert({
                            where: { karyawanId_bulan_tahun: { karyawanId: employee.id, bulan, tahun } },
                            update: { jumlahHadir: jmlHadir },
                            create: { karyawanId: employee.id, bulan, tahun, jumlahHadir: jmlHadir }
                        });

                        // Eksekusi Slip Gaji
                        await tx.slipGaji.upsert({
                            where: { karyawanId_bulan_tahun: { karyawanId: employee.id, bulan, tahun } },
                            update: {
                                gajiKotor, totalPotongan, gajiBersih,
                                detailKomponen: { deleteMany: {}, create: komponenDetail }
                            },
                            create: {
                                karyawanId: employee.id, bulan, tahun,
                                gajiKotor, totalPotongan, gajiBersih,
                                detailKomponen: { create: komponenDetail }
                            }
                        });

                        successCount++;
                    }));
                }
            }, {
                // Konfigurasi krusial untuk bulk insert di serverless
                maxWait: 5000,    // Maksimal waktu menunggu koneksi DB (5 detik)
                timeout: 30000    // Maksimal waktu transaksi sebelum dibatalkan (30 detik)
            });
        }
        return {
            success: true,
            totalProcessed: successCount,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    // ── IMPORT HONOR MENGAJAR FUNCTION ───────────────────────────────────────────
    static async importHonorMengajar(buffer: Buffer, bulan: number, tahun: number, namaKomponen: string) {
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rows || rows.length === 0) {
            throw new Error('Format file tidak valid atau data kosong.');
        }

        let headerRowIndex = -1;
        let nikKey = '';
        let honorKey = '';

        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;

            const nikIdx = row.findIndex(cell => cell && cell.toString().toLowerCase().replace(/[\s._-]/g, '') === 'nik');
            if (nikIdx !== -1) {
                const honorIdx = row.findIndex((cell, idx) => {
                    if (!cell || idx === nikIdx) return false;
                    const cleanK = cell.toString().toLowerCase();
                    return cleanK.includes('honor') || cleanK.includes('mengajar') || cleanK.includes('nominal') || cleanK.includes('jumlah');
                });

                if (honorIdx !== -1) {
                    headerRowIndex = r;
                    nikKey = row[nikIdx].toString();
                    honorKey = row[honorIdx].toString();
                    break;
                }
            }
        }

        if (headerRowIndex === -1) {
            throw new Error('Format file tidak valid. Pastikan terdapat kolom NIK dan Honor Mengajar/Nominal.');
        }

        const data: any[] = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex });
        if (!data || data.length === 0) {
            throw new Error('Format file tidak valid atau tidak ada data.');
        }

        const errors: string[] = [];
        const updateDataArray: {
            slipId: number;
            gajiKotor: number;
            totalPotongan: number;
            gajiBersih: number;
            newDetails: any[];
        }[] = [];

        const rawNiks = data.map(row => row[nikKey]?.toString().trim()).filter(Boolean);
        const niks = Array.from(new Set(rawNiks));

        if (niks.length === 0) {
            throw new Error('Tidak ada data NIK yang valid dalam file.');
        }

        const employees = await prisma.karyawan.findMany({
            where: { nik: { in: niks } },
            select: { id: true, nik: true, nama: true }
        });
        const empMap = new Map(employees.map(e => [e.nik, e]));

        const existingSlips = await prisma.slipGaji.findMany({
            where: {
                karyawanId: { in: employees.map(e => e.id) },
                bulan,
                tahun,
                deletedAt: null
            },
            include: { detailKomponen: true }
        });
        const slipMap = new Map(existingSlips.map(s => [s.karyawanId, s]));

        const namaKomponenLower = namaKomponen.trim().toLowerCase();

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rawNik = row[nikKey]?.toString().trim();
            const rawHonor = row[honorKey];

            if (!rawNik && (rawHonor === undefined || rawHonor === null || rawHonor === '')) continue;

            if (!rawNik) {
                errors.push(`Baris ${i + headerRowIndex + 2}: NIK kosong.`);
                continue;
            }

            const employee = empMap.get(rawNik);
            if (!employee) {
                errors.push(`Baris ${i + headerRowIndex + 2}: Karyawan dengan NIK "${rawNik}" tidak ditemukan di database.`);
                continue;
            }

            const honorAmount = Number(rawHonor);
            if (isNaN(honorAmount) || honorAmount < 0) {
                errors.push(`Baris ${i + headerRowIndex + 2} (${employee.nama}): Nominal honor tidak valid.`);
                continue;
            }

            const slip = slipMap.get(employee.id);
            if (!slip) {
                errors.push(`Baris ${i + headerRowIndex + 2} (${employee.nama}): Slip Gaji belum digenerate untuk periode ${bulan}/${tahun}.`);
                continue;
            }

            const oldDetails = slip.detailKomponen.map(d => ({
                nama: d.nama,
                jenis: d.jenis,
                kategori: d.kategori,
                jumlah: d.jumlah
            }));

            // Filter out komponen dengan nama yang sama (replace, bukan akumulasi)
            const otherDetails = oldDetails.filter(d => d.nama.trim().toLowerCase() !== namaKomponenLower);

            // Tambahkan sebagai komponen baru dengan nama dinamis dari user
            otherDetails.push({
                nama: namaKomponen.trim(),
                jenis: 'TUNJANGAN',
                kategori: 'LAINNYA',
                jumlah: honorAmount
            });

            const gajiKotor = otherDetails
                .filter(d => d.jenis === 'TUNJANGAN')
                .reduce((sum, d) => sum + d.jumlah, 0);

            const totalPotongan = otherDetails
                .filter(d => d.jenis === 'POTONGAN')
                .reduce((sum, d) => sum + d.jumlah, 0);

            const gajiBersih = gajiKotor - totalPotongan;

            updateDataArray.push({
                slipId: slip.id,
                gajiKotor,
                totalPotongan,
                gajiBersih,
                newDetails: otherDetails
            });
        }

        let successCount = 0;
        if (updateDataArray.length > 0) {
            await prisma.$transaction(async (tx) => {
                const CHUNK_SIZE = 50;
                for (let i = 0; i < updateDataArray.length; i += CHUNK_SIZE) {
                    const chunk = updateDataArray.slice(i, i + CHUNK_SIZE);
                    await Promise.all(chunk.map(async (updateItem) => {
                        const { slipId, gajiKotor, totalPotongan, gajiBersih, newDetails } = updateItem;

                        await tx.detailSlipGaji.deleteMany({ where: { slipGajiId: slipId } });

                        await tx.detailSlipGaji.createMany({
                            data: newDetails.map(d => ({
                                slipGajiId: slipId,
                                nama: d.nama,
                                jenis: d.jenis,
                                kategori: d.kategori,
                                jumlah: d.jumlah
                            }))
                        });

                        await tx.slipGaji.update({
                            where: { id: slipId },
                            data: { gajiKotor, totalPotongan, gajiBersih }
                        });

                        successCount++;
                    }));
                }
            }, { maxWait: 5000, timeout: 30000 });
        }

        return {
            success: true,
            totalProcessed: successCount,
            errors: errors.length > 0 ? errors : undefined
        };
    }
}