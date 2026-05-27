/**
 * Centralized utility to extract parameters from common request locations
 * Priority: Body > Query > Headers > Defaults
 * 
 * @param {Object} req - Express request object
 * @param {Array} keys - List of keys to extract
 * @param {Object} defaults - Optional default values
 * @returns {Object} Extracted parameters
 */
export const getRequestParams = (req, keys = [], defaults = {}) => {
    const params = { ...defaults };
    const { body = {}, query = {}, headers = {} } = req;

    keys.forEach(key => {
        // Priority: Body, then Query, then Headers
        const value = body[key] !== undefined ? body[key] : (query[key] !== undefined ? query[key] : headers[key]);

        if (value !== undefined) {
            params[key] = value;
        }
    });

    // Handle language specifically if not provided
    if (!params.lang) {
        params.lang = body.lang || query.lang || headers.lang || 'en';
    }

    return params;
};

/**
 * Normalizes boolean strings from requests
 * @param {any} val 
 * @returns {boolean}
 */
export const parseBoolean = (val) => {
    if (val === undefined || val === null) return undefined;
    return val === 'true' || val === true || val === 1 || val === '1' || val === 'Active';
};
