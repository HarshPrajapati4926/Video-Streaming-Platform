import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://video-streaming-platform-bf1p.onrender.com', { transports: ['websocket'] });

export function Sender() {
  const videoRef = useRef();
  const [videoUrl, setVideoUrl] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const pcMap = useRef(new Map());

  useEffect(() => {
    socket.emit('create-room');
    socket.on('room-created', (id) => setRoomId(id));

    return () => {
      for (const pc of pcMap.current.values()) pc.close();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!broadcasting || !videoUrl || !roomId) return;

    socket.on('viewer-joined', async (viewerId) => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

      pc.onicecandidate = e => {
        if (e.candidate) {
          socket.emit('ice-candidate', { candidate: e.candidate, target: viewerId });
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

      const stream = canvas.captureStream(30);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('offer', { offer, target: viewerId });
      pcMap.current.set(viewerId, pc);
    });

    socket.on('answer', ({ answer, target }) => {
      const pc = pcMap.current.get(target);
      if (pc && pc.signalingState !== 'stable') {
        pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', ({ candidate, target }) => {
      const pc = pcMap.current.get(target);
      if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

  }, [broadcasting, videoUrl, roomId]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) setVideoUrl(URL.createObjectURL(file));
  };

  const shareLink = roomId ? `${window.location.origin}?roomId=${roomId}` : '';

  return (
    <div className="p-4">
      <input type="file" accept="video/*" onChange={handleFile} />
      {videoUrl && (
        <>
          <video ref={videoRef} src={videoUrl} controls className="my-4 w-full max-w-xl" />
          {!broadcasting && (
            <button onClick={() => setBroadcasting(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg">
              Start Broadcast
            </button>
          )}
        </>
      )}
      {shareLink && (
        <p className="mt-4">Share this link: <a href={shareLink} className="text-blue-600">{shareLink}</a></p>
      )}
    </div>
  );
}
