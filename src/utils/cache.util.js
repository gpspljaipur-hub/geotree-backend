/**
 * Simple in-memory cache utility with TTL and tag-based invalidation.
 * NOTE: This cache is per-process. In PM2 cluster mode with multiple workers,
 * each worker has its own cache. For cross-worker caching, use Redis.
 */
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

class CacheManager {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Get cached value, or fetch + cache it on miss.
     * @param {string} key      - Cache key
     * @param {Function} fetcher - Async function to fetch data on cache miss
     * @param {string[]} tags   - Tags for bulk invalidation (e.g. ['species', 'site-123'])
     * @param {number} ttlMs    - Time-to-live in milliseconds (default: 10 minutes)
     */
    async get(key, fetcher, tags = [], ttlMs = DEFAULT_TTL_MS) {
        const entry = this.cache.get(key);

        // Check for existing, non-expired entry
        if (entry) {
            if (Date.now() < entry.expiresAt) {
                return entry.data; // Cache hit
            }
            // Entry expired — remove it
            this.cache.delete(key);
        }

        // Cache miss — fetch fresh data
        const data = await fetcher();
        this.set(key, data, tags, ttlMs);
        return data;
    }

    /**
     * Manually set a cache entry.
     * @param {string} key
     * @param {*} data
     * @param {string[]} tags
     * @param {number} ttlMs
     */
    set(key, data, tags = [], ttlMs = DEFAULT_TTL_MS) {
        this.cache.set(key, {
            data,
            tags,
            expiresAt: Date.now() + ttlMs
        });
    }

    /**
     * Invalidate all cache entries that have at least one matching tag.
     * @param {string|string[]} tags
     */
    invalidate(tags) {
        const tagList = Array.isArray(tags) ? tags : [tags];
        for (const [key, entry] of this.cache.entries()) {
            if (entry.tags.some(t => tagList.includes(t))) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Remove a specific key.
     * @param {string} key
     */
    delete(key) {
        this.cache.delete(key);
    }

    /** Clear all entries */
    clear() {
        this.cache.clear();
    }

    /** Returns number of entries currently in cache (includes possibly expired ones) */
    get size() {
        return this.cache.size;
    }
}

export const globalCache = new CacheManager();
