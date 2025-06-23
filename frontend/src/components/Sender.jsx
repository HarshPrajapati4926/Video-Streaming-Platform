import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaVideo,
  FaLink,
  FaCopy,
  FaCheck,
  FaWhatsapp,
  FaFacebook,
  FaXTwitter,
} from 'react-icons/fa6';

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
      setRoomId(id);
    });

    return () => {
      socket.off('room-created');
    };
  }, []);

  useEffect(() => {
    if (!videoFile || !startBroadcast || !roomId) return;

    const handleViewerJoined = async (viewerSocketId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
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

      const stream = video.captureStream();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

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

    const handleIceCandidate = ({ candidate, sender }) => {
      const pc = pcMap.current.get(sender);
      if (pc && candidate) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    socket.on('viewer-joined', handleViewerJoined);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);

    return () => {
      pcMap.current.forEach((pc) => pc.close());
      pcMap.current.clear();

      socket.off('viewer-joined', handleViewerJoined);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
    };
  }, [videoFile, startBroadcast, roomId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoFile(url);
    }
  };

  const link = roomId ? `${window.location.origin}?roomId=${roomId}` : '';

  const handleCopy = () => {
    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center p-6"
    >
      <motion.div
        layout
        className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6 space-y-6"
      >
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl font-bold text-center text-gray-800 flex items-center justify-center gap-2"
        >
          <FaVideo className="text-blue-500" />
          Video Broadcast (Sender)
        </motion.h2>

        <div className="flex flex-col items-center gap-4">
          <motion.input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all"
            whileFocus={{ scale: 1.02 }}
          />

          <AnimatePresence>
            {videoFile && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-4 w-full"
              >
                <motion.video
                  ref={videoRef}
                  src={videoFile}
                  controls
                  className="w-full max-w-2xl rounded-lg shadow-md"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 100 }}
                />

                {!startBroadcast && (
                  <motion.button
                    onClick={() => setStartBroadcast(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                  >
                    Start Broadcast
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {link && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mt-6 text-center space-y-4"
              >
                <p className="text-gray-700 flex items-center justify-center gap-2">
                  <FaLink className="text-blue-500" />
                  Viewer Link:
                </p>

                <div className="flex items-center justify-center gap-2">
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline break-all max-w-xs"
                  >
                    {link}
                  </a>

                  <motion.button
                    onClick={handleCopy}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <motion.div
                        key="copied"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="text-green-600"
                      >
                        <FaCheck />
                      </motion.div>
                    ) : (
                      <FaCopy />
                    )}
                  </motion.button>
                </div>

                <AnimatePresence>
                  {copied && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-green-600 text-sm font-medium"
                    >
                      Copied to clipboard!
                    </motion.span>
                  )}
                </AnimatePresence>

                <motion.div
                  className="flex justify-center gap-4 mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    href={`https://api.whatsapp.com/send?text=Join%20my%20video%20stream:%20${encodeURIComponent(
                      link
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600 transition"
                    title="Share on WhatsApp"
                  >
                    <FaWhatsapp />
                  </motion.a>

                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
                    title="Share on Facebook"
                  >
                    <FaFacebook />
                  </motion.a>

                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    href={`https://twitter.com/intent/tweet?text=Join%20my%20video%20stream&url=${encodeURIComponent(
                      link
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-black text-white hover:bg-gray-800 transition"
                    title="Share on X"
                  >
                    <FaXTwitter />
                  </motion.a>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
