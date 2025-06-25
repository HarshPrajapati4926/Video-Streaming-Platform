import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { FaVideo, FaCopy, FaWhatsapp, FaInstagram, FaEye } from 'react-icons/fa';
import './App.css';

const socket = io('https://video-streaming-platform-bf1p.onrender.com'); // update for prod

export default function App() {
  const [role, setRole] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [startBroadcast, setStartBroadcast] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authFailed, setAuthFailed] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [showToast, setShowToast] = useState(null);

  const videoRef = useRef(null);
  const viewerVideoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const pcMap = useRef(new Map());

  useEffect(() => {
    const queryRoom = new URLSearchParams(window.location.search).get('roomId');
    if (queryRoom) setRole('viewer');
  }, []);

  // SENDER: create room
  useEffect(() => {
    if (role === 'sender') {
      socket.emit('create-room');
      socket.on('room-created', setRoomId);
    }
  }, [role]);

  // SENDER: prepare media stream (canvas workaround for mobile)
  useEffect(() => {
    if (!startBroadcast || !videoRef.current) return;

    const setupStream = async () => {
      const video = videoRef.current;
      await video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;

      const draw = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(draw);
      };
      draw();

      const videoStream = canvas.captureStream();
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
      ]);

      mediaStreamRef.current = combined;
    };

    setupStream();
  }, [startBroadcast]);

  // SENDER: signaling and syncing
  useEffect(() => {
    if (!mediaStreamRef.current || !roomId || role !== 'sender') return;

    socket.on('viewer-joined', async ({ viewerId, password: viewerPw }) => {
      if (viewerPw !== password) {
        socket.emit('auth-failed', viewerId);
        return;
      }

      triggerViewerToast('👤 A viewer joined');

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.onicecandidate = e => {
        if (e.candidate) {
          socket.emit('ice-candidate', { candidate: e.candidate, target: viewerId });
        }
      };

      mediaStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, mediaStreamRef.current);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { offer, target: viewerId });

      pcMap.current.set(viewerId, pc);
    });

    socket.on('answer', ({ answer, viewerId }) => {
      const pc = pcMap.current.get(viewerId);
      pc?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', ({ candidate, viewerId }) => {
      const pc = pcMap.current.get(viewerId);
      pc?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('viewer-count', setViewerCount);

    const sync = type => socket.emit('sync-control', { type });
    const video = videoRef.current;

    const playHandler = () => sync('play');
    const pauseHandler = () => sync('pause');

    video.addEventListener('play', playHandler);
    video.addEventListener('pause', pauseHandler);

    return () => {
      pcMap.current.forEach(pc => pc.close());
      socket.off('viewer-count');
      video.removeEventListener('play', playHandler);
      video.removeEventListener('pause', pauseHandler);
    };
  }, [mediaStreamRef.current, roomId, role, password]);

  // VIEWER
  useEffect(() => {
    if (role !== 'viewer') return;

    const rid = new URLSearchParams(window.location.search).get('roomId');
    if (!rid || !authenticated) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    let senderId = null;

    pc.ontrack = ({ streams }) => {
      viewerVideoRef.current.srcObject = streams[0];
      viewerVideoRef.current.play().catch(err => console.warn('autoplay blocked:', err));
    };

    pc.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('ice-candidate', { candidate: e.candidate, target: senderId });
      }
    };

    socket.emit('join-room', { roomId: rid, password: passwordInput });

    socket.on('auth-failed', () => setAuthFailed(true));

    socket.on('offer', async ({ offer, sender }) => {
      senderId = sender;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { answer, target: sender, viewerId: socket.id });
    });

    socket.on('ice-candidate', ({ candidate }) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('sync-control', ({ type }) => {
      const video = viewerVideoRef.current;
      if (type === 'play') video.play().catch(() => {});
      else video.pause();
    });

    return () => pc.close();
  }, [role, authenticated]);

  const handleCopy = () => {
    const link = `${window.location.origin}?roomId=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setShowToast('🔗 Link copied!');
    setTimeout(() => {
      setCopied(false);
      setShowToast(null);
    }, 2000);
  };

  const handleSetPassword = () => {
    if (tempPassword.trim()) {
      setPassword(tempPassword);
      setShowToast('✅ Password set!');
    } else {
      setShowToast('⚠️ Enter a password first.');
    }
    setTimeout(() => setShowToast(null), 2000);
  };

  const triggerViewerToast = msg => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  const shareLink = roomId ? `${window.location.origin}?roomId=${roomId}` : '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 px-4 relative">
      <AnimatePresence>
        {showToast && (
          <motion.div
            className="fixed top-4 right-4 bg-black text-white px-4 py-2 rounded-xl shadow-lg z-50"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {showToast}
          </motion.div>
        )}
      </AnimatePresence>

      {!role ? (
        <motion.div className="bg-white p-8 rounded-2xl shadow max-w-md w-full text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-2xl font-bold mb-6">Start Your Video Broadcast</h1>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setRole('sender')} className="bg-blue-600 text-white py-2 px-4 rounded-lg w-full flex justify-center items-center gap-2">
            <FaVideo /> Sender
          </motion.button>
        </motion.div>
      ) : role === 'sender' ? (
        <motion.div className="bg-white p-6 rounded-2xl shadow max-w-3xl w-full space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="text-2xl text-center">🎥 Sender Broadcast</h2>
          <input type="file" accept="video/*" onChange={e => setVideoFile(URL.createObjectURL(e.target.files[0]))} className="file:bg-blue-600 file:text-white file:px-4 file:py-2 file:rounded-lg" />
          
          {!password && (
            <div className="flex gap-2">
              <input type="password" placeholder="Set viewer password..." value={tempPassword} onChange={e => setTempPassword(e.target.value)} className="border p-2 w-full rounded" />
              <button onClick={handleSetPassword} className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-900">Set</button>
            </div>
          )}

          {password && (
            <div className="text-sm text-gray-700">🔒 Password: <span className="font-bold">{password}</span></div>
          )}

          {videoFile && (
            <>
              <video ref={videoRef} src={videoFile} controls className="w-full rounded-lg" muted playsInline />
              {!startBroadcast && (
                <button onClick={() => setStartBroadcast(true)} className="bg-green-600 text-white px-6 py-2 rounded-lg">Start Broadcast</button>
              )}
              {roomId && (
                <div className="space-y-2 text-center">
                  <p className="text-gray-700">Viewer Link:</p>
                  <p className="text-blue-600 break-all">{shareLink}</p>
                  <div className="flex justify-center gap-4 mt-2 flex-wrap">
                    <button onClick={handleCopy} className="bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                      <FaCopy /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(shareLink)}`} target="_blank" rel="noreferrer" className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaWhatsapp /> WhatsApp</a>
                    <a href={`https://instagram.com/?url=${encodeURIComponent(shareLink)}`} target="_blank" rel="noreferrer" className="bg-pink-500 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaInstagram /> Instagram</a>
                  </div>
                  <div className="mt-4 text-gray-800 flex justify-center items-center gap-2 text-lg">
                    <FaEye className="text-blue-600" />
                    <span>{viewerCount} viewer{viewerCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      ) : !authenticated ? (
        <motion.div className="bg-white p-6 rounded-2xl shadow max-w-md w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="text-xl text-center mb-4">🔐 Enter Password</h2>
          <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Password" className="w-full p-2 border rounded mb-4" />
          {authFailed && <p className="text-red-600 mb-2">❌ Incorrect password</p>}
          <button onClick={() => setAuthenticated(true)} className="bg-blue-600 text-white w-full py-2 rounded">View Stream</button>
        </motion.div>
      ) : (
        <motion.div className="bg-white p-6 rounded-2xl shadow max-w-3xl w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="text-xl text-center">👁️ Viewer Stream</h2>
          <video ref={viewerVideoRef} autoPlay playsInline controls muted={false} className="w-full rounded-lg" />
        </motion.div>
      )}
    </div>
  );
}
