import prisma from '../configs/database.js';
import * as xlsx from 'xlsx';

// NOTE: xlsx (SheetJS) Community Edition mendukung cell styling hanya via
// format string (numFmt). Untuk fill/font/border penuh, gunakan paket
// `xlsx-style` atau `@zurb/xlsx-style`, atau switch ke ExcelJS.
// Kode ini menggunakan xlsx murni + workaround via `!cols`, `!rows`, `!merges`.

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
const RP_FMT  = '"Rp"* #,##0;[Red]"Rp"* -#,##0;"-"';
const INT_FMT = '#,##0;-#,##0;"-"';

// ── Style builders (kompatibel xlsx-style) ───────────────────────────────────
type XlsxStyle = {
    font?:      Record<string, unknown>;
    fill?:      Record<string, unknown>;
    alignment?: Record<string, unknown>;
    border?:    Record<string, unknown>;
    numFmt?:    string;
};

const THIN   = { style: 'thin',   color: { rgb: 'D0D0D0' } };
const MEDIUM = { style: 'medium', color: { rgb: '2F75B6' } };
const HAIR   = { style: 'hair',   color: { rgb: 'E0E0E0' } };

function styleGroupHeader(bgRgb: string): XlsxStyle {
    return {
        font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 9, name: 'Arial' },
        fill:      { patternType: 'solid', fgColor: { rgb: bgRgb } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border:    { left: THIN, right: THIN, bottom: THIN },
    };
}

