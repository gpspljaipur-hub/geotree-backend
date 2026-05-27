import * as security from '../utils/security.js';

/**
 * Middleware to decrypt incoming req.body fields if they are encrypted
 * Assumes req.body has been populated by body-parser or multer
 */
// Pattern to validate encrypted data format: 32-char hex IV : hex ciphertext
const ENCRYPTED_PATTERN = /^[0-9a-f]{32}:[0-9a-f]+$/i;

export const decryptionMiddleware = (req, res, next) => {
    req.isEncryptedRequest = false; // Flag to track if the incoming request was encrypted

    if (req.body && typeof req.body === 'object') {
        for (const key in req.body) {
            const value = req.body[key];
            // Only attempt decryption on values matching encrypted hex:hex pattern
            if (typeof value === 'string' && ENCRYPTED_PATTERN.test(value)) {
                try {
                    const decrypted = security.decrypt(value);
                    if (decrypted !== value) {
                        req.body[key] = decrypted;
                        req.isEncryptedRequest = true; // Mark that we found and decrypted a field
                    }
                } catch (err) {
                    // Not actually encrypted or failed to decrypt — leave original value
                }
            }
        }
    }
    next();
};

/**
 * Middleware to intercept res.json, format it globally, and encrypt the response data
 */
export const encryptionResponseMiddleware = (req, res, next) => {
    const originalJson = res.json;

    res.json = function (body) {
        let formattedResponse = {};

        // 1. Check if the response is already in the { status, message, data } format
        const isAlreadyFormatted = body &&
            typeof body === 'object' &&
            'status' in body &&
            'message' in body;

        if (isAlreadyFormatted) {
            formattedResponse = body;
        } else {
            // 2. Wrap the response into the standard format
            const isSuccess = res.statusCode < 400;
            let message = isSuccess ? "Success" : "Error";
            let data = body;

            if (body && typeof body === 'object') {
                if (body.message && !body.data) {
                    message = body.message;
                    data = body.data !== undefined ? body.data : (Object.keys(body).length === 1 ? null : body);
                }
                if (body.errors && Array.isArray(body.errors)) {
                    message = body.message || "Validation Error";
                    data = body.errors;
                }
            }

            formattedResponse = {
                status: isSuccess,
                message: message,
                data: data
            };
        }

        // 3. Selective Encryption: Only encrypt if the request was encrypted or explicitly requested
        // If it's a plain text request (Postman testing), return plain text
        if (req.isEncryptedRequest) {
            const encryptedBody = security.encryptObject(formattedResponse);
            return originalJson.call(this, encryptedBody);
        }

        // Return standard formatted but UNENCRYPTED response for plain text requests
        return originalJson.call(this, formattedResponse);
    };
    next();
};
