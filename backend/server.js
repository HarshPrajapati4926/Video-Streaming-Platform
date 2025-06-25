const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());

const rooms = {}; // roomId => { senderId, password, viewers: Set }

io.on('connection', socket => {
  console.log('✅ New connection:', socket.id);

  // Sender creates room
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

  // Viewer joins
  socket.on('join-room', ({ roomId, password }) => {
    const room = rooms[roomId];
    if (!room) return;

    // Validate password
    if (room.password && password !== room.password) {
      console.log('❌ Incorrect password from viewer:', socket.id);
      io.to(socket.id).emit('auth-failed');
      return;
    }

    // Accept viewer
    socket.join(roomId);
    room.viewers.add(socket.id);
    console.log(`👤 Viewer ${socket.id} joined room ${roomId}`);
    io.to(room.senderId).emit('viewer-joined', { viewerId: socket.id, password });
    updateViewerCount(roomId);
  });

  // Sender sets password (first time viewer joins)
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

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    Object.entries(rooms).forEach(([roomId, room]) => {
      if (room.senderId === socket.id) {
        // Sender disconnected, remove room
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

  // Sender sets password (only once)
  socket.on('set-password', ({ roomId, password }) => {
    if (rooms[roomId] && rooms[roomId].senderId === socket.id) {
      rooms[roomId].password = password;
      console.log(`🔐 Password set for room ${roomId}`);
    }
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Signaling server live on port ${PORT}`);
});

});
