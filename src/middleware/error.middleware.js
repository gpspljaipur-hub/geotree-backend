/**
 * Global Error Handling Middleware
 * Standardizes error responses across the application.
 */
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Mongoose CastError (invalid ObjectId, wrong type, etc.)
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}: "${err.value}". Expected a valid ${err.kind || 'value'}.`;
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyValue || {}).join(', ');
        message = `Duplicate field value entered: ${field}`;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token. Please log in again.';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired. Please log in again.';
    }

    // SyntaxError from malformed JSON/data
    if (err instanceof SyntaxError && err.status === 400) {
        statusCode = 400;
        message = 'Malformed request data.';
    }

    if (process.env.NODE_ENV === 'development') {
        console.error(`[Error] ${statusCode} ${message}`, err.stack);
    }

    // Prevent sending response if headers already sent
    if (res.headersSent) {
        return next(err);
    }

    res.status(statusCode).json({
        status: false,
        message: message,
        data: process.env.NODE_ENV === 'development' ? { stack: err.stack } : null
    });
};

export default errorHandler;
