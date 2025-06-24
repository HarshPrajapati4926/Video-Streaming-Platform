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

const rooms = {}; // roomId: { sender, viewers: Set }

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('create-room', () => {
    const roomId = uuidv4();
    rooms[roomId] = {
      sender: socket.id,
      viewers: new Set(),
    };
    socket.emit('room-created', roomId);
    console.log(`📺 Room created: ${roomId}`);
  });

  socket.on('join-room', (roomId) => {
    const room = rooms[roomId];
    if (room && room.sender) {
      room.viewers.add(socket.id);
      io.to(room.sender).emit('viewer-joined', socket.id);
      console.log(`👀 Viewer ${socket.id} joined room ${roomId}`);
    } else {
      socket.emit('error', 'Room not found or sender not connected.');
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

    for (const roomId in rooms) {
      const room = rooms[roomId];

      // If sender disconnected
      if (room.sender === socket.id) {
        room.viewers.forEach((viewerId) => {
          io.to(viewerId).emit('sender-disconnected');
        });
        delete rooms[roomId];
        console.log(`🚫 Room ${roomId} closed (sender disconnected)`);

      // If viewer disconnected
      } else if (room.viewers.has(socket.id)) {
        room.viewers.delete(socket.id);
        console.log(`👋 Viewer ${socket.id} left room ${roomId}`);

        // Clean up if no viewers left
        if (room.viewers.size === 0) {
          console.log(`🧹 Room ${roomId} has no viewers`);
        }
      }
    }
  });
});

app.get('/', (req, res) => {
  res.send('✅ WebRTC signaling server is running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Signaling server live on port ${PORT}`);
});
