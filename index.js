// Import Express and necessary packages
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")("sk_test_51QFeRQBnUwl9B8JgwDFd0ojYHcvlyjJkXux0ZfgF1gmEcjvnnnHkpykpReu37Ar08urjMpd30CwR4DpLtRXcPP2h00Rhd2YgnQ");
require('dotenv').config();
const cors = require('cors');

const app = express();
const port = process.env.PORT || 7000;

// Middleware to enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// MongoDB connection URI
const uri = process.env.DATABASE_URL;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function bootstrap() {
    try {
        await client.connect();
        const database = client.db("SecondChanceShop");
        const bookingCollection = database.collection('bookingCollection');
        const userCollection = database.collection("Users");

        // Route to get all bookings
        app.get('/bookingCollection', async (req, res) => {
            const result = await bookingCollection.find({}).toArray();
            res.send(result);
        });

        // Route to handle booking submission
        app.post('/bookingCollection', async (req, res) => {
            const bookingDetails = req.body;
            try {
                const result = await bookingCollection.insertOne(bookingDetails);
                res.status(201).send({ message: "Booking confirmed!", bookingId: result.insertedId });
            } catch (error) {
                console.error("Error saving booking:", error);
                res.status(500).send({ error: "Failed to save booking. Please try again later." });
            }
        });

        // Fetch orders for the current user
        app.get('/my-orders', async (req, res) => {
            const userEmail = req.query.userEmail;
            try {
                const orders = await bookingCollection.find({ userEmail }).toArray();
                res.status(200).send(orders);
            } catch (error) {
                console.error("Error fetching orders:", error);
                res.status(500).send({ error: "Failed to fetch orders." });
            }
        });

        // Route to get booking details by ID
        app.get('/bookingCollection/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
                res.send(booking);
            } catch (error) {
                console.error("Error fetching booking by ID:", error);
                res.status(500).send({ error: "Failed to fetch booking details." });
            }
        });

        // Payment Intent creation
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = Math.round(price * 100);
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    currency: "usd",
                    amount: amount,
                    payment_method_types: ["card"],
                });
                res.send({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                console.error("Error creating payment intent:", error);
                res.status(500).send({ error: "Failed to create payment intent" });
            }
        });

        // Route to check if user is a buyer
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send({ isBuyer: user?.role === "buyer" });
        });

        // Route to check if user is an admin
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            if (user?.role === "admin") {
                res.send({ isAdmin: true });
            } else {
                res.status(403).send({ isAdmin: false });
            }
        });

        // Fetch all users
        app.get('/users', async (req, res) => {
            const result = await userCollection.find({}).toArray();
            res.send(result);
        });

        // Insert user with correct role (admin or buyer/seller)
        app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = user.userType === "admin" ? "admin" : user.userType; // Set role based on userType
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        // Update user role to buyer
        app.put('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            try {
                const result = await userCollection.updateOne(
                    { email: email },
                    { $set: { role: "buyer" } },
                    { upsert: true }
                );
                res.send(result);
            } catch (error) {
                console.error("Error updating user role:", error);
                res.status(500).send({ error: "Failed to update user role." });
            }
        });

        // Delete user and associated bookings
        app.delete('/users/:email', async (req, res) => {
            const email = req.params.email;
            try {
                const deleteUserResult = await userCollection.deleteOne({ email });
                const deleteBookingsResult = await bookingCollection.deleteMany({ userEmail: email });
                if (deleteUserResult.deletedCount === 1) {
                    res.send({ message: "Buyer and associated bookings deleted successfully." });
                } else {
                    res.status(404).send({ error: "User not found." });
                }
            } catch (error) {
                console.error("Error deleting user and bookings:", error);
                res.status(500).send({ error: "Failed to delete user and associated bookings." });
            }
        });

        // Confirm MongoDB connection
        await client.db("admin").command({ ping: 1 });
        console.log("Successfully connected to MongoDB!");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

// Start the application
bootstrap().catch(console.dir);
app.get('/', (req, res) => {
    res.send('Second Chance Shop Is Running');
});
app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
