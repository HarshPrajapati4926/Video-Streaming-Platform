// components/Viewer.js
import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Viewer() {
  const videoRef = useRef(null);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('roomId');
    if (!roomId) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    let senderSocketId = null;

    pc.ontrack = (event) => {
      videoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && senderSocketId) {
        socket.emit('ice-candidate', {
          candidate: e.candidate,
          target: senderSocketId
        });
      }
    };

    socket.emit('join-room', roomId);

    socket.on('offer', async ({ offer, sender }) => {
      senderSocketId = sender;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { answer, target: sender });
    });

    socket.on('ice-candidate', (candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => pc.close();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">👁️ Viewer</h2>
      <video ref={videoRef} autoPlay playsInline controls className="w-full max-w-3xl rounded shadow" />
    </div>
  );
}
