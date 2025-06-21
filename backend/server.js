const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Enable CORS (Allow all origins or restrict to frontend domain)
app.use(cors());

// Serve static frontend if needed (optional)
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server
const server = http.createServer(app);

// Set up Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: '*', // Replace with your frontend domain if needed
    methods: ['GET', 'POST'],
  },
});

// Store roomId -> broadcaster socket ID
const sessions = {};

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Broadcaster creates a room
  socket.on('create-room', () => {
    const roomId = uuidv4();
    sessions[roomId] = socket.id;
    socket.emit('room-created', roomId);
    console.log(`📺 Room created: ${roomId} by ${socket.id}`);
  });

  // Viewer joins a room
  socket.on('join-room', (roomId) => {
    const broadcasterId = sessions[roomId];
    if (broadcasterId) {
      socket.to(broadcasterId).emit('viewer-joined', socket.id);
      console.log(`👀 Viewer ${socket.id} joined room ${roomId}`);
    } else {
      socket.emit('error', 'Room not found');
      console.warn(`❌ Room ${roomId} not found`);
    }
  });

  // WebRTC signaling events
  socket.on('offer', ({ offer, target }) => {
    io.to(target).emit('offer', { offer, sender: socket.id });
  });

  socket.on('answer', ({ answer, target }) => {
    io.to(target).emit('answer', answer);
  });

  socket.on('ice-candidate', ({ candidate, target }) => {
    io.to(target).emit('ice-candidate', candidate);
  });

  // Clean up rooms on disconnect
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    for (const roomId in sessions) {
      if (sessions[roomId] === socket.id) {
        delete sessions[roomId];
        console.log(`🗑️ Removed room ${roomId}`);
      }
    }
  });
});

// Fallback route (only if serving frontend from same server)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Use dynamic port for Render (default to 3000 locally)
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
