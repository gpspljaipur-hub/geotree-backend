import { validationResult } from 'express-validator';

/**
 * Middleware to check for validation errors from express-validator
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: false,
            message: "Validation Error",
            errors: errors.array()
        });
    }
    next();
};

export default validate;
