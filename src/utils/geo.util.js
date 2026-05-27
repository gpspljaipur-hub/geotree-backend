import * as turf from '@turf/turf';
import shp from 'shpjs';
import { DOMParser } from 'xmldom';
import * as togeojson from '@tmcw/togeojson';

/**
 * Calculate the centroid of a GeoJSON polygon boundary
 * @param {Object} boundary - { type: 'Polygon', coordinates: [[[lng, lat], ...]] }
 * @returns {Object|null} { lat, lng }
 */
export const getCentroid = (boundary) => {
    try {
        if (!boundary || !boundary.coordinates || !boundary.coordinates.length) return null;

        const polygon = turf.polygon(boundary.coordinates);
        const centroid = turf.centroid(polygon);

        return {
            lat: centroid.geometry.coordinates[1],
            lng: centroid.geometry.coordinates[0]
        };
    } catch (error) {
        console.error("Error calculating centroid:", error);
        return null;
    }
};

/**
 * Calculate the area of a GeoJSON polygon boundary
 * @param {Object} boundary - { type: 'Polygon', coordinates: [[[lng, lat], ...]] }
 * @returns {Number|null} Area in Square Meters
 */
export const getArea = (boundary) => {
    try {
        if (!boundary || !boundary.coordinates || !boundary.coordinates.length) return null;
        const polygon = turf.polygon(boundary.coordinates);
        return turf.area(polygon); // Returns area in square meters
    } catch (error) {
        console.error("Error calculating area:", error);
        return null;
    }
};

/**
 * Parse KML file buffer to GeoJSON Polygon
 * @param {Buffer} buffer 
 * @returns {Object} GeoJSON Polygon geometry
 */
export const parseKML = (buffer) => {
    try {
        const kmlStr = buffer.toString('utf8');
        const kmlDom = new DOMParser().parseFromString(kmlStr, 'text/xml');
        const geoJSON = togeojson.kml(kmlDom);

        const polygonFeature = geoJSON.features.find(f => f.geometry.type === 'Polygon');
        if (!polygonFeature) throw new Error("No polygon found in KML");

        return polygonFeature.geometry;
    } catch (error) {
        throw new Error(`Failed to parse KML: ${error.message}`);
    }
};

/**
 * Parse Shapefile (zipped) buffer to GeoJSON Polygon
 * @param {Buffer} buffer 
 * @returns {Promise<Object>} GeoJSON Polygon geometry
 */
export const parseSHP = async (buffer) => {
    try {
        const geoJSON = await shp(buffer);

        let feature;
        if (Array.isArray(geoJSON)) {
            // Find first layer with a polygon
            for (const layer of geoJSON) {
                feature = layer.features.find(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
                if (feature) break;
            }
        } else {
            feature = geoJSON.features.find(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
        }

        if (!feature) throw new Error("No polygon found in Shapefile");

        if (feature.geometry.type === 'MultiPolygon') {
            return {
                type: 'Polygon',
                coordinates: feature.geometry.coordinates[0]
            };
        }

        return feature.geometry;
    } catch (error) {
        throw new Error(`Failed to parse Shapefile: ${error.message}`);
    }
};
