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

const rooms = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create-room', () => {
    const roomId = uuidv4();
    rooms[roomId] = {
      sender: socket.id,
      viewers: []
    };
    socket.emit('room-created', roomId);
    console.log(`Room created: ${roomId}`);
  });

  socket.on('join-room', (roomId) => {
    const room = rooms[roomId];
    if (room && room.sender) {
      room.viewers.push(socket.id);
      io.to(room.sender).emit('viewer-joined', socket.id);
      console.log(`Viewer ${socket.id} joined room ${roomId}`);
    } else {
      socket.emit('error', 'Room not found or sender not available.');
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
    console.log('Client disconnected:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.sender === socket.id) {
        // Notify all viewers that sender is gone
        room.viewers.forEach((viewerId) => {
          io.to(viewerId).emit('sender-disconnected');
        });
        delete rooms[roomId];
        console.log(`Room ${roomId} deleted`);
      } else {
        // Remove viewer from room if present
        room.viewers = room.viewers.filter((id) => id !== socket.id);
      }
    }
  });
});

app.get('/', (req, res) => {
  res.send('🔁 WebRTC Signaling Server is running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
