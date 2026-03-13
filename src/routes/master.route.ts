import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { MasterService } from '../services/master.service.js';
import { GolonganSchema, JabatanSchema } from '../types/schemas.js';

const masterRoute = new Hono();

// --- GOLONGAN ---
masterRoute.get('/golongan', async (c) => {
    const output = await MasterService.getAllGolongan();
    return c.json({ success: true, data: output });
});

masterRoute.post('/golongan', zValidator('json', GolonganSchema), async (c) => {
    const data = c.req.valid('json');
    const output = await MasterService.createGolongan(data);
    return c.json({ success: true, data: output }, 201);
});

masterRoute.put('/golongan/:id', zValidator('json', GolonganSchema.partial()), async (c) => {
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const output = await MasterService.updateGolongan(id, data);
    return c.json({ success: true, data: output });
});

masterRoute.delete('/golongan/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    await MasterService.deleteGolongan(id);
    return c.json({ success: true, message: 'Golongan deleted' });
});

// --- JABATAN ---
masterRoute.get('/jabatan', async (c) => {
    const output = await MasterService.getAllJabatan();
    return c.json({ success: true, data: output });
});

masterRoute.post('/jabatan', zValidator('json', JabatanSchema), async (c) => {
    const data = c.req.valid('json');
    const output = await MasterService.createJabatan(data);
    return c.json({ success: true, data: output }, 201);
});

masterRoute.put('/jabatan/:id', zValidator('json', JabatanSchema.partial()), async (c) => {
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const output = await MasterService.updateJabatan(id, data);
    return c.json({ success: true, data: output });
});

masterRoute.delete('/jabatan/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    await MasterService.deleteJabatan(id);
    return c.json({ success: true, message: 'Jabatan deleted' });
});

export default masterRoute;
