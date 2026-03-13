import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AttendanceService } from '../services/attendance.service.js';
import { KehadiranSchema } from '../types/schemas.js';

const attendanceRoute = new Hono();

// GET /api/attendance
attendanceRoute.get('/', async (c) => {
    const output = await AttendanceService.getAll();
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
