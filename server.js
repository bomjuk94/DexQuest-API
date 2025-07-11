require("dotenv").config();
const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");
const multer = require("multer");

const app = express();

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

client.connect()
    .then(() => {
        console.log("✅ Connected to MongoDB Atlas");

        // User Auth
        const authRoutes = require("./routes/auth")(client);
        app.use("/api", authRoutes);

        app.use((err, req, res, next) => {
            console.error("🔥 Uncaught error:", err);
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ error: "File too large" });
            }
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ error: err.message });
            }
            res.status(500).json({ error: "Internal server error" });
        });
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    });
