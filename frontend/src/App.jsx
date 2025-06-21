import React, { useState, useEffect } from 'react';
import { Sender } from './components/Sender';
import { Viewer } from './components/Viewer';

export default function App() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('roomId');
    if (roomId) setRole('viewer');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      {!role ? (
        <div className="bg-white rounded-xl p-6 shadow-md text-center">
          <h1 className="text-xl font-bold mb-4">Select Role</h1>
          <button onClick={() => setRole('sender')} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
            Sender
          </button>
        </div>
      ) : (
        <>
          {role === 'sender' ? <Sender /> : <Viewer />}
        </>
      )}
    </div>
  );
}
