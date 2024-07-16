const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
app.use(cookieParser());
app.use(cors({
  origin: [
    "http://localhost:5173",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
}));
app.use(express.json());

// Set up MongoDB connection
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const userCollection = client.db('SwiftPay').collection('user');
const requstedCollection = client.db('SwiftPay').collection('requsted');

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    app.get('/user', async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post('/user', async (req, res) => {
      const userDetails = req.body; // Assuming JSON body with user details
      try {
        // Insert user details into MongoDB
        const result = await userCollection.insertOne(userDetails);
        console.log('User inserted:', result);
        res.status(200).json({ message: 'User registered successfully' });
      } catch (error) {
        console.error('Error inserting user:', error);
        res.status(500).json({ message: 'Failed to register user' });
      }
    });
    app.post('/requsted', async (req, res) => {
      const userDetails = req.body; // Assuming JSON body with user details
      try {
        // Insert user details into MongoDB
        const result = await requstedCollection.insertOne(userDetails);
        console.log('User inserted:', result);
        res.status(200).json({ message: 'User registered successfully' });
      } catch (error) {
        console.error('Error inserting user:', error);
        res.status(500).json({ message: 'Failed to register user' });
      }
    });

    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email
      }
      const role = await userCollection.findOne(query)
      console.log(role);
      let admin = false
      let user = false
      let agent = false
      if (role) {
        admin = role?.role === 'admin'
        user = role?.role === 'user'
        agent = role?.role === 'agent'
      }
      res.send({ admin, user , agent })
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // Start the server
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('server is running');
});
