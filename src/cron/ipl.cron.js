import { processPendingSettlements } from '../controllers/ipl.controller.js';

export const startIPLCron = () => {
    /*
    // Run every 10 minutes
    const INTERVAL_MS = 10 * 60 * 1000;

    console.log("🕒 IPL Settlement Cron Started (running every 10 mins)");

    // Initial check on startup (Delayed to ensure DB connection is stable)
    setTimeout(() => {
        processPendingSettlements();
    }, 5000); // 5 seconds delay on startup

    setInterval(() => {
        processPendingSettlements();
    }, INTERVAL_MS);
    */
};
