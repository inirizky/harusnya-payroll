import PDFDocument from 'pdfkit';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

type SlipStatus = 'DRAFT' | 'REVIEW' | 'PENDING' | 'APPROVED' | 'SENT' | 'CONFIRMED' | 'DISPUTED' | 'UNDER_REVIEW' | 'PROCESSED' | 'PAID' | 'REJECTED' | 'CANCELLED';

interface SignatureData {
    kepalaSDM?: Buffer;
    keuangan?: Buffer;
}

interface SlipGajiData {
    status: SlipStatus;
    createdAt: string | Date;
    bulan: number | string;
    tahun: number | string;
    gajiKotor: number;
    totalPotongan: number;
    gajiBersih: number;
    karyawan: {
        nik: string;
        nama: string;
        tarifMakan: number;
        tarifTransport: number;
        golongan: { nama: string };
        jabatan: { nama: string };
    };
    attendance?: { jumlahHadir: number } | null;
    detailKomponen: Array<{
        nama: string;
        jumlah: number;
        jenis: 'TUNJANGAN' | 'POTONGAN';
        kategori: 'TETAP' | 'LAINNYA';
    }>;
    signatures?: SignatureData;
}

// ─────────────────────────────────────────────────────────
// Watermark
// ─────────────────────────────────────────────────────────

const WATERMARK_CONFIG: Record<SlipStatus, string | null> = {
    DRAFT: null, REVIEW: null, PENDING: null, APPROVED: null,
    SENT: null, CONFIRMED: null, DISPUTED: null, UNDER_REVIEW: null,
    PROCESSED: null, PAID: 'LUNAS', REJECTED: null, CANCELLED: null,
};

// ─────────────────────────────────────────────────────────
// Table helper
// Draws all content first, then draws ALL grid lines on top.
// This ensures perfect, unbroken lines with no gaps.
// ─────────────────────────────────────────────────────────

type CellAlign = 'left' | 'right' | 'center';

interface ColDef {
    width: number;
    align?: CellAlign;
}

interface CellDef {
    text: string;
    bold?: boolean;
    fontSize?: number;
    color?: string;
    align?: CellAlign;
}

interface RowDef {
    cells: (string | CellDef)[];
    height?: number;
    bg?: string;
}

function drawTable(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    cols: ColDef[],
    rows: RowDef[],
    opts: {
        borderColor?: string;
        borderWidth?: number;
        defaultFontSize?: number;
        defaultRowHeight?: number;
        paddingX?: number;
        paddingY?: number;
    } = {}
): number {
    const {
        borderColor = '#000000',
        borderWidth = 0.5,
        defaultFontSize = 7.5,
        defaultRowHeight = 17,
        paddingX = 6,
        paddingY = 5,
    } = opts;

    const totalW = cols.reduce((s, c) => s + c.width, 0);

    // ── Pass 1: backgrounds + text ────────────────────────
    let curY = y;
    for (const row of rows) {
        const rh = row.height ?? defaultRowHeight;

        if (row.bg && row.bg !== '#FFFFFF') {
            doc.rect(x, curY, totalW, rh).fill(row.bg);
        }

        let curX = x;
        row.cells.forEach((cell, ci) => {
            const col = cols[ci];
            if (!col) return;

            const c: CellDef = typeof cell === 'string'
                ? { text: cell }
                : cell;

            const fontSize = c.fontSize ?? defaultFontSize;
            const align = c.align ?? col.align ?? 'left';
            const color = c.color ?? '#000000';
            const font = c.bold ? 'Helvetica-Bold' : 'Helvetica';

            doc.font(font)
                .fontSize(fontSize)
                .fillColor(color)
                .text(c.text, curX + paddingX, curY + paddingY, {
                    width: col.width - paddingX * 2,
                    align,
                    lineBreak: false,
                });

            curX += col.width;
        });

        curY += rh;
    }

    const tableBottom = curY;

    // ── Pass 2: draw ALL grid lines on top ────────────────
    // Horizontal lines
    let lineY = y;
    for (const row of rows) {
        doc.moveTo(x, lineY).lineTo(x + totalW, lineY)
            .strokeColor(borderColor).lineWidth(borderWidth).stroke();
        lineY += row.height ?? defaultRowHeight;
    }
    doc.moveTo(x, lineY).lineTo(x + totalW, lineY)
        .strokeColor(borderColor).lineWidth(borderWidth).stroke();

    // Vertical lines
    let lineX = x;
    for (const col of cols) {
        doc.moveTo(lineX, y).lineTo(lineX, tableBottom)
            .strokeColor(borderColor).lineWidth(borderWidth).stroke();
        lineX += col.width;
    }
    doc.moveTo(lineX, y).lineTo(lineX, tableBottom)
        .strokeColor(borderColor).lineWidth(borderWidth).stroke();

    return tableBottom;
}

