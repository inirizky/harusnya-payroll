import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PayrollService } from '../services/payroll.service.js';
import { PayrollExcelService } from '../services/payroll-excel.service.js';
import { PayrollGenerateSchema, PayrollUpdateSchema, PayrollExportSchema } from '../types/schemas.js';
import { PDFGenerator } from '../lib/pdf-generator.js';

const payrollRoute = new Hono();

// GET /api/payroll
payrollRoute.get('/', async (c) => {
    const payrolls = await PayrollService.getAll();
    return c.json({
        success: true,
        data: payrolls
    });
});

// GET /api/payroll/export-excel
payrollRoute.get('/export-excel', zValidator('query', PayrollExportSchema), async (c) => {
    const { bulan, tahun } = c.req.valid('query');
    try {
        const buffer = await PayrollExcelService.exportToExcel(bulan, tahun);
        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="payroll-template-${bulan}-${tahun}.xlsx"`
            }
        });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
});

// POST /api/payroll/import-excel
payrollRoute.post('/import-excel', async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body['file'];
        const bulan = Number(body['bulan']);
        const tahun = Number(body['tahun']);

        if (!file || typeof file === 'string') {
            return c.json({ success: false, message: 'Excel file is required' }, 400);
        }

        if (isNaN(bulan) || isNaN(tahun)) {
            return c.json({ success: false, message: 'Invalid month or year' }, 400);
        }

        const buffer = Buffer.from(await (file as File).arrayBuffer());
        const result = await PayrollExcelService.importFromExcel(buffer, bulan, tahun);

        return c.json({
            success: true,
            message: `Berhasil generate ${result.totalProcessed} slip gaji bulan ${bulan}/${tahun}`,
            data: result
        });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
});

// POST /api/payroll/generate
payrollRoute.post('/generate', zValidator('json', PayrollGenerateSchema), async (c) => {
    const data = c.req.valid('json');
    try {
        const payroll = await PayrollService.generate(data);
        return c.json({
            success: true,
            data: payroll
        }, 201);
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
});

// POST /api/payroll/preview
payrollRoute.post('/preview', zValidator('json', PayrollGenerateSchema), async (c) => {
    const data = c.req.valid('json');
    try {
        const preview = await PayrollService.preview(data);
        return c.json({
            success: true,
            data: preview
        });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
});

// GET /api/payroll/:id
payrollRoute.get('/:id', async (c) => {
    const slipId = parseInt(c.req.param('id'));
    const payrollData = await PayrollService.getById(slipId);

    if (!payrollData) {
        return c.json({ success: false, message: 'Payroll record not found' }, 404);
    }

    return c.json({
        success: true,
        data: payrollData
    });
});

// PUT /api/payroll/:id
payrollRoute.put('/:id', zValidator('json', PayrollUpdateSchema), async (c) => {
    const slipId = parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    try {
        const updatedPayroll = await PayrollService.update(slipId, data);
        return c.json({
            success: true,
            message: 'Slip Gaji updated successfully',
            data: updatedPayroll
        });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
});

// GET /api/payroll/download/:slipId
payrollRoute.get('/view/:slipId', async (c) => {
    const slipId = parseInt(c.req.param('slipId'));
    const payrollData = await PayrollService.getById(slipId);

    if (!payrollData) {
        return c.json({ success: false, message: 'Payroll record not found' }, 404);
    }

    const pdfBuffer = await PDFGenerator.generateSlipGaji(payrollData);

    return new Response(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="slip-gaji-${payrollData.karyawan.nik}-${payrollData.bulan}-${payrollData.tahun}.pdf"`
        }
    });
});

export default payrollRoute;
