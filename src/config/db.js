import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Use environment variable
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://nooserkhandeshwali_db_user:husain7744@cluster0.s1em8rq.mongodb.net/'
    // const mongoURI = 'mongodb+srv://rajatsonisoni77_db_user:GRhGH6hpufuCEOMy@cluster0.3j0qmnt.mongodb.net/?appName=Cluster0'
    console.log("db", mongoURI)
    if (!mongoURI) {
      throw new Error("MONGODB_URI not defined in .env file");
    }

    // Add database name to connection string if not present
    const connectionString = mongoURI.includes('/?')
      ? mongoURI.replace('/?', '/geotree?')
      : mongoURI;

    const conn = await mongoose.connect(connectionString, {
      // Node.js is async. A highly concurrent worker doesn't need 100 connections.
      // 15-20 connections per worker process is more than enough to handle 1000+ RPS total.
      maxPoolSize: 20,

      // PRE-WARM CONNECTIONS: Set minPoolSize EQUAL to maxPoolSize.
      // This prevents the "thundering herd" problem where a sudden spike in traffic 
      // forces Node to do heavy TLS handshakes simultaneously to open new connections.
      minPoolSize: 20,

      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,

      // Increased connection timeout for Atlas stability during startup TLS handshakes
      connectTimeoutMS: 20000,

      family: 4,
      retryWrites: true,
      retryReads: true,

      // REMOVED maxIdleTimeMS: We DO NOT want connections closing when idle, 
      // because re-establishing them under high sudden load is what causes your timeout!
    });

    console.log(`✅ MongoDB connected successfully!`);
    console.log(`📍 Host: ${conn.connection.host}`);
    console.log(`📍 Database: ${conn.connection.name}`);

    // Monitoring Connection Events
    mongoose.connection.on('disconnected', () => {
      console.warn("⚠️ MongoDB disconnected! Attempting to reconnect...");
    });

    mongoose.connection.on('reconnected', () => {
      console.log("✅ MongoDB reconnected!");
    });

    mongoose.connection.on('error', (err) => {
      console.error("❌ MongoDB connection error:", err);
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed!");
    console.error("Error:", error.message);

    if (error.message.includes('IP')) {
      console.error("\n🔒 IP Whitelist Issue:");
      console.error("Your IP address is not whitelisted in MongoDB Atlas.");
      console.error("Please follow these steps:");
      console.error("1. Go to: https://cloud.mongodb.com/");
      console.error("2. Select your cluster");
      console.error("3. Click 'Network Access' in the left menu");
      console.error("4. Click 'Add IP Address'");
      console.error("5. Click 'Allow Access from Anywhere' (0.0.0.0/0) for development");
      console.error("   OR add your current IP address");
      console.error("6. Wait 1-2 minutes for changes to take effect");
    }

    if (error.message.includes('authentication')) {
      console.error("\n🔐 Authentication Issue:");
      console.error("Please check your MongoDB username and password in .env file");
    }

    console.error("\n💡 Tip: Make sure MONGODB_URI is set in your .env file");
    process.exit(1);
  }
};

export default connectDB;