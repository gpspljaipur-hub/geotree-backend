
/**
 * Helper to generate a full absolute URL from a relative path.
 * Should be used before sending responses to the client.
 * 
 * @param {Object} req - The Express request object (to access protocol and host)
 * @param {String} relativePath - The path stored in DB (e.g., /uploads/image.jpg)
 * @returns {String} - Full URL (e.g., http://localhost:5000/uploads/image.jpg) or default placeholder
 */
export const getAbsoluteUrl = (req, relativePath) => {
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath; // Already absolute

    // Handle potential double slashes or missing slashes
    const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

    // Use configured BASE_URL or fallback to request headers (reliable for prod behind proxy)
    const baseUrl = process.env.API_BASE_URL
        ? process.env.API_BASE_URL.replace(/\/$/, '') // Remove trailing slash if present
        : `${req.protocol}://${req.get('host')}`;

    return `${baseUrl}${cleanPath}`;
};

/**
 * Helper to process an array of objects and add valid image URLs
 */
export const appendBaseUrlToImages = (req, data, imageFields = []) => {
    if (!data) return data;

    const transform = (item) => {
        const newItem = item.toObject ? item.toObject() : { ...item };
        imageFields.forEach(field => {
            if (newItem[field]) {
                newItem[field] = getAbsoluteUrl(req, newItem[field]);
            }
        });
        return newItem;
    };

    if (Array.isArray(data)) {
        return data.map(transform);
    } // else single object
    return transform(data);
};