// ─────────────────────────────────────────────────────────
// Main generator
// ─────────────────────────────────────────────────────────

export class PDFGenerator {
    static generateSlipGaji(data: SlipGajiData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 0, size: 'A4' });
            const buffers: Buffer[] = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const BLACK = '#000000';
            const GRAY = '#444444';
            const HINT = '#888888';
            const BORDER = '#000000';
            const BW = 0.5;

            const PAGE_W = 612;
            const PAGE_H = 841;
            const MX = 40;
            const CW = PAGE_W - MX * 2;

            const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

            // ── Header ─────────────────────────────────────
            doc.fillColor(BLACK).fontSize(13).font('Helvetica-Bold')
                .text('UNIVERSITAS LAMPUNG', MX, 28);
            doc.fillColor(GRAY).fontSize(8).font('Helvetica')
                .text('Biro Keuangan & Sumber Daya Manusia', MX, 44);
            doc.fillColor(HINT).fontSize(7.5).font('Helvetica')
                .text(
                    'Bandar Lampung, ' + new Date(data.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric',
                    }),
                    MX, 56
                );

            doc.fillColor(BLACK).fontSize(11).font('Helvetica-Bold')
                .text('SLIP GAJI', PAGE_W - MX - 130, 28, { width: 130, align: 'right' });
            doc.fillColor(GRAY).fontSize(8).font('Helvetica')
                .text(`Periode: ${data.bulan} / ${data.tahun}`, PAGE_W - MX - 130, 44, {
                    width: 130, align: 'right',
                });

            // ── Divider ────────────────────────────────────
            let y = 74;
            doc.moveTo(MX, y).lineTo(PAGE_W - MX, y)
                .strokeColor(BORDER).lineWidth(BW).stroke();

            // ── Employee Info ──────────────────────────────
            y += 10;
            const INFO_RH = 21;
            const COL2 = CW / 2 - 5;
            const rightX = MX + CW / 2 + 5;

            const infoField = (lx: number, label: string, value: string, iy: number) => {
                doc.fillColor(HINT).fontSize(6.5).font('Helvetica')
                    .text(label.toUpperCase(), lx, iy);
                doc.fillColor(BLACK).fontSize(8).font('Helvetica-Bold')
                    .text(value, lx, iy + 9, { width: COL2 });
            };

            infoField(MX, 'NIK', data.karyawan.nik, y);
            infoField(rightX, 'Golongan', data.karyawan.golongan.nama, y); y += INFO_RH;
            infoField(MX, 'Nama', data.karyawan.nama, y);
            infoField(rightX, 'Jabatan', data.karyawan.jabatan.nama, y); y += INFO_RH;
            infoField(MX, 'Hari Bekerja', `${data.attendance?.jumlahHadir ?? 0} Hari`, y);
            infoField(rightX, 'Jab. Akademik', '-', y); y += INFO_RH;
            infoField(MX, 'Tarif Makan/Hari', rp(data.karyawan.tarifMakan), y);
            infoField(rightX, 'Status', data.status, y); y += INFO_RH;
            infoField(MX, 'Tarif Transp/Hari', rp(data.karyawan.tarifTransport), y);

            y += 20;
            doc.moveTo(MX, y).lineTo(PAGE_W - MX, y)
                .strokeColor(BORDER).lineWidth(BW).stroke();
            y += 10;

            // ── Build table data ───────────────────────────
            //
            // Layout: 4 columns — [label-left | value-left | label-right | value-right]
            // Left half  = PENDAPATAN
            // Right half = POTONGAN

            const HALF = Math.floor(CW / 2);
            const LBL_W = Math.floor(HALF * 0.70);
            const VAL_W = HALF - LBL_W;

            const cols: ColDef[] = [
                { width: LBL_W, align: 'left' },
                { width: VAL_W, align: 'right' },
                { width: LBL_W, align: 'left' },
                { width: VAL_W, align: 'right' },
            ];

            const incomeTetap = data.detailKomponen.filter(d => d.jenis === 'TUNJANGAN' && d.kategori === 'TETAP');
            const incomeLainnya = data.detailKomponen.filter(d => d.jenis === 'TUNJANGAN' && d.kategori === 'LAINNYA');
            const deductTetap = data.detailKomponen.filter(d => d.jenis === 'POTONGAN' && d.kategori === 'TETAP');
            const deductLainnya = data.detailKomponen.filter(d => d.jenis === 'POTONGAN' && d.kategori === 'LAINNYA');

            const rows: RowDef[] = [];

            // Header row
            const hdrCell = (text: string): CellDef => ({
                text, bold: false, fontSize: 8,
            });
            rows.push({
                height: 18,
                cells: [hdrCell('PENDAPATAN'), hdrCell('Jumlah'), hdrCell('POTONGAN'), hdrCell('')],
            });

            // Pair tetap rows side by side
            const maxTetap = Math.max(incomeTetap.length, deductTetap.length);
            for (let i = 0; i < maxTetap; i++) {
                const inc = incomeTetap[i];
                const dec = deductTetap[i];
                rows.push({
                    cells: [
                        inc ? inc.nama : '',
                        inc ? rp(inc.jumlah) : '',
                        dec ? dec.nama : '',
                        dec ? rp(dec.jumlah) : '',
                    ],
                });
            }

            // "Lainnya" sub-header + rows
            const hasLainnya = incomeLainnya.length > 0 || deductLainnya.length > 0;
            if (hasLainnya) {
                const subCell = (text: string): CellDef => ({
                    text, bold: true, fontSize: 7, color: HINT,
                });
                rows.push({
                    height: 15,
                    cells: [
                        subCell(incomeLainnya.length > 0 ? 'Lainnya' : ''),
                        subCell(''),
                        subCell(deductLainnya.length > 0 ? 'Lainnya' : ''),
                        subCell(''),
                    ],
                });
                const maxLainnya = Math.max(incomeLainnya.length, deductLainnya.length);
                for (let i = 0; i < maxLainnya; i++) {
                    const inc = incomeLainnya[i];
                    const dec = deductLainnya[i];
                    rows.push({
                        cells: [
                            inc ? inc.nama : '',
                            inc ? rp(inc.jumlah) : '',
                            dec ? dec.nama : '',
                            dec ? rp(dec.jumlah) : '',
                        ],
                    });
                }
            }

            // No deduction fallback
            if (deductTetap.length === 0 && deductLainnya.length === 0 && maxTetap === 0) {
                rows.push({ cells: ['', '', '-', ''] });
            }

            // Subtotal row
            const totalCell = (text: string): CellDef => ({
                text, bold: true, fontSize: 8,
            });
            rows.push({
                height: 20,
                cells: [
                    totalCell('Penerimaan Kotor'),
                    totalCell(rp(data.gajiKotor)),
                    totalCell('Jumlah Potongan'),
                    totalCell(rp(data.totalPotongan)),
                ],
            });

            // ── Draw table ─────────────────────────────────
            const afterTable = drawTable(doc, MX, y, cols, rows, {
                borderColor: BORDER,
                borderWidth: BW,
                defaultFontSize: 7.5,
                defaultRowHeight: 17,
                paddingX: 6,
                paddingY: 5,
            });

            // ── THP row (full width) ───────────────────────
            //   Drawn as a single merged row manually, then grid on top
            const THP_H = 26;
            const thpY = afterTable;

            // Text
            doc.fillColor(HINT).fontSize(7).font('Helvetica')
                .text('Penerimaan Bersih (THP)', MX + 6, thpY + 5);
            doc.fillColor(BLACK).fontSize(11).font('Helvetica-Bold')
                .text(rp(data.gajiBersih), MX + 6, thpY + 11,
                    { width: CW - 12, align: 'right' });

            // Grid lines (top already drawn by table; draw bottom + sides)
            doc.moveTo(MX, thpY + THP_H).lineTo(MX + CW, thpY + THP_H)
                .strokeColor(BORDER).lineWidth(BW).stroke();
            doc.moveTo(MX, thpY).lineTo(MX, thpY + THP_H)
                .strokeColor(BORDER).lineWidth(BW).stroke();
            doc.moveTo(MX + CW, thpY).lineTo(MX + CW, thpY + THP_H)
                .strokeColor(BORDER).lineWidth(BW).stroke();

            // ── Signatures ─────────────────────────────────
            const thpBottom = thpY + THP_H;
            let sigY = thpBottom + 22;
            const SIG_W = 130;
            const SIG_H = 40;
            const sigLineY = sigY + SIG_H + 4;

            doc.fillColor(HINT).fontSize(7).font('Helvetica').text('Mengetahui,', MX, sigY);
            if (data.signatures?.kepalaSDM) {
                doc.image(data.signatures.kepalaSDM, MX, sigY + 8, {
                    width: SIG_W, height: SIG_H, fit: [SIG_W, SIG_H],
                    align: 'center', valign: 'bottom',
                });
            }
            doc.moveTo(MX, sigLineY).lineTo(MX + SIG_W, sigLineY)
                .strokeColor(BORDER).lineWidth(BW).stroke();
            doc.fillColor(BLACK).fontSize(8).font('Helvetica-Bold')
                .text('Kepala Biro SDM', MX, sigLineY + 4);

            const sigRightX = PAGE_W - MX - SIG_W;
            doc.fillColor(HINT).fontSize(7).font('Helvetica').text('Hormat kami,', sigRightX, sigY);
            if (data.signatures?.keuangan) {
                doc.image(data.signatures.keuangan, sigRightX, sigY + 8, {
                    width: SIG_W, height: SIG_H, fit: [SIG_W, SIG_H],
                    align: 'center', valign: 'bottom',
                });
            }
            doc.moveTo(sigRightX, sigLineY).lineTo(sigRightX + SIG_W, sigLineY)
                .strokeColor(BORDER).lineWidth(BW).stroke();
            doc.fillColor(BLACK).fontSize(8).font('Helvetica-Bold')
                .text('Bagian Keuangan', sigRightX, sigLineY + 4);

            // ── Watermark ──────────────────────────────────
            const wmText = WATERMARK_CONFIG[data.status];
            if (wmText) {
                doc.save();
                doc.translate(PAGE_W / 2, PAGE_H / 2);
                doc.rotate(-45);
                doc.fontSize(80).font('Helvetica-Bold')
                    .fillColor('#000000').fillOpacity(0.07)
                    .text(wmText, -200, -40, { width: 400, align: 'center', lineBreak: false });
                doc.rect(-210, -55, 420, 90)
                    .strokeColor('#000000').strokeOpacity(0.08).lineWidth(0.5).stroke();
                doc.restore();
                doc.fillOpacity(1).strokeOpacity(1);
            }

            doc.end();
        });
    }
}