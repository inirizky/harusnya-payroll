import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler } from './middlewares/error-handler.js';
import employeeRoute from './routes/employee.route.js';
import payrollRoute from './routes/payroll.route.js';
import masterRoute from './routes/master.route.js';
import attendanceRoute from './routes/attendance.route.js';
import { prettyJSON } from 'hono/pretty-json';

const app = new Hono();


app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    maxAge: 600,
    credentials: true,
}))

app.use("*", logger())
app.use("*", prettyJSON())


// Routes
app.get('/', (c) => c.text('Employee Payroll API is running!'));
app.route('/api/master', masterRoute);
app.route('/api/kehadiran', attendanceRoute);
app.route('/api/karyawan', employeeRoute);
app.route('/api/payroll', payrollRoute);

// Error Handling
app.onError(errorHandler);

export default app;
