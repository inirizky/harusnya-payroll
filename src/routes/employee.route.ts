import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { EmployeeService } from '../services/employee.service.js';
import { KaryawanCreateSchema } from '../types/schemas.js';
import * as XLSX from 'xlsx';

const employeeRoute = new Hono();

// POST /api/karyawan
employeeRoute.post('/', zValidator('json', KaryawanCreateSchema), async (c) => {
    const data = c.req.valid('json');
    const employee = await EmployeeService.create(data);

    return c.json({
        success: true,
        message: 'Karyawan berhasil dibuat',
    }, 201);
});


// POST /api/karyawan/import
employeeRoute.post('/import', async (c) => {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || typeof file === 'string') {
        return c.json({ success: false, message: 'File CSV tidak ditemukan' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const results = await EmployeeService.importFromCSV(buffer);

    return c.json({
        success: true,
        message: `Import selesai: ${results.success} berhasil, ${results.failed} gagal`,
        data: results,
    });
});

// GET /api/karyawan/import/template
employeeRoute.get('/import/template', async (c) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['NIK', 'Nama', 'Jabatan', 'Golongan', 'Gaji Pokok', 'Tarif Makan', 'Tarif Transport'],
        ['EMP001', 'Budi Santoso', "Dosen", "Grade 0", 5000000, 25000, 50000],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Karyawan');

    const csvBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'csv' });

    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', 'attachment; filename="template-karyawan.csv"');
    return c.body(csvBuffer);
});

// GET /api/karyawan
employeeRoute.get('/', async (c) => {
    const employees = await EmployeeService.getAll();
    return c.json({
        success: true,
        data: employees
    });
});

// GET /api/karyawan/:id
employeeRoute.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    const employee = await EmployeeService.getById(id);

    if (!employee) {
        return c.json({ success: false, message: 'Employee not found' }, 404);
    }

    return c.json({
        success: true,
        data: employee
    });
});

employeeRoute.put('/:id', zValidator('json', KaryawanCreateSchema), async (c) => {
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    // Route hanya memanggil service, tidak ada business logic di sini
    await EmployeeService.update(id, data);

    return c.json({
        success: true,
        message: 'Karyawan berhasil diperbarui',
    });
});

employeeRoute.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    await EmployeeService.delete(id);
    return c.json({
        success: true,
        message: 'Karyawan berhasil dihapus',
    });
});

export default employeeRoute;
