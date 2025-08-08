require('dotenv').config();

const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const session = require('express-session');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const MongoStore = require('connect-mongo');

const app = express();
app.set('trust proxy', 1); // <-- CRUCIAL LINE FOR DEPLOYMENT
const server = http.createServer(app);

// --- CONFIGURATIONS ---

const io = new Server(server, {
  cors: {
    origin: "https://kindred-connect-app.onrender.com", // Make sure this is your live URL
    methods: ["GET", "POST"]
  }
});

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const PORT = process.env.PORT || 3000;
const connectionString = process.env.MONGO_CONNECTION_STRING;
const client = new MongoClient(connectionString);

async function run() {
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB Atlas!");
        const db = client.db("KindredConnectDB");
        const usersCollection = db.collection("users");

        // UPDATED: Production-grade session configuration
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // More secure: only save sessions for logged-in users
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_CONNECTION_STRING,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60 // Sessions will expire after 1 day
    }),
    cookie: { 
    secure: process.env.NODE_ENV === 'production', // This is the fix
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: 'lax'
}
});

        app.use(express.static(__dirname));
        app.use(express.urlencoded({ extended: true }));
        app.use(sessionMiddleware);
        io.engine.use(sessionMiddleware); 

        function isAuthenticated(req, res, next) {
            if (req.session.user) {
                next();
            } else {
                res.redirect('/login.html');
            }
        }

        // --- PAGE ROUTES ---
        app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
        app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
        app.get('/dashboard', isAuthenticated, (req, res) => {
            res.send(`
                <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Dashboard</title><link rel="stylesheet" href="/style.css"></head>
                <body>
                    <header><nav><div class="logo">KindredConnect</div><ul><li><a href="/logout">Logout</a></li></ul></nav></header>
                    <main class="dashboard-container">
                        <h1>Welcome, ${req.session.user.name}!</h1><p>This is your private dashboard.</p>
                        <div class="dashboard-grid">
                            <a href="/friends" class="action-card"><div class="icon">🧑‍🤝‍🧑</div><h3>My Friends</h3></a>
                            <a href="/requests" class="action-card"><div class="icon">➕</div><h3>Friend Requests</h3></a>
                            <a href="/members" class="action-card"><div class="icon">🔍</div><h3>View Members</h3></a>
                            <a href="/chat" class="action-card"><div class="icon">💬</div><h3>Join Global Chat</h3></a>
                        </div>
                    </main>
                    <footer><p>© 2025 AmritKumarGiri. All Rights Reserved.</p></footer>
                </body></html>
            `);
        });
        app.get('/members', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'members.html')));
        app.get('/user/:id', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
        app.get('/chat', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
        app.get('/chat/private/:friendId', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'private-chat.html')));
        app.get('/requests', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'requests.html')));
        app.get('/friends', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'friends.html')));
        app.get('/logout', (req, res) => {
            req.session.destroy(() => res.redirect('/'));
        });
        
        // --- API & FORM ROUTES ---
        app.get('/api/users', isAuthenticated, async (req, res) => {
            const users = await usersCollection.find({ _id: { $ne: new ObjectId(req.session.user._id) } }, { projection: { password: 0 } }).toArray();
            res.json(users);
        });
        app.get('/api/user/:id', isAuthenticated, async (req, res) => {
            const profileUserId = new ObjectId(req.params.id);
            const currentUserId = new ObjectId(req.session.user._id);
            const user = await usersCollection.findOne({ _id: profileUserId }, { projection: { password: 0 } });
            if (user) {
                user.isFriend = user.friends && user.friends.some(friendId => friendId.equals(currentUserId));
                user.sentRequestToMe = user.receivedRequests && user.receivedRequests.some(reqId => reqId.equals(currentUserId));
                res.json(user);
            } else {
                res.status(404).json({ message: "User not found" });
            }
        });
        app.get('/api/requests', isAuthenticated, async (req, res) => {
            const currentUser = await usersCollection.findOne({ _id: new ObjectId(req.session.user._id) });
            if (currentUser && currentUser.receivedRequests) {
                const requests = await usersCollection.find({ _id: { $in: currentUser.receivedRequests } }, { projection: { password: 0 } }).toArray();
                res.json(requests);
            } else {
                res.json([]);
            }
        });
        app.get('/api/friends', isAuthenticated, async (req, res) => {
            const currentUser = await usersCollection.findOne({ _id: new ObjectId(req.session.user._id) });
            if (currentUser && currentUser.friends) {
                const friends = await usersCollection.find({ _id: { $in: currentUser.friends } }, { projection: { password: 0 } }).toArray();
                res.json(friends);
            } else {
                res.json([]);
            }
        });
        app.post('/api/request/send/:id', isAuthenticated, async (req, res) => {
            const senderId = new ObjectId(req.session.user._id);
            const receiverId = new ObjectId(req.params.id);
            await usersCollection.updateOne({ _id: senderId }, { $addToSet: { sentRequests: receiverId } });
            await usersCollection.updateOne({ _id: receiverId }, { $addToSet: { receivedRequests: senderId } });
            res.json({ message: "Friend request sent successfully." });
        });
        app.post('/api/request/accept/:id', isAuthenticated, async (req, res) => {
            const acceptorId = new ObjectId(req.session.user._id);
            const senderId = new ObjectId(req.params.id);
            await usersCollection.updateOne({ _id: acceptorId }, { $addToSet: { friends: senderId }, $pull: { receivedRequests: senderId } });
            await usersCollection.updateOne({ _id: senderId }, { $addToSet: { friends: acceptorId }, $pull: { sentRequests: acceptorId } });
            res.json({ message: "Friend request accepted!" });
        });
        app.post('/api/upload/image', isAuthenticated, upload.single('image'), (req, res) => {
            if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
            cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
                if (error || !result) return res.status(500).json({ message: 'Error uploading to cloud.' });
                res.json({ imageUrl: result.secure_url });
            }).end(req.file.buffer);
        });
        app.post('/signup', async (req, res) => {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const newUser = { name: req.body.name, email: req.body.email, age: req.body.age, password: hashedPassword, friends: [], sentRequests: [], receivedRequests: [] };
            await usersCollection.insertOne(newUser);
            res.redirect('/login.html');
        });
        app.post('/login', async (req, res) => {
            const user = await usersCollection.findOne({ email: req.body.email });
            if (!user) return res.status(400).send("Invalid email or password.");
            const isMatch = await bcrypt.compare(req.body.password, user.password);
            if (isMatch) {
                req.session.user = { _id: user._id, email: user.email, name: user.name };
                res.redirect('/dashboard');
            } else {
                res.status(400).send("Invalid email or password.");
            }
        });

        // --- SOCKET.IO LOGIC ---
        io.on('connection', (socket) => {
            const session = socket.request.session;
            const user = session.user;
            if (!user) return;
            const userName = user.name;
            const userId = user._id.toString();
            socket.on('join private chat', (friendId) => {
                const roomName = [userId, friendId].sort().join('-');
                socket.join(roomName);
            });
            socket.on('private message', (data) => {
                const roomName = [userId, data.friendId].sort().join('-');
                socket.to(roomName).emit('private message', { sender: userName, text: data.text });
            });
            socket.on('chat message', (msg) => {
                io.emit('chat message', { senderId: user._id, senderName: userName, text: msg });
            });
        });

        // --- START SERVER ---
        server.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));

    } catch (error) {
        console.error("Failed to connect to the database or start server:", error);
        await client.close();
        process.exit(1);
    }
}

run();

