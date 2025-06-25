const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Setup Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());

// Root route to test server availability on mobile
app.get('/', (req, res) => {
  res.send('✅ Signaling server is running!');
});

const rooms = {}; // roomId => { senderId, password, viewers: Set }

io.on('connection', socket => {
  console.log('✅ New connection:', socket.id);

  socket.on('create-room', () => {
    const roomId = uuidv4();
    rooms[roomId] = {
      senderId: socket.id,
      password: null,
      viewers: new Set(),
    };
    socket.join(roomId);
    socket.emit('room-created', roomId);
    console.log(`📺 Room created: ${roomId}`);
  });

  socket.on('join-room', ({ roomId, password }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.password && password !== room.password) {
      console.log('❌ Incorrect password from viewer:', socket.id);
      io.to(socket.id).emit('auth-failed');
      return;
    }

    socket.join(roomId);
    room.viewers.add(socket.id);
    console.log(`👤 Viewer ${socket.id} joined room ${roomId}`);
    io.to(room.senderId).emit('viewer-joined', { viewerId: socket.id, password });
    updateViewerCount(roomId);
  });

  socket.on('offer', ({ offer, target }) => {
    io.to(target).emit('offer', { offer, sender: socket.id });
  });

  socket.on('answer', ({ answer, target, viewerId }) => {
    io.to(target).emit('answer', { answer, viewerId });
  });

  socket.on('ice-candidate', ({ candidate, target, viewerId }) => {
    io.to(target).emit('ice-candidate', { candidate, viewerId });
  });

  socket.on('sync-control', ({ type }) => {
    const roomId = getRoomIdBySender(socket.id);
    if (roomId) {
      const room = rooms[roomId];
      room.viewers.forEach(viewerId => {
        io.to(viewerId).emit('sync-control', { type });
      });
    }
  });

  socket.on('auth-failed', viewerId => {
    io.to(viewerId).emit('auth-failed');
  });

  socket.on('set-password', ({ roomId, password }) => {
    const room = rooms[roomId];
    if (room && room.senderId === socket.id) {
      room.password = password;
      console.log(`🔐 Password set for room ${roomId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    Object.entries(rooms).forEach(([roomId, room]) => {
      if (room.senderId === socket.id) {
        room.viewers.forEach(viewerId => {
          io.to(viewerId).emit('sync-control', { type: 'stop' });
        });
        delete rooms[roomId];
      } else if (room.viewers.has(socket.id)) {
        room.viewers.delete(socket.id);
        updateViewerCount(roomId);
      }
    });
  });

  function updateViewerCount(roomId) {
    const room = rooms[roomId];
    if (room) {
      const count = room.viewers.size;
      io.to(room.senderId).emit('viewer-count', count);
    }
  }

  function getRoomIdBySender(senderId) {
    return Object.keys(rooms).find(rid => rooms[rid].senderId === senderId);
  }
});

// 🚀 Start the server on all network interfaces (important for mobile)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Signaling server live on http://<your-ip>:${PORT}`);
});
