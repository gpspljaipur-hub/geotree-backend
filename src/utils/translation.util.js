import { translate } from '@vitalets/google-translate-api';
import TranslationCache from '../models/translation.cache.model.js';

/**
 * Translates a single string or an array of strings with caching.
 * @param {string|string[]} text - Text to translate.
 * @param {string} to - Target language code (e.g., 'hi').
 * @returns {Promise<string|string[]>} - Translated text.
 */
export const translateText = async (text, to = 'en') => {
    if (!text || to === 'en') return text;

    const isArray = Array.isArray(text);
    const textsToProcess = isArray ? text : [text];
    const results = new Array(textsToProcess.length);
    const indicesToTranslate = [];

    // 1. Check Cache in Bulk
    const uniqueTexts = [...new Set(textsToProcess.filter(t => t))];
    const cachedItems = uniqueTexts.length > 0
        ? await TranslationCache.find({ text: { $in: uniqueTexts }, to }).lean()
        : [];

    const cacheMap = new Map(cachedItems.map(item => [item.text, item.translatedText]));

    for (let i = 0; i < textsToProcess.length; i++) {
        const original = textsToProcess[i];
        if (!original) {
            results[i] = original;
            continue;
        }

        if (cacheMap.has(original)) {
            results[i] = cacheMap.get(original);
        } else {
            indicesToTranslate.push(i);
        }
    }

    // 2. Translate missing items
    if (indicesToTranslate.length > 0) {
        try {
            // Dedup missing texts to save API costs and improve speed
            const missingTexts = indicesToTranslate.map(i => textsToProcess[i]);
            const uniqueMissing = [...new Set(missingTexts)];

            const SEPARATOR = " |###| ";
            const combinedText = uniqueMissing.join(SEPARATOR);

            const res = await translate(combinedText, { to });
            const translatedParts = res.text.split("|###|").map(s => s.trim());

            const missingCacheMap = new Map();
            uniqueMissing.forEach((text, idx) => {
                const translated = translatedParts[idx] || text;
                missingCacheMap.set(text, translated);

                // Save to cache (async)
                TranslationCache.create({
                    text: text,
                    to: to,
                    translatedText: translated
                }).catch(err => {
                    if (err.code !== 11000) console.error("Cache Save Error:", err.message);
                });
            });

            // Map back to results
            indicesToTranslate.forEach(i => {
                results[i] = missingCacheMap.get(textsToProcess[i]);
            });
        } catch (error) {
            console.error("Translation API Error:", error.message);
            // Fallback for failed translations
            indicesToTranslate.forEach(i => {
                results[i] = textsToProcess[i];
            });
        }
    }

    return isArray ? results : results[0];
};

/**
 * Translates specific fields in an object or array of objects with caching.
 * @param {Object|Object[]} data - Data to translate.
 * @param {string[]} fields - Field names to translate.
 * @param {string} to - Target language code.
 * @returns {Promise<Object|Object[]>} - Translated data.
 */
export const translateData = async (data, fields, to = 'en') => {
    if (!data || !fields || fields.length === 0 || !to || to === 'en') return data;

    const isArray = Array.isArray(data);
    const items = isArray ? data : [data];

    // Collect all unique texts that need translation across all items and fields
    const textsToTranslate = [];
    const mapping = []; // { itemIndex, field }

    items.forEach((item, itemIdx) => {
        fields.forEach(field => {
            if (item[field] && typeof item[field] === 'string') {
                textsToTranslate.push(item[field]);
                mapping.push({ itemIdx, field });
            }
        });
    });

    if (textsToTranslate.length === 0) return data;

    // Perform translation in one bulk operation (handled by our updated translateText)
    const translatedResults = await translateText(textsToTranslate, to);

    // Map back to items
    const translatedItems = items.map(item => ({ ...item }));
    mapping.forEach((map, i) => {
        translatedItems[map.itemIdx][map.field] = translatedResults[i];
    });

    return isArray ? translatedItems : translatedItems[0];
};
