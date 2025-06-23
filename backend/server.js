const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const rooms = {}; // { roomId: { sender, viewers: [] } }
// const MAX_VIEWERS = 100; // Optional max viewer limit

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Sender creates a new room
  socket.on('create-room', () => {
    const roomId = uuidv4();
    rooms[roomId] = {
      sender: socket.id,
      viewers: [],
    };
    socket.emit('room-created', roomId);
    console.log(`🚪 Room created: ${roomId} by sender ${socket.id}`);
  });

  // Viewer joins an existing room
  socket.on('join-room', (roomId) => {
    const room = rooms[roomId];

    if (!room || !room.sender) {
      socket.emit('error', '❌ Room not found or sender not connected.');
      return;
    }

    // if (room.viewers.length >= MAX_VIEWERS) {
    //   socket.emit('error', '❌ Room full.');
    //   return;
    // }

    if (!room.viewers.includes(socket.id)) {
      room.viewers.push(socket.id);
      io.to(room.sender).emit('viewer-joined', socket.id);
      io.to(room.sender).emit('viewer-count', room.viewers.length);
      console.log(`👀 Viewer ${socket.id} joined room ${roomId}`);
    }
  });

  // Signaling: offer, answer, ICE candidates
  socket.on('offer', ({ offer, target }) => {
    io.to(target).emit('offer', { offer, sender: socket.id });
  });

  socket.on('answer', ({ answer, target }) => {
    io.to(target).emit('answer', answer);
  });

  socket.on('ice-candidate', ({ candidate, target }) => {
    io.to(target).emit('ice-candidate', candidate);
  });

  // Handle disconnects (sender/viewer)
  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      if (room.sender === socket.id) {
        // Sender disconnected: close room
        room.viewers.forEach((viewerId) => {
          io.to(viewerId).emit('sender-disconnected');
        });
        delete rooms[roomId];
        console.log(`🛑 Room ${roomId} closed (sender disconnected)`);
      } else {
        // Viewer disconnected: remove from room
        const index = room.viewers.indexOf(socket.id);
        if (index !== -1) {
          room.viewers.splice(index, 1);
          io.to(room.sender).emit('viewer-count', room.viewers.length);
          console.log(`👋 Viewer ${socket.id} left room ${roomId}`);
        }
      }
    }
  });
});

// Health check
app.get('/', (req, res) => {
  res.send('✅ WebRTC signaling server is running.');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is live on port ${PORT}`);
});
