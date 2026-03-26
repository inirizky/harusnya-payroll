import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { MasterService } from '../services/master.service.js';
import { GolonganSchema, JabatanSchema, KomponenTetapSchema, KomponenDefaultSchema } from '../types/schemas.js';

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

// --- KOMPONEN TETAP ---
// GET /api/master/komponen-tetap/karyawan/:id
masterRoute.get('/komponen-tetap/karyawan/:id', async (c) => {
    const karyawanId = parseInt(c.req.param('id'));
    const output = await MasterService.getKomponenTetapByEmployee(karyawanId);
    return c.json({ success: true, data: output });
});

// POST /api/master/komponen-tetap
masterRoute.post('/komponen-tetap', zValidator('json', KomponenTetapSchema.extend({ karyawanId: z.number() })), async (c) => {
    const data = c.req.valid('json');
    const output = await MasterService.createKomponenTetap(data as any);
    return c.json({ success: true, data: output }, 201);
});

// PUT /api/master/komponen-tetap/:id
masterRoute.put('/komponen-tetap/:id', zValidator('json', KomponenTetapSchema.partial()), async (c) => {
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const output = await MasterService.updateKomponenTetap(id, data as any);
    return c.json({ success: true, data: output });
});

// DELETE /api/master/komponen-tetap/:id
masterRoute.delete('/komponen-tetap/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    await MasterService.deleteKomponenTetap(id);
    return c.json({ success: true, message: 'Komponen Tetap deleted' });
});

// --- KOMPONEN DEFAULT ---
masterRoute.get('/komponen-default', async (c) => {
    const output = await MasterService.getAllKomponenDefault();
    return c.json({ success: true, data: output });
});

masterRoute.post('/komponen-default', zValidator('json', KomponenDefaultSchema), async (c) => {
    const data = c.req.valid('json');
    const output = await MasterService.createKomponenDefault(data as any);
    return c.json({ success: true, data: output }, 201);
});

masterRoute.put('/komponen-default/:id', zValidator('json', KomponenDefaultSchema.partial()), async (c) => {
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const output = await MasterService.updateKomponenDefault(id, data as any);
    return c.json({ success: true, data: output });
});

masterRoute.delete('/komponen-default/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    await MasterService.deleteKomponenDefault(id);
    return c.json({ success: true, message: 'Komponen Default deleted' });
});

export default masterRoute;
