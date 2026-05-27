/**
 * Async Handler Wrapper
 * Eliminates the need for try-catch blocks in every controller.
 * Also ensures req.body is always at least an empty object to prevent
 * "Cannot read properties of undefined" errors.
 */
const asyncHandler = (fn) => (req, res, next) => {
    // Ensure req.body is never null/undefined
    if (!req.body || typeof req.body !== 'object') {
        req.body = {};
    }
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;

