import React, { useState, useEffect } from 'react';
import { Sender } from './components/Sender';
import { Viewer } from './components/Viewer';
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      {!role ? (
        <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-6 text-gray-800">Select Role</h1>
          <div className="flex flex-col space-y-4">
            <button
              onClick={() => setRole('sender')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
            >
              Sender
            </button>
            {/* <button
              onClick={() => setRole('viewer')}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
            >
              Viewer
            </button> */}
          </div>
        </div>
      ) : (
        <div className="w-full">
          {role === 'sender' && <Sender />}
          {role === 'viewer' && <Viewer />}
        </div>
      )}
    </div>
  );
}
