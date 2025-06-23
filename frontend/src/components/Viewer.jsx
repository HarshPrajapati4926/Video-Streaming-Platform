import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import { FaEye } from 'react-icons/fa';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Viewer() {
  const videoRef = useRef(null);
  const pcRef = useRef(null);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('roomId');
    if (!roomId) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    let senderSocketId = null;

    pc.ontrack = (event) => {
      const incomingStream = event.streams[0];
      if (videoRef.current && videoRef.current.srcObject !== incomingStream) {
        videoRef.current.srcObject = incomingStream;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && senderSocketId) {
        socket.emit('ice-candidate', {
          candidate: e.candidate,
          target: senderSocketId,
        });
      }
    };

    socket.emit('join-room', roomId);

    const handleOffer = async ({ offer, sender }) => {
      try {
        if (pc.signalingState !== 'stable') return; // prevent conflict
        senderSocketId = sender;

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { answer, target: sender });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    };

    const handleIceCandidate = (candidate) => {
      try {
        if (candidate && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    };

    socket.on('offer', handleOffer);
    socket.on('ice-candidate', handleIceCandidate);

    return () => {
      if (pc) pc.close();
      socket.off('offer', handleOffer);
      socket.off('ice-candidate', handleIceCandidate);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-purple-100 via-white to-blue-100 flex flex-col items-center justify-center p-6"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-3xl font-bold mb-6 text-gray-800 flex items-center gap-2"
      >
        <FaEye className="text-purple-600" />
        Viewer
      </motion.h2>

      <motion.video
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
        ref={videoRef}
        autoPlay
        playsInline
        controls
        onLoadedMetadata={() => (videoRef.current.volume = 1)}
        className="w-full max-w-3xl rounded-2xl shadow-lg border border-gray-300"
      />
    </motion.div>
  );
}