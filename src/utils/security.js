import crypto from 'crypto';

// Use a fixed algorithm and key size
const ALGORITHM = 'aes-256-cbc';
const JWT_SECRET = "geotree_jwt_secret_key_development_only_1234567890"
const IV_LENGTH = 16; // For AES, this is always 16
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables. Critical security risk.");
}
const KEY = crypto.scryptSync(JWT_SECRET, 'salt', 32);

/**
 * Encrypts a string
 * @param {string} text 
 * @returns {string} iv:encryptedData
 */
export const encrypt = (text) => {
    if (!text || typeof text !== 'string') return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (err) {
        console.error("Encryption failed:", err.message);
        return text;
    }
};

/**
 * Decrypts a string
 * @param {string} text 
 * @returns {string} 
 */
export const decrypt = (text) => {
    try {
        if (!text || typeof text !== 'string' || !text.includes(':')) return text;
        const textParts = text.split(':');
        if (textParts.length < 2) return text;

        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');

        if (iv.length !== IV_LENGTH) return text;

        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        // Silently return original text if it's not actually encrypted data
        return text;
    }
};

/**
 * Custom function to encrypt object values (for responses)
 */
export const encryptObject = (obj, depth = 0) => {
    if (depth > 10) return obj;
    if (!obj || typeof obj !== 'object') return obj;

    // Fast way to get a clean plain object/array without Mongoose baggage
    let cleanObj;
    try {
        if (depth === 0) {
            // Only do this at the top level to avoid redundant cycles
            cleanObj = JSON.parse(JSON.stringify(obj));
        } else {
            cleanObj = obj;
        }
    } catch (e) {
        cleanObj = obj;
    }

    // Handle Arrays
    if (Array.isArray(cleanObj)) {
        return cleanObj.map(item => encryptObject(item, depth + 1));
    }

    const newObj = {};
    for (const key in cleanObj) {
        const val = cleanObj[key];

        // Only encrypt string values that don't look like IDs, dates, or tokens
        if (typeof val === 'string' &&
            key !== '_id' &&
            !key.toLowerCase().includes('id') &&
            !key.toLowerCase().includes('date') &&
            !key.toLowerCase().includes('token') &&
            val.length > 0
        ) {
            newObj[key] = encrypt(val);
        } else if (typeof val === 'object' && val !== null) {
            newObj[key] = encryptObject(val, depth + 1);
        } else {
            newObj[key] = val;
        }
    }
    return newObj;
};
