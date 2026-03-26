import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PayrollService } from '../services/payroll.service.js';
import { PayrollGenerateSchema, PayrollUpdateSchema } from '../types/schemas.js';
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

    return new Response(pdfBuffer, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="slip-gaji-${payrollData.karyawan.nik}-${payrollData.bulan}-${payrollData.tahun}.pdf"`
        }
    });
});

export default payrollRoute;
