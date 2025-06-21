const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS and serve static frontend
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory map of roomId -> broadcaster socket ID
const sessions = {};

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('create-room', () => {
    const roomId = uuidv4();
    sessions[roomId] = socket.id;
    socket.emit('room-created', roomId);
    console.log(`🎥 Room created: ${roomId}`);
  });

  socket.on('join-room', (roomId) => {
    const broadcasterId = sessions[roomId];
    if (broadcasterId) {
      socket.to(broadcasterId).emit('viewer-joined', socket.id);
      console.log(`👤 Viewer ${socket.id} joined room ${roomId}`);
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  socket.on('offer', ({ offer, target }) => {
    io.to(target).emit('offer', { offer, sender: socket.id });
  });

  socket.on('answer', ({ answer, target }) => {
    io.to(target).emit('answer', answer);
  });

  socket.on('ice-candidate', ({ candidate, target }) => {
    io.to(target).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    // Remove rooms created by this socket
    for (const roomId in sessions) {
      if (sessions[roomId] === socket.id) {
        delete sessions[roomId];
        console.log(`🗑️ Room deleted: ${roomId}`);
      }
    }
  });
});

// Catch-all: Serve React app on any route (for direct link access like /?roomId=abc)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
