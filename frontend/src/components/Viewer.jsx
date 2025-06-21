import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://video-streaming-platform-bf1p.onrender.com', { transports: ['websocket'] });

export function Viewer() {
  const videoRef = useRef();

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('roomId');
    if (!roomId) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

    pc.ontrack = (event) => {
      videoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('ice-candidate', { candidate: e.candidate, target: null });
      }
    };

    socket.emit('join-room', roomId);

    socket.on('offer', async ({ offer, sender }) => {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { answer, target: sender });
    });

    socket.on('ice-candidate', (candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      pc.close();
      socket.disconnect();
    };
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">📺 Viewer</h2>
      <video ref={videoRef} autoPlay playsInline controls className="w-full max-w-xl" />
    </div>
  );
}
