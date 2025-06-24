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
  const videoRef = useRef(null);
  const viewerVideoRef = useRef(null);

  useEffect(() => {
    const queryRoomId = new URLSearchParams(window.location.search).get('roomId');
    if (queryRoomId) {
      setRole('viewer');
    }
  }, []);

  useEffect(() => {
    if (role === 'sender') {
      socket.emit('create-room');
      socket.on('room-created', (id) => setRoomId(id));
    }
  }, [role]);

  useEffect(() => {
    if (!videoFile || !startBroadcast || !roomId || role !== 'sender') return;

    const pcMap = new Map();

    socket.on('viewer-joined', async (viewerSocketId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('ice-candidate', {
            candidate: e.candidate,
            target: viewerSocketId,
          });
        }
      };

      const video = videoRef.current;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');

      function draw() {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(draw);
      }
      draw();

      const canvasStream = canvas.captureStream(30);
      const audioTracks = video.captureStream().getAudioTracks();
      const fullStream = new MediaStream();

      canvasStream.getVideoTracks().forEach(track => fullStream.addTrack(track));
      audioTracks.forEach(track => fullStream.addTrack(track.clone()));

      fullStream.getTracks().forEach(track => pc.addTrack(track, fullStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { offer, target: viewerSocketId });

      pcMap.set(viewerSocketId, pc);
    });

    socket.on('answer', (answer) => {
      for (const pc of pcMap.values()) {
        if (pc.signalingState !== 'stable') {
          pc.setRemoteDescription(new RTCSessionDescription(answer));
          break;
        }
      }
    });

    socket.on('ice-candidate', (candidate) => {
      if (candidate && candidate.candidate) {
        for (const pc of pcMap.values()) {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn('Sender failed to add ICE', e));
        }
      }
    });

    const video = videoRef.current;
    const emitPlayPause = (type) => socket.emit('sync-control', { type });

    video.addEventListener('play', () => emitPlayPause('play'));
    video.addEventListener('pause', () => emitPlayPause('pause'));

    return () => {
      pcMap.forEach((pc) => pc.close());
      video.removeEventListener('play', () => emitPlayPause('play'));
      video.removeEventListener('pause', () => emitPlayPause('pause'));
    };
  }, [videoFile, startBroadcast, roomId, role]);

  useEffect(() => {
    if (role !== 'viewer') return;

    const roomId = new URLSearchParams(window.location.search).get('roomId');
    if (!roomId) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    let senderSocketId = null;

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (viewerVideoRef.current) {
        viewerVideoRef.current.srcObject = remoteStream;
        viewerVideoRef.current.volume = 1.0;
        setTimeout(() => {
          viewerVideoRef.current.play().catch(err => console.warn('Autoplay prevented:', err));
        }, 300);
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
      if (candidate && candidate.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn('Viewer failed to add ICE', e));
      }
    });

    socket.on('sync-control', ({ type }) => {
      const video = viewerVideoRef.current;
      if (!video) return;

      if (type === 'play') {
        video.play();
      } else if (type === 'pause') {
        video.pause();
      }
    });

    return () => pc.close();
  }, [role]);

  const handleCopy = () => {
    if (!roomId) return;
    const link = `${window.location.origin}?roomId=${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareLink = roomId ? `${window.location.origin}?roomId=${roomId}` : '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 px-4">
      {!role ? (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="bg-white shadow-xl rounded-2xl p-8 max-w-md w-full text-center"
        >
          <h1 className="text-3xl font-extrabold mb-6 text-gray-800">
            Start Your Video Broadcast
          </h1>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setRole('sender')}
            className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 w-full"
          >
            <FaVideo /> Sender
          </motion.button>
        </motion.div>
      ) : role === 'sender' ? (
        <motion.div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="text-2xl font-bold text-center text-gray-800">🎥 Video Broadcast (Sender)</h2>
          <input type="file" accept="video/*" onChange={(e) => setVideoFile(URL.createObjectURL(e.target.files[0]))} className="file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all" />
          {videoFile && (
            <div className="flex flex-col items-center gap-4">
              <motion.video ref={videoRef} src={videoFile} controls className="w-full rounded-lg shadow-md" autoPlay muted playsInline />
              {!startBroadcast && (
                <motion.button onClick={() => setStartBroadcast(true)} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition" whileTap={{ scale: 0.95 }}>
                  Start Broadcast
                </motion.button>
              )}
              {roomId && (
                <div className="text-center space-y-3">
                  <p className="text-gray-700">Viewer Link:</p>
                  <p className="text-blue-600 break-all">{shareLink}</p>
                  <div className="flex justify-center gap-4 mt-2 flex-wrap">
                    <motion.button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900" whileTap={{ scale: 0.95 }}>
                      <FaCopy />{copied ? 'Copied!' : 'Copy Link'}
                    </motion.button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(shareLink)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                      <FaWhatsapp /> WhatsApp
                    </a>
                    <a href={`https://www.instagram.com/?url=${encodeURIComponent(shareLink)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600">
                      <FaInstagram /> Instagram
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="text-xl font-semibold mb-4 text-center text-gray-800">👁️ Viewer</h2>
          <motion.video
            ref={viewerVideoRef}
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
      )}
    </div>
  );
}
