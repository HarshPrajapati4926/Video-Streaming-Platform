import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Viewer() {
  const videoRef = useRef(null);
  let pc = useRef(null);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('roomId');
    if (!roomId) return;

    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.current.ontrack = event => {
      if (videoRef.current.srcObject !== event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    pc.current.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('ice-candidate', { candidate: e.candidate, target: roomId });
      }
    };

    socket.emit('join-room', roomId);

    socket.on('offer', async ({ offer, sender }) => {
      await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      socket.emit('answer', { answer, target: sender });
    });

    socket.on('ice-candidate', ({ candidate, from }) => {
      pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => pc.current.close();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <h2 className="mb-4 text-xl font-semibold text-gray-800">👁️ Viewer</h2>
      <video ref={videoRef} autoPlay playsInline controls className="w-full max-w-3xl rounded shadow" />
    </div>
  );
}
