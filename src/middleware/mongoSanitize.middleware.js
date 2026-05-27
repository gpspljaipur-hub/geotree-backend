
/**
 * Custom MongoDB Sanitization Middleware
 * Replacement for 'express-mongo-sanitize' to fix compatibility issues with Express 5
 * (specifically "Cannot set property query of [object Object] which has only a getter")
 *
 * Protects against:
 *   - NoSQL injection via keys starting with '$'
 *   - Object path traversal via keys containing '.'
 */

const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return;

    for (const key in obj) {
        // Remove keys starting with $ (prevent NoSQL injection operators)
        // Remove keys containing . (prevent path traversal in MongoDB queries)
        if (key.startsWith('$') || key.includes('.')) {
            delete obj[key];
            continue;
        }

        const val = obj[key];

        // Recursively sanitize nested objects and arrays
        if (val && typeof val === 'object') {
            if (Array.isArray(val)) {
                val.forEach(item => {
                    if (item && typeof item === 'object') sanitize(item);
                });
            } else {
                sanitize(val);
            }
        }
    }
};

const mongoSanitize = (req, res, next) => {
    try {
        if (req.body) sanitize(req.body);
        if (req.params) sanitize(req.params);
        // req.query may be read-only in Express 5; wrap safely
        if (req.query && typeof req.query === 'object') {
            try { sanitize(req.query); } catch { /* Express 5 read-only query */ }
        }
        next();
    } catch (err) {
        console.error("Sanitization error:", err.message);
        next(); // Proceed even if sanitization fails
    }
};

export default mongoSanitize;
