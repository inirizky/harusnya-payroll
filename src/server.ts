import app from "./index.js";
import { serve } from "@hono/node-server";
import { logger } from "./lib/logger.js";

const port = Number(process.env.PORT) || 3000;

logger.info(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port,
});