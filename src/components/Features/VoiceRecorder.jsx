import { useState, useRef } from 'react';
import { Mic, Square, Loader } from 'lucide-react';
import { storage } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const VoiceRecorder = ({ onUploadComplete }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await uploadAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Microphone access denied:", err);
            alert("Please enable microphone access to send voice messages.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const uploadAudio = async (blob) => {
        setIsUploading(true);
        try {
            const storageRef = ref(storage, `voice_messages/${Date.now()}.webm`);
            await uploadBytes(storageRef, blob);
            const url = await getDownloadURL(storageRef);
            onUploadComplete(url);
        } catch (error) {
            console.error("Voice upload failed:", error);
            alert("Failed to send voice message.");
        } finally {
            setIsUploading(false);
        }
    };

    if (isUploading) return <Loader className="animate-spin" size={24} color="#667781" />;

    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            {isRecording ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#ea0038',
                        borderRadius: '50%',
                        animation: 'pulse 1s infinite'
                    }} />
                    <button
                        type="button"
                        onClick={stopRecording}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ea0038' }}
                    >
                        <Square size={24} />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={startRecording}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f' }}
                >
                    <Mic size={24} />
                </button>
            )}
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.3; }
                    100% { opacity: 1; }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default VoiceRecorder;