function styleSubHeader(): XlsxStyle {
    return {
        font:      { bold: true, sz: 9, name: 'Arial', color: { rgb: '1F3864' } },
        fill:      { patternType: 'solid', fgColor: { rgb: 'D9E1F2' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border:    { top: THIN, bottom: MEDIUM, left: THIN, right: THIN },
    };
}

function styleData(bgRgb: string, hAlign = 'left'): XlsxStyle {
    return {
        font:      { sz: 9, name: 'Arial' },
        fill:      { patternType: 'solid', fgColor: { rgb: bgRgb } },
        alignment: { horizontal: hAlign, vertical: 'center' },
        border:    { top: HAIR, bottom: HAIR, left: HAIR, right: HAIR },
    };
}

function styleGrandTotal(): XlsxStyle {
    return {
        font:      { bold: true, sz: 9, name: 'Arial', color: { rgb: 'FFFFFF' } },
        fill:      { patternType: 'solid', fgColor: { rgb: '1F3864' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border:    { top: MEDIUM, bottom: MEDIUM, left: HAIR, right: HAIR },
    };
}

// ── Cell builder ─────────────────────────────────────────────────────────────
function cell(
    value: string | number | { f: string },
    style: XlsxStyle,
    numFmt?: string,
): xlsx.CellObject {
    const isFormula = typeof value === 'object' && 'f' in value;
    const c: xlsx.CellObject = isFormula
        ? { t: 'n', f: (value as { f: string }).f }
        : typeof value === 'number'
            ? { t: 'n', v: value }
            : { t: 's', v: value as string };

    if (numFmt) c.z = numFmt;
    // xlsx-style reads `s` property for styles
    (c as any).s = style;
    return c;
}

export class PayrollExcelService {
    // ── Main export function ──────────────────────────────────────────────────────
    static async exportToExcel(bulan: number, tahun: number): Promise<Buffer> {
        const BULAN_NAMES = ['','Januari','Februari','Maret','April','Mei','Juni',
                             'Juli','Agustus','September','Oktober','November','Desember'];

        // 1. Fetch employees
        const employees = await prisma.karyawan.findMany({
            include: {
                golongan:        true,
                jabatan:         true,
                komponenTetap:   true,
                komponenTambahan: { where: { bulan, tahun } },
                kehadiran:        { where: { bulan, tahun } },
            },
            orderBy: { nik: 'asc' },
        });

        // 2. Collect unique component names
        const fixedCompNames = Array.from(new Set(
            employees.flatMap(e => e.komponenTetap.map(kt => kt.nama))
        ));
        const addCompNames = Array.from(new Set(
            employees.flatMap(e => e.komponenTambahan.map(ka => ka.nama))
        ));

        // 3. Column indices (1-based)
        const C = {
            NO:        1,
            NIK:       2,
            NAMA:      3,
            JABATAN:   4,
            GOLONGAN:  5,
            HADIR:     6,
            GAJI_PKK:  7,
            TUNJ_GOL:  8,
            TUNJ_MKN:  9,
            TUNJ_TRP:  10,
            FIX_START: 11,
            FIX_END:   10 + fixedCompNames.length,
            ADD_START: 11 + fixedCompNames.length,
            ADD_END:   10 + fixedCompNames.length + addCompNames.length,
        } as const;

        const C_BRUTO   = C.ADD_END + 1;
        const C_POTONG  = C.ADD_END + 2;
        const C_BERSIH  = C.ADD_END + 3;
        const C_CATATAN = C.ADD_END + 4;
        const TOTAL_COLS = C_CATATAN;

        // 4. Build worksheet as object
        const ws: Record<string, xlsx.CellObject> = {};

        const setCell = (row: number, col: number, c: xlsx.CellObject) => {
            ws[`${colLetter(col)}${row}`] = c;
        };

        // ── ROW 1: Title ──────────────────────────────────────────────────────────
        setCell(1, 1, cell(
            `DAFTAR GAJI KARYAWAN — ${BULAN_NAMES[bulan].toUpperCase()} ${tahun}`,
            {
                font:      { bold: true, sz: 14, name: 'Arial', color: { rgb: '1F3864' } },
                fill:      { patternType: 'solid', fgColor: { rgb: 'EBF3FB' } },
                alignment: { horizontal: 'center', vertical: 'center' },
                border:    { bottom: MEDIUM },
            }
        ));

        // ── ROW 2: Group Headers ──────────────────────────────────────────────────
        const groups: [string, number, number, string][] = [
            ['Identitas Karyawan',        C.NO,        C.GOLONGAN,  '1F3864'],
            ['Komponen Pokok & Absensi',  C.HADIR,     C.TUNJ_TRP,  '2E75B6'],
            ['Komponen Tetap',            C.FIX_START, C.FIX_END,   '375623'],
            ['Komponen Tambahan (Admin)', C.ADD_START, C.ADD_END,   '7030A0'],
            ['Total Gaji Kotor',          C_BRUTO,     C_BRUTO,     'C55A11'],
            ['Total Potongan',            C_POTONG,    C_POTONG,    'C00000'],
            ['Gaji Bersih',               C_BERSIH,    C_BERSIH,    '375623'],
            ['Catatan',                   C_CATATAN,   C_CATATAN,   '595959'],
        ];
        for (const [label, sc, ec, bg] of groups) {
            if (sc > ec) continue;
            setCell(2, sc, cell(label, styleGroupHeader(bg)));
        }

        // ── ROW 3: Sub-headers ────────────────────────────────────────────────────
        const subHeaders: [number, string][] = [
            [C.NO,        'No'],
            [C.NIK,       'NIK'],
            [C.NAMA,      'Nama Karyawan'],
            [C.JABATAN,   'Jabatan'],
            [C.GOLONGAN,  'Golongan'],
            [C.HADIR,     'Jml Hadir'],
            [C.GAJI_PKK,  'Gaji Pokok'],
            [C.TUNJ_GOL,  'Tunj. Golongan'],
            [C.TUNJ_MKN,  'Tunj. Makan'],
            [C.TUNJ_TRP,  'Tunj. Transport'],
            ...fixedCompNames.map((n, i): [number, string] => [C.FIX_START + i, n]),
            ...addCompNames.map((n, i):   [number, string] => [C.ADD_START + i, n]),
            [C_BRUTO,    'Total Gaji Kotor'],
            [C_POTONG,   'Total Potongan'],
            [C_BERSIH,   'Gaji Bersih'],
            [C_CATATAN,  'Catatan'],
        ];
        for (const [col, label] of subHeaders) {
            setCell(3, col, cell(label, styleSubHeader()));
        }

        // ── Data Rows ─────────────────────────────────────────────────────────────
        const DATA_START = 4;

        employees.forEach((emp, idx) => {
            const r         = DATA_START + idx;
            const rowBg     = idx % 2 === 0 ? 'FFFFFF' : 'F2F7FF';
            const attendance = emp.kehadiran[0]?.jumlahHadir ?? 0;
            const tunjanganMakan     = emp.tarifMakan    * attendance;
            const tunjanganTransport = emp.tarifTransport * attendance;

            const dataNum  = (col: number, val: number, fmt: string, bg = rowBg) =>
                setCell(r, col, { ...cell(val, styleData(bg, 'right'), fmt) });
            const dataStr  = (col: number, val: string, hAlign = 'left') =>
                setCell(r, col, cell(val, styleData(rowBg, hAlign)));
            const dataFormula = (col: number, formula: string, fmt: string, fontColor: string, bg: string) => {
                const c = cell({ f: formula }, {
                    font:      { bold: true, sz: 9, name: 'Arial', color: { rgb: fontColor } },
                    fill:      { patternType: 'solid', fgColor: { rgb: bg } },
                    alignment: { horizontal: 'right', vertical: 'center' },
                    border:    { top: HAIR, bottom: HAIR, left: HAIR, right: HAIR },
                }, fmt);
                setCell(r, col, c);
            };

            dataStr(C.NO,        String(idx + 1), 'center');
            dataStr(C.NIK,       emp.nik,         'center');
            dataStr(C.NAMA,      emp.nama);
            dataStr(C.JABATAN,   emp.jabatan.nama);
            dataStr(C.GOLONGAN,  emp.golongan.nama,'center');
            dataNum(C.HADIR,     attendance,        INT_FMT);
            dataNum(C.GAJI_PKK,  emp.gajiPokok,     RP_FMT);
            dataNum(C.TUNJ_GOL,  emp.golongan.tunjanganGolongan, RP_FMT);
            dataNum(C.TUNJ_MKN,  tunjanganMakan,    RP_FMT);
            dataNum(C.TUNJ_TRP,  tunjanganTransport,RP_FMT);

            // Komponen Tetap
            fixedCompNames.forEach((name, i) => {
                const comp = emp.komponenTetap.find(kt => kt.nama === name);
                const val  = comp ? (comp.jenis === 'POTONGAN' ? -Math.abs(comp.jumlah) : comp.jumlah) : 0;
                dataNum(C.FIX_START + i, val, RP_FMT);
            });

            // Komponen Tambahan (Admin)
            addCompNames.forEach((name, i) => {
                const comp = emp.komponenTambahan.find(ka => ka.nama === name);
                const val  = comp ? (comp.jenis === 'POTONGAN' ? -Math.abs(comp.jumlah) : comp.jumlah) : 0;
                dataNum(C.ADD_START + i, val, RP_FMT);
            });

            // ── Formulas ──────────────────────────────────────────────────────────
            const firstCurr = colLetter(C.GAJI_PKK);
            const lastComp  = colLetter(C.ADD_END);
            const bgBruto   = idx % 2 === 0 ? 'FFF2CC' : 'FFE89A';
            const bgPotong  = idx % 2 === 0 ? 'FCE4D6' : 'F4B9A7';
            const bgBersih  = idx % 2 === 0 ? 'E2EFDA' : 'C6EFCE';

            dataFormula(C_BRUTO,
                `SUMPRODUCT((${firstCurr}${r}:${lastComp}${r}>0)*${firstCurr}${r}:${lastComp}${r})`,
                RP_FMT, '7F3F00', bgBruto
            );
            dataFormula(C_POTONG,
                `ABS(SUMPRODUCT((${firstCurr}${r}:${lastComp}${r}<0)*${firstCurr}${r}:${lastComp}${r}))`,
                RP_FMT, 'C00000', bgPotong
            );
            dataFormula(C_BERSIH,
                `${colLetter(C_BRUTO)}${r}-${colLetter(C_POTONG)}${r}`,
                RP_FMT, '375623', bgBersih
            );

            setCell(r, C_CATATAN, cell('', styleData(rowBg)));
        });

        // ── Grand Total Row ───────────────────────────────────────────────────────
        const totalRow = DATA_START + employees.length;

        setCell(totalRow, C.NO, cell('TOTAL', {
            font:      { bold: true, sz: 10, name: 'Arial', color: { rgb: 'FFFFFF' } },
            fill:      { patternType: 'solid', fgColor: { rgb: '1F3864' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border:    { top: MEDIUM, bottom: MEDIUM },
        }));

        for (let col = C.HADIR; col <= C_BERSIH; col++) {
            const ltr = colLetter(col);
            setCell(totalRow, col, {
                ...cell(
                    { f: `SUM(${ltr}${DATA_START}:${ltr}${totalRow - 1})` },
                    styleGrandTotal(),
                    col === C.HADIR ? INT_FMT : RP_FMT,
                ),
            });
        }
        setCell(totalRow, C_CATATAN, cell('', {
            fill:  { patternType: 'solid', fgColor: { rgb: '1F3864' } },
            border: { top: MEDIUM, bottom: MEDIUM },
        }));

        // ── Merges ────────────────────────────────────────────────────────────────
        const merges: xlsx.Range[] = [
            // Row 1 — title
            { s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS - 1 } },
            // Row 2 — group headers
            ...groups
                .filter(([, sc, ec]) => sc <= ec)
                .map(([, sc, ec]): xlsx.Range => ({
                    s: { r: 1, c: sc - 1 },
                    e: { r: 1, c: ec - 1 },
                })),
            // Grand total — identity merge
            { s: { r: totalRow - 1, c: 0 }, e: { r: totalRow - 1, c: C.GOLONGAN - 1 } },
        ];
        ws['!merges'] = merges;

        // ── Column Widths ─────────────────────────────────────────────────────────
        const colWidths: number[] = [];
        colWidths[C.NO - 1]       = 5;
        colWidths[C.NIK - 1]      = 14;
        colWidths[C.NAMA - 1]     = 26;
        colWidths[C.JABATAN - 1]  = 20;
        colWidths[C.GOLONGAN - 1] = 13;
        colWidths[C.HADIR - 1]    = 9;
        for (let c = C.GAJI_PKK; c <= TOTAL_COLS; c++) colWidths[c - 1] = 18;
        colWidths[C_CATATAN - 1] = 22;
        ws['!cols'] = colWidths.map(w => ({ wch: w }));

        // ── Row Heights ───────────────────────────────────────────────────────────
        ws['!rows'] = [
            { hpt: 30 },   // row 1: title
            { hpt: 20 },   // row 2: group headers
            { hpt: 38 },   // row 3: sub headers
            ...Array(employees.length).fill({ hpt: 18 }),
            { hpt: 22 },   // grand total
        ];

        // ── Freeze Pane ───────────────────────────────────────────────────────────
        // Note: Gunakan '!views' untuk versi standard xlsx
        ws['!views'] = [{ state: 'frozen', xSplit: C.GOLONGAN, ySplit: 3 }];
        ws['!freeze'] = { xSplit: C.GOLONGAN, ySplit: 3 }; // Dipertahankan untuk fallback library khusus

        // ── Autofilter ────────────────────────────────────────────────────────────
        ws['!autofilter'] = { ref: `A3:${colLetter(TOTAL_COLS)}3` };

        // ── Sheet range ───────────────────────────────────────────────────────────
        ws['!ref'] = `A1:${colLetter(TOTAL_COLS)}${totalRow}`;

        // ── Build Workbook ────────────────────────────────────────────────────────
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Penggajian');

        // Use xlsx-style for full styling, or xlsx for basic output
        const buffer = xlsx.write(wb, {
            type:      'buffer',
            bookType:  'xlsx',
            bookSST:   false,
            cellStyles: true, // required by xlsx-style
        });

        return buffer;
    }

    /**
     * IMPORT: Smart Parsing tanpa Prefix dan Bulk Transaction
     */
    static async importFromExcel(buffer: Buffer, bulan: number, tahun: number) {
        const wb = xlsx.read(buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]; 

        if (data.length < 4) throw new Error('Format Excel tidak valid: Data terlalu sedikit.');

        // 1. Mencari baris header aktual (Baris ke-3 berdasarkan template export)
        const headerRowIndex = data.findIndex(row => row.includes('NIK'));
        if (headerRowIndex === -1) throw new Error('Format Excel tidak valid: Kolom "NIK" tidak ditemukan.');
        
        const headers = data[headerRowIndex].map(h => h?.toString().trim());
        const nikIdx = headers.indexOf('NIK');
        const hadirIdx = headers.indexOf('Jml Hadir');

        // Abaikan kolom-kolom standar dari template agar hanya komponen yang diproses
        const standardColumns = [
            'No', 'NIK', 'Nama Karyawan', 'Jabatan', 'Golongan', 
            'Jml Hadir', 'Gaji Pokok', 'Tunj. Golongan', 'Tunj. Makan', 'Tunj. Transport', 
            'Total Gaji Kotor', 'Total Potongan', 'Gaji Bersih', 'Catatan'
        ];

        // 2. Ambil semua NIK unik dari Excel (Skip baris "TOTAL" di bawah)
        const rowsToProcess = data.slice(headerRowIndex + 1).filter(r => {
            const nikVal = r[nikIdx]?.toString().trim();
            const noVal = r[0]?.toString().trim(); // Kolom "No" biasanya berisi "TOTAL"
            return nikVal && nikVal !== '' && noVal !== 'TOTAL';
        });

        const importedNiks = rowsToProcess.map(r => r[nikIdx].toString().trim());
        
        // 3. FETCH SEKALI SAJA (Optimasi Kinerja N+1)
        const employees = await prisma.karyawan.findMany({
            where: { nik: { in: importedNiks } },
            include: { komponenTetap: true, golongan: true }
        });
        const empMap = new Map(employees.map(e => [e.nik, e])); 

        const dbOperations: any[] = []; 
        let successCount = 0;
        const errors: string[] = [];

        // 4. Iterasi Data dan Kalkulasi Slip Gaji
        for (let i = 0; i < rowsToProcess.length; i++) {
            const row = rowsToProcess[i];
            const nik = row[nikIdx].toString().trim();
            const employee = empMap.get(nik);

            if (!employee) {
                // (i + headerRowIndex + 2) digunakan untuk mendapatkan baris akurat di Excel
                errors.push(`Baris ${i + headerRowIndex + 2}: NIK ${nik} tidak terdaftar di database.`);
                continue;
            }

            const jmlHadir = hadirIdx !== -1 ? Number(row[hadirIdx]) || 0 : 0;
            const komponenDetail: any[] = [];

            // A. Sinkronisasi Komponen Dasar Utama
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
                
                const val = Number(rawValue);
                if (isNaN(val) || val === 0) return; // Abaikan jika bukan angka / nol

                const dbComp = masterCompMap.get(headerName.toLowerCase());

                if (dbComp) {
                    // Komponen ditemukan di master tetap
                    komponenDetail.push({
                        nama: headerName,
                        jenis: dbComp.jenis,
                        kategori: 'TETAP',
                        jumlah: Math.abs(val)
                    });
                } else {
                    // C. SMART PARSING KOMPONEN TAMBAHAN
                    // Jika nilai minus ATAU nama header mengindikasikan potongan
                    const isPotongan = val < 0 || /potongan|denda|kasbon|pinjaman|absen/i.test(headerName);
                    
                    komponenDetail.push({
                        nama: headerName,
                        jenis: isPotongan ? 'POTONGAN' : 'TUNJANGAN',
                        kategori: 'LAINNYA', 
                        jumlah: Math.abs(val) // Database selalu simpan angka absolut
                    });
                }
            });

            // D. Kalkulasi Total
            const gajiKotor = komponenDetail.filter(d => d.jenis === 'TUNJANGAN').reduce((sum, d) => sum + d.jumlah, 0);
            const totalPotongan = komponenDetail.filter(d => d.jenis === 'POTONGAN').reduce((sum, d) => sum + d.jumlah, 0);
            const gajiBersih = gajiKotor - totalPotongan;

            // E. Daftarkan query ke antrian (Transaction Mode)
            dbOperations.push(prisma.kehadiran.upsert({
                where: { karyawanId_bulan_tahun: { karyawanId: employee.id, bulan, tahun } },
                update: { jumlahHadir: jmlHadir },
                create: { karyawanId: employee.id, bulan, tahun, jumlahHadir: jmlHadir }
            }));

            dbOperations.push(prisma.slipGaji.upsert({
                where: { karyawanId_bulan_tahun: { karyawanId: employee.id, bulan, tahun } },
                update: {
                    gajiKotor, totalPotongan, gajiBersih,
                    detailKomponen: {
                        deleteMany: {}, // Hapus record komponen slip lama di bulan tersebut
                        create: komponenDetail
                    }
                },
                create: {
                    karyawanId: employee.id, bulan, tahun,
                    gajiKotor, totalPotongan, gajiBersih,
                    detailKomponen: { create: komponenDetail }
                }
            }));

            successCount++;
        }

        // 5. Eksekusi semua proses ke Database serentak
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