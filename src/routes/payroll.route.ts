import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PayrollService } from '../services/payroll.service.js';
import { PayrollGenerateSchema } from '../types/schemas.js';
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

// GET /api/payroll/download/:slipId
payrollRoute.get('/download/:slipId', async (c) => {
    const slipId = parseInt(c.req.param('slipId'));
    const payrollData = await PayrollService.getById(slipId);

    if (!payrollData) {
        return c.json({ success: false, message: 'Payroll record not found' }, 404);
    }

    const pdfBuffer = await PDFGenerator.generateSlipGaji(payrollData);

    return new Response(pdfBuffer, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="slip-gaji-${payrollData.karyawan.nik}-${payrollData.bulan}-${payrollData.tahun}.pdf"`
        }
    });
});

export default payrollRoute;
