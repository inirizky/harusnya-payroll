import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { EmployeeService } from '../services/employee.service.js';
import { KaryawanCreateSchema } from '../types/schemas.js';

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
