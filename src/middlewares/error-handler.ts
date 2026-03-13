import { Context } from 'hono';
import { logger } from '../lib/logger.js';

export const errorHandler = (err: Error, c: Context) => {
    logger.error(err, `Request failed: ${err.message}`);

    return c.json(
        {
            success: false,
            message: err.message || 'Internal Server Error',
        },
        500
    );
};
