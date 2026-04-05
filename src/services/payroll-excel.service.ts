import prisma from '../configs/database.js';
import ExcelJS from 'exceljs';

// ── Helper: column index (1-based) → Excel letter ────────────────────────────
function colLetter(n: number): string {
    let letter = '';
    while (n > 0) {
        const mod = (n - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        n = Math.floor((n - 1) / 26);
    }
    return letter;
}

// ── Format constants ─────────────────────────────────────────────────────────
// Mengubah format agar nilai 0 tampil sebagai "Rp 0" (bukan "-")
const RP_FMT = '"Rp"* #,##0;[Red]"Rp"* -#,##0;"Rp"* 0';
const INT_FMT = '#,##0;-#,##0;0';

// ── Styling Helpers ──────────────────────────────────────────────────────────
const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
};

export class PayrollExcelService {
    // ── Main export function ──────────────────────────────────────────────────────
    static async exportToExcel(bulan: number, tahun: number): Promise<Buffer> {
        const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        // 1. Fetch employees
        const employees = await prisma.karyawan.findMany({
            include: {
                golongan: true,
                jabatan: true,
                komponenTetap: true,
                kehadiran: { where: { bulan, tahun } },
            },
            orderBy: { nik: 'asc' },
        });

        // 2. Pisahkan komponen tetap berdasarkan Jenis
        const fixedTunjanganNames = Array.from(new Set(
            employees.flatMap(e => e.komponenTetap.filter(kt => kt.jenis === 'TUNJANGAN').map(kt => kt.nama))
        ));
        const fixedPotonganNames = Array.from(new Set(
            employees.flatMap(e => e.komponenTetap.filter(kt => kt.jenis === 'POTONGAN').map(kt => kt.nama))
        ));

        const addCompNames = ['Bonus Tambahan (Contoh)', 'Potongan/Kasbon (Contoh)'];

        // 3. Column indices (1-based)
        const C = {
            NO: 1,
            NIK: 2,
            NAMA: 3,
            JABATAN: 4,
            GOLONGAN: 5,
            HADIR: 6,
            GAJI_PKK: 7,
            TUNJ_GOL: 8,
            TUNJ_MKN: 9,
            TUNJ_TRP: 10,
            FIX_TUNJ_START: 11,
            FIX_TUNJ_END: 10 + fixedTunjanganNames.length,
            FIX_POT_START: 11 + fixedTunjanganNames.length,
            FIX_POT_END: 10 + fixedTunjanganNames.length + fixedPotonganNames.length,
            ADD_START: 11 + fixedTunjanganNames.length + fixedPotonganNames.length,
            ADD_END: 10 + fixedTunjanganNames.length + fixedPotonganNames.length + addCompNames.length,
        } as const;

        const C_BRUTO = C.ADD_END + 1;
        const C_POTONG = C.ADD_END + 2;
        const C_BERSIH = C.ADD_END + 3;
        const C_CATATAN = C.ADD_END + 4;
        const TOTAL_COLS = C_CATATAN;

        // 4. Initialize ExcelJS Workbook & Worksheet
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Penggajian', {
            views: [{ state: 'frozen', xSplit: 5, ySplit: 3 }] // Freeze pane
        });

        // ── ROW 1: Title ──────────────────────────────────────────────────────────
        const titleCell = ws.getCell(1, 1);
        titleCell.value = `DAFTAR GAJI KARYAWAN — ${BULAN_NAMES[bulan].toUpperCase()} ${tahun}`;
        titleCell.font = { bold: true, size: 14, name: 'Arial', color: { argb: 'FF1F3864' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF3FB' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.mergeCells(1, 1, 1, TOTAL_COLS);

        // ── ROW 2: Group Headers ──────────────────────────────────────────────────
        const groups: [string, number, number, string][] = [
            ['Identitas Karyawan', C.NO, C.GOLONGAN, 'FF1F3864'],
            ['Komponen Pokok & Absensi', C.HADIR, C.TUNJ_TRP, 'FF2E75B6'],
            ['Tunjangan Tetap', C.FIX_TUNJ_START, C.FIX_TUNJ_END, 'FF375623'], // Hijau
            ['Potongan Tetap', C.FIX_POT_START, C.FIX_POT_END, 'FFC0504D'], // Merah
            ['Komponen Tambahan (+ Tunjangan, - Potongan)', C.ADD_START, C.ADD_END, 'FF7030A0'],
            ['Total Gaji Kotor', C_BRUTO, C_BRUTO, 'FFC55A11'],
            ['Total Potongan', C_POTONG, C_POTONG, 'FFC00000'],
            ['Gaji Bersih', C_BERSIH, C_BERSIH, 'FF375623'],
            ['Catatan', C_CATATAN, C_CATATAN, 'FF595959'],
        ];

        for (const [label, sc, ec, bgHex] of groups) {
            if (sc > ec) continue; // Skip jika tidak ada komponen di grup tersebut
            const cell = ws.getCell(2, sc);
            cell.value = label;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9, name: 'Arial' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = borderThin;

            if (sc !== ec) ws.mergeCells(2, sc, 2, ec);
        }

        // ── ROW 3: Sub-headers ────────────────────────────────────────────────────
        const subHeaders: [number, string][] = [
            [C.NO, 'No'],
            [C.NIK, 'NIK'],
            [C.NAMA, 'Nama Karyawan'],
            [C.JABATAN, 'Jabatan'],
            [C.GOLONGAN, 'Golongan'],
            [C.HADIR, 'Jml Hadir'],
            [C.GAJI_PKK, 'Gaji Pokok'],
            [C.TUNJ_GOL, 'Tunj. Golongan'],
            [C.TUNJ_MKN, 'Tunj. Makan'],
            [C.TUNJ_TRP, 'Tunj. Transport'],
            ...fixedTunjanganNames.map((n, i): [number, string] => [C.FIX_TUNJ_START + i, n]),
            ...fixedPotonganNames.map((n, i): [number, string] => [C.FIX_POT_START + i, n]),
            ...addCompNames.map((n, i): [number, string] => [C.ADD_START + i, n]),
            [C_BRUTO, 'Total Gaji Kotor'],
            [C_POTONG, 'Total Potongan'],
            [C_BERSIH, 'Gaji Bersih'],
            [C_CATATAN, 'Catatan'],
        ];

        for (const [col, label] of subHeaders) {
            const cell = ws.getCell(3, col);
            cell.value = label;
            cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF1F3864' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = borderThin;
        }

        // ── Data Rows ─────────────────────────────────────────────────────────────
        const DATA_START = 4;

        employees.forEach((emp, idx) => {
            const r = DATA_START + idx;
            const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF2F7FF'; // Alternate rows
            const attendance = emp.kehadiran[0]?.jumlahHadir ?? 0;
            const tunjanganMakan = emp.tarifMakan * attendance;
            const tunjanganTransport = emp.tarifTransport * attendance;

            const setVal = (col: number, val: any, numFmt?: string, align: 'left' | 'center' | 'right' = 'left', customBg?: string, fontColor?: string) => {
                const cell = ws.getCell(r, col);
                cell.value = val;
                cell.font = { size: 9, name: 'Arial', color: { argb: fontColor || 'FF000000' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: customBg || rowBg } };
                cell.alignment = { horizontal: align, vertical: 'middle' };
                cell.border = borderThin;
                if (numFmt) cell.numFmt = numFmt;
            };

            setVal(C.NO, idx + 1, undefined, 'center');
            setVal(C.NIK, emp.nik, undefined, 'center');
            setVal(C.NAMA, emp.nama);
            setVal(C.JABATAN, emp.jabatan.nama);
            setVal(C.GOLONGAN, emp.golongan.nama, undefined, 'center');

            setVal(C.HADIR, attendance, INT_FMT, 'right');
            setVal(C.GAJI_PKK, emp.gajiPokok, RP_FMT, 'right');
            setVal(C.TUNJ_GOL, emp.golongan.tunjanganGolongan, RP_FMT, 'right');
            setVal(C.TUNJ_MKN, tunjanganMakan, RP_FMT, 'right');
            setVal(C.TUNJ_TRP, tunjanganTransport, RP_FMT, 'right');

            // Tunjangan Tetap
            fixedTunjanganNames.forEach((name, i) => {
                const comp = emp.komponenTetap.find(kt => kt.nama === name);
                if (comp) {
                    // Ada datanya (termasuk jika nilainya 0), format agar tampil "Rp 0"
                    setVal(C.FIX_TUNJ_START + i, comp.jumlah, RP_FMT, 'right');
                } else {
                    // Karyawan tidak memiliki komponen ini, jadikan string "-"
                    setVal(C.FIX_TUNJ_START + i, "-", undefined, 'center');
                }
            });

            // Potongan Tetap
            fixedPotonganNames.forEach((name, i) => {
                const comp = emp.komponenTetap.find(kt => kt.nama === name);
                if (comp) {
                    setVal(C.FIX_POT_START + i, -Math.abs(comp.jumlah), RP_FMT, 'right');
                } else {
                    setVal(C.FIX_POT_START + i, "-", undefined, 'center');
                }
            });

            // Komponen Tambahan Placeholder (Tinggalkan sebagai string "-")
            addCompNames.forEach((name, i) => {
                setVal(C.ADD_START + i, "-", undefined, 'center');
            });

            // ── Formulas (Telah dipisah agar tidak salah hitung) ───────────────────
            const colGajiPokok = colLetter(C.GAJI_PKK);
            const colTunjTrp = colLetter(C.TUNJ_TRP);

            let formulaBruto = `SUM(${colGajiPokok}${r}:${colTunjTrp}${r})`;
            if (fixedTunjanganNames.length > 0) {
                formulaBruto += `+SUM(${colLetter(C.FIX_TUNJ_START)}${r}:${colLetter(C.FIX_TUNJ_END)}${r})`;
            }
            if (addCompNames.length > 0) {
                formulaBruto += `+SUMIF(${colLetter(C.ADD_START)}${r}:${colLetter(C.ADD_END)}${r},">0")`;
            }

            let formulaPotong = ``;
            if (fixedPotonganNames.length > 0) {
                formulaPotong += `ABS(SUM(${colLetter(C.FIX_POT_START)}${r}:${colLetter(C.FIX_POT_END)}${r}))`;
            } else {
                formulaPotong += `0`;
            }
            if (addCompNames.length > 0) {
                formulaPotong += `+ABS(SUMIF(${colLetter(C.ADD_START)}${r}:${colLetter(C.ADD_END)}${r},"<0"))`;
            }

            const bgBruto = idx % 2 === 0 ? 'FFFFF2CC' : 'FFFFE89A';
            const bgPotong = idx % 2 === 0 ? 'FFFCE4D6' : 'FFF4B9A7';
            const bgBersih = idx % 2 === 0 ? 'FFE2EFDA' : 'FFC6EFCE';

            setVal(C_BRUTO, { formula: formulaBruto }, RP_FMT, 'right', bgBruto, 'FF7F3F00');
            setVal(C_POTONG, { formula: formulaPotong }, RP_FMT, 'right', bgPotong, 'FFC00000');
            setVal(C_BERSIH, { formula: `${colLetter(C_BRUTO)}${r}-${colLetter(C_POTONG)}${r}` }, RP_FMT, 'right', bgBersih, 'FF375623');

            setVal(C_CATATAN, '');

            ws.getCell(r, C_BRUTO).font.bold = true;
            ws.getCell(r, C_POTONG).font.bold = true;
            ws.getCell(r, C_BERSIH).font.bold = true;
        });

        // ── Grand Total Row ───────────────────────────────────────────────────────
        const totalRow = DATA_START + employees.length;

        ws.mergeCells(totalRow, C.NO, totalRow, C.ADD_END);
        const totalCell = ws.getCell(totalRow, C.NO);
        totalCell.value = 'TOTAL';
        totalCell.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
        totalCell.alignment = { horizontal: 'right', vertical: 'middle' };
        totalCell.border = borderThin;

        for (let col = C.NO; col <= C.ADD_END; col++) {
            ws.getCell(totalRow, col).border = borderThin;
        }

        const targetCols = [C_BRUTO, C_POTONG, C_BERSIH];
        for (const col of targetCols) {
            const ltr = colLetter(col);
            const cell = ws.getCell(totalRow, col);
            cell.value = { formula: `SUM(${ltr}${DATA_START}:${ltr}${totalRow - 1})` };
            cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.border = borderThin;
            cell.numFmt = RP_FMT;
        }

        const catatanTotalCell = ws.getCell(totalRow, C_CATATAN);
        catatanTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
        catatanTotalCell.border = borderThin;

        // ── Column Widths ─────────────────────────────────────────────────────────
        const colWidths = [];
        colWidths[C.NO - 1] = 6;
        colWidths[C.NIK - 1] = 16;
        colWidths[C.NAMA - 1] = 28;
        colWidths[C.JABATAN - 1] = 22;
        colWidths[C.GOLONGAN - 1] = 15;
        colWidths[C.HADIR - 1] = 11;
        for (let c = C.GAJI_PKK; c <= TOTAL_COLS; c++) colWidths[c - 1] = 20;
        colWidths[C_CATATAN - 1] = 25;

        colWidths.forEach((width, index) => {
            ws.getColumn(index + 1).width = width;
        });

        // ── Row Heights ───────────────────────────────────────────────────────────
        ws.getRow(1).height = 30; // Title
        ws.getRow(2).height = 25; // Group headers
        ws.getRow(3).height = 40; // Sub headers
        ws.getRow(totalRow).height = 25; // Grand total

        // ── Autofilter ────────────────────────────────────────────────────────────
        ws.autoFilter = {
            from: { row: 3, column: 1 },
            to: { row: totalRow - 1, column: TOTAL_COLS }
        };

        // ── Build Workbook ────────────────────────────────────────────────────────
        const buffer = await wb.xlsx.writeBuffer();
        return buffer as Buffer;
    }

    /**
     * IMPORT: Smart Parsing menggunakan ExcelJS
     */
    static async importFromExcel(buffer: Buffer, bulan: number, tahun: number) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.worksheets[0];

        if (!ws || ws.rowCount < 4) throw new Error('Format Excel tidak valid: Data terlalu sedikit.');

        const data: any[][] = [];
        ws.eachRow({ includeEmpty: true }, (row, rowNum) => {
            const rowData: any[] = [];
            row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                let val = cell.value;
                if (val && typeof val === 'object' && 'result' in val) {
                    val = (val as any).result;
                }
                if (val && typeof val === 'object' && 'error' in val) {
                    val = undefined;
                }
                rowData[colNum - 1] = val;
            });
            data[rowNum - 1] = rowData;
        });

        const headerRowIndex = data.findIndex(row => row && row.includes('NIK'));
        if (headerRowIndex === -1) throw new Error('Format Excel tidak valid: Kolom "NIK" tidak ditemukan.');

        const headers = data[headerRowIndex].map(h => h?.toString().trim());
        const nikIdx = headers.indexOf('NIK');
        const hadirIdx = headers.indexOf('Jml Hadir');

        const standardColumns = [
            'No', 'NIK', 'Nama Karyawan', 'Jabatan', 'Golongan',
            'Jml Hadir', 'Gaji Pokok', 'Tunj. Golongan', 'Tunj. Makan', 'Tunj. Transport',
            'Total Gaji Kotor', 'Total Potongan', 'Gaji Bersih', 'Catatan'
        ];

        const rowsToProcess = data.slice(headerRowIndex + 1).filter(r => {
            if (!r) return false;
            const nikVal = r[nikIdx]?.toString().trim();
            const noVal = r[0]?.toString().trim();
            return nikVal && nikVal !== '' && noVal !== 'TOTAL';
        });

        const importedNiks = rowsToProcess.map(r => r[nikIdx].toString().trim());

        const employees = await prisma.karyawan.findMany({
            where: { nik: { in: importedNiks } },
            include: { komponenTetap: true, golongan: true }
        });
        const empMap = new Map(employees.map(e => [e.nik, e]));

        const dbOperations: any[] = [];
        let successCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < rowsToProcess.length; i++) {
            const row = rowsToProcess[i];
            const nik = row[nikIdx].toString().trim();
            const employee = empMap.get(nik);

            if (!employee) {
                errors.push(`Baris ${i + headerRowIndex + 2}: NIK ${nik} tidak terdaftar di database.`);
                continue;
            }

            const jmlHadir = hadirIdx !== -1 ? Number(row[hadirIdx]) || 0 : 0;
            const komponenDetail: any[] = [];

            // A. Sinkronisasi Komponen Dasar Utama dengan Kategori "TETAP"
            komponenDetail.push(
                { nama: 'Gaji Pokok', jenis: 'TUNJANGAN', kategori: 'TETAP', jumlah: employee.gajiPokok },
                { nama: `Tunjangan Golongan (${employee.golongan.nama})`, jenis: 'TUNJANGAN', kategori: 'TETAP', jumlah: employee.golongan.tunjanganGolongan },
                { nama: `Tunjangan Makan (${jmlHadir} hari)`, jenis: 'TUNJANGAN', kategori: 'TETAP', jumlah: employee.tarifMakan * jmlHadir },
                { nama: `Tunjangan Transport (${jmlHadir} hari)`, jenis: 'TUNJANGAN', kategori: 'TETAP', jumlah: employee.tarifTransport * jmlHadir }
            );

            const masterCompMap = new Map(employee.komponenTetap.map(k => [k.nama.toLowerCase(), k]));

            // B. Iterasi Deteksi Kolom Master & Tambahan
            headers.forEach((headerName, colIdx) => {
                if (!headerName || standardColumns.includes(headerName)) return;

                const rawValue = row[colIdx];
                if (rawValue === '' || rawValue === undefined || rawValue === null) return;

                // Mengizinkan nilai 0 diproses, membuang cell kosong / string "-"
                let val: number;
                if (typeof rawValue === 'number') {
                    val = rawValue;
                } else if (typeof rawValue === 'string') {
                    const cleanStr = rawValue.trim();
                    if (cleanStr === '' || cleanStr === '-') return;
                    val = Number(cleanStr);
                    if (isNaN(val)) return;
                } else {
                    return;
                }

                const dbComp = masterCompMap.get(headerName.toLowerCase());

                if (dbComp) {
                    // Komponen Master Tetap (0 tetap diizinkan agar tampil di slip)
                    komponenDetail.push({
                        nama: headerName,
                        jenis: dbComp.jenis,
                        kategori: 'TETAP',
                        jumlah: Math.abs(val)
                    });
                } else {
                    // Kolom Tambahan Bebas (Abaikan 0 untuk kolom bebas agar tidak nyampah)
                    if (val === 0) return;

                    // SELARAS 100% DENGAN EXCEL: Jika angkanya Positif = Tunjangan, Negatif = Potongan
                    komponenDetail.push({
                        nama: headerName,
                        jenis: val < 0 ? 'POTONGAN' : 'TUNJANGAN',
                        kategori: 'LAINNYA',
                        jumlah: Math.abs(val)
                    });
                }
            });

            const gajiKotor = komponenDetail.filter(d => d.jenis === 'TUNJANGAN').reduce((sum, d) => sum + d.jumlah, 0);
            const totalPotongan = komponenDetail.filter(d => d.jenis === 'POTONGAN').reduce((sum, d) => sum + d.jumlah, 0);
            const gajiBersih = gajiKotor - totalPotongan;

            // Upsert Kehadiran
            dbOperations.push(prisma.kehadiran.upsert({
                where: { karyawanId_bulan_tahun: { karyawanId: employee.id, bulan, tahun } },
                update: { jumlahHadir: jmlHadir },
                create: { karyawanId: employee.id, bulan, tahun, jumlahHadir: jmlHadir }
            }));

            // Upsert Slip Gaji & Detail Komponen
            dbOperations.push(prisma.slipGaji.upsert({
                where: { karyawanId_bulan_tahun: { karyawanId: employee.id, bulan, tahun } },
                update: {
                    gajiKotor,
                    totalPotongan,
                    gajiBersih,
                    detailKomponen: {
                        deleteMany: {},
                        create: komponenDetail
                    }
                },
                create: {
                    karyawanId: employee.id,
                    bulan,
                    tahun,
                    gajiKotor,
                    totalPotongan,
                    gajiBersih,
                    detailKomponen: { create: komponenDetail }
                }
            }));

            successCount++;
        }

        if (dbOperations.length > 0) {
            await prisma.$transaction(dbOperations);
        }

        return {
            success: true,
            totalProcessed: successCount,
            errors: errors.length > 0 ? errors : undefined
        };
    }
}