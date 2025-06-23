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

const sessions = {}; // { roomId: senderSocketId }

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Create a new room and register sender
  socket.on('create-room', () => {
    const roomId = uuidv4();
    sessions[roomId] = socket.id;
    socket.emit('room-created', roomId);
    console.log(`📡 Room created: ${roomId} by ${socket.id}`);
  });

  // Viewer joins a room; inform the sender
  socket.on('join-room', (roomId) => {
    const senderSocketId = sessions[roomId];
    if (senderSocketId) {
      socket.to(senderSocketId).emit('viewer-joined', socket.id);
      console.log(`👁️ Viewer ${socket.id} joined room ${roomId}`);
    } else {
      console.warn(`⚠️ Room not found for ID: ${roomId}`);
    }
  });

  // Signaling messages
  socket.on('offer', ({ offer, target }) => {
    io.to(target).emit('offer', { offer, sender: socket.id });
  });

  socket.on('answer', ({ answer, target }) => {
    io.to(target).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, target }) => {
    io.to(target).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Clean up when client disconnects
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    for (const roomId in sessions) {
      if (sessions[roomId] === socket.id) {
        console.log(`🧹 Cleaning up room: ${roomId}`);
        delete sessions[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
