import "dotenv/config";
import connectDB from '../config/db.js';
import State from '../models/state.model.js';

const stateData = [
    { state_name: "Andhra Pradesh", description: "Known for its rich coastal ecosystems, mangroves, and the Eastern Ghats biodiversity." },
    { state_name: "Arunachal Pradesh", description: "A biodiversity hotspot featuring dense tropical and subtropical forests, home to rare flora and fauna." },
    { state_name: "Assam", description: "Famous for Kaziranga National Park, vast tea gardens, and the vibrant Brahmaputra river valley ecosystem." },
    { state_name: "Bihar", description: "Rich in agricultural lands with significant riverine ecosystems along the Ganges." },
    { state_name: "Chhattisgarh", description: "Heavily forested state with rich mineral resources, diverse tribal culture, and pristine wildlife sanctuaries." },
    { state_name: "Goa", description: "Renowned for its coastal biodiversity, Western Ghats forests, and beautiful beaches." },
    { state_name: "Gujarat", description: "Home to the Asiatic lion in Gir Forest and the unique salt marshes of the Rann of Kutch." },
    { state_name: "Haryana", description: "A predominantly agricultural state focusing on increasing its green cover through massive plantation drives." },
    { state_name: "Himachal Pradesh", description: "Characterized by its majestic Himalayan landscapes, pine forests, and rich alpine flora." },
    { state_name: "Jharkhand", description: "Known as the 'Land of Forests', rich in biodiversity, dense woodlands, and wildlife reserves." },
    { state_name: "Karnataka", description: "Features the highly biodiverse Western Ghats, extensive tiger reserves, and lush evergreen forests." },
    { state_name: "Kerala", description: "God's Own Country, celebrated for its tropical greenery, backwaters, and pristine Western Ghats rainforests." },
    { state_name: "Madhya Pradesh", description: "The 'Heart of India', boasting the largest forest cover in the country and numerous national parks." },
    { state_name: "Maharashtra", description: "Diverse landscapes from the Konkan coast to the Western Ghats, rich in endemic species." },
    { state_name: "Manipur", description: "A lush, green state in the northeast, known for Loktak Lake and unique floating national park." },
    { state_name: "Meghalaya", description: "The 'Abode of Clouds', featuring some of the wettest places on earth and rich tropical forests." },
    { state_name: "Mizoram", description: "Characterized by rolling hills, expansive bamboo forests, and high biodiversity." },
    { state_name: "Nagaland", description: "A mountainous state with rich traditional conservation practices and vibrant forest ecosystems." },
    { state_name: "Odisha", description: "Known for its rich coastal biodiversity, Chilika Lake, and extensive mangrove and deciduous forests." },
    { state_name: "Punjab", description: "The fertile 'Land of Five Rivers', focusing on agroforestry and restoring its ecological balance." },
    { state_name: "Rajasthan", description: "Home to the Thar Desert ecosystem and the Aravalli range, featuring unique desert flora and fauna." },
    { state_name: "Sikkim", description: "A fully organic state nestled in the Himalayas, boasting incredible alpine biodiversity and Kanchenjunga." },
    { state_name: "Tamil Nadu", description: "Features diverse ecosystems including the Western and Eastern Ghats, coastal plains, and mangrove forests." },
    { state_name: "Telangana", description: "A plateau region with rising focus on urban forestry and increasing its green canopy." },
    { state_name: "Tripura", description: "Rich in bamboo forests and hilly terrain, supporting diverse wildlife and flora." },
    { state_name: "Uttar Pradesh", description: "Fertile plains along the Ganges with significant wetland ecosystems and wildlife sanctuaries." },
    { state_name: "Uttarakhand", description: "A Himalayan state rich in alpine forests, origin of the Ganges, and highly biodiverse national parks." },
    { state_name: "West Bengal", description: "Home to the Sundarbans, the largest contiguous mangrove forest in the world, and rich coastal ecology." },
    { state_name: "Andaman and Nicobar Islands", description: "Pristine tropical rainforests, endemic species, and vibrant coral reef ecosystems." },
    { state_name: "Chandigarh", description: "A well-planned urban city renowned for its greenery, gardens, and urban forestry management." },
    { state_name: "Dadra and Nagar Haveli and Daman and Diu", description: "Coastal and forested territories with significant ecological conservation efforts." },
    { state_name: "Lakshadweep", description: "An archipelago with fragile coral reef ecosystems and distinct marine biodiversity." },
    { state_name: "Delhi", description: "The capital region, working continuously to expand its urban green cover and combat pollution." },
    { state_name: "Puducherry", description: "A coastal union territory focusing on coastal zone management and preserving its green heritage." },
    { state_name: "Ladakh", description: "A high-altitude cold desert with unique, fragile alpine ecology and rare mountain wildlife." },
    { state_name: "Jammu and Kashmir", description: "Known for its breathtaking Himalayan valleys, pristine lakes, and rich temperate forests." }
];

const seedStates = async () => {
    try {
        await connectDB();

        console.log("Seeding Indian states with descriptions...");

        // Prevent duplicates
        for (const data of stateData) {
            const existingState = await State.findOne({ state_name: data.state_name });
            if (!existingState) {
                await State.create(data);
                console.log(`✅ Added: ${data.state_name}`);
            } else {
                console.log(`⚠️ Skipped (already exists): ${data.state_name}`);
            }
        }

        console.log("🎉 Seeding complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error.message);
        process.exit(1);
    }
};

seedStates();
