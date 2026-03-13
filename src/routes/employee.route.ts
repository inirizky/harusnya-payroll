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
        data: employee
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

export default employeeRoute;
