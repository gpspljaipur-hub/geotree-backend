import axios from 'axios';

/**
 * Calculate the distance between two coordinates using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
export const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
};

const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
};

/**
 * Geocode an address to get latitude and longitude.
 * Requires GOOGLE_MAPS_API_KEY in environment variables.
 * @param {string} address - The address to geocode
 * @returns {Object} { lat, lng }
 */
export const geocodeAddress = async (address) => {
    try {
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            console.warn("GOOGLE_MAPS_API_KEY is not set. Returning null for geocoding.");
            return null;
        }

        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: address,
                key: process.env.GOOGLE_MAPS_API_KEY
            }
        });

        if (response.data.status === 'OK') {
            const location = response.data.results[0].geometry.location;
            return {
                lat: location.lat,
                lng: location.lng,
                formatted_address: response.data.results[0].formatted_address
            };
        } else {
            console.error(`Geocoding error: ${response.data.status}`);
            return null;
        }
    } catch (error) {
        console.error("Geocoding API failed:", error.message);
        return null;
    }
};

/**
 * Reverse geocode coordinates to get an address.
 * @param {number} lat 
 * @param {number} lng 
 * @returns {string} Formatted address
 */
export const reverseGeocode = async (lat, lng) => {
    try {
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            console.warn("GOOGLE_MAPS_API_KEY is not set. Returning null for reverse geocoding.");
            return null;
        }

        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                latlng: `${lat},${lng}`,
                key: process.env.GOOGLE_MAPS_API_KEY
            }
        });

        if (response.data.status === 'OK') {
            return response.data.results[0].formatted_address;
        } else {
            console.error(`Reverse geocoding error: ${response.data.status}`);
            return null;
        }
    } catch (error) {
        console.error("Reverse geocoding API failed:", error.message);
        return null;
    }
};
