import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { errorHandler } from './middlewares/error-handler.js';
import employeeRoute from './routes/employee.route.js';
import payrollRoute from './routes/payroll.route.js';
import masterRoute from './routes/master.route.js';
import attendanceRoute from './routes/attendance.route.js';
import { logger } from './lib/logger.js';
import 'dotenv/config';

const app = new Hono();

// Middlewares
app.use('*', honoLogger());
app.use('*', cors());

// Routes
app.get('/', (c) => c.text('Employee Payroll API is running!'));
app.route('/api/master', masterRoute);
app.route('/api/attendance', attendanceRoute);
app.route('/api/karyawan', employeeRoute);
app.route('/api/payroll', payrollRoute);

// Error Handling
app.onError(errorHandler);

const port = Number(process.env.PORT) || 3000;

logger.info(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port,
});
