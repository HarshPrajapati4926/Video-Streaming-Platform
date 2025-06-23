import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://video-streaming-platform-bf1p.onrender.com');

export function Sender() {
  const videoRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [startBroadcast, setStartBroadcast] = useState(false);
  const [roomId, setRoomId] = useState(null);

  useEffect(() => {
    socket.emit('create-room');
    socket.on('room-created', (id) => {
      setRoomId(id);
    });
  }, []);

  useEffect(() => {
    if (!videoFile || !startBroadcast || !roomId) return;

    const pcMap = new Map();

    socket.on('viewer-joined', async (viewerSocketId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.onicecandidate = e => {
        if (e.candidate) {
          socket.emit('ice-candidate', { candidate: e.candidate, target: viewerSocketId });
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

      let audioStream = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.error('Microphone access denied:', err);
      }

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioStream ? audioStream.getAudioTracks() : [])
      ]);

      combinedStream.getTracks().forEach(track => pc.addTrack(track, combinedStream));

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
      for (const pc of pcMap.values()) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      pcMap.forEach(pc => pc.close());
      socket.off('viewer-joined');
      socket.off('answer');
      socket.off('ice-candidate');
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

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6 space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-800">🎥 Video Broadcast (Sender)</h2>

        <div className="flex flex-col items-center gap-4">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all"
          />

          {videoFile && (
            <div className="flex flex-col items-center gap-4 w-full">
              <video
                ref={videoRef}
                src={videoFile}
                controls
                className="w-full max-w-2xl rounded-lg shadow-md"
              />

              {!startBroadcast && (
                <button
                  onClick={() => setStartBroadcast(true)}
                  className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                >
                  Start Broadcast
                </button>
              )}
            </div>
          )}

          {link && (
            <div className="mt-6 text-center">
              <p className="text-gray-700 mb-1">Viewer Link:</p>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline break-all"
              >
                {link}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
