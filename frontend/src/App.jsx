import React, { useState, useEffect } from 'react';
import { Sender } from './components/Sender';
import { Viewer } from './components/Viewer';
import { motion } from 'framer-motion';
import { FaVideo, FaUserAlt } from 'react-icons/fa';
import './App.css';

export default function App() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('roomId');
    if (roomId) {
      setRole('viewer');
    }
  }, []);

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
          <div className="flex flex-col space-y-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setRole('sender')}
              className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
            >
              <FaVideo />
              Sender
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          {role === 'sender' && <Sender />}
          {role === 'viewer' && <Viewer />}
        </motion.div>
      )}
    </div>
  );
}
