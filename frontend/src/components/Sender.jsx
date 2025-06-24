import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import { FaWhatsapp, FaInstagram, FaCopy } from 'react-icons/fa';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Sender() {
  const videoRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [startBroadcast, setStartBroadcast] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [copied, setCopied] = useState(false);
  const pcMap = useRef(new Map());

  useEffect(() => {
    socket.emit('create-room');
    socket.on('room-created', (id) => {
      console.log('Room created:', id);
      setRoomId(id);
    });
  }, []);

  useEffect(() => {
    if (!videoFile || !startBroadcast || !roomId) return;

    const handleViewerJoined = async (viewerSocketId) => {
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

      function drawFrame() {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      }
      drawFrame();

      const videoStream = canvas.captureStream(30);
      const audioTracks = video.captureStream().getAudioTracks();

      const fullStream = new MediaStream();
      videoStream.getVideoTracks().forEach((track) => fullStream.addTrack(track));
      audioTracks.forEach((track) => fullStream.addTrack(track.clone()));

      fullStream.getTracks().forEach((track) => pc.addTrack(track, fullStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { offer, target: viewerSocketId });

      pcMap.current.set(viewerSocketId, pc);
    };

    const handleAnswer = ({ answer, sender }) => {
      const pc = pcMap.current.get(sender);
      if (pc && pc.signalingState !== 'stable') {
        pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleCandidate = ({ candidate, sender }) => {
      const pc = pcMap.current.get(sender);
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => console.error(err));
      }
    };

    const emitPlayPause = (type) => {
      socket.emit('sync-control', { type });
    };

    socket.on('viewer-joined', handleViewerJoined);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleCandidate);

    const video = videoRef.current;
    video.addEventListener('play', () => emitPlayPause('play'));
    video.addEventListener('pause', () => emitPlayPause('pause'));

    return () => {
      socket.off('viewer-joined', handleViewerJoined);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleCandidate);
      pcMap.current.forEach((pc) => pc.close());
      pcMap.current.clear();
    };
  }, [videoFile, startBroadcast, roomId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setVideoFile(URL.createObjectURL(file));
  };

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
    <motion.div className="min-h-screen bg-gray-100 flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6 space-y-6" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <h2 className="text-2xl font-bold text-center text-gray-800">🎥 Video Broadcast (Sender)</h2>
        <div className="flex flex-col items-center gap-4">
          <input type="file" accept="video/*" onChange={handleFileChange} className="file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all" />
          
          {roomId && (
            <motion.div className="mt-6 w-full text-center space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
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
            </motion.div>
          )}

          {videoFile && (
            <div className="flex flex-col items-center gap-4 w-full">
              <motion.video ref={videoRef} src={videoFile} controls className="w-full max-w-2xl rounded-lg shadow-md" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }} />
              {!startBroadcast && (
                <motion.button onClick={() => setStartBroadcast(true)} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition" whileTap={{ scale: 0.95 }}>
                  Start Broadcast
                </motion.button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import { FaWhatsapp, FaInstagram, FaCopy } from 'react-icons/fa';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Sender() {
  const videoRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [startBroadcast, setStartBroadcast] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [copied, setCopied] = useState(false);
  const pcMap = useRef(new Map());

  useEffect(() => {
    socket.emit('create-room');
    socket.on('room-created', (id) => {
      console.log('Room created:', id);
      setRoomId(id);
    });
  }, []);

  useEffect(() => {
    if (!videoFile || !startBroadcast || !roomId) return;

    const handleViewerJoined = async (viewerSocketId) => {
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

      function drawFrame() {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      }
      drawFrame();

      const videoStream = canvas.captureStream(30);
      const audioTracks = video.captureStream().getAudioTracks();

      const fullStream = new MediaStream();
      videoStream.getVideoTracks().forEach((track) => fullStream.addTrack(track));
      audioTracks.forEach((track) => fullStream.addTrack(track.clone()));

      fullStream.getTracks().forEach((track) => pc.addTrack(track, fullStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { offer, target: viewerSocketId });

      pcMap.current.set(viewerSocketId, pc);
    };

    const handleAnswer = ({ answer, sender }) => {
      const pc = pcMap.current.get(sender);
      if (pc && pc.signalingState !== 'stable') {
        pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleCandidate = ({ candidate, sender }) => {
      const pc = pcMap.current.get(sender);
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => console.error(err));
      }
    };

    const emitPlayPause = (type) => {
      socket.emit('sync-control', { type });
    };

    socket.on('viewer-joined', handleViewerJoined);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleCandidate);

    const video = videoRef.current;
    video.addEventListener('play', () => emitPlayPause('play'));
    video.addEventListener('pause', () => emitPlayPause('pause'));

    return () => {
      socket.off('viewer-joined', handleViewerJoined);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleCandidate);
      pcMap.current.forEach((pc) => pc.close());
      pcMap.current.clear();
    };
  }, [videoFile, startBroadcast, roomId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setVideoFile(URL.createObjectURL(file));
  };

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
    <motion.div className="min-h-screen bg-gray-100 flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6 space-y-6" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <h2 className="text-2xl font-bold text-center text-gray-800">🎥 Video Broadcast (Sender)</h2>
        <div className="flex flex-col items-center gap-4">
          <input type="file" accept="video/*" onChange={handleFileChange} className="file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all" />
          
          {roomId && (
            <motion.div className="mt-6 w-full text-center space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
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
            </motion.div>
          )}

          {videoFile && (
            <div className="flex flex-col items-center gap-4 w-full">
              <motion.video ref={videoRef} src={videoFile} controls className="w-full max-w-2xl rounded-lg shadow-md" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }} />
              {!startBroadcast && (
                <motion.button onClick={() => setStartBroadcast(true)} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition" whileTap={{ scale: 0.95 }}>
                  Start Broadcast
                </motion.button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import { FaWhatsapp, FaInstagram, FaCopy } from 'react-icons/fa';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Sender() {
  const videoRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [startBroadcast, setStartBroadcast] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [copied, setCopied] = useState(false);
  const pcMap = useRef(new Map());

  useEffect(() => {
    socket.emit('create-room');
    socket.on('room-created', (id) => {
      console.log('Room created:', id);
      setRoomId(id);
    });
  }, []);

  useEffect(() => {
    if (!videoFile || !startBroadcast || !roomId) return;

    const handleViewerJoined = async (viewerSocketId) => {
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

      function drawFrame() {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      }
      drawFrame();

      const videoStream = canvas.captureStream(30);
      const audioTracks = video.captureStream().getAudioTracks();

      const fullStream = new MediaStream();
      videoStream.getVideoTracks().forEach((track) => fullStream.addTrack(track));
      audioTracks.forEach((track) => fullStream.addTrack(track.clone()));

      fullStream.getTracks().forEach((track) => pc.addTrack(track, fullStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { offer, target: viewerSocketId });

      pcMap.current.set(viewerSocketId, pc);
    };

    const handleAnswer = ({ answer, sender }) => {
      const pc = pcMap.current.get(sender);
      if (pc && pc.signalingState !== 'stable') {
        pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleCandidate = ({ candidate, sender }) => {
      const pc = pcMap.current.get(sender);
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => console.error(err));
      }
    };

    const emitPlayPause = (type) => {
      socket.emit('sync-control', { type });
    };

    socket.on('viewer-joined', handleViewerJoined);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleCandidate);

    const video = videoRef.current;
    video.addEventListener('play', () => emitPlayPause('play'));
    video.addEventListener('pause', () => emitPlayPause('pause'));

    return () => {
      socket.off('viewer-joined', handleViewerJoined);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleCandidate);
      pcMap.current.forEach((pc) => pc.close());
      pcMap.current.clear();
    };
  }, [videoFile, startBroadcast, roomId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setVideoFile(URL.createObjectURL(file));
  };

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
    <motion.div className="min-h-screen bg-gray-100 flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6 space-y-6" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <h2 className="text-2xl font-bold text-center text-gray-800">🎥 Video Broadcast (Sender)</h2>
        <div className="flex flex-col items-center gap-4">
          <input type="file" accept="video/*" onChange={handleFileChange} className="file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all" />
          
          {roomId && (
            <motion.div className="mt-6 w-full text-center space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
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
            </motion.div>
          )}

          {videoFile && (
            <div className="flex flex-col items-center gap-4 w-full">
              <motion.video ref={videoRef} src={videoFile} controls className="w-full max-w-2xl rounded-lg shadow-md" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }} />
              {!startBroadcast && (
                <motion.button onClick={() => setStartBroadcast(true)} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition" whileTap={{ scale: 0.95 }}>
                  Start Broadcast
                </motion.button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import { FaWhatsapp, FaInstagram, FaCopy } from 'react-icons/fa';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Sender() {
  const videoRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [startBroadcast, setStartBroadcast] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [copied, setCopied] = useState(false);
  const pcMap = useRef(new Map());

  useEffect(() => {
    socket.emit('create-room');
    socket.on('room-created', (id) => {
      console.log('Room created:', id);
      setRoomId(id);
    });
  }, []);

  useEffect(() => {
    if (!videoFile || !startBroadcast || !roomId) return;

    const handleViewerJoined = async (viewerSocketId) => {
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

      function drawFrame() {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      }
      drawFrame();

      const videoStream = canvas.captureStream(30);
      const audioTracks = video.captureStream().getAudioTracks();

      const fullStream = new MediaStream();
      videoStream.getVideoTracks().forEach((track) => fullStream.addTrack(track));
      audioTracks.forEach((track) => fullStream.addTrack(track.clone()));

      fullStream.getTracks().forEach((track) => pc.addTrack(track, fullStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { offer, target: viewerSocketId });

      pcMap.current.set(viewerSocketId, pc);
    };

    const handleAnswer = ({ answer, sender }) => {
      const pc = pcMap.current.get(sender);
      if (pc && pc.signalingState !== 'stable') {
        pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleCandidate = ({ candidate, sender }) => {
      const pc = pcMap.current.get(sender);
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => console.error(err));
      }
    };

    const emitPlayPause = (type) => {
      socket.emit('sync-control', { type });
    };

    socket.on('viewer-joined', handleViewerJoined);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleCandidate);

    const video = videoRef.current;
    video.addEventListener('play', () => emitPlayPause('play'));
    video.addEventListener('pause', () => emitPlayPause('pause'));

    return () => {
      socket.off('viewer-joined', handleViewerJoined);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleCandidate);
      pcMap.current.forEach((pc) => pc.close());
      pcMap.current.clear();
    };
  }, [videoFile, startBroadcast, roomId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setVideoFile(URL.createObjectURL(file));
  };

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
    <motion.div className="min-h-screen bg-gray-100 flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6 space-y-6" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <h2 className="text-2xl font-bold text-center text-gray-800">🎥 Video Broadcast (Sender)</h2>
        <div className="flex flex-col items-center gap-4">
          <input type="file" accept="video/*" onChange={handleFileChange} className="file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all" />
          
          {roomId && (
            <motion.div className="mt-6 w-full text-center space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
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
            </motion.div>
          )}

          {videoFile && (
            <div className="flex flex-col items-center gap-4 w-full">
              <motion.video ref={videoRef} src={videoFile} controls className="w-full max-w-2xl rounded-lg shadow-md" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }} />
              {!startBroadcast && (
                <motion.button onClick={() => setStartBroadcast(true)} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition" whileTap={{ scale: 0.95 }}>
                  Start Broadcast
                </motion.button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
