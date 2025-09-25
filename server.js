require("dotenv").config();
const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");
const multer = require("multer");

const app = express();
console.log("server is starting");

const allowedOrigins = [
    "http://localhost:5173",
    "https://dexquest.bomjukim.com",
    "https://dex-quest-client.vercel.app",
];

app.use(cors({
    origin: (origin, callback) => {
        console.log('🌍 Incoming origin:', origin);
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.warn('🚫 Blocked CORS request from:', origin);
            callback(null, false);
        }
    },
    credentials: true,
}));

app.use(express.json());

// ==== DEV-ONLY: simulate cold start / transient errors ====
if (process.env.NODE_ENV === "development") {
    app.use((req, res, next) => {
        // Header-triggered artificial delay (ms)
        const coldHeader = req.headers["x-simulate-cold"];
        const ms = Number(Array.isArray(coldHeader) ? coldHeader[0] : coldHeader);
        if (!Number.isNaN(ms) && ms > 0) {
            console.log(`🧊 Simulating cold start delay: ${ms}ms`);
            return setTimeout(next, ms);
        }

        // One-off 503 to test retry path
        if (req.headers["x-simulate-503"]) {
            console.log("🧪 Simulating 503 Service Unavailable");
            return res.status(503).json({ error: "Service Unavailable (simulated)" });
        }

        return next();
    });
}
// =========================================================

const client = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

client
    .connect()
    .then(() => {
        console.log("✅ Connected to MongoDB Atlas");

        // User Auth
        const authRoutes = require("./routes/auth")(client);
        app.use("/api", authRoutes);

        // Central error handler (incl. multer)
        app.use((err, req, res, next) => {
            console.error("🔥 Uncaught error:", err);
            if (err?.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ error: "File too large" });
            }
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ error: err.message });
            }
            return res.status(500).json({ error: "Internal server error" });
        });

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    });
