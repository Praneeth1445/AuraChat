import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./services/firebase";
import Login from "./components/Auth/Login";
import Chat from "./components/Chat/Chat";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Update lastSeen periodically when user is logged in
  useEffect(() => {
    if (!user) return;

    const updatePresence = async () => {
      try {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          lastSeen: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error("Presence update failed:", e);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 120000); // Every 2 mins
    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f2f5'
      }}>
        <div className="loading-spinner" style={{
          width: '50px',
          height: '50px',
          border: '3px solid #e9edef',
          borderTop: '3px solid #00a884',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return user ? <Chat user={user} /> : <Login setUser={setUser} />;
}

export default App;
