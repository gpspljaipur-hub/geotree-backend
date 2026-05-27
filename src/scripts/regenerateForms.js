
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import OccasionType from '../models/occasionType.model.js';
import { saveOccasionFormHtml } from '../utils/formGenerator.util.js';

const regenerateAll = async () => {
    try {
        await connectDB();
        console.log("Connected to DB...\n");

        const occasions = await OccasionType.find({});
        console.log(`Found ${occasions.length} occasion types. Regenerating...\n`);

        for (const occasion of occasions) {
            const url = saveOccasionFormHtml(occasion.toObject());

            // Update the form_html_url in the DB
            occasion.form_html_url = url;
            await occasion.save();

            console.log(`✅ ${occasion.name} -> ${url}  (DB updated)`);
        }

        console.log(`\n🎉 All ${occasions.length} forms regenerated & DB updated successfully.`);
        process.exit(0);
    } catch (error) {
        console.error("Error regenerating forms:", error);
        process.exit(1);
    }
};

regenerateAll();
