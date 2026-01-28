import { auth, googleProvider } from "../../services/firebase";
import { signInWithPopup } from "firebase/auth";
import { MessageSquare, Chrome } from "lucide-react";

export default function Login({ setUser }) {
    const handleLogin = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            setUser(result.user);
        } catch (error) {
            console.error("Login failed:", error);
            alert("Failed to login with Google. Please check your Firebase configuration.");
        }
    };

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #00a884 0%, #008069 100%)',
            fontFamily: 'Outfit, sans-serif'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                textAlign: 'center',
                width: '100%',
                maxWidth: '400px',
                animation: 'fadeIn 0.6s ease-out'
            }}>
                <div style={{
                    backgroundColor: '#00a884',
                    width: '80px',
                    height: '80px',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    color: 'white',
                    boxShadow: '0 8px 16px rgba(0,168,132,0.3)'
                }}>
                    <MessageSquare size={40} />
                </div>

                <h1 style={{ fontSize: '28px', color: '#111b21', marginBottom: '8px', fontWeight: '600' }}>AuraChat</h1>
                <p style={{ color: '#667781', marginBottom: '32px', fontSize: '16px' }}>Connect with anyone, anywhere.</p>

                <button
                    onClick={handleLogin}
                    style={{
                        width: '100%',
                        padding: '14px',
                        backgroundColor: 'white',
                        border: '2px solid #e9edef',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                        color: '#111b21'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                        e.currentTarget.style.borderColor = '#00a884';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e9edef';
                    }}
                >
                    <Chrome size={20} color="#4285F4" />
                    Sign in with Google
                </button>

                <p style={{ marginTop: '24px', fontSize: '12px', color: '#8696a0' }}>
                    By signing in, you agree to our Terms and Conditions.
                </p>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
