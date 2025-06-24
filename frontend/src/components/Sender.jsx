import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import { FaWhatsapp, FaInstagram, FaCopy } from 'react-icons/fa';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Sender() {
  const videoRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [roomId, setRoomId] = useState(() => {
    const idFromUrl = window.location.pathname.split('/')[2];
    return idFromUrl || crypto.randomUUID();
  });

  useEffect(() => {
    window.history.replaceState(null, '', `/sender/${roomId}`);
  }, [roomId]);

  useEffect(() => {
    socket.emit('sender-join', roomId);

    socket.on('viewer-count', count => {
      setViewerCount(count);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    if (!videoRef.current) return;

    const stream = videoRef.current.captureStream();
    let audioTracks = stream.getAudioTracks();

    socket.on('new-viewer', ({ viewerId }) => {
      const peer = new RTCPeerConnection();

      stream.getVideoTracks().forEach(track => peer.addTrack(track, stream));
      audioTracks.forEach(track => peer.addTrack(track.clone(), stream));

      peer.onicecandidate = e => {
        if (e.candidate) {
          socket.emit('ice-candidate', { viewerId, candidate: e.candidate });
        }
      };

      peer.createOffer()
        .then(offer => peer.setLocalDescription(offer))
        .then(() => {
          socket.emit('offer', { viewerId, offer: peer.localDescription });
        });

      socket.on('answer', ({ viewerId: vId, answer }) => {
        if (vId === viewerId) {
          peer.setRemoteDescription(answer);
        }
      });

      socket.on('ice-candidate', ({ viewerId: vId, candidate }) => {
        if (vId === viewerId && candidate) {
          peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });
    });
  }, [videoRef.current]);

  const handleFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    videoRef.current.src = url;
    videoRef.current.load();
    setVideoFile(file);
  };

  const handlePlay = () => {
    videoRef.current.play();
    setIsPlaying(true);
    socket.emit('sync-action', { action: 'play', roomId });
  };

  const handlePause = () => {
    videoRef.current.pause();
    setIsPlaying(false);
    socket.emit('sync-action', { action: 'pause', roomId });
  };

  const handleStop = () => {
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    setIsPlaying(false);
    socket.emit('sync-action', { action: 'stop', roomId });
  };

  const handleReset = () => {
    socket.emit('reset-stream', roomId);
    window.location.reload();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://video-platform.web.app/viewer/${roomId}`);
  };

  const shareText = encodeURIComponent(`Join my video stream: https://video-platform.web.app/viewer/${roomId}`);

  return (
    <div className="p-4 text-center">
      <h1 className="text-3xl font-bold mb-4">Broadcast Your Video</h1>
      <input type="file" accept="video/*" onChange={handleFileChange} className="mb-4" />
      <video ref={videoRef} controls className="mx-auto w-full max-w-3xl mb-4" />

      <div className="flex justify-center gap-4 mb-4">
        <button onClick={handlePlay} disabled={!videoFile || isPlaying} className="btn">Play</button>
        <button onClick={handlePause} disabled={!videoFile || !isPlaying} className="btn">Pause</button>
        <button onClick={handleStop} disabled={!videoFile} className="btn">Stop</button>
        <button onClick={handleReset} className="btn">Reset</button>
      </div>

      <p className="mb-2">Room ID: <span className="font-mono">{roomId}</span></p>
      <p className="mb-4">Viewers: {viewerCount}</p>

      <div className="flex justify-center gap-4">
        <motion.button whileHover={{ scale: 1.1 }} onClick={handleCopy} className="icon-btn">
          <FaCopy />
        </motion.button>
        <motion.a whileHover={{ scale: 1.1 }} href={`https://wa.me/?text=${shareText}`} target="_blank" className="icon-btn">
          <FaWhatsapp />
        </motion.a>
        <motion.a whileHover={{ scale: 1.1 }} href={`https://www.instagram.com/direct/inbox`} target="_blank" className="icon-btn">
          <FaInstagram />
        </motion.a>
      </div>
    </div>
  );
}
