import Admin from '../models/admin.model.js';
import bcrypt from 'bcrypt';

const seedAdmin = async () => {
    try {
        const email = process.env.SUPER_ADMIN_EMAIL;
        const password = process.env.SUPER_ADMIN_PASSWORD;

        if (!email || !password) {
            console.warn("⚠️ SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set in .env. Skipping admin seed.");
            return;
        }

        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            // console.log("✅ Super Admin already exists.");
            return;
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        await Admin.create({
            name: "Super Admin",
            email,
            password_hash,
            role: "super_admin",
            status: true
        });

        console.log("✅ Super Admin seeded successfully.");

    } catch (error) {
        console.error("❌ Failed to seed Super Admin:", error.message);
    }
};

export default seedAdmin;
