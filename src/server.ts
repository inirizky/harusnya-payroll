import app from "./index";
import { serve } from "@hono/node-server";
import { logger } from "./lib/logger";

const port = Number(process.env.PORT) || 3000;

logger.info(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port,
});