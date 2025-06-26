import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import { FaVideo, FaCopy, FaWhatsapp, FaInstagram } from 'react-icons/fa';
import './App.css';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export default function App() {
  const [role, setRole] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [startBroadcast, setStartBroadcast] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const videoRef = useRef(null);
  const viewerVideoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('roomId');
    if (q) setRole('viewer');
  }, []);

  useEffect(() => {
    if (role === 'sender') {
      socket.emit('create-room');
      socket.on('room-created', setRoomId);
    }
  }, [role]);

  useEffect(() => {
    if (startBroadcast && videoRef.current) {
      const stream = videoRef.current.captureStream();
      mediaStreamRef.current = stream;
    }
  }, [startBroadcast]);

  useEffect(() => {
    if (!mediaStreamRef.current || !roomId || role !== 'sender') return;
    const pcMap = new Map();

    socket.on('viewer-joined', async (viewerId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        sdpSemantics: 'unified-plan',
      });

      pc.onicecandidate = (e) => {
        e.candidate && socket.emit('ice-candidate', { candidate: e.candidate, target: viewerId });
      };

      mediaStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, mediaStreamRef.current);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { offer, target: viewerId });
      pcMap.set(viewerId, pc);
    });

    socket.on('answer', (answer) => {
      for (let pc of pcMap.values()) {
        if (pc.signalingState !== 'stable') {
          pc.setRemoteDescription(new RTCSessionDescription(answer));
          break;
        }
      }
    });

    socket.on('ice-candidate', (candidate) => {
      pcMap.forEach(pc => pc.addIceCandidate(new RTCIceCandidate(candidate)));
    });

    const sync = (type) => socket.emit('sync-control', { type });
    const videoEl = videoRef.current;
    videoEl.addEventListener('play', () => sync('play'));
    videoEl.addEventListener('pause', () => sync('pause'));

    return () => {
      pcMap.forEach(pc => pc.close());
      videoEl.removeEventListener('play', () => sync('play'));
      videoEl.removeEventListener('pause', () => sync('pause'));
    };
  }, [mediaStreamRef.current, roomId, role]);

  useEffect(() => {
    if (role !== 'viewer') return;
    const rid = new URLSearchParams(window.location.search).get('roomId');
    if (!rid) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      sdpSemantics: 'unified-plan',
    });

    let senderId = null;
    pc.ontrack = ({ streams }) => {
      const video = viewerVideoRef.current;
      if (!video) return;

      video.srcObject = streams[0];
      video.muted = true; // mute to allow autoplay
      video
        .play()
        .then(() => {
          console.log('Autoplay succeeded');
        })
        .catch((err) => {
          console.warn('Autoplay blocked:', err);
          setAutoplayBlocked(true);
        });
    };

    pc.onicecandidate = (e) => {
      e.candidate && senderId && socket.emit('ice-candidate', { candidate: e.candidate, target: senderId });
    };

    socket.emit('join-room', rid);

    socket.on('offer', async ({ offer, sender }) => {
      senderId = sender;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      socket.emit('answer', { answer: ans, target: sender });
    });

    socket.on('ice-candidate', (candidate) => pc.addIceCandidate(new RTCIceCandidate(candidate)));
    socket.on('sync-control', ({ type }) => {
      const v = viewerVideoRef.current;
      v && (type === 'play' ? v.play() : v.pause());
    });

    return () => pc.close();
  }, [role]);

  const handleCopy = () => {
    const link = `${window.location.origin}?roomId=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = roomId ? `${window.location.origin}?roomId=${roomId}` : '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 px-4">
      {!role ? (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="bg-white p-8 rounded-2xl shadow max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-6">Start Your Video Broadcast</h1>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setRole('sender')} className="bg-blue-600 text-white py-2 px-4 rounded-lg w-full flex items-center justify-center gap-2">
            <FaVideo /> Sender
          </motion.button>
        </motion.div>
      ) : role === 'sender' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-6 rounded-2xl shadow max-w-3xl w-full space-y-6">
          <h2 className="text-2xl text-center">🎥 Sender Broadcast</h2>
          <input type="file" accept="video/*" onChange={e => setVideoFile(URL.createObjectURL(e.target.files[0]))} className="file:bg-blue-600 file:text-white file:px-4 file:py-2 file:rounded-lg" />
          {videoFile && (
            <>
              <motion.video ref={videoRef} src={videoFile} controls className="w-full rounded-lg" autoPlay muted playsInline />
              {!startBroadcast && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStartBroadcast(true)} className="bg-green-600 text-white px-6 py-2 rounded-lg">
                  Start Broadcast
                </motion.button>
              )}
              {roomId && (
                <div className="space-y-2 text-center">
                  <p className="text-gray-700">Viewer Link:</p>
                  <p className="text-blue-600 break-all">{shareLink}</p>
                  <div className="flex justify-center gap-4 mt-2 flex-wrap">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={handleCopy} className="bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                      <FaCopy /> {copied ? 'Copied!' : 'Copy Link'}
                    </motion.button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(shareLink)}`} target="_blank" rel="noreferrer" className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaWhatsapp /> WhatsApp</a>
                    <a href={`https://instagram.com/?url=${encodeURIComponent(shareLink)}`} target="_blank" rel="noreferrer" className="bg-pink-500 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaInstagram /> Instagram</a>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-6 rounded-2xl shadow max-w-3xl w-full">
          <h2 className="text-xl text-center">👁️ Viewer Stream</h2>
          <motion.video ref={viewerVideoRef} autoPlay playsInline controls muted className="w-full rounded-lg" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }} />
          {autoplayBlocked && (
            <div className="text-center mt-4">
              <button
                onClick={() => {
                  const v = viewerVideoRef.current;
                  v.muted = false;
                  v.play().then(() => setAutoplayBlocked(false));
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                Tap to Play Stream
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
