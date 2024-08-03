const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require('dotenv').config();
const app = express();

const port = process.env.PORT || 5000;
app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:5173",
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
const requestedCollection = client.db('SwiftPay').collection('requested');
const transactionsCollection = client.db('SwiftPay').collection('transactions');
async function run() {
  try {
    // Connect the client to the server
    // await client.connect();


    app.get('/user', async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const role = await userCollection.findOne(query);
      let admin = false, user = false, agent = false;

      if (role) {
        admin = role.role === 'admin';
        user = role.role === 'user';
        agent = role.role === 'agent';
      }
      res.send({ admin, user, agent });
    });

    app.post('/user', async (req, res) => {
      const userDetails = req.body;
      try {
        const result = await userCollection.insertOne(userDetails);
        res.status(200).json({ message: 'User registered successfully' });
      } catch (error) {
        console.error('Error inserting user:', error);
        res.status(500).json({ message: 'Failed to register user' });
      }
    });

    // Admin page routes
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
      const userDetails = req.body;
      try {
        const result = await requestedCollection.insertOne(userDetails);
        res.status(200).json({ message: 'User registered successfully' });
      } catch (error) {
        res.status(500).json({ message: 'Failed to register user' });
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

    // User page routes
    app.post('/api/sendMoney', async (req, res) => {
      const { sender, recipient, amount, pin } = req.body;

      try {
        const senderUser = await userCollection.findOne({ email: sender });
        const recipientUser = await userCollection.findOne({ email: recipient });

        if (!senderUser || !recipientUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        if (senderUser.password !== pin) { // Validate PIN
          return res.status(403).json({ message: 'Invalid PIN' });
        }

        const amountNum = parseFloat(amount);

        if (amountNum < 50) { // Minimum transaction amount
          return res.status(400).json({ message: 'Minimum transaction amount is 50 Taka' });
        }

        if (senderUser.balance < amountNum) { // Check balance
          return res.status(400).json({ message: 'Insufficient balance' });
        }

        let fee = 0;
        if (amountNum > 100) {
          fee = 5; // Transaction fee
        }
        // Log transaction
        const transaction = {
          email: sender,
          date: new Date(),
          amount: amountNum,
          type: 'transfer',
          description: `Sent ${amountNum} Taka to ${recipient}`,
          sender: sender,
          recipient: recipient,
        };

        await transactionsCollection.insertOne(transaction);

        await userCollection.updateOne(
          { email: sender },
          { $inc: { balance: -(amountNum + fee) } }
        );

        await userCollection.updateOne(
          { email: recipient },
          { $inc: { balance: amountNum } }
        );

        res.status(200).json({ message: 'Money sent successfully' });
      } catch (error) {
        console.error('Error sending money:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    app.post('/api/cashOut', async (req, res) => {
      const { agent, amount, pin, userEmail } = req.body;

      console.log('User email:', userEmail);
      console.log('Agent:', agent);
      console.log('Amount:', amount);
      console.log('PIN:', pin);

      try {
        const userAccount = await userCollection.findOne({ email: userEmail });
        const agentAccount = await userCollection.findOne({ email: agent });

        if (!userAccount || !agentAccount) {
          return res.status(404).json({ message: 'User or agent not found' });
        }

        if (userAccount.password !== pin) { // Validate PIN
          return res.status(403).json({ message: 'Invalid PIN' });
        }


        const amountNum = parseFloat(amount);
        const fee = amountNum * 0.015;
        const totalDeducted = amountNum + fee;

        if (userAccount.balance < totalDeducted) {
          return res.status(400).json({ message: 'Insufficient balance' });
        }
        // Log transaction
        const transaction = {
          email: userEmail,
          date: new Date(),
          amount: amountNum,
          type: 'cash-out',
          description: `Cashed out ${amountNum} Taka through agent ${agent}`,
          sender: userEmail,
          recipient: agent,
        };

        await transactionsCollection.insertOne(transaction);


        // Update balances
        await userCollection.updateOne(
          { email: userEmail },
          { $inc: { balance: -totalDeducted } }
        );

        await userCollection.updateOne(
          { email: agent },
          { $inc: { balance: amountNum + fee } }
        );

        res.status(200).json({ message: 'Cash out successful' });
      } catch (error) {
        console.error('Error cashing out:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });
    app.get('/api/balance/:email', async (req, res) => {
      const { email } = req.params;

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      try {
        // Find the user in the database
        const userAccount = await userCollection.findOne({ email });

        if (!userAccount) {
          return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ balance: userAccount.balance });
      } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    // Endpoint for requesting cash-in
    app.post('/api/requestCashIn', async (req, res) => {
      const { userEmail, agentEmail, amount } = req.body;

      try {
        // Validate amount
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          return res.status(400).json({ message: 'Invalid amount' });
        }

        // Find user and agent
        const user = await userCollection.findOne({ email: userEmail });
        const agent = await userCollection.findOne({ email: agentEmail });

        if (!user || !agent) {
          return res.status(404).json({ message: 'User or agent not found' });
        }

        // Create request in the requested collection
        const request = {
          userEmail,
          agentEmail,
          amount,
          status: 'pending' // Default status
        };

        // Add request to the collection
        await requestedCollection.insertOne(request);

        res.status(200).json({ message: 'Cash-in request sent successfully' });
      } catch (error) {
        console.error('Error processing cash-in request:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });
    app.get('/api/requestCashIn', async (req, res) => {
      try {
        // Fetch all cash-in requests
        const requests = await requestedCollection.find().toArray();

        // Respond with the fetched data
        res.status(200).json(requests);
      } catch (error) {
        console.error('Error fetching cash-in requests:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    // Endpoint for agents to approve cash-in requests
    app.put('/api/approveCashIn/:id', async (req, res) => {
      const requestId = req.params.id;
      const { agentEmail } = req.body;

      try {
        // Find the request
        const request = await requestedCollection.findOne({ _id: new ObjectId(requestId) });

        if (!request || request.agentEmail !== agentEmail || request.status !== 'pending') {
          return res.status(404).json({ message: 'Request not found or already processed' });
        }

        const user = await userCollection.findOne({ email: request.userEmail });
        const agent = await userCollection.findOne({ email: agentEmail });

        if (!user || !agent) {
          return res.status(404).json({ message: 'User or agent not found' });
        }

        const amount = parseFloat(request.amount);

        if (agent.balance < amount) {
          return res.status(400).json({ message: 'Insufficient balance in agent account' });
        }

        // Update balances
        await userCollection.updateOne(
          { email: request.userEmail },
          { $inc: { balance: amount } }
        );

        await userCollection.updateOne(
          { email: agentEmail },
          { $inc: { balance: -amount } }
        );

        // Update request status
        await requestedCollection.updateOne(
          { _id: new ObjectId(requestId) },
          { $set: { status: 'approved' } }
        );
        const transaction = {
          email: request.userEmail,
          date: new Date(),
          amount: parseFloat(request.amount),
          type: 'cash-in',
          description: `Cash-in request of ${amount} Taka approved`,
          sender: agentEmail,
          recipient: request.userEmail,
        };
        await transactionsCollection.insertOne(transaction);
        res.status(200).json({ message: 'Cash-in request approved' });
      } catch (error) {
        console.error('Error approving cash-in:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });
    // Backend: Fetch last 10 transactions for a user
    app.get('/api/transactions/:email', async (req, res) => {
      const { email } = req.params;

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      try {
        // Find the last 10 transactions for the user
        const transactions = await transactionsCollection.find({ email }).sort({ date: -1 }).limit(10).toArray();

        res.status(200).json(transactions);
      } catch (error) {
        console.error('Error fetching transactions:', error);
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
