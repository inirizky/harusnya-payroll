import PDFDocument from 'pdfkit';
import { Stream } from 'stream';

export class PDFGenerator {
    static generateSlipGaji(data: any): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                margin: 0,
                size: 'A4'
            });
            const buffers: Buffer[] = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // --- Configuration & Colors ---
            const colors = {
                primary: '#1A365D',    // Deep Blue
                secondary: '#2C5282',  // Medium Blue
                teal: '#319795',       // Cyan/Teal
                income: '#2F855A',     // Green
                expense: '#C53030',    // Red
                bgLight: '#F7FAFC',    // Near White
                textDark: '#2D3748',
                textLight: '#718096',
                white: '#FFFFFF'
            };

            const marginX = 40;
            const contentWidth = 515;

            // --- Header Block ---
            doc.rect(0, 0, 612, 140).fill(colors.primary);

            // Circular Logo Placeholder (UNI)
            doc.circle(80, 70, 35).fill(colors.teal);
            doc.fillColor(colors.white).fontSize(20).font('Helvetica-Bold').text('UNI', 55, 62, { width: 50, align: 'center' });

            // Title Info
            doc.fillColor(colors.white).fontSize(18).text('UNIVERSITAS LAMPUNG', 130, 50);
            doc.fontSize(10).font('Helvetica').text('Biro Keuangan & Sumber Daya Manusia', 130, 75);
            doc.fontSize(9).text('Bandar Lampung, ' + new Date(data.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), 130, 95);

            // Right Header Box (SLIP GAJI)
            doc.roundedRect(420, 30, 150, 80, 8).fill(colors.secondary);
            doc.fillColor(colors.white).fontSize(14).font('Helvetica-Bold').text('SLIP GAJI', 420, 50, { width: 150, align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Periode: ${data.bulan}/${data.tahun}`, 420, 75, { width: 150, align: 'center' });

            // --- Employee Info Box ---
            let currentY = 160;
            doc.roundedRect(marginX, currentY, contentWidth, 110, 5).strokeColor('#E2E8F0').stroke();

            doc.fillColor(colors.textLight).fontSize(9).font('Helvetica');
            // Left Column
            doc.text('NIK', marginX + 20, currentY + 15);
            doc.text('Nama', marginX + 20, currentY + 35);
            doc.text('Hari Bekerja', marginX + 20, currentY + 55);
            doc.text('Tarif Makan/Hari', marginX + 20, currentY + 75);
            doc.text('Tarif Transp/Hari', marginX + 20, currentY + 95);

            doc.fillColor(colors.textDark).font('Helvetica-Bold');
            doc.text(data.karyawan.nik, marginX + 110, currentY + 15);
            doc.text(data.karyawan.nama, marginX + 110, currentY + 35);
            const jmlHadir = data.tunjanganMakan / data.karyawan.tarifMakan || 0;
            doc.text(`${jmlHadir} Hari`, marginX + 110, currentY + 55);
            doc.text(`Rp ${data.karyawan.tarifMakan.toLocaleString()}`, marginX + 110, currentY + 75);
            doc.text(`Rp ${data.karyawan.tarifTransport.toLocaleString()}`, marginX + 110, currentY + 95);

            // Right Column
            doc.fillColor(colors.textLight).font('Helvetica');
            doc.text('Golongan', marginX + 280, currentY + 15);
            doc.text('Jabatan', marginX + 280, currentY + 35);
            doc.text('Jab. Akademik', marginX + 280, currentY + 55);
            doc.text('Status', marginX + 280, currentY + 75);

            doc.fillColor(colors.textDark).font('Helvetica-Bold');
            doc.text(data.karyawan.golongan.nama, marginX + 370, currentY + 15);
            doc.text(data.karyawan.jabatan.nama, marginX + 370, currentY + 35);
            doc.text('-', marginX + 370, currentY + 55); // Placeholder for Jabatan Akademik
            doc.text('TETAP', marginX + 370, currentY + 75);

            // --- Income vs Deduction Columns ---
            currentY += 130;
            const colWidth = 250;
            const incomeYStart = currentY;

            // Income Header
            doc.rect(marginX, currentY, colWidth, 25).fill(colors.income);
            doc.fillColor(colors.white).fontSize(10).font('Helvetica-Bold').text('PENDAPATAN', marginX + 10, currentY + 8);

            currentY += 25;
            const renderItem = (y: number, label: string, value: number) => {
                doc.rect(marginX, y, colWidth, 20).fill(y % 40 === 0 ? colors.bgLight : colors.white);
                doc.fillColor(colors.textDark).fontSize(9).font('Helvetica').text(label, marginX + 10, y + 6);
                doc.font('Helvetica-Bold').text(`Rp ${value.toLocaleString()}`, marginX + 10, y + 6, { width: colWidth - 20, align: 'right' });
                return y + 20;
            };

            let incomeY = currentY;
            incomeY = renderItem(incomeY, 'Gaji Pokok', data.gajiPokok);
            incomeY = renderItem(incomeY, 'Tunjangan Golongan', data.tunjanganGolongan);
            incomeY = renderItem(incomeY, 'Total Tunj. Makan', data.tunjanganMakan);
            incomeY = renderItem(incomeY, 'Total Tunj. Transport', data.tunjanganTransport);

            // Group: TETAP
            const incomeTetap = data.detailKomponen.filter((d: any) => d.jenis === 'TUNJANGAN' && d.kategori === 'TETAP');
            incomeTetap.forEach((d: any) => {
                incomeY = renderItem(incomeY, d.nama, d.jumlah);
            });

            // Deductions Column (Start rendering to calculate deductY)
            let deductY = incomeYStart;
            const deductX = marginX + colWidth + 15;
            doc.rect(deductX, deductY, colWidth, 25).fill(colors.expense);
            doc.fillColor(colors.white).fontSize(10).font('Helvetica-Bold').text('POTONGAN', deductX + 10, deductY + 8);

            deductY += 25;
            const renderDeduct = (y: number, label: string, value: number) => {
                doc.rect(deductX, y, colWidth, 20).fill(y % 40 === 0 ? colors.bgLight : colors.white);
                doc.fillColor(colors.textDark).fontSize(9).font('Helvetica').text(label, deductX + 10, y + 6);
                doc.font('Helvetica-Bold').text(`Rp ${value.toLocaleString()}`, deductX + 10, y + 6, { width: colWidth - 20, align: 'right' });
                return y + 20;
            };

            // Group: TETAP
            const deductTetap = data.detailKomponen.filter((d: any) => d.jenis === 'POTONGAN' && d.kategori === 'TETAP');
            deductTetap.forEach((d: any) => {
                deductY = renderDeduct(deductY, d.nama, d.jumlah);
            });

            // --- SYNC POINT: Align "LAINNYA" sections ---
            const maxYForLainnya = Math.max(incomeY, deductY) + 5;
            incomeY = maxYForLainnya;
            deductY = maxYForLainnya;

            // Render Income LAINNYA
            const incomeLain = data.detailKomponen.filter((d: any) => d.jenis === 'TUNJANGAN' && d.kategori === 'LAINNYA');
            if (incomeLain.length > 0) {
                doc.fillColor(colors.textLight).fontSize(7).text('KOMPONEN LAINNYA', marginX + 10, incomeY + 2);
                incomeY += 12;
                incomeLain.forEach((d: any) => {
                    incomeY = renderItem(incomeY, d.nama, d.jumlah);
                });
            }

            // Render Deduction LAINNYA
            const deductLain = data.detailKomponen.filter((d: any) => d.jenis === 'POTONGAN' && d.kategori === 'LAINNYA');
            if (deductLain.length > 0) {
                doc.fillColor(colors.textLight).fontSize(7).text('KOMPONEN LAINNYA', deductX + 10, deductY + 2);
                deductY += 12;
                deductLain.forEach((d: any) => {
                    deductY = renderDeduct(deductY, d.nama, d.jumlah);
                });
            }

            if (data.detailKomponen.filter((d: any) => d.jenis === 'POTONGAN').length === 0 && deductTetap.length === 0) {
                deductY = renderDeduct(deductY, '-', 0);
            }


            // --- Footer Summary ---
            currentY = Math.max(incomeY, deductY) + 10;
            doc.roundedRect(marginX, currentY, contentWidth, 60, 5).strokeColor('#E2E8F0').stroke();

            const cellW = contentWidth / 3;
            doc.fillColor(colors.textLight).fontSize(8).text('PENERIMAAN KOTOR', marginX + 20, currentY + 15);
            doc.fillColor(colors.textDark).fontSize(12).font('Helvetica-Bold').text(`Rp ${data.gajiKotor.toLocaleString()}`, marginX + 20, currentY + 30);

            doc.fillColor(colors.textLight).fontSize(8).text('JUMLAH POTONGAN', marginX + cellW + 20, currentY + 15);
            doc.fillColor(colors.expense).fontSize(12).font('Helvetica-Bold').text(`Rp ${data.totalPotongan.toLocaleString()}`, marginX + cellW + 20, currentY + 30);

            doc.fillColor(colors.textLight).fontSize(8).text('PENERIMAAN BERSIH (THP)', marginX + cellW * 2 + 20, currentY + 15);
            doc.fillColor(colors.income).fontSize(14).font('Helvetica-Bold').text(`Rp ${data.gajiBersih.toLocaleString()}`, marginX + cellW * 2 + 20, currentY + 30);

            // --- Signatures ---
            currentY += 100;
            doc.fillColor(colors.textDark).fontSize(10).font('Helvetica');
            doc.text('Mengetahui,', marginX, currentY);
            doc.text('Hormat kami,', marginX + 350, currentY);

            currentY += 60;
            doc.font('Helvetica-Bold').text('Kepala Biro SDM', marginX, currentY);
            doc.text('Bagian Keuangan', marginX + 350, currentY);

            doc.end();
        });
    }
}
