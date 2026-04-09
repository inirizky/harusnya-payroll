import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AttendanceService } from '../services/attendance.service.js';
import { KehadiranSchema } from '../types/schemas.js';

const attendanceRoute = new Hono();

// GET /api/attendance
attendanceRoute.get('/', async (c) => {
    // 1. Ambil query string dari request
    const bulanQuery = c.req.query('bulan');
    const tahunQuery = c.req.query('tahun');

    // 2. Parsing string menjadi number (jika ada)
    const bulan = bulanQuery ? parseInt(bulanQuery) : undefined;
    const tahun = tahunQuery ? parseInt(tahunQuery) : undefined;

    console.log(bulan);

    // 3. Teruskan ke service
    const output = await AttendanceService.getAll(bulan, tahun);
    return c.json({ success: true, data: output });
});

// POST /api/attendance (Upsert)
attendanceRoute.post('/', zValidator('json', KehadiranSchema), async (c) => {
    const data = c.req.valid('json');
    const output = await AttendanceService.upsert(data);
    return c.json({ success: true, data: output });
});

// DELETE /api/attendance/:id
attendanceRoute.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    await AttendanceService.delete(id);
    return c.json({ success: true, message: 'Attendance record deleted' });
});

export default attendanceRoute;
