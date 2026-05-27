import AuditLog from '../models/auditLog.model.js';

/**
 * Fields that must NEVER be stored in audit logs.
 * Prevents OTP, payment credentials, and tokens from leaking into the audit trail.
 */
const SENSITIVE_KEYS = new Set([
    'otp', 'password', 'token', 'device_token',
    'razorpay_signature', 'razorpay_payment_id',
    'hashed_otp', 'secret', 'key', 'private_key'
]);

const sanitizeForAudit = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    return Object.fromEntries(
        Object.entries(obj)
            .filter(([k]) => !SENSITIVE_KEYS.has(k.toLowerCase()))
            .map(([k, v]) => [k, typeof v === 'object' && v !== null ? '[object]' : v])
    );
};

/**
 * Audit Logging Middleware
 * @param {String} moduleName - Name of the module (e.g., 'IPL', 'User')
 * @param {String} actionType - Optional override (e.g., 'CREATE'). If null, derived from method.
 */
const auditMiddleware = (moduleName, actionType = null) => {
    return async (req, res, next) => {
        // Only log if user is authenticated (adminId exists)
        if (!req.user || !req.user.adminId) {
            return next();
        }

        const originalSend = res.json;

        res.json = function (body) {
            res.locals.responseBody = body;
            return originalSend.call(this, body);
        };

        res.on('finish', async () => {
            // Only log successful modifying actions (or strictly sensitive ones)
            // Skip GET requests to avoid spam, unless specified otherwise?
            // Usually we audit POST, PUT, DELETE.
            if (req.method === 'GET') return;

            if (res.statusCode >= 200 && res.statusCode < 400) {
                try {
                    let action = actionType;
                    if (!action) {
                        if (req.method === 'POST') action = 'CREATE';
                        else if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE';
                        else if (req.method === 'DELETE') action = 'DELETE';
                    }

                    // ID might be in params or body
                    const targetId = req.params.id || req.body.id || (res.locals.responseBody?.data?._id) || null;

                    await AuditLog.create({
                        admin_id: req.user.adminId,
                        action: action,
                        module: moduleName,
                        target_id: targetId,
                        ip_address: req.ip,
                        details: `${action} operation on ${moduleName}`,
                        metadata: {
                            // FIX: Sanitize body before storage — never log OTPs, tokens, or payment data
                            body: sanitizeForAudit(req.body),
                            query: req.query
                        }
                    });
                } catch (err) {
                    console.error('Audit Log Error:', err);
                }
            }
        });

        next();
    };
};

export default auditMiddleware;
