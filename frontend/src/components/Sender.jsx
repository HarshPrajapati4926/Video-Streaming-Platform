import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaVideo, FaLink, FaCopy, FaCheck,
  FaWhatsapp, FaFacebook, FaXTwitter
} from 'react-icons/fa6';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Sender() {
  const videoRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [startBroadcast, setStartBroadcast] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    socket.emit('create-room');
    socket.on('room-created', id => setRoomId(id));
  }, []);

  useEffect(() => {
    if (!videoFile || !startBroadcast || !roomId) return;

    const pcMap = new Map();

    socket.on('viewer-joined', async viewerId => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcMap.set(viewerId, pc);

      pc.onicecandidate = e => {
        if (e.candidate) {
          socket.emit('ice-candidate', { candidate: e.candidate, target: viewerId });
        }
      };

      await videoRef.current.play();
      const stream = videoRef.current.captureStream();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { offer, target: viewerId });
    });

    socket.on('answer', ({ answer, from }) => {
      const pc = pcMap.get(from);
      if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', ({ candidate, from }) => {
      const pc = pcMap.get(from);
      if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      pcMap.forEach(pc => pc.close());
      socket.off('viewer-joined');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [videoFile, startBroadcast, roomId]);

  const handleFile = e => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(URL.createObjectURL(file));
    }
  };

  const link = roomId ? `${window.location.origin}?roomId=${roomId}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center p-6">
      <motion.div layout className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6 space-y-6">
        <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-center">
          <FaVideo className="inline text-blue-500 mr-2" />
          Broadcast
        </motion.h2>

        <motion.input type="file" accept="video/*" onChange={handleFile}
          className="file:px-4 file:py-2 file:rounded-lg file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all"
          whileFocus={{ scale: 1.02 }}
        />

        <AnimatePresence>
          {videoFile && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
              <motion.video ref={videoRef} src={videoFile} controls
                className="w-full max-w-2xl rounded-lg shadow-md"
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 100 }}
              />
              {!startBroadcast && (
                <motion.button onClick={() => setStartBroadcast(true)}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg"
                >
                  Start Broadcast
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {link && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.2 }} className="mt-6 space-y-4 text-center">
              <p className="flex items-center justify-center gap-2 text-gray-700">
                <FaLink className="text-blue-500" /> Viewer Link:
              </p>
              <div className="flex items-center justify-center gap-2">
                <a href={link} target="_blank" className="text-blue-600 underline max-w-xs">{link}</a>
                <motion.button onClick={handleCopy} whileTap={{ scale: 0.9 }} className="p-2 bg-gray-200 rounded-full">
                  {copied ? <FaCheck className="text-green-600"/> : <FaCopy />}
                </motion.button>
              </div>
              {copied && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-green-600">Copied!</motion.span>}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex justify-center gap-4">
                {[
                  { href: `https://api.whatsapp.com/send?text=${encodeURIComponent(link)}`, icon: FaWhatsapp, color: 'bg-green-500' },
                  { href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, icon: FaFacebook, color: 'bg-blue-600' },
                  { href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}`, icon: FaXTwitter, color: 'bg-black' },
                ].map(({ href, icon: Icon, color }) => (
                  <motion.a key={href} href={href} target="_blank" className={`${color} p-2 rounded-full text-white`} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <Icon />
                  </motion.a>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}