const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authenticateToken = require("../middleware/auth");
const { upload } = require("../middleware/multerConfig")
const { v4: uuidv4 } = require('uuid');

module.exports = (client) => {
    const router = express.Router();

    router.post("/register", upload.single("profileImage"), async (req, res) => {
        const { username, email, password } = req.body;
        const usernameCaseInsensitive = username.toLowerCase()


        const { validateRegistrationInput } = require("../utils/validUserInput");

        const errors = validateRegistrationInput({ username, email, password })

        if (errors.length > 0) {
            return res.status(400).json({ errors })
        }

        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ message: "Profile image is required." });
        }

        const imageBuffer = req.file.buffer
        const { detectMime } = require("../utils/validateImageMimeType")
        const mimeType = detectMime(imageBuffer);

        if (!mimeType) {
            return res.status(400).json({ message: "Unsupported image type." });
        }

        try {
            const authDb = client.db("auth");
            const users = authDb.collection("users");

            const existingUser = await users.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: "Account with email already registered" });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const createdAt = new Date()

            const result = await users.insertOne({
                username: usernameCaseInsensitive,
                email,
                password: hashedPassword,
                createdAt
            });

            const pokedexDb = client.db('pokedex')
            const profiles = pokedexDb.collection('profiles')

            await profiles.insertOne({
                _id: result.insertedId,
                theme: "light",
                colorScheme: "default",
                profileImage: {
                    data: imageBuffer,
                    contentType: mimeType,
                },
                favourites: [],
                teams: [],
                comparisons: [],
                silhouetteHistory: [],
                battleHistory: [],
                createdAt,
            })

            const token = jwt.sign(
                { userId: result.insertedId, username: usernameCaseInsensitive },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            return res.json({ message: "User registered successfully", token });

        } catch (err) {
            console.error("🔥 Caught error in /register:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    router.post("/login", async (req, res) => {
        console.log('login route hit');

        const { username, password } = req.body;

        const usernameCaseInsensitive = username.toLowerCase()

        const { validateLoginInputs } = require("../utils/validUserInput");

        const errors = validateLoginInputs({ username, password });
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        try {
            const users = client.db("auth").collection("users");
            const user = await users.findOne({ username: usernameCaseInsensitive });
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials." });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: "Invalid credentials." });
            }

            const token = jwt.sign(
                { userId: user._id, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            return res.json({ message: "Login successful", token });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.get("/profile", authenticateToken, async (req, res) => {

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId);

        const authDb = client.db("auth");
        const pokedexDb = client.db('pokedex')
        const authCollection = authDb.collection("users");
        const profilesCollection = pokedexDb.collection('profiles')

        const authRecord = await authCollection.findOne({ _id: userId });
        if (!authRecord) {
            return res.status(404).json({ error: "Auth record not found." });
        }

        const profile = await profilesCollection.findOne({ _id: userId });
        if (!profile) {
            return res.status(404).json({ error: "Profile not found." });
        }

        return res.json({
            username: authRecord.username,
            email: authRecord.email,
            userId: userId.toHexString(),
            profile: {
                ...profile,
                profileImage: {
                    contentType: profile.profileImage.contentType,
                    data: profile.profileImage.data.toString("base64"),
                }
            },
        })
    })

    router.put("/profile/avatar", authenticateToken, upload.single("profileImage"), async (req, res) => {

        try {
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({ message: "Profile image is required." });
            }

            const { detectMime } = require("../utils/validateImageMimeType");
            const mimeType = detectMime(req.file.buffer);

            if (!mimeType) {
                return res.status(400).json({ message: "Unsupported image type." });
            }

            const pokedexDb = client.db("pokedex");
            const profiles = pokedexDb.collection("profiles");
            const { ObjectId, Binary } = require("mongodb");

            const userId = new ObjectId(req.user.userId);

            const result = await profiles.updateOne(
                { _id: userId },
                {
                    $set: {
                        "profileImage": {
                            data: new Binary(req.file.buffer),
                            contentType: mimeType,
                        },
                    },
                }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: "Profile not found." });
            }

            return res.json({ message: "Profile image updated successfully." });
        } catch (error) {
            console.error("🔥 Error updating profile image:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/profile/theme", authenticateToken, async (req, res) => {
        const { colorScheme } = req.body;
        const { ObjectId } = require("mongodb");

        if (!colorScheme) return res.status(400).json({ message: 'Colour scheme is required' })

        try {
            const pokedexDb = client.db("pokedex");
            const profiles = pokedexDb.collection("profiles");
            const userId = new ObjectId(req.user.userId);

            await profiles.updateOne(
                { _id: userId },
                {
                    $set: {
                        colorScheme,
                    }
                }
            )

            return res.json({ message: "Colour scheme updated successfully" })

        } catch (error) {
            res.status(500).json({ error: 'Internal server error' })
        }
    })


    router.put("/profile/auth", authenticateToken, async (req, res) => {
        const { username, email, password } = req.body;
        const { ObjectId } = require("mongodb");
        const { validateProfileUpdateInput } = require("../utils/validUserInput")
        const errors = validateProfileUpdateInput({ username, email, password });

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        try {
            const authDb = client.db("auth");
            const users = authDb.collection("users");
            const userId = new ObjectId(req.user.userId);

            const updateFields = {};
            if (username) updateFields.username = username;
            if (email) updateFields.email = email;
            if (password && password.trim() !== "") {
                updateFields.password = await bcrypt.hash(password, 10);
            }

            if (Object.keys(updateFields).length === 0) {
                return res.status(400).json({ error: "No valid fields to update." });
            }

            const result = await users.updateOne(
                { _id: userId },
                { $set: updateFields }
            );

            if (result.modifiedCount === 0) {
                return res.status(404).json({ error: "User not found or no changes made." });
            }

            return res.json({
                message: "Profile updated successfully",
                user: {
                    username: updateFields.username || undefined,
                    email: updateFields.email || undefined,
                }
            });
        } catch (error) {
            console.error("Unsuccessful profile update:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.get("/profile/colorScheme", authenticateToken, async (req, res) => {

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        const pokedexDb = client.db('pokedex')
        const profilesCollection = pokedexDb.collection('profiles')

        const profile = await profilesCollection.findOne({ _id: userId });
        if (!profile) {
            return res.status(404).json({ error: "Profile not found." });
        }

        return res.json({
            colorScheme: profile.colorScheme,
        })
    })

    router.post("/profile/teams/add", authenticateToken, async (req, res) => {
        const { teamToAdd, teamName } = req.body;

        if (teamToAdd.length !== 6) {
            return res.status(400).json({ message: "Team must have exactly 6 Pokémon." });
        }

        if (!teamName) {
            return res.status(400).json({ message: "Team must have a name." });
        }

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db("pokedex")
            const profilesCollection = pokedexDb.collection('profiles')

            const profile = await profilesCollection.findOne({ _id: userId });

            if (profile) {
                await profilesCollection.updateOne(
                    { _id: userId },
                    { $push: { teams: { _id: uuidv4(), name: teamName, team: teamToAdd } } }
                );
            }

            return res.json({ message: "Team successfully added" });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.get("/profile/teams", authenticateToken, async (req, res) => {

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db('pokedex')
            const profilesCollection = pokedexDb.collection('profiles')

            const profile = await profilesCollection.findOne({ _id: userId });
            if (!profile) {
                return res.status(404).json({ error: "Profile not found." });
            }

            return res.json({
                teams: profile.teams,
            })
        } catch (error) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/profile/teams/remove", authenticateToken, async (req, res) => {

        const { teams } = req.body

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db('pokedex')
            const profilesCollection = pokedexDb.collection('profiles')

            await profilesCollection.updateOne(
                {
                    _id: userId,
                },
                {
                    $set: {
                        teams,
                    }
                },
            )

            return res.json({
                message: "Team removed successfully",
            })

        } catch (error) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.post("/profile/silhouette/add", authenticateToken, async (req, res) => {
        const { game } = req.body;

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db("pokedex")
            const profilesCollection = pokedexDb.collection('profiles')

            const profile = await profilesCollection.findOne({ _id: userId });

            if (profile) {
                await profilesCollection.updateOne(
                    { _id: userId },
                    { $push: { silhouetteHistory: { _id: uuidv4(), game } } }
                );
            }

            return res.json({ message: "Game successfully added" });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.post("/profile/favourites/add", authenticateToken, async (req, res) => {
        const { favouriteId } = req.body;

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db("pokedex")
            const profilesCollection = pokedexDb.collection('profiles')

            await profilesCollection.updateOne(
                { _id: userId },
                {
                    $push: {
                        favourites: favouriteId
                    }
                }
            );

            return res.json({ message: " successfully added" });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.get("/profile/favourites", authenticateToken, async (req, res) => {

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db('pokedex')
            const profilesCollection = pokedexDb.collection('profiles')

            const profile = await profilesCollection.findOne({ _id: userId });
            if (!profile) {
                return res.status(404).json({ error: "Profile not found." });
            }

            const favouritesIds = profile.favourites

            return res.json({ favouritesIds })
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/profile/favourites/remove", authenticateToken, async (req, res) => {
        const { IdToRemove } = req.body;
        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId);

        try {
            const pokedexDb = client.db('pokedex');
            const profilesCollection = pokedexDb.collection('profiles');

            const result = await profilesCollection.findOneAndUpdate(
                { _id: userId },
                { $pull: { favourites: IdToRemove } },
                { returnDocument: "after" }
            );

            if (!result) {
                return res.status(404).json({ error: "Profile not found." });
            }

            return res.json({
                message: "Favourite successfully removed",
                profile: result
            });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.post("/profile/comparison/add", authenticateToken, async (req, res) => {
        const { name, comparison } = req.body;

        if (comparison.length !== 2 && !comparisonToAdd.includes(null)) {
            return res.status(400).json({ error: 'At least 2 pokemon are needed to save comparison' })
        }

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db("pokedex")
            const profilesCollection = pokedexDb.collection('profiles')

            const profile = await profilesCollection.findOne({ _id: userId });

            if (profile) {
                await profilesCollection.updateOne(
                    { _id: userId },
                    { $push: { comparisons: { _id: uuidv4(), name, comparison } } }
                );
            }

            return res.json({ message: "Comparison successfully added" });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.get("/profile/silhouette", authenticateToken, async (req, res) => {

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db('pokedex')
            const profilesCollection = pokedexDb.collection('profiles')

            const profile = await profilesCollection.findOne({ _id: userId });
            if (!profile) {
                return res.status(404).json({ error: "Profile not found." });
            }

            const silhouetteGameHistory = profile.silhouetteHistory

            return res.json({ silhouetteGameHistory })
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.get("/profile/comparisons", authenticateToken, async (req, res) => {

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db('pokedex')
            const profilesCollection = pokedexDb.collection('profiles')

            const profile = await profilesCollection.findOne({ _id: userId });
            if (!profile) {
                return res.status(404).json({ error: "Profile not found." });
            }

            const comparisons = profile.comparisons

            return res.json({ comparisons })
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    })


    router.get("/auth/user", authenticateToken, async (req, res) => {

        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const authDb = client.db('auth')
            const usersCollection = authDb.collection('users')

            const user = await usersCollection.findOne({ _id: userId });
            if (!user) {
                return res.status(404).json({ error: "Profile not found." });
            }

            return res.json({ username })
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.patch("/profile/teams/name/update", authenticateToken, async (req, res) => {
        const { teamId, name } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Need a team name' })
        }

        try {

            const { ObjectId } = require("mongodb");
            const userId = new ObjectId(req.user.userId)

            const pokedexDb = client.db('pokedex')
            const profilesCollection = pokedexDb.collection('profiles')

            const result = await profilesCollection.updateOne(
                { _id: userId, "teams._id": teamId },
                { $set: { "teams.$.name": name } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Team not found' });
            }

            return res.json({ message: "Team name successfully updated" });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.patch("/profile/comparisons/name/update", authenticateToken, async (req, res) => {
        const { comparisonId, name } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Need a comparison name' })
        }

        try {

            const { ObjectId } = require("mongodb");
            const userId = new ObjectId(req.user.userId)

            const pokedexDb = client.db('pokedex')
            const profilesCollection = pokedexDb.collection('profiles')

            const result = await profilesCollection.updateOne(
                { _id: userId, "comparisons._id": comparisonId },
                { $set: { "comparisons.$.name": name } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Comparison not found' });
            }

            return res.json({ message: "Comparison name successfully updated" });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.put("/profile/silhouettes/remove", authenticateToken, async (req, res) => {

        const { silhouettes } = req.body
        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db('pokedex')
            const profilesCollection = pokedexDb.collection('profiles')

            await profilesCollection.updateOne(
                {
                    _id: userId,
                },
                {
                    $set: {
                        silhouetteHistory: silhouettes,
                    }
                },
            )

            return res.json({
                message: "Silhouette removed successfully",
            })

        } catch (error) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/profile/comparisons/remove", authenticateToken, async (req, res) => {

        const { comparisons } = req.body
        const { ObjectId } = require("mongodb");
        const userId = new ObjectId(req.user.userId)

        try {
            const pokedexDb = client.db('pokedex')
            const profilesCollection = pokedexDb.collection('profiles')

            await profilesCollection.updateOne(
                {
                    _id: userId,
                },
                {
                    $set: {
                        comparisons,
                    }
                },
            )

            return res.json({
                message: "Comparison removed successfully",
            })

        } catch (error) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.get("/profile/comparisons/:comparisonId", authenticateToken, async (req, res) => {
        const { comparisonId } = req.params;
        const { ObjectId } = require("mongodb");

        if (!comparisonId || typeof comparisonId !== "string") {
            return res.status(400).json({ error: "Invalid comparisonId" });
        }

        const userId = new ObjectId(req.user.userId);

        try {
            const pokedexDb = client.db("pokedex");
            const profilesCollection = pokedexDb.collection("profiles");

            const result = await profilesCollection.findOne(
                { _id: userId },
                {
                    projection: {
                        comparisons: { $elemMatch: { _id: comparisonId } },
                    },
                }
            );

            const comparison = result?.comparisons?.[0];

            if (!comparison) {
                return res.status(404).json({ error: "Comparison not found" });
            }

            return res.json({
                message: "Comparison found",
                comparison,
            });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.get("/pokemon/light", async (req, res) => {
        // TODO: Fetch first 50 on initial load, then fetch the rest
        // TODO: Add filtering logic (name, type, alphabetical, stat values and orientation, )
        const limit = parseInt(req.query.limit) || 50
        const offset = parseInt(req.query.offset) || 0

        try {
            const pokedexDb = client.db("pokedex");
            const pokemonCollection = pokedexDb.collection("pokemonLight");
            const allPokemon = await
                pokemonCollection
                    .find({})
                    .skip(offset)
                    .limit(limit)
                    .sort({ id: 1 })
                    .toArray();

            const total = await pokemonCollection.countDocuments()

            return res.json({
                data: allPokemon,
                total,
            });
        } catch (err) {
            console.error('Error fetching Pokémon:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    })

    router.post("/pokemon/individual", async (req, res) => {
        const { pokeId } = req.body

        try {

            const pokedexDb = client.db("pokedex");
            const pokemonCollection = pokedexDb.collection("pokemon");

            const pokemon = await pokemonCollection.findOne({
                id: Number(pokeId),
            })

            if (!pokemon) {
                return res.status(403).json({ error: 'Pokemon not round' })
            }
            return res.json(pokemon)
        } catch (error) {
            console.error('Error fetching Pokémon:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    })

    router.post("/pokemon/list", authenticateToken, async (req, res) => {
        try {
            const { ids } = req.body

            const pokedexDb = client.db('pokedex')
            const pokemonCollection = pokedexDb.collection("pokemon")

            if (!Array.isArray(ids)) {
                return res.status(400).json({ error: "IDs must be an array" })
            }

            const pokemonList = await pokemonCollection.find({ id: { $in: ids } }).toArray();

            return res.status(200).json(pokemonList)
        } catch (error) {
            console.error("Error fetching Pokémon:", error);
            return res.status(500).json({ error: "Internal server error." });
        }
    })

    return router
};