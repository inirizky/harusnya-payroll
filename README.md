# Harusnya Payroll API

Harusnya Payroll API is a lightweight, high-performance backend REST service built with Hono to manage employee data, attendance tracking, and payroll processing. It provides structured endpoints to handle financial administration efficiently, including the capability to generate payroll reports in both PDF and Excel formats.

### Key Features
* **Employee Management:** Comprehensive handling of employee master data.
* **Attendance Tracking:** Recording and monitoring of employee attendance.
* **Master Data Management:** Configuration of reference data and basic components for system operations.
* **Payroll Processing:** Calculation of employee salaries based on attendance records and master configurations.
* **Bulk import functionality:** employee and payroll data entry via Excel.

## Built With
* Hono
* Node.js
* TypeScript
* PostgreSQL
* Prisma ORM

## Getting Started

Follow these instructions to set up the project locally.

### Prerequisites
Ensure you have the following installed on your local machine:
* Node.js (v16 or higher)
* npm, yarn, pnpm, or bun
* PostgreSQL

### Installation

1. Clone the repository
   ```sh
   git clone <repository-url>
   cd harusnya-payroll
   ```

2. Install dependencies
   ```sh
   npm install
   ```

3. Configure environment variables
   Copy the sample environment file and update the values accordingly.
   ```sh
   cp env.example .env
   ```
   Ensure the `DATABASE_URL` in the `.env` file is properly configured with your PostgreSQL credentials.
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/payroll_db?schema=public"
   PORT=3000
   ```

4. Run database migrations
   Initialize the database tables using Prisma ORM.
   ```sh
   npx prisma migrate dev
   ```

5. Start the development server
   ```sh
   npm run dev
   ```
   The API server will run on port 3000 (or the port specified in your `.env` file).

## Project Structure
* `src/routes/` - API endpoints for attendance, employees, master data, and payroll.
* `src/services/` - Core business logic, including Excel processing and payroll calculations.
* `src/middlewares/` - Application middlewares such as error handlers.
* `src/configs/` - Database and application configuration.
* `src/lib/` - Utility modules (e.g., logger, PDF generator).
* `src/types/` - TypeScript type definitions and validation schemas.
* `prisma/` - Prisma schema, migration history, and database seed scripts.

## License
Distributed under the Proprietary License. Intended for internal organizational use only.
