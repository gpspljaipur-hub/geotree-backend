import "dotenv/config";
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import LocationData from '../models/locationData.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../../states_districts.xlsx');

const seedLocationData = async () => {
    try {
        await connectDB();

        console.log("Reading Excel file for Location Hierarchy...");
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`Processing ${data.length} rows...`);

        // Clear existing hierarchy
        await LocationData.deleteMany({});

        const bulkData = data.map(row => {
            const item = {
                state: row.State || row.state,
                district: row.District || row.district
            };
            const block = row.Block || row.block || row.SubDistrict || row['Sub-district'];
            const gp = row['Gram Panchayat'] || row.gram_panchayat || row.GP || row.gp;
            const village = row.Village || row.village;

            if (block) item.block = block;
            if (gp) item.gram_panchayat = gp;
            if (village) item.village = village;

            return item;
        }).filter(item => item.state && item.district);

        if (bulkData.length > 0) {
            await LocationData.insertMany(bulkData);
            console.log(`✅ Successfully seeded ${bulkData.length} location records.`);
        } else {
            console.log("⚠️ No valid data found in Excel.");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error.message);
        process.exit(1);
    }
};

seedLocationData();
