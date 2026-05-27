import fs from 'fs';
import path from 'path';

/**
 * Safely deletes a file from the public directory
 * @param {string} relativePath - The path stored in DB (e.g., /uploads/species/image.jpg)
 */
export const deleteFile = (relativePath) => {
    if (!relativePath || relativePath.startsWith('http')) return;

    // Remove leading slash if present to make it relative to process.cwd() / public
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    const absolutePath = path.join(process.cwd(), 'public', cleanPath);

    try {
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
            console.log(`✅ Deleted file: ${absolutePath}`);
        } else {
            console.warn(`⚠️ File not found for deletion: ${absolutePath}`);
        }
    } catch (err) {
        console.error(`❌ Error deleting file ${absolutePath}:`, err.message);
    }
};
