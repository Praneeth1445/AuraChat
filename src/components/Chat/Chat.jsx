import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, where, deleteDoc, doc, updateDoc, arrayUnion, limit, getDocs } from "firebase/firestore";
import { db, auth, storage } from "../../services/firebase";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useEffect, useState, useRef, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import { parseBotCommand } from "../../utils/botService";
import VoiceRecorder from "../Features/VoiceRecorder";
import {
    Search,
    MoreVertical,
    MessageSquare,
    Send,
    Paperclip,
    Smile,
    LogOut,
    ArrowLeft,
    CheckCheck,
    Users,
    Trash2,
    ChevronDown,
    Circle,
    UserX,
    HelpCircle,
    Sun,
    Moon,
    Camera,
    Loader2,
    Settings2,
    ShieldCheck,
    Info,
    X
} from "lucide-react";

const detectEmotion = (text) => {
    const words = text.toLowerCase();

    // Happy
    if (
        words.includes("happy") || words.includes("love") || words.includes("great") ||
        words.includes("awesome") || words.includes("good") || words.includes("excited") ||
        words.includes("😊") || words.includes("😂") || words.includes("❤️") || words.includes("😍")
    ) return "happy";

    // Sad
    if (
        words.includes("sad") || words.includes("cry") || words.includes("sorry") ||
        words.includes("upset") || words.includes("lonely") || words.includes("hurt") ||
        words.includes("😭") || words.includes("😔") || words.includes("💔") || words.includes("😥")
    ) return "sad";

    // Angry
    if (
        words.includes("angry") || words.includes("hate") || words.includes("mad") ||
        words.includes("annoyed") || words.includes("furious") || words.includes("kill") ||
        words.includes("😡") || words.includes("😠") || words.includes("🤬") || words.includes("👿")
    ) return "angry";

    return "neutral";
};

const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Offline';
    const date = timestamp.toDate?.() || new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 5) return 'Online';
    if (diffMins < 60) return `Last seen ${diffMins}m ago`;
    if (diffMins < 1440) return `Last seen ${Math.floor(diffMins / 60)}h ago`;
    return `Last seen ${date.toLocaleDateString()}`;
};

const COMMON_EMOJIS = [
    "😊", "😂", "🤣", "❤️", "😍", "😒", "😭", "😘", "😔", "😩", "🙄", "😁", "☺️", "🤔", "🤨", "😐", "😑", "😏", "😣", "😥", "😮", "🤐", "😯", "😪", "😫", "🥱", "😴",
    "👍", "👎", "👌", "✌️", "🤞", "🤙", "🤝", "👏", "🙌", "👐", "🤲", "🙏", "💪", "🔥", "✨", "🎉", "🎈", "🎂", "🍎", "🍕", "🍔", "🍦", "⚽", "🚗", "🏠", "💻"
];

