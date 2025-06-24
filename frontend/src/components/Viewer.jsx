import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Viewer() {
  const videoRef = useRef(null);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('roomId');
    if (!roomId) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    let senderSocketId = null;

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream;
        videoRef.current.volume = 1.0;
        videoRef.current
          .play()
          .catch((err) => console.warn('Autoplay prevented:', err));
      }
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

    // Sync playback controls
    socket.on('sync-control', ({ type }) => {
      const video = videoRef.current;
      if (!video) return;

      if (type === 'play') {
        video.play();
      } else if (type === 'pause') {
        video.pause();
      }
    });

    return () => pc.close();
  }, []);

  return (
    <motion.div
      className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-xl font-semibold mb-4 text-center text-gray-800">👁️ Viewer</h2>
        <motion.video
          ref={videoRef}
          autoPlay
          playsInline
          controls
          muted={false}
          className="w-full rounded-lg shadow-md"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
        />
      </motion.div>
    </motion.div>
  );
}
