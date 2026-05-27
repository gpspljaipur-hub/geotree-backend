module.exports = {
    apps: [
        {
            name: "geotree-backend",
            script: "src/server.js",
            instances: "max",        // Utilizes all available CPU cores
            exec_mode: "cluster",    // Run in cluster mode
            autorestart: true,       // Restart on crash
            watch: true,             // Keep an eye on file changes (set to false in production)
            ignore_watch: ["node_modules", "public/uploads", "logs", "public/forms"],
            max_memory_restart: "1G", // Prevent memory leaks
            env: {
                NODE_ENV: "development",
            },
            env_production: {
                NODE_ENV: "production",
            }
        }
    ]
};