export default function Chat({ user }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedChat, setSelectedChat] = useState({ id: 'global', name: 'Global Group' });
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [activeToast, setActiveToast] = useState(null);
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [filterMode, setFilterMode] = useState('all'); // 'all' or 'active'
    const [showHelp, setShowHelp] = useState(false);
    const [notifPermission, setNotifPermission] = useState(Notification.permission);
    const { theme, setThemeByEmotion, toggleTheme, themeName, manualOverride, resetToAuto } = useTheme();
    const scrollRef = useRef(null);
    const audioRef = useRef(new Audio("/notify.mp3"));
    const seenMsgsRef = useRef(new Set());
    const isInitialMount = useRef(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [mobileShowChat, setMobileShowChat] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Sidebar & Profile states
    const [showSidebarMenu, setShowSidebarMenu] = useState(false);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newDisplayName, setNewDisplayName] = useState(user.displayName || "");
    const [newPhotoURL, setNewPhotoURL] = useState(user.photoURL || "");

    // Request Notification permission
    useEffect(() => {
        if ("Notification" in window) {
            if (Notification.permission === "default") {
                Notification.requestPermission().then(setNotifPermission);
            } else {
                setNotifPermission(Notification.permission);
            }
        }
    }, []);

    const getChatId = (uid1, uid2) => {
        if (!uid2) return 'global';
        return [uid1, uid2].sort().join('_');
    };

    const currentChatId = selectedChat.id === 'global' ? 'global' : getChatId(user.uid, selectedChat.uid || selectedChat.id);

    // Listen for users
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
            const usersData = snapshot.docs
                .map(doc => doc.data())
                .filter(u => u.uid !== user.uid);
            setUsers(usersData);

            if (selectedChat.id !== 'global') {
                const refreshedUser = usersData.find(u => u.uid === selectedChat.uid);
                if (refreshedUser) {
                    setSelectedChat(prev => ({ ...prev, ...refreshedUser }));
                }
            }
        }, (err) => console.error("Users list error:", err));
        return unsub;
    }, [user.uid, selectedChat.id, selectedChat.uid]);

    const [currentUserData, setCurrentUserData] = useState({
        displayName: user.displayName || "",
        photoURL: user.photoURL || ""
    });

    // Listen for current user's data (blocked list + profile)
    useEffect(() => {
        const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setBlockedUsers(data.blockedUsers || []);
                setCurrentUserData({
                    displayName: data.displayName || user.displayName || "",
                    photoURL: data.photoURL || user.photoURL || ""
                });
                setNewDisplayName(data.displayName || user.displayName || "");
                setNewPhotoURL(data.photoURL || user.photoURL || "");
            }
        });
        return unsub;
    }, [user.uid, user.displayName, user.photoURL]);

    // Listen for messages
    useEffect(() => {
        const q = query(
            collection(db, "messages"),
            where("chatId", "==", currentChatId)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const sortedMsgs = msgs.sort((a, b) => {
                const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
                const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
                return timeA - timeB;
            });

            setMessages(sortedMsgs);

            const lastMsg = sortedMsgs[sortedMsgs.length - 1];
            if (lastMsg && lastMsg.emotion) {
                setThemeByEmotion(lastMsg.emotion);
            } else {
                setThemeByEmotion('neutral');
            }
        }, (err) => {
            console.error("Messages sync error:", err);
        });
        return unsub;
    }, [currentChatId, setThemeByEmotion]);

    // Mark messages as read
    useEffect(() => {
        const markAsRead = async () => {
            const unreadMessages = messages.filter(m => m.uid !== user.uid && !m.read);
            if (unreadMessages.length > 0) {
                const batch = unreadMessages.map(m => updateDoc(doc(db, "messages", m.id), { read: true }));
                await Promise.all(batch);
            }
        };
        if (currentChatId !== 'global') {
            markAsRead();
        }
    }, [messages, currentChatId, user.uid]);

    // Global Listener for Notifications
    useEffect(() => {
        const q = query(
            collection(db, "messages"),
            orderBy("createdAt", "desc"),
            limit(15)
        );

        const listenerStartedAt = Date.now();

        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const msg = { id: change.doc.id, ...change.doc.data() };

                    if (seenMsgsRef.current.has(msg.id)) return;
                    seenMsgsRef.current.add(msg.id);

                    // Skip messages sent before the listener started
                    const msgTime = msg.createdAt?.toDate?.()?.getTime() || Date.now();
                    if (msgTime < listenerStartedAt - 5000) return;

                    const isFromMe = msg.uid === user.uid;
                    const isForCurrentChat = msg.chatId === currentChatId;
                    const isTabBg = document.hidden || !document.hasFocus();

                    if (!isFromMe) {
                        // UI Notification (Toast/Sidebar)
                        // Trigger if user is in another chat OR tab is in background
                        if (!isForCurrentChat || isTabBg) {
                            setNotifications(prev => {
                                if (prev.find(n => n.id === msg.id)) return prev;
                                return [msg, ...prev].slice(0, 20);
                            });
                            setActiveToast(msg);
                            audioRef.current.play().catch(() => { });
                        }

                        // Browser Notification - if in background OR in another chat
                        if (isTabBg || !isForCurrentChat) {
                            if ("Notification" in window && Notification.permission === "granted" && isTabBg) {
                                new Notification(
                                    isForCurrentChat ? `Message in ${selectedChat.name}` : `New message from ${msg.name}`,
                                    {
                                        body: msg.type === 'voice' ? '🎤 Voice message' : msg.text,
                                        icon: msg.photoURL || '/favicon.ico',
                                        tag: msg.chatId,
                                        renotify: true
                                    }
                                );
                            }
                        }
                    }
                }
            });
        }, (err) => console.error("Notification listener error:", err));

        return unsub;
    }, [user.uid, currentChatId, selectedChat.name]);

    // Toast auto-dismiss
    useEffect(() => {
        if (activeToast) {
            const timer = setTimeout(() => setActiveToast(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [activeToast]);

    // Update currentChatId when notifications are clicked
    const handleNotificationClick = (notif) => {
        if (notif.chatId === 'global') {
            setSelectedChat({ id: 'global', name: 'Global Group' });
        } else {
            // Find the other user's UID from the composite chatId
            const uids = notif.chatId.split('_');
            const otherUid = uids.find(id => id !== user.uid);
            const targetUser = users.find(u => u.uid === otherUid);
            if (targetUser) {
                setSelectedChat({ id: otherUid, name: targetUser.displayName, ...targetUser });
            }
        }
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
        setShowNotifications(false);
        if (isMobile) setMobileShowChat(true);
    };

    // UI Click-away for menus
    useEffect(() => {
        const handleClickAway = () => {
            setOpenMenuId(null);
            setShowEmojiPicker(false);
            setShowHeaderMenu(false);
            setShowNotifications(false);
            setShowSidebarMenu(false);
        };
        window.addEventListener('click', handleClickAway);
        return () => window.removeEventListener('click', handleClickAway);
    }, []);

    const sendSystemMessage = useCallback(async (content) => {
        try {
            await addDoc(collection(db, "messages"), {
                text: content,
                type: "system",
                name: "AuraBot",
                chatId: currentChatId,
                createdAt: serverTimestamp(),
            });
        } catch (e) {
            console.error("System message failed:", e);
        }
    }, [currentChatId]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleVoiceUpload = async (audioUrl) => {
        try {
            await addDoc(collection(db, "messages"), {
                audioUrl,
                type: "voice",
                name: user.displayName,
                uid: user.uid,
                photoURL: user.photoURL,
                chatId: currentChatId,
                createdAt: serverTimestamp(),
                deletedBy: [],
                read: false
            });
        } catch (e) {
            console.error("Voice message failed:", e);
        }
    };

    const sendMessage = async (e) => {
        if (e) e.preventDefault();
        const messageText = text.trim();
        if (!messageText) return;

        if (messageText.startsWith('/')) {
            const botAction = parseBotCommand(messageText);
            if (botAction) {
                await sendSystemMessage(botAction.response);
                if (botAction.command === 'remind') {
                    setTimeout(() => {
                        sendSystemMessage(`🔔 REMINDER: ${botAction.message}`);
                    }, botAction.time * 1000);
                }
                setText("");
                return;
            }
        }

        const emotion = detectEmotion(messageText);

        // Optimistically update sender's theme
        setThemeByEmotion(emotion);

        try {
            await addDoc(collection(db, "messages"), {
                text: messageText,
                name: user.displayName,
                uid: user.uid,
                photoURL: user.photoURL,
                emotion,
                chatId: currentChatId,
                createdAt: serverTimestamp(),
                deletedBy: [],
                read: false
            });
            setText("");
            setShowEmojiPicker(false);
        } catch (e) {
            console.error("Send message failed:", e);
        }
    };

    const deleteForMe = async (msgId) => {
        try {
            await updateDoc(doc(db, "messages", msgId), {
                deletedBy: arrayUnion(user.uid)
            });
            setOpenMenuId(null);
        } catch (e) {
            console.error("Delete for me failed:", e);
        }
    };

    const deleteForEveryone = async (msgId) => {
        try {
            await deleteDoc(doc(db, "messages", msgId));
            setOpenMenuId(null);
        } catch (e) {
            console.error("Delete for everyone failed:", e);
        }
    };

    const clearChat = async () => {
        if (messages.length === 0) return;
        if (!window.confirm("Are you sure you want to clear all messages in this chat? This cannot be undone.")) return;

        try {
            const deletePromises = messages.map(msg => deleteDoc(doc(db, "messages", msg.id)));
            await Promise.all(deletePromises);
            setShowHeaderMenu(false);
        } catch (e) {
            console.error("Clear chat failed:", e);
        }
    };

    const removeUser = async (uid) => {
        if (!uid) return;
        if (!window.confirm("Are you sure you want to remove this user? They will disappear from your chat list.")) return;

        try {
            await updateDoc(doc(db, "users", user.uid), {
                blockedUsers: arrayUnion(uid)
            });
            if (selectedChat.uid === uid || selectedChat.id === uid) {
                setSelectedChat({ id: 'global', name: 'Global Group' });
            }
            setShowHeaderMenu(false);
        } catch (e) {
            console.error("Remove user failed:", e);
        }
    };

    const handleProfileUpdate = async (e) => {
        if (e) e.preventDefault();
        try {
            setIsUploading(true);
            await updateProfile(auth.currentUser, {
                displayName: newDisplayName,
                photoURL: newPhotoURL
            });
            await updateDoc(doc(db, "users", user.uid), {
                displayName: newDisplayName,
                photoURL: newPhotoURL
            });
            setShowProfileEdit(false);
            setShowSidebarMenu(false);
        } catch (error) {
            console.error("Profile update failed:", error);
            alert("Failed to update profile.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            setIsUploading(true);
            const storageRef = ref(storage, `profiles/${user.uid}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setNewPhotoURL(url);
        } catch (error) {
            console.error("File upload failed:", error);
            alert("Failed to upload image.");
        } finally {
            setIsUploading(false);
        }
    };

    const markAllAsRead = async () => {
        try {
            setShowSidebarMenu(false);
            const q = query(collection(db, "messages"), where("read", "==", false));
            const querySnapshot = await getDocs(q);
            const promises = [];
            querySnapshot.forEach((m) => {
                const data = m.data();
                if (data.uid !== user.uid) {
                    promises.push(updateDoc(doc(db, "messages", m.id), { read: true }));
                }
            });
            await Promise.all(promises);
            console.log("All messages marked as read");
        } catch (e) {
            console.error("Mark all read failed:", e);
        }
    };

    const clearAllNotifications = () => {
        setNotifications([]);
        setShowSidebarMenu(false);
    };

    const addEmoji = (emoji) => {
        setText(prev => prev + emoji);
    };

    const filteredUsers = users.filter(u => {
        const name = (u.displayName || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const search = searchTerm.toLowerCase();
        return name.includes(search) || email.includes(search);
    });

    const activeUsers = users.filter(u => formatLastSeen(u.lastSeen) === 'Online');

    const displayUsers = filteredUsers.filter(u => {
        if (blockedUsers.includes(u.uid)) return false;
        // If searching, show all matching results regardless of filter mode
        if (searchTerm.trim() !== "") return true;
        if (filterMode === 'all') return true;
        return formatLastSeen(u.lastSeen) === 'Online';
    });

    const visibleMessages = messages.filter(msg =>
        !msg.deletedBy?.includes(user.uid) &&
        !blockedUsers.includes(msg.uid) &&
        !(msg.type === 'system' && msg.text?.includes('screenshot'))
    );

    return (
        <div className="app-container" style={{
            backgroundColor: theme.background,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.5s ease',
            height: isMobile ? '100%' : '100vh',
            width: '100%',
            overflow: 'hidden'
        }}>
            <div
                className="glass smooth-transition"
                style={{
                    width: '100%',
                    maxWidth: isMobile ? '100%' : '1200px',
                    height: isMobile ? '100%' : '90vh',
                    display: 'flex',
                    borderRadius: isMobile ? '0' : '24px',
                    overflow: 'hidden',
                    backgroundColor: themeName === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.7)',
                    border: `1px solid ${theme.accent}44`
                }}>
                {/* Sidebar */}
                <aside style={{
                    width: isMobile ? '100%' : '360px',
                    minWidth: isMobile ? '100%' : '360px',
                    borderRight: `1px solid ${theme.accent}33`,
                    display: (isMobile && mobileShowChat) ? 'none' : 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    backgroundColor: themeName === 'dark' ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <header style={{
                        padding: '16px 20px',
                        backgroundColor: `${theme.accent}22`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: `1px solid ${theme.accent}33`
                    }}>
                        <div style={{ position: 'relative', width: '42px', height: '42px' }}>
                            <img
                                src={currentUserData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData.displayName)}&background=random`}
                                alt="profile"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '12px',
                                    border: `2px solid ${theme.primary}55`,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    objectFit: 'cover'
                                }}
                            />
                            <div style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '12px',
                                height: '12px',
                                backgroundColor: '#22c55e',
                                borderRadius: '50%',
                                border: '2px solid white'
                            }} />
                        </div>
                        <div style={{ display: 'flex', gap: isMobile ? '12px' : '16px', color: theme.secondaryText, position: 'relative', alignItems: 'center' }}>
                            <div style={{ position: 'relative', cursor: 'pointer', display: 'flex' }} onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); setShowSidebarMenu(false); }}>
                                <MessageSquare size={20} />
                                {notifications.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-8px',
                                        right: '-8px',
                                        backgroundColor: '#ef4444',
                                        color: 'white',
                                        fontSize: '10px',
                                        borderRadius: '50%',
                                        width: '18px',
                                        height: '18px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        border: '2px solid white',
                                        zIndex: 10
                                    }}>
                                        {notifications.length}
                                    </div>
                                )}

                                {showNotifications && (
                                    <div onClick={(e) => e.stopPropagation()} style={{
                                        position: 'absolute',
                                        top: '35px',
                                        right: isMobile ? '-50px' : '0',
                                        backgroundColor: themeName === 'dark' ? '#1e293b' : '#ffffff',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                        borderRadius: '12px',
                                        zIndex: 2000,
                                        width: isMobile ? '280px' : '320px',
                                        maxHeight: '400px',
                                        overflowY: 'auto',
                                        padding: '8px 0',
                                        animation: 'fadeIn 0.2s ease',
                                        border: `1px solid ${theme.accent}`
                                    }}>
                                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.accent}`, fontWeight: '600', fontSize: '14px', color: theme.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            Notifications
                                            <X size={14} style={{ cursor: 'pointer' }} onClick={() => setShowNotifications(false)} />
                                        </div>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '24px', textAlign: 'center', color: theme.secondaryText, fontSize: '13px' }}>
                                                No new messages
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleNotificationClick(n)}
                                                    style={{
                                                        padding: '12px 16px',
                                                        cursor: 'pointer',
                                                        borderBottom: `1px solid ${theme.accent}`,
                                                        transition: 'all 0.2s',
                                                        display: 'flex',
                                                        gap: '12px',
                                                        alignItems: 'center',
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = `${theme.primary}15`}
                                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <img src={n.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.name)}`} alt={n.name} style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', alignItems: 'center' }}>
                                                            <span style={{ fontWeight: '700', fontSize: '13px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {n.name}
                                                            </span>
                                                            <div style={{
                                                                fontSize: '9px',
                                                                padding: '2px 6px',
                                                                borderRadius: '6px',
                                                                backgroundColor: n.emotion === 'happy' ? '#22c55e' :
                                                                    n.emotion === 'sad' ? '#3b82f6' :
                                                                        n.emotion === 'angry' ? '#ef4444' :
                                                                            theme.primary,
                                                                color: 'white',
                                                                fontWeight: 'bold',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {n.emotion || 'msg'}
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: theme.secondaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {n.type === 'voice' ? '🎤 Voice message' : n.text}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {!isMobile && (
                                <>
                                    <div style={{ position: 'relative' }}>
                                        <HelpCircle
                                            size={20}
                                            style={{
                                                cursor: 'pointer',
                                                color: notifPermission !== 'granted' ? theme.primary : theme.secondaryText,
                                                animation: notifPermission !== 'granted' ? 'pulse 2s infinite' : 'none'
                                            }}
                                            onClick={() => setShowHelp(true)}
                                            title="Help & Notifications"
                                        />
                                    </div>
                                    {themeName === 'dark' ? (
                                        <Sun size={20} style={{ cursor: 'pointer' }} onClick={toggleTheme} title="Switch Theme" />
                                    ) : (
                                        <Moon size={20} style={{ cursor: 'pointer' }} onClick={toggleTheme} title="Switch Theme" />
                                    )}
                                </>
                            )}

                            <div style={{ position: 'relative', display: 'flex' }}>
                                <MoreVertical
                                    size={20}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSidebarMenu(!showSidebarMenu);
                                    }}
                                />
                                {showSidebarMenu && (
                                    <div
                                        className="glass"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            position: 'absolute',
                                            top: '35px',
                                            right: '0',
                                            width: '220px',
                                            borderRadius: '16px',
                                            zIndex: 2000,
                                            padding: '8px',
                                            animation: 'fadeIn 0.2s ease',
                                            backgroundColor: themeName === 'dark' ? '#1e293b' : '#ffffff',
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                            border: `1px solid ${theme.accent}`
                                        }}
                                    >
                                        {[
                                            { icon: <Settings2 size={16} />, label: 'Edit Profile', action: () => setShowProfileEdit(true) },
                                            { icon: <ShieldCheck size={16} />, label: 'Mark all as Read', action: markAllAsRead },
                                            { icon: <Trash2 size={16} />, label: 'Clear Notifications', action: clearAllNotifications },
                                            ...(isMobile ? [
                                                { icon: themeName === 'dark' ? <Sun size={16} /> : <Moon size={16} />, label: themeName === 'dark' ? 'Light Mode' : 'Dark Mode', action: toggleTheme },
                                                { icon: <HelpCircle size={16} />, label: 'Help & Notifs', action: () => setShowHelp(true) }
                                            ] : []),
                                            { icon: <Info size={16} />, label: 'About AuraChat', action: () => setShowAbout(true) },
                                            { icon: <LogOut size={16} />, label: 'Logout', action: () => auth.signOut() },
                                        ].map((item, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => { item.action(); setShowSidebarMenu(false); }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px 16px',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    color: theme.text,
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.backgroundColor = `${theme.primary}15`;
                                                    e.currentTarget.style.color = theme.primary;
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = theme.text;
                                                }}
                                            >
                                                {item.icon} {item.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {!isMobile && (
                                <LogOut size={20} onClick={() => auth.signOut()} style={{ cursor: 'pointer' }} title="Logout" />
                            )}
                        </div>
                    </header>

                    {/* Filter Tabs */}
                    <div style={{
                        display: 'flex',
                        padding: '8px 16px',
                        backgroundColor: theme.chatBubble,
                        borderBottom: `1px solid ${theme.accent}`,
                        gap: '10px'
                    }}>
                        <button
                            onClick={() => setFilterMode('all')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '20px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: filterMode === 'all' ? '600' : '400',
                                backgroundColor: filterMode === 'all' ? theme.primary : theme.accent,
                                color: filterMode === 'all' ? 'white' : theme.secondaryText,
                                transition: 'all 0.3s'
                            }}
                        >
                            All Chats
                        </button>
                        <button
                            onClick={() => setFilterMode('active')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '20px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: filterMode === 'active' ? '600' : '400',
                                backgroundColor: filterMode === 'active' ? '#25D366' : theme.accent,
                                color: filterMode === 'active' ? 'white' : theme.secondaryText,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.3s'
                            }}
                        >
                            <div style={{ width: '8px', height: '8px', backgroundColor: '#25D366', borderRadius: '50%', boxShadow: '0 0 5px rgba(37,211,102,0.5)' }} />
                            Active ({activeUsers.length})
                        </button>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: 'transparent' }}>
                        <div style={{
                            backgroundColor: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 14px',
                            gap: '12px',
                            border: `1px solid ${theme.accent}22`
                        }}>
                            <Search size={18} color={theme.secondaryText} />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search conversations..."
                                style={{
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    outline: 'none',
                                    width: '100%',
                                    fontSize: '14px',
                                    color: theme.text,
                                    fontWeight: '500'
                                }}
                            />
                            {searchTerm && (
                                <X
                                    size={16}
                                    style={{ cursor: 'pointer', color: theme.secondaryText }}
                                    onClick={() => setSearchTerm("")}
                                />
                            )}
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {/* Global Chat Item - only show in 'all' mode and not searching */}
                        {filterMode === 'all' && !searchTerm && (
                            <div
                                onClick={() => {
                                    setSelectedChat({ id: 'global', name: 'Global Group' });
                                    if (isMobile) setMobileShowChat(true);
                                }}
                                style={{
                                    padding: '12px 16px',
                                    display: 'flex',
                                    gap: '15px',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    backgroundColor: selectedChat.id === 'global' ? theme.accent : 'transparent',
                                    borderBottom: `1px solid ${theme.accent}`,
                                    transition: 'background-color 0.5s ease'
                                }}
                            >
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    backgroundColor: theme.primary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white'
                                }}>
                                    <Users size={24} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '500', color: theme.text }}>Global Group</h4>
                                        <span style={{ fontSize: '12px', color: theme.secondaryText }}>Community</span>
                                    </div>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: theme.secondaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        Talk to everyone in AuraChat
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Private Users */}
                        {displayUsers.map((u) => (
                            <div
                                key={u.uid}
                                onClick={() => {
                                    setSelectedChat({ ...u, id: u.uid, name: u.displayName });
                                    if (isMobile) setMobileShowChat(true);
                                }}
                                className="smooth-transition"
                                style={{
                                    padding: '14px 20px',
                                    display: 'flex',
                                    gap: '16px',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    backgroundColor: selectedChat.id === u.uid ? `${theme.primary}15` : 'transparent',
                                    margin: '4px 8px',
                                    borderRadius: '16px',
                                    borderLeft: selectedChat.id === u.uid ? `4px solid ${theme.primary}` : '4px solid transparent',
                                    transform: selectedChat.id === u.uid ? 'scale(1.02)' : 'scale(1)'
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedChat.id !== u.uid) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)';
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedChat.id !== u.uid) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <div style={{ position: 'relative' }}>
                                    <img src={u.photoURL} alt={u.displayName} style={{ width: '50px', height: '50px', borderRadius: '14px', objectFit: 'cover' }} />
                                    {formatLastSeen(u.lastSeen) === 'Online' && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '-2px',
                                            right: '-2px',
                                            width: '14px',
                                            height: '14px',
                                            backgroundColor: '#22c55e',
                                            borderRadius: '50%',
                                            border: `3px solid ${theme.chatBubble}`,
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }} />
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.displayName}</h4>
                                        <span style={{ fontSize: '11px', color: theme.secondaryText, fontWeight: '500' }}>{formatLastSeen(u.lastSeen)}</span>
                                    </div>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: theme.secondaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8 }}>
                                        {u.email || 'AuraChat User'}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {displayUsers.length === 0 && (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: theme.secondaryText, fontSize: '14px' }}>
                                {filterMode === 'active' ? "No users are currently online." : "No users found."}
                            </div>
                        )}
                    </div>
                </aside >

                {/* Main Chat Area */}
                < main style={{
                    flex: 1,
                    display: (isMobile && !mobileShowChat) ? 'none' : 'flex',
                    flexDirection: 'column',
                    backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                    backgroundColor: theme.background,
                    position: 'relative',
                    transition: 'background-color 0.5s ease',
                    height: '100%'
                }
                }>
                    <header style={{
                        padding: isMobile ? '12px 16px' : '10px 16px',
                        backgroundColor: theme.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderLeft: isMobile ? 'none' : '1px solid #e9edef',
                        zIndex: 30,
                        transition: 'background-color 0.5s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '12px' }}>
                            {isMobile && (
                                <ArrowLeft
                                    size={24}
                                    style={{ cursor: 'pointer', color: theme.text }}
                                    onClick={() => setMobileShowChat(false)}
                                />
                            )}
                            {selectedChat.id === 'global' ? (
                                <div style={{
                                    width: isMobile ? '45px' : '40px',
                                    height: isMobile ? '45px' : '40px',
                                    borderRadius: '50%',
                                    backgroundColor: theme.primary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white'
                                }}>
                                    <Users size={20} />
                                </div>
                            ) : (
                                <img src={selectedChat.photoURL} alt="profile" style={{ width: isMobile ? '45px' : '40px', height: isMobile ? '45px' : '40px', borderRadius: '50%', objectFit: 'cover' }} />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', color: theme.text, margin: 0 }}>{selectedChat.name}</h3>
                                <p style={{ fontSize: '12px', color: theme.secondaryText, margin: 0, opacity: 0.8 }}>
                                    {selectedChat.id === 'global' ? 'Global Community' : formatLastSeen(selectedChat.lastSeen)}
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '20px', color: theme.secondaryText, position: 'relative' }}>
                            <Search size={20} style={{ cursor: 'pointer' }} />
                            <MoreVertical
                                size={20}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowHeaderMenu(!showHeaderMenu);
                                }}
                            />
                            {showHeaderMenu && (
                                <div style={{
                                    position: 'absolute',
                                    top: '30px',
                                    right: '0',
                                    backgroundColor: theme.chatBubble,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                    borderRadius: '8px',
                                    zIndex: 100,
                                    padding: '6px 0',
                                    width: '180px',
                                    animation: 'fadeIn 0.15s ease'
                                }}>
                                    <div
                                        onClick={clearChat}
                                        style={{
                                            padding: '10px 16px',
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            color: '#d32f2f',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fff5f5'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <Trash2 size={16} color="#d32f2f" /> Clear chat
                                    </div>
                                    {selectedChat.id !== 'global' && (
                                        <div
                                            onClick={() => removeUser(selectedChat.uid || selectedChat.id)}
                                            style={{
                                                padding: '10px 16px',
                                                fontSize: '14px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                color: '#d32f2f',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fff5f5'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <UserX size={16} color="#d32f2f" /> Remove User
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </header>

                    {activeToast && (
                        <div
                            onClick={() => handleNotificationClick(activeToast)}
                            className="glass"
                            style={{
                                position: 'absolute',
                                top: isMobile ? '70px' : '80px',
                                right: isMobile ? '10px' : '20px',
                                left: isMobile ? '10px' : 'auto',
                                backgroundColor: themeName === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                                borderRadius: '16px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                zIndex: 1000,
                                cursor: 'pointer',
                                border: `1px solid ${activeToast.emotion === 'happy' ? '#22c55e' :
                                    activeToast.emotion === 'sad' ? '#60a5fa' :
                                        activeToast.emotion === 'angry' ? '#f87171' :
                                            theme.primary
                                    }44`,
                                borderLeft: `6px solid ${activeToast.emotion === 'happy' ? '#22c55e' :
                                    activeToast.emotion === 'sad' ? '#60a5fa' :
                                        activeToast.emotion === 'angry' ? '#f87171' :
                                            theme.primary
                                    }`,
                                animation: 'slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                maxWidth: '320px'
                            }}
                        >
                            <img src={activeToast.photoURL} alt="" style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'cover', border: `2px solid ${theme.accent}` }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    color: activeToast.emotion === 'happy' ? '#166534' :
                                        activeToast.emotion === 'sad' ? '#1e40af' :
                                            activeToast.emotion === 'angry' ? '#991b1b' :
                                                theme.primary,
                                    marginBottom: '2px'
                                }}>
                                    {activeToast.name} {activeToast.chatId === 'global' ? '• Global' : '• Private'}
                                </div>
                                <div style={{ fontSize: '13px', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.9 }}>
                                    {activeToast.type === 'voice' ? '🎤 Voice message' : activeToast.text}
                                </div>
                            </div>
                            <div
                                onClick={(e) => { e.stopPropagation(); setActiveToast(null); }}
                                style={{ padding: '4px', borderRadius: '50%', backgroundColor: `${theme.accent}44`, display: 'flex' }}
                            >
                                <X size={14} color={theme.secondaryText} />
                            </div>
                        </div>
                    )}

                    {/* Messages Body */}
                    <div
                        className="animate-fade-in"
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            padding: isMobile ? '20px 16px' : '24px 40px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            backgroundColor: themeName === 'dark' ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(5px)',
                            position: 'relative'
                        }}
                    >
                        {visibleMessages.length === 0 && (
                            <div className="glass" style={{ alignSelf: 'center', marginTop: '40px', color: theme.secondaryText, padding: '12px 32px', borderRadius: '20px', fontWeight: '500' }}>
                                Start a fresh conversation! 👋
                            </div>
                        )}
                        {visibleMessages.map((msg) => (
                            msg.type === 'system' ? (
                                <div key={msg.id} style={{
                                    alignSelf: 'center',
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    fontSize: '12.5px',
                                    color: theme.secondaryText,
                                    margin: '10px 0',
                                    boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)'
                                }}>
                                    {msg.text}
                                </div>
                            ) : (
                                <div key={msg.id}
                                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                                    onMouseLeave={() => setHoveredMessageId(null)}
                                    style={{
                                        alignSelf: msg.uid === user.uid ? 'flex-end' : 'flex-start',
                                        backgroundColor: msg.uid === user.uid ? theme.primary : theme.chatBubble,
                                        padding: '10px 14px',
                                        borderRadius: msg.uid === user.uid ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                        maxWidth: '75%',
                                        position: 'relative',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                        border: msg.uid === user.uid ? 'none' : `1px solid ${theme.accent}44`,
                                        color: msg.uid === user.uid ? '#ffffff' : theme.text,
                                        animation: 'fadeIn 0.3s ease-out'
                                    }}
                                >
                                    {/* Action Toggle */}
                                    {(hoveredMessageId === msg.id || openMenuId === msg.id) && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === msg.id ? null : msg.id);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '4px',
                                                right: '4px',
                                                cursor: 'pointer',
                                                backgroundColor: 'rgba(255,255,255,0.7)',
                                                borderRadius: '50%',
                                                padding: '2px',
                                                zIndex: 10
                                            }}
                                        >
                                            <ChevronDown size={16} color={theme.secondaryText} />
                                        </div>
                                    )}

                                    {/* Custom Context Menu */}
                                    {openMenuId === msg.id && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                position: 'absolute',
                                                top: '25px',
                                                right: '0px',
                                                backgroundColor: theme.chatBubble,
                                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                                borderRadius: '8px',
                                                zIndex: 100,
                                                padding: '6px 0',
                                                width: '180px',
                                                animation: 'fadeIn 0.15s ease'
                                            }}
                                        >
                                            <div
                                                onClick={() => deleteForMe(msg.id)}
                                                style={{
                                                    padding: '10px 16px',
                                                    fontSize: '14px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    color: theme.text,
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = theme.accent}
                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <Trash2 size={16} color={theme.secondaryText} /> Delete for me
                                            </div>
                                            {msg.uid === user.uid && (
                                                <div
                                                    onClick={() => deleteForEveryone(msg.id)}
                                                    style={{
                                                        padding: '10px 16px',
                                                        fontSize: '14px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        color: '#d32f2f',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fff5f5'}
                                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <Trash2 size={16} color="#d32f2f" /> Delete for everyone
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Sender Name in Global */}
                                    {msg.uid !== user.uid && selectedChat.id === 'global' && (
                                        <div style={{ fontSize: '13px', fontWeight: '600', color: theme.primary, marginBottom: '2px' }}>
                                            {msg.name}
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div style={{
                                        fontSize: '14.5px',
                                        overflowWrap: 'anywhere',
                                        wordBreak: 'normal',
                                        lineHeight: '1.5'
                                    }}>
                                        {msg.type === 'voice' ? (
                                            <audio src={msg.audioUrl} controls style={{ maxWidth: '200px', height: '35px' }} />
                                        ) : (
                                            msg.text
                                        )}
                                    </div>

                                    {/* Metadata */}
                                    <div style={{
                                        fontSize: '11px',
                                        color: msg.uid === user.uid ? 'rgba(255,255,255,0.7)' : theme.secondaryText,
                                        textAlign: 'right',
                                        marginTop: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        gap: '4px'
                                    }}>
                                        {new Date(msg.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {msg.uid === user.uid && (
                                            <CheckCheck
                                                size={15}
                                                color={msg.read ? "#34B7F1" : 'rgba(255,255,255,0.7)'}
                                                style={{ marginLeft: '2px' }}
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        ))}
                        <style>{`
                            @keyframes slideInRight {
                                from { transform: translateX(100%); opacity: 0; }
                                to { transform: translateX(0); opacity: 1; }
                            }
                            @keyframes fadeIn {
                                from { opacity: 0; transform: translateY(-5px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                        `}</style>
                        <div ref={scrollRef} />
                    </div>

                    {/* Input Area */}
                    <footer style={{
                        padding: isMobile ? '12px 14px' : '16px 24px',
                        backgroundColor: isMobile ? theme.accent : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? '10px' : '16px',
                        borderTop: `1px solid ${theme.accent}33`,
                        backdropFilter: isMobile ? 'none' : 'blur(20px)',
                        boxShadow: isMobile ? '0 -2px 10px rgba(0,0,0,0.05)' : 'none'
                    }}>
                        <div className="smooth-transition" style={{ backgroundColor: isMobile ? 'transparent' : `${theme.accent}22`, borderRadius: '12px', padding: isMobile ? '4px' : '8px' }}>
                            <Smile
                                color={theme.primary}
                                size={isMobile ? 26 : 22}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowEmojiPicker(!showEmojiPicker);
                                }}
                            />
                        </div>
                        {showEmojiPicker && (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: 'absolute',
                                    bottom: '70px',
                                    left: isMobile ? '10px' : '20px',
                                    right: isMobile ? '10px' : 'auto',
                                    backgroundColor: theme.chatBubble,
                                    padding: '10px',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'repeat(6, 1fr)' : 'repeat(8, 1fr)',
                                    gap: isMobile ? '4px' : '8px',
                                    zIndex: 1000,
                                    animation: 'fadeIn 0.2s ease'
                                }}
                            >
                                {COMMON_EMOJIS.map(e => (
                                    <span key={e} onClick={() => addEmoji(e)} style={{ fontSize: '24px', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseOver={(e) => e.target.style.transform = 'scale(1.2)'} onMouseOut={(e) => e.target.style.transform = 'scale(1)'}>{e}</span>
                                ))}
                            </div>
                        )}

                        <form onSubmit={sendMessage} style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Write a message..."
                                    className="glass"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '16px',
                                        border: 'none',
                                        outline: 'none',
                                        fontSize: '15px',
                                        backgroundColor: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                                        color: theme.text,
                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                    }}
                                />
                                <Paperclip
                                    size={20}
                                    color={theme.secondaryText}
                                    style={{ position: 'absolute', right: '12px', cursor: 'pointer' }}
                                />
                            </div>

                            {(text.trim()) ? (
                                <button
                                    type="submit"
                                    className="smooth-transition"
                                    style={{
                                        background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}dd)`,
                                        border: 'none',
                                        color: 'white',
                                        cursor: 'pointer',
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: `0 4px 12px ${theme.primary}44`
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <Send size={20} />
                                </button>
                            ) : (
                                <div style={{ transform: 'scale(1.1)' }}>
                                    <VoiceRecorder onUploadComplete={handleVoiceUpload} />
                                </div>
                            )}
                        </form>
                    </footer>
                </main >
            </div >

            {/* Help Modal */}
            {
                showHelp && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000,
                        animation: 'fadeIn 0.3s ease'
                    }}>
                        <div style={{
                            backgroundColor: theme.chatBubble,
                            width: '90%',
                            maxWidth: '500px',
                            borderRadius: '16px',
                            padding: '24px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                            position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, color: theme.text, fontSize: '20px' }}>Theme Guide</h2>
                                <X size={24} style={{ cursor: 'pointer', color: theme.secondaryText }} onClick={() => setShowHelp(false)} />
                            </div>

                            <p style={{ fontSize: '14px', color: theme.secondaryText, marginBottom: '24px', lineHeight: '1.5' }}>
                                The application identifies emotions in your messages and automatically changes the theme colors.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {[
                                    { color: '🟣', label: 'Indigo', emotion: 'Neutral', examples: 'Default mode (standard messages)', bg: '#6366f1' },
                                    { color: '�', label: 'Green', emotion: 'Happy', examples: '"love", "good", "great", 😊, ❤️', bg: '#22c55e' },
                                    { color: '🔵', label: 'Blue', emotion: 'Sad', examples: '"hurt", "cry", "sorry", 😭, 😔', bg: '#3b82f6' },
                                    { color: '🔴', label: 'Red', emotion: 'Angry', examples: '"hate", "mad", "angry", 😡, 😠', bg: '#ef4444' }
                                ].map((item, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        gap: '16px',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.accent,
                                        borderLeft: `6px solid ${item.bg}`
                                    }}>
                                        <div style={{ fontSize: '20px' }}>{item.color}</div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '15px', color: theme.text }}>
                                                {item.emotion} <span style={{ fontWeight: '400', fontSize: '13px', color: theme.secondaryText }}>({item.label})</span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: theme.secondaryText, marginTop: '4px' }}>
                                                {item.examples}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: '24px', borderTop: `1px solid ${theme.accent}`, paddingTop: '16px' }}>
                                <button
                                    onClick={() => {
                                        if ("Notification" in window) {
                                            Notification.requestPermission().then(permission => {
                                                const testMsg = {
                                                    id: 'test-' + Date.now(),
                                                    name: 'AuraBot',
                                                    text: permission === "granted" ? "System notification test successful! 🚀" : "Permission denied.",
                                                    photoURL: '/favicon.ico',
                                                    chatId: 'test',
                                                    emotion: 'happy'
                                                };

                                                if (permission === "granted") {
                                                    new Notification("AuraChat: Notifications Active!", {
                                                        body: testMsg.text,
                                                        icon: testMsg.photoURL
                                                    });
                                                    setActiveToast(testMsg);
                                                    audioRef.current.play().catch(() => { });
                                                } else {
                                                    alert(`Status: ${permission}. Please enable in browser settings.`);
                                                }
                                                setNotifPermission(permission);
                                            });
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        backgroundColor: 'transparent',
                                        color: theme.primary,
                                        border: `2px solid ${theme.primary}55`,
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    🔔 Test & Enable Notifications
                                </button>
                            </div>

                            {manualOverride && (
                                <button
                                    onClick={() => { resetToAuto(); setShowHelp(false); }}
                                    style={{
                                        marginTop: '16px',
                                        width: '100%',
                                        padding: '12px',
                                        backgroundColor: theme.accent,
                                        color: theme.secondaryText,
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                    }}
                                >
                                    🔄 Reset to Automatic (Emoji Mode)
                                </button>
                            )}

                            <button
                                onClick={() => setShowHelp(false)}
                                style={{
                                    marginTop: manualOverride ? '8px' : '24px',
                                    width: '100%',
                                    padding: '12px',
                                    backgroundColor: theme.primary,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    transition: 'opacity 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                            >
                                Got it!
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Profile Edit Modal */}
            {showProfileEdit && (
                <div
                    onClick={() => setShowProfileEdit(false)}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, width: '100vw', height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2001, animation: 'fadeIn 0.3s ease'
                    }}
                >
                    <div className="glass" onClick={(e) => e.stopPropagation()} style={{
                        backgroundColor: theme.chatBubble,
                        width: '90%', maxWidth: '400px', borderRadius: '24px',
                        padding: '32px', textAlign: 'center'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, color: theme.text, fontSize: '20px' }}>Your Profile</h2>
                            <X size={24} style={{ cursor: 'pointer', color: theme.secondaryText }} onClick={() => setShowProfileEdit(false)} />
                        </div>

                        <div style={{ position: 'relative', width: '110px', height: '110px', margin: '0 auto 24px' }}>
                            <img
                                src={newPhotoURL || currentUserData.photoURL}
                                alt="preview"
                                style={{ width: '100%', height: '100%', borderRadius: '30px', objectFit: 'cover', border: `3px solid ${theme.primary}44` }}
                            />
                            <label style={{
                                position: 'absolute', bottom: '-5px', right: '-5px',
                                backgroundColor: theme.primary, padding: '10px', borderRadius: '15px',
                                cursor: 'pointer', display: 'flex', color: 'white'
                            }}>
                                <Camera size={18} />
                                <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                            </label>
                            {isUploading && (
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Loader2 className="loading-spinner" style={{ color: 'white' }} />
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleProfileUpdate}>
                            <input
                                value={newDisplayName}
                                onChange={(e) => setNewDisplayName(e.target.value)}
                                placeholder="Edit nickname"
                                style={{
                                    width: '100%', padding: '14px', borderRadius: '14px', border: `1px solid ${theme.accent}33`,
                                    backgroundColor: 'rgba(0,0,0,0.03)', color: theme.text, marginBottom: '20px', outline: 'none'
                                }}
                            />
                            <button
                                type="submit"
                                disabled={isUploading}
                                style={{
                                    width: '100%', padding: '14px', backgroundColor: theme.primary, color: 'white',
                                    border: 'none', borderRadius: '14px', fontWeight: '600', cursor: 'pointer'
                                }}
                            >
                                {isUploading ? 'Updating...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* About Modal */}
            {showAbout && (
                <div
                    onClick={() => setShowAbout(false)}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, width: '100vw', height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2001, animation: 'fadeIn 0.3s ease'
                    }}
                >
                    <div className="glass" onClick={(e) => e.stopPropagation()} style={{
                        backgroundColor: theme.chatBubble,
                        width: '90%', maxWidth: '400px', borderRadius: '24px',
                        padding: '32px', textAlign: 'center'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                            <X size={24} style={{ cursor: 'pointer', color: theme.secondaryText }} onClick={() => setShowAbout(false)} />
                        </div>
                        <div style={{ backgroundColor: `${theme.primary}15`, width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: theme.primary }}>
                            <Info size={32} />
                        </div>
                        <h2 style={{ color: theme.text, marginBottom: '8px' }}>AuraChat Pro</h2>
                        <p style={{ color: theme.secondaryText, fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                            Experience the future of communication. AuraChat Pro combines AI-driven emotion detection with crystal-clear voice messaging and a state-of-the-art glass interface.
                        </p>
                        <div style={{ fontSize: '12px', color: theme.secondaryText, opacity: 0.6 }}>
                            Version 2.5.0 • Build 2026.01.11
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
