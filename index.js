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
const requestedCollection = client.db('SwiftPay').collection('requsted');

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    app.get('/user', async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email
      }
      const role = await userCollection.findOne(query)
      let admin = false
      let user = false
      let agent = false
      if (role) {
        admin = role?.role === 'admin'
        user = role?.role === 'user'
        agent = role?.role === 'agent'
      }
      res.send({ admin, user, agent })
    })
    app.post('/user', async (req, res) => {
      const userDetails = req.body;
      try {
        // Insert user details into MongoDB
        const result = await userCollection.insertOne(userDetails);
        res.status(200).json({ message: 'User registered successfully' });
      } catch (error) {
        console.error('Error inserting user:', error);
        res.status(500).json({ message: 'Failed to register user' });
      }
    });

    app.get('/requested', async (req, res) => {
      const cursor = requestedCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get('/requested/user', async (req, res) => {
      try {
        const users = await requestedCollection.find({ role: 'user' }).toArray();
        res.status(200).json(users);
      } catch (error) {
        res.status(500).json({ message: 'Failed to fetch user requests' });
      }
    });

    app.post('/requested', async (req, res) => {
      const userDetails = req.body; // Assuming JSON body with user details
      try {
        // Insert user details into MongoDB
        const result = await requestedCollection.insertOne(userDetails);
        res.status(200).json({ message: 'User registered successfully' });
      } catch (error) {
        res.status(500).json({ message: 'Failed to register user' });
      }
    });

    app.get('/requested/user', async (req, res) => {
      try {
        const users = await requestedCollection.find({ role: 'user' }).toArray();
        res.status(200).json(users);
      } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users' });
      }
    });

    app.get('/requested/agents', async (req, res) => {
      try {
        const agents = await requestedCollection.find({ role: 'agent' }).toArray();
        res.status(200).json(agents);
      } catch (error) {
        res.status(500).json({ message: 'Failed to fetch agents' });
      }
    });

    //  '/requested/:id' &  balance: 40 &  stutas : active
    app.put('/requested/:id', async (req, res) => {
      const requestId = req.params.id;
      const { balance, status } = req.body;
      try {
        const filter = { _id: new ObjectId(requestId) };
        const updateDoc = {
          $set: {
            balance: balance,
            status: status,
          },
        };
        const result = await requestedCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount === 1) {
          res.status(200).json({ message: 'User request updated successfully' });
        } else {
          res.status(404).json({ message: 'User request not found' });
        }
      } catch (error) {
        res.status(500).json({ message: 'Failed to update user request' });
      }
    });
    app.get('/requested/:id', async (req, res) => {
      const id = req.params.id;
      try {
        const query = { _id: new ObjectId(id) };
        const user = await requestedCollection.findOne(query);

        if (user) {
          res.status(200).json(user);
        } else {
          res.status(404).json({ message: 'User not found' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

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
