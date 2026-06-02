import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createUploadMiddleware = (folderName = '') => {
    // Determine the upload directory
    const uploadDir = path.join(__dirname, '../../public/uploads', folderName);

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Configure Storage
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            // Create unique filename: fieldname-timestamp.ext
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });

    // File Filter
    const fileFilter = (req, file, cb) => {
        // Allow images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else if (folderName === 'template' && (file.mimetype === 'text/html' || path.extname(file.originalname).toLowerCase() === '.html')) {
            // Allow .html for certificate templates
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not allowed in folder ${folderName}`), false);
        }
    };

    const multerInstance = multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
    });

    multerInstance.single = function (fieldname) {
        const multerFields = multerInstance.fields([
            { name: fieldname, maxCount: 1 },
            { name: 'image', maxCount: 1 },
            { name: 'logo', maxCount: 1 },
            { name: 'file', maxCount: 1 }
        ]);

        return (req, res, next) => {
            multerFields(req, res, (err) => {
                if (err) return next(err);
                if (req.files) {
                    const file = req.files[fieldname]?.[0] || req.files.image?.[0] || req.files.logo?.[0] || req.files.file?.[0];
                    if (file) {
                        req.file = file;
                    }
                }
                next();
            });
        };
    };

    return multerInstance;
};

// Default export uses the root uploads folder for backward compatibility
// or use 'common' if you want to segregate default uploads.
// Keeping it to root to minimize breakage for unmigrated code.
const upload = createUploadMiddleware('');
export const siteImageUpload = createUploadMiddleware('site');

export const boundaryUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, '../../public/uploads/boundaries');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.kml' || ext === '.zip') {
            cb(null, true);
        } else {
            cb(new Error('Only .kml and .zip files are allowed!'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

export default upload;
