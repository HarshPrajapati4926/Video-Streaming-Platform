import React, { useState, useEffect } from 'react';
import { Sender } from './components/Sender';
import { Viewer } from './components/Viewer';
import { motion } from 'framer-motion';
import { FaVideo } from 'react-icons/fa';
import './App.css';

export default function App() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('roomId');
    if (roomId) {
      setRole('viewer');
    }
  }, []);

  const radarAnimation = {
    scale: [1, 2.2, 1],
    opacity: [0.3, 0, 0.3],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* FULLSCREEN BROADCAST BACKGROUND */}
      {!role && (
        <>
          <motion.div
            className="absolute inset-0 z-0 bg-gradient-to-br from-blue-200 via-white to-purple-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          />

          {/* Radar pulse effect centered fullscreen */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-[700px] h-[700px] -translate-x-1/2 -translate-y-1/2 bg-blue-400 rounded-full z-0 opacity-20"
            animate={radarAnimation}
          />
        </>
      )}

      {/* MAIN CARD */}
      {!role ? (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative bg-white shadow-2xl rounded-2xl p-10 max-w-md w-full text-center z-10"
        >
          <motion.div
            initial={{ rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: 'backOut' }}
            className="flex justify-center mb-6"
          >
            <FaVideo className="text-6xl text-blue-600 drop-shadow-md animate-pulse" />
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-3xl font-bold text-gray-800 mb-4"
          >
            Ready to Broadcast?
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-gray-500 mb-6"
          >
            Stream your video live to anyone with a link.
          </motion.p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setRole('sender')}
            className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 transition-all"
          >
            Start Broadcasting
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full z-10"
        >
          {role === 'sender' && <Sender />}
          {role === 'viewer' && <Viewer />}
        </motion.div>
      )}
    </div>
  );
}
