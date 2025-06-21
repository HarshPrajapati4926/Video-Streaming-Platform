import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export function Viewer() {
  const videoRef = useRef(null);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('roomId');
    if (!roomId) return;

    const pc = new RTCPeerConnection();

    socket.emit('join-room', roomId);

    pc.ontrack = (event) => {
      videoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('ice-candidate', { candidate: e.candidate, target: null });
    };

    socket.on('offer', async ({ offer, sender }) => {
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
    <div>
      <h2>Viewer</h2>
      <video ref={videoRef} autoPlay playsInline controls style={{ maxWidth: '800px' }} />
    </div>
  );
}




