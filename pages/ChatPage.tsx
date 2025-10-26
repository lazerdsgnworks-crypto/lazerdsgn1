
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, ChatSession, ChatMessage, UserProfile } from '../types';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { createThumbnail, createPdfThumbnail, compressImage, dataURLtoFile } from '../utils/files';
import Avatar from '../components/Avatar';

const TEMP_TITLE_PREFIX = 'New Chat -';
const WEBHOOK_URL = 'https://umarworks1.app.n8n.cloud/webhook/chatinput';
const ANALYSIS_WEBHOOK_URL = 'https://umarworks1.app.n8n.cloud/webhook/analyze';
const ANALYSIS_TEXT_ONLY_WEBHOOK_URL = 'https://umarworks1.app.n8n.cloud/webhook/analysis';
const APP_ID = 'default-lazerdsgn-app';
const CHATS_COLLECTION = `artifacts/${APP_ID}/users/`;
const CLOUDINARY_UPLOAD_PRESET = "communityposts";
const CLOUDINARY_CLOUD_NAME = "dsbtpkjvt";


interface ChatPageProps {
  user: User;
  userProfile: UserProfile | null;
  openDeleteModal: (title: string, onConfirm: () => void) => void;
  onViewProfile: () => void;
}

function formatAIResponse(text: string): string {
    if (!text) return '';
    // Basic sanitization to prevent HTML injection.
    let safeText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Format **bold** text
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert newlines to <br> tags for display.
    safeText = safeText.replace(/\n/g, '<br />');

    return safeText;
}

const ChatPage: React.FC<ChatPageProps> = ({ user, userProfile, openDeleteModal, onViewProfile }) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isAnalysisMode, setAnalysisMode] = useState(false);
    const [isImageGenMode, setIsImageGenMode] = useState(false);
    const [isVideoGenMode, setIsVideoGenMode] = useState(false);
    const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [analysisFile, setAnalysisFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    
    const createNewSession = useCallback(async (setActive = true) => {
        if (!user) return;
        const sessionsRef = collection(db, `${CHATS_COLLECTION}${user.uid}/sessions`);
        const newSessionRef = await addDoc(sessionsRef, {
            title: `${TEMP_TITLE_PREFIX}${new Date().toLocaleDateString()}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        if (setActive) {
            setCurrentSessionId(newSessionRef.id);
        }
    }, [user]);

    // Effect to create a new session every time the user navigates to the chat page.
    useEffect(() => {
        if (user) {
            createNewSession();
        }
    }, [user]);

    // Effect to listen for session list changes for the sidebar.
     useEffect(() => {
        if (!user) {
            setSessions([]);
            return;
        }
        setError(null);
        const sessionsRef = collection(db, `${CHATS_COLLECTION}${user.uid}/sessions`);
        const q = query(sessionsRef, orderBy('updatedAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const fetchedSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
            setSessions(fetchedSessions);
        }, (err) => {
            console.error("Firebase session listener error:", err);
            if (err.code === 'permission-denied') {
                setError("You don't have permission to view chats. This is likely a security rule misconfiguration.");
            } else {
                setError("Failed to load chat sessions.");
            }
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!currentSessionId || !user) {
            setMessages([]);
            return;
        };

        const messagesRef = collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`);
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
            setMessages(fetchedMessages);
        }, (err) => {
            console.error("Firebase messages listener error:", err);
        });

        return () => unsubscribe();
    }, [currentSessionId, user]);
    
    useEffect(() => {
        document.body.classList.toggle('sidebar-collapsed', isSidebarCollapsed);
    }, [isSidebarCollapsed]);
    
    const handleSendMessage = async (message: string, imageFiles: File[]) => {
        if (!user || !currentSessionId) return;
        if (!message.trim() && imageFiles.length === 0 && !analysisFile) return;

        setIsLoading(true);
        if (isImageGenMode) setIsGeneratingImage(true);
        if (isVideoGenMode) setIsGeneratingVideo(true);
        

        const currentSession = sessions.find(s => s.id === currentSessionId);
        const isFirstMessage = currentSession?.title.startsWith(TEMP_TITLE_PREFIX) ?? false;
        
        const userMessage: Omit<ChatMessage, 'id' | 'createdAt'> = { text: message, role: 'user' };

        try {
            if (imageFiles.length > 0) {
                userMessage.imageUrls = await Promise.all(imageFiles.map(async (file) => {
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target!.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    return createThumbnail(dataUrl);
                }));
            }
            if (analysisFile) {
                userMessage.analysisFile = { name: analysisFile.name, type: analysisFile.type };
                if (analysisFile.type.startsWith('image/')) {
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target!.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(analysisFile);
                    });
                    userMessage.imageUrl = await createThumbnail(dataUrl);
                } else if (analysisFile.type === 'application/pdf') {
                    try {
                        userMessage.imageUrl = await createPdfThumbnail(analysisFile);
                    } catch (pdfError) {
                        console.error("Failed to generate PDF thumbnail:", pdfError);
                        // Don't add imageUrl if thumbnail generation fails, it will fallback to an icon
                    }
                }
            }

            await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                ...userMessage,
                createdAt: serverTimestamp(),
            });

            if (isFirstMessage) {
                let newTitleText = message || "New Chat";
                if (isImageGenMode) newTitleText = `Image: ${message}`;
                if (isVideoGenMode) newTitleText = `Video: ${message}`;
                if (analysisFile) newTitleText = `Analysis of ${analysisFile.name}`;

                let newTitle = newTitleText.trim().substring(0, 40) + (newTitleText.length > 40 ? '...' : '');
                await updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}`), { title: newTitle, updatedAt: serverTimestamp() });
            } else {
                 await updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}`), { updatedAt: serverTimestamp() });
            }

            // A helper function to robustly extract a URL from a webhook response.
            const extractUrlFromResponse = (responseData: any): string | null => {
                if (!responseData) return null;
                const dataToInspect = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
                
                if (dataToInspect && typeof dataToInspect === 'object') {
                    const commonKeys = ['videoUrl', 'imageUrl', 'url', 'output'];
                    for (const key of commonKeys) {
                        if (typeof dataToInspect[key] === 'string' && dataToInspect[key].startsWith('http')) {
                            return dataToInspect[key];
                        }
                    }
                    // Fallback to check any value in the object
                    for (const value of Object.values(dataToInspect)) {
                        if (typeof value === 'string' && value.startsWith('http')) {
                            return value as string;
                        }
                    }
                }
                return null;
            };


            // Branching logic for AI response type
            if (isImageGenMode) {
                const genResponse = await fetch('https://umarworks1.app.n8n.cloud/webhook/imagegen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: message }),
                });
                if (!genResponse.ok) throw new Error('Image generation service failed.');
                const genResult = await genResponse.json();
                const tempImageUrl = extractUrlFromResponse(genResult);
                if (!tempImageUrl) throw new Error('Image generation did not return a URL.');

                const imageResponse = await fetch(tempImageUrl);
                if (!imageResponse.ok) throw new Error('Could not fetch the generated image.');
                const imageBlob = await imageResponse.blob();
                const imageFile = new File([imageBlob], "generated.png", { type: imageBlob.type });

                const formData = new FormData();
                formData.append('file', imageFile);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
                const cloudinaryResponse = await fetch(cloudinaryUrl, { method: 'POST', body: formData });
                if (!cloudinaryResponse.ok) throw new Error('Cloudinary upload failed.');
                const cloudinaryData = await cloudinaryResponse.json();
                const permanentImageUrl = cloudinaryData.secure_url;

                await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                    text: `Here's the image for your prompt:`,
                    role: 'ai',
                    imageUrl: permanentImageUrl,
                    createdAt: serverTimestamp(),
                });
            } else if (isVideoGenMode) {
                const genResponse = await fetch('https://umarworks1.app.n8n.cloud/webhook/videogen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: message, ratio: videoAspectRatio }),
                });
                if (!genResponse.ok) throw new Error(`Video generation service failed with status ${genResponse.status}.`);
                
                let genResult;
                try {
                     genResult = await genResponse.json();
                } catch(e) {
                    console.error("Failed to parse video generation response:", e);
                    throw new Error("Video generation service returned an invalid response.");
                }

                const tempVideoUrl = extractUrlFromResponse(genResult);
                if (!tempVideoUrl) throw new Error('Video generation did not return a URL.');

                const videoResponse = await fetch(tempVideoUrl);
                if (!videoResponse.ok) throw new Error('Could not fetch the generated video.');
                const videoBlob = await videoResponse.blob();
                const videoFile = new File([videoBlob], "generated.mp4", { type: videoBlob.type });

                const formData = new FormData();
                formData.append('file', videoFile);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
                const cloudinaryResponse = await fetch(cloudinaryUrl, { method: 'POST', body: formData });
                if (!cloudinaryResponse.ok) throw new Error('Cloudinary video upload failed.');
                const cloudinaryData = await cloudinaryResponse.json();
                const permanentVideoUrl = cloudinaryData.secure_url;

                await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                    text: `Here's the video for your prompt:`,
                    role: 'ai',
                    videoUrl: permanentVideoUrl,
                    createdAt: serverTimestamp(),
                });
            } else {
                // Regular Text or Analysis AI Response Logic
                const isAnalysis = isAnalysisMode;
                let targetUrl = isAnalysis ? ANALYSIS_WEBHOOK_URL : WEBHOOK_URL;
                let fetchOptions: RequestInit;

                if (isAnalysis && !analysisFile && message.trim()) {
                    // Text-only analysis request
                    targetUrl = ANALYSIS_TEXT_ONLY_WEBHOOK_URL;
                    fetchOptions = {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: message, userId: user.uid }),
                    };
                } else if (isAnalysis || imageFiles.length > 0) {
                    // This covers: analysis with file, and normal chat with files
                    const payload = new FormData();
                    payload.append('message', message);
                    payload.append('userId', user.uid);

                    if (isAnalysis && analysisFile) {
                        payload.append('file', analysisFile, analysisFile.name);
                    } else {
                        // This is for normal chat with image files.
                        imageFiles.forEach((file) => {
                            payload.append(`files`, file, file.name);
                        });
                    }
                    fetchOptions = { method: 'POST', body: payload };
                } else {
                    // This handles normal text-only chat
                    fetchOptions = {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: message, userId: user.uid }),
                    };
                }

                const response = await fetch(targetUrl, fetchOptions);
                if (!response.ok) throw new Error(`Webhook failed with status ${response.status}`);
                
                const result = await response.json();
                const aiResponseText = result.output || result.text || result.response || "Sorry, I couldn't get a response.";

                await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                    text: aiResponseText, role: 'ai', createdAt: serverTimestamp(),
                });
            }
        } catch (error) {
            console.error("Error during message send:", error);
            await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                text: "An error occurred. Please try again.", role: 'ai', createdAt: serverTimestamp(),
            });
        } finally {
            setIsLoading(false);
            setIsGeneratingImage(false);
            setIsGeneratingVideo(false);
            if (isAnalysisMode) setAnalysisFile(null);
            if (isImageGenMode) setIsImageGenMode(false);
            if (isVideoGenMode) setIsVideoGenMode(false);
        }
    };

    const handleToggleAnalysisMode = () => {
        if (isAnalysisMode) {
            setAnalysisFile(null);
        }
        setAnalysisMode(prev => !prev);
        if (!isAnalysisMode) { // if turning on
            setIsImageGenMode(false);
            setIsVideoGenMode(false);
        }
    };

    const handleToggleImageGenMode = () => {
        setIsImageGenMode(prev => !prev);
        if (!isImageGenMode) { // if turning on
            setAnalysisMode(false);
            setAnalysisFile(null);
            setIsVideoGenMode(false);
        }
    };

    const handleToggleVideoGenMode = () => {
        setIsVideoGenMode(prev => !prev);
        if (!isVideoGenMode) { // if turning on
            setAnalysisMode(false);
            setAnalysisFile(null);
            setIsImageGenMode(false);
        }
    };

    const handleSelectSession = (sessionId: string) => {
        setCurrentSessionId(sessionId);
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }
    
    const handleDeleteSession = async (sessionId: string) => {
        if (!user) return;
        await deleteDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions`, sessionId));
        if (currentSessionId === sessionId) {
            createNewSession(true);
        }
    };
    
    const handleRenameSession = async (sessionId: string, newTitle: string) => {
        if (!user) return;
        await updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions`, sessionId), { title: newTitle, updatedAt: serverTimestamp() });
    };

    return (
        <div className="flex h-screen -mt-[68px] pt-[68px] bg-primary w-full overflow-hidden">
             {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)}></div>}
            <ChatSidebar
                sessions={sessions}
                activeSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onNewChat={() => createNewSession(true)}
                onDeleteSession={(id, title) => openDeleteModal(title, () => handleDeleteSession(id))}
                onRenameSession={handleRenameSession}
                userProfile={userProfile}
                isOpen={isSidebarOpen}
                isCollapsed={isSidebarCollapsed}
                error={error}
                onViewProfile={onViewProfile}
            />
            <div className="flex-1 flex flex-col overflow-hidden h-full bg-secondary">
                <header className="p-4 flex items-center justify-between bg-secondary z-10 flex-shrink-0">
                     <div className="flex items-center">
                        <button onClick={() => {
                            if (window.innerWidth < 768) setSidebarOpen(!isSidebarOpen)
                            else setSidebarCollapsed(!isSidebarCollapsed)
                        }} id="sidebar-toggle-btn" className="p-2 rounded-full hover:bg-muted">
                            <svg className="w-6 h-6 transition-transform text-muted"><use href="#icon-sidebar-toggle"></use></svg>
                        </button>
                         <button onClick={() => createNewSession(true)} id="collapsed-new-chat-btn" className={`${isSidebarCollapsed ? 'inline-flex' : 'hidden'} p-2 rounded-full hover:bg-muted ml-2`}>
                             <svg className="w-6 h-6 text-muted"><use href="#icon-plus-square"></use></svg>
                        </button>
                    </div>
                    <button onClick={() => createNewSession(true)} className="p-2 rounded-full hover:bg-muted md:hidden" aria-label="New Chat">
                         <svg className="w-6 h-6 text-muted"><use href="#icon-plus-square"></use></svg>
                    </button>
                </header>
                <ChatMessages messages={messages} isLoading={isLoading} isGeneratingImage={isGeneratingImage} isGeneratingVideo={isGeneratingVideo} userProfile={userProfile}/>
                <ChatInput 
                    onSendMessage={handleSendMessage} 
                    isAnalysisMode={isAnalysisMode}
                    onToggleAnalysisMode={handleToggleAnalysisMode}
                    isImageGenMode={isImageGenMode}
                    onToggleImageGenMode={handleToggleImageGenMode}
                    isVideoGenMode={isVideoGenMode}
                    onToggleVideoGenMode={handleToggleVideoGenMode}
                    videoAspectRatio={videoAspectRatio}
                    onVideoAspectRatioChange={setVideoAspectRatio}
                    onAnalysisFileSelect={setAnalysisFile}
                    analysisFile={analysisFile}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
};

// Sub-components
const ChatSidebar: React.FC<{
    sessions: ChatSession[], 
    activeSessionId: string | null,
    onSelectSession: (id: string) => void,
    onNewChat: () => void,
    onDeleteSession: (id: string, title: string) => void,
    onRenameSession: (id: string, newTitle: string) => void,
    userProfile: UserProfile | null,
    isOpen: boolean,
    isCollapsed: boolean,
    error: string | null,
    onViewProfile: () => void,
}> = ({ sessions, activeSessionId, onSelectSession, onNewChat, onDeleteSession, onRenameSession, userProfile, isOpen, isCollapsed, error, onViewProfile }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSessions = sessions
        .filter(s => !s.title.startsWith(TEMP_TITLE_PREFIX))
        .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div id="chat-sidebar" className={`fixed top-0 bottom-0 left-0 h-full z-40 md:relative md:h-full transition-all duration-300 ease-in-out bg-muted flex flex-col w-72 flex-shrink-0 md:transform-none ${isOpen ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'collapsed' : ''}`}>
             <div className="p-4 flex-shrink-0 h-[68px]">
                    <button id="new-chat-btn" onClick={onNewChat} className="flex items-center justify-center w-full px-4 py-2 bg-primary-accent text-on-primary-accent rounded-lg font-medium hover:bg-accent-hover transition">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        New Chat
                    </button>
            </div>
            <div className="px-4 pb-2 flex-shrink-0">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-secondary border border-primary rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition text-primary"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                        <svg className="w-4 h-4"><use href="#icon-search"></use></svg>
                    </div>
                </div>
            </div>
            {error ? (
                <div className="p-4 m-2 text-sm text-red-700 bg-red-100 rounded-lg">
                    <strong>Error</strong>
                    <p>{error}</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto px-2">
                    {filteredSessions.map(session => (
                        <SidebarItem 
                            key={session.id} 
                            session={session} 
                            isActive={session.id === activeSessionId}
                            onSelect={() => onSelectSession(session.id)}
                            onDelete={() => onDeleteSession(session.id, session.title)}
                            onRename={onRenameSession}
                        />
                    ))}
                </div>
            )}
             <div className="p-2 flex-shrink-0">
                <button onClick={onViewProfile} className="p-2 w-full flex items-center space-x-3 text-left hover:bg-hover rounded-lg transition-colors">
                    {userProfile && <Avatar email={userProfile.email} photoURL={userProfile.photoURL} size="sm" />}
                    <div className="min-w-0">
                        <p className="font-semibold text-primary text-sm truncate">{userProfile?.username ?? '...'}</p>
                    </div>
                </button>
            </div>
        </div>
    );
};

const SidebarItem: React.FC<{
    session: ChatSession,
    isActive: boolean,
    onSelect: () => void,
    onDelete: () => void,
    onRename: (id: string, newTitle: string) => void
}> = ({ session, isActive, onSelect, onDelete, onRename }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(session.title);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setTitle(session.title) }, [session.title]);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleRename = () => {
        if (title.trim() && title.trim() !== session.title) {
            onRename(session.id, title.trim());
        } else {
            setTitle(session.title);
        }
        setIsEditing(false);
    };

    return (
        <div 
            className={`session-item-container group ${isActive ? 'active' : 'md:hover:bg-hover'}`}
            onClick={onSelect}
        >
            <div className="flex-grow min-w-0 pr-8">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                        className="session-text text-sm w-full bg-secondary border border-secondary rounded px-1 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className={`session-text text-sm block truncate ${isActive ? 'text-primary font-semibold' : 'text-secondary md:group-hover:text-primary'}`}>{session.title}</span>
                )}
            </div>
             <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}>
                <button title="Rename" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1.5 text-muted hover:text-primary rounded"><svg className="w-4 h-4"><use href="#icon-rename"></use></svg></button>
                <button title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-muted hover:text-primary rounded"><svg className="w-4 h-4"><use href="#icon-trash"></use></svg></button>
            </div>
        </div>
    );
};

const ChatMessages: React.FC<{ messages: ChatMessage[], isLoading: boolean, isGeneratingImage: boolean, isGeneratingVideo: boolean, userProfile: UserProfile | null }> = ({ messages, isLoading, isGeneratingImage, isGeneratingVideo, userProfile }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="flex flex-col space-y-6">
                {messages.map(msg => <ChatMessageItem key={msg.id} message={msg} userProfile={userProfile}/>)}
                {isLoading && <ChatMessageItem message={{ role: 'ai', id: 'loading' } as ChatMessage} isLoading={true} isGeneratingImage={isGeneratingImage} isGeneratingVideo={isGeneratingVideo} userProfile={userProfile}/>}
                {messages.length === 0 && !isLoading && (
                    <div className="text-center text-secondary font-bold text-2xl pt-20">
                        Hey, How can I help you?
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};

const ChatMessageItem: React.FC<{ message: ChatMessage, isLoading?: boolean, isGeneratingImage?: boolean, isGeneratingVideo?: boolean, userProfile: UserProfile | null }> = ({ message, isLoading, isGeneratingImage, isGeneratingVideo, userProfile }) => {
    const isUser = message.role === 'user';
    
    const copyToClipboard = (text: string, button: HTMLButtonElement) => {
        navigator.clipboard.writeText(text);
        const original = button.innerHTML;
        button.innerHTML = `<svg class="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
        setTimeout(() => button.innerHTML = original, 1500);
    };

    const handleDownload = async (mediaUrl: string, isVideo: boolean) => {
        try {
            const response = await fetch(mediaUrl);
            if (!response.ok) throw new Error('Network response was not ok.');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `lazerdsgn-generated-${Date.now()}.${isVideo ? 'mp4' : 'png'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            // In a real app, you might want to show a user-facing error message.
        }
    };

    if (isLoading) {
        if (isGeneratingVideo) {
            return (
                <div className="flex items-start gap-3 justify-start">
                    <Avatar email="ai@lazerdsgn.com" size="sm" />
                    <div className="p-4 bg-muted rounded-2xl">
                        <div className="w-64 h-36 rounded-lg flex flex-col items-center justify-center overflow-hidden">
                            <div className="w-full h-full shimmer-bg flex flex-col items-center justify-center">
                                <svg className="w-12 h-12 text-secondary"><use href="#icon-video"></use></svg>
                                <p className="mt-2 text-sm text-secondary">Crafting your video...</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        if (isGeneratingImage) {
            return (
                <div className="flex items-start gap-3 justify-start">
                    <Avatar email="ai@lazerdsgn.com" size="sm" />
                    <div className="p-4 bg-muted rounded-2xl">
                        <div className="w-64 h-64 rounded-lg flex flex-col items-center justify-center overflow-hidden">
                            <div className="w-full h-full shimmer-bg flex flex-col items-center justify-center">
                                <svg className="w-12 h-12 text-secondary" fill="none" viewBox="0 0 24" stroke="currentColor"><use href="#icon-image"></use></svg>
                                <p className="mt-2 text-sm text-secondary">Conjuring pixels...</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return (
             <div className="flex items-start gap-3 justify-start">
                <Avatar email="ai@lazerdsgn.com" size="sm" />
                <div className="chat-message-bubble bg-muted">
                    <div className="flex items-center justify-center space-x-1.5 p-2">
                        <span className="w-2 h-2 bg-secondary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-secondary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-secondary rounded-full animate-bounce"></span>
                    </div>
                </div>
            </div>
        );
    }

    const messageAlignmentClass = isUser ? 'justify-end' : 'justify-start';

    const renderFilePreview = (msg: ChatMessage) => {
        let content = null;
        if (msg.videoUrl) {
            content = (
                <div className="relative group max-w-sm sm:max-w-md">
                    <video src={msg.videoUrl} controls playsInline className="rounded-lg w-full h-auto shadow-md bg-black" />
                    <button 
                        onClick={() => handleDownload(msg.videoUrl!, true)} 
                        className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Download Video"
                    >
                        <svg className="w-5 h-5"><use href="#icon-download"></use></svg>
                    </button>
                </div>
            );
        } else if (msg.analysisFile) {
            // If we have a thumbnail (for image or PDF), display it.
            if (msg.imageUrl) {
                 content = (
                    <div className="relative bg-hover border border-secondary rounded-lg p-3 flex items-start space-x-3">
                        <img src={msg.imageUrl} alt="File preview" className="w-16 h-16 object-cover rounded flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <span className="text-sm text-primary truncate block font-medium">{msg.analysisFile.name}</span>
                            <span className="text-xs text-muted">{msg.analysisFile.type}</span>
                        </div>
                    </div>
                );
            } else {
                // Otherwise, show an icon.
                let iconHref = '#icon-file-text';
                if (msg.analysisFile.type.startsWith('video/')) {
                    iconHref = '#icon-video';
                } else if (msg.analysisFile.type.startsWith('audio/')) {
                    iconHref = '#icon-music';
                }
                content = (
                    <div className="relative bg-hover border border-secondary rounded-lg p-3 flex items-center space-x-3">
                        <svg className="w-8 h-8 text-muted flex-shrink-0"><use href={iconHref}></use></svg>
                        <span className="text-sm text-secondary truncate">{msg.analysisFile.name}</span>
                    </div>
                );
            }
        } else if (msg.imageUrl && !msg.imageUrls) {
            if (msg.role === 'ai') {
                content = (
                    <div className="relative group max-w-full sm:max-w-md">
                        <img src={msg.imageUrl} alt="AI generated content" className="rounded-lg w-full h-auto shadow-md" />
                        <button 
                            onClick={() => handleDownload(msg.imageUrl!, false)} 
                            className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Download Image"
                        >
                            <svg className="w-5 h-5"><use href="#icon-download"></use></svg>
                        </button>
                    </div>
                );
            } else {
                 content = <img src={msg.imageUrl} alt="Uploaded content" className="rounded-lg max-w-xs max-h-48" />;
            }
        } else if (msg.imageUrls) {
            content = (
                <div className={`grid gap-2 ${msg.imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {msg.imageUrls.map((url, index) => <img key={index} src={url} alt={`Uploaded content ${index + 1}`} className="rounded-lg w-full h-auto object-cover" />)}
                </div>
            );
        }
        return content ? <div className="mb-2">{content}</div> : null;
    }

    return (
        <div className={`flex items-start gap-3 ${messageAlignmentClass} chat-message-container`}>
            {!isUser && <Avatar email="ai@lazerdsgn.com" size="sm" />}
            <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                {renderFilePreview(message)}
                
                {message.text && (
                    <div className={`chat-message-bubble relative ${isUser ? 'user-message' : 'ai-message'}`}>
                        <div className={message.role === 'ai' ? 'ai-text-content' : ''} dangerouslySetInnerHTML={{__html: formatAIResponse(message.text)}}></div>
                    </div>
                )}
                 <div className={`chat-actions flex items-center text-sm text-muted mt-2 space-x-2 `}>
                    {message.text && <button title="Copy" onClick={(e) => copyToClipboard(message.text, e.currentTarget)} className="p-1 hover:text-primary"><svg className="w-4 h-4"><use href="#icon-copy"></use></svg></button>}
                    {!isUser && (
                        <>
                            <button title="Good" className="p-1 hover:text-primary"><svg className="w-4 h-4"><use href="#icon-heart"></use></svg></button>
                            <button title="Bad" className="p-1 hover:text-primary"><svg className="w-4 h-4"><use href="#icon-flag"></use></svg></button>
                        </>
                    )}
                </div>
            </div>
            {isUser && userProfile && <Avatar email={userProfile.email} photoURL={userProfile.photoURL} size="sm" />}
        </div>
    );
};

const ChatInput: React.FC<{
    onSendMessage: (message: string, files: File[]) => void,
    isAnalysisMode: boolean,
    onToggleAnalysisMode: () => void,
    isImageGenMode: boolean,
    onToggleImageGenMode: () => void,
    isVideoGenMode: boolean,
    onToggleVideoGenMode: () => void,
    videoAspectRatio: '16:9' | '9:16',
    onVideoAspectRatioChange: (ratio: '16:9' | '9:16') => void,
    onAnalysisFileSelect: (file: File | null) => void,
    analysisFile: File | null,
    isLoading: boolean,
}> = ({ onSendMessage, isAnalysisMode, onToggleAnalysisMode, isImageGenMode, onToggleImageGenMode, isVideoGenMode, onToggleVideoGenMode, videoAspectRatio, onVideoAspectRatioChange, onAnalysisFileSelect, analysisFile, isLoading }) => {
    const [input, setInput] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const analysisInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Speech Recognition setup
    useEffect(() => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported in this browser.");
            return;
        }

        // FIX: The expression `new SpeechRecognition()` was causing a "not constructable" error because TypeScript couldn't infer the correct type for the vendor-prefixed `webkitSpeechRecognition`. By casting `SpeechRecognition` to `any`, we bypass the type check and allow the constructor to be called, resolving the runtime error.
        const recognition = new (SpeechRecognition as any)();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        
        recognition.onresult = (event: any) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            setInput(prev => (prev ? prev.trim() + ' ' : '') + transcript);
        };

        recognition.onstart = () => {
            setIsListening(true);
        };
        
        recognition.onend = () => {
            setIsListening(false);
        };
        
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                alert('Microphone access was denied. Please allow microphone access in your browser settings.');
            }
            setIsListening(false);
        };
        
        recognitionRef.current = recognition;

    }, []);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            // Cap height at a reasonable max, e.g., 200px
            textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
        }
    }, [input]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading || (!input.trim() && !analysisFile)) return;
        onSendMessage(input, []);
        setInput('');
    };

    const handleMicClick = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition is not supported in this browser.');
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };
    
    const handleAnalysisFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onAnalysisFileSelect(e.target.files?.[0] || null);
    };

    const handleSelectImageGen = () => {
        if (isAnalysisMode) onToggleAnalysisMode();
        if (isVideoGenMode) onToggleVideoGenMode();
        if (!isImageGenMode) onToggleImageGenMode();
        setIsMenuOpen(false);
    };

    const handleSelectVideoGen = () => {
        if (isAnalysisMode) onToggleAnalysisMode();
        if (isImageGenMode) onToggleImageGenMode();
        if (!isVideoGenMode) onToggleVideoGenMode();
        setIsMenuOpen(false);
    };

    const handleSelectAnalysis = () => {
        if (isImageGenMode) onToggleImageGenMode();
        if (isVideoGenMode) onToggleVideoGenMode();
        if (!isAnalysisMode) onToggleAnalysisMode();
        setIsMenuOpen(false);
        analysisInputRef.current?.click();
    };

    const dismissMode = () => {
        if (isImageGenMode) onToggleImageGenMode();
        if (isVideoGenMode) onToggleVideoGenMode();
        if (isAnalysisMode) onToggleAnalysisMode();
        onAnalysisFileSelect(null);
    };
    
    return (
         <div className="p-4 md:px-6 bg-secondary flex-shrink-0">
            <div className="w-full max-w-3xl mx-auto">
                {/* UPDATED Active Mode Indicator */}
                {(isImageGenMode || isAnalysisMode || isVideoGenMode) && (
                    <div className="flex justify-between items-center bg-muted px-4 py-2 rounded-t-xl ai-text-content" style={{ animationDuration: '0.3s' }}>
                        <div>
                            {isImageGenMode && <span className="text-sm font-semibold text-primary">Image Generation Mode</span>}
                            {isVideoGenMode && (
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-semibold text-primary">Video Generation</span>
                                    <div className="flex items-center bg-secondary border border-primary rounded-full p-0.5">
                                        <button type="button" onClick={() => onVideoAspectRatioChange('16:9')} className={`px-2 py-0.5 text-xs rounded-full transition-colors ${videoAspectRatio === '16:9' ? 'bg-primary-accent text-on-primary-accent' : 'text-secondary hover:bg-hover'}`}>16:9</button>
                                        <button type="button" onClick={() => onVideoAspectRatioChange('9:16')} className={`px-2 py-0.5 text-xs rounded-full transition-colors ${videoAspectRatio === '9:16' ? 'bg-primary-accent text-on-primary-accent' : 'text-secondary hover:bg-hover'}`}>9:16</button>
                                    </div>
                                </div>
                            )}
                            {isAnalysisMode && <span className="text-sm font-semibold text-primary truncate">{analysisFile ? `Analyzing: ${analysisFile.name}` : 'Analysis Mode'}</span>}
                        </div>
                        <button type="button" onClick={dismissMode} className="p-1 rounded-full hover:bg-hover flex-shrink-0">
                            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                )}

                <form 
                    onSubmit={handleSubmit} 
                    className={`relative bg-muted border border-transparent focus-within:border-secondary transition-colors shadow-sm 
                    ${(isImageGenMode || isAnalysisMode || isVideoGenMode) ? 'rounded-b-3xl' : 'rounded-3xl'}`}
                >
                    <div className="flex items-end p-2 space-x-2">
                        {/* REDESIGNED: FAB menu */}
                        <div className="relative self-end" ref={menuRef}>
                            {/* Menu items with animation */}
                            <div className={`absolute bottom-full mb-3 flex flex-col items-center gap-3 transition-all duration-300 ease-in-out ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                                <button type="button" onClick={handleSelectVideoGen} title="Video Gen" className="w-10 h-10 flex items-center justify-center bg-secondary border border-primary rounded-full shadow-lg hover:bg-hover transition-transform hover:scale-110">
                                    <svg className="w-5 h-5 text-muted"><use href="#icon-video"></use></svg>
                                </button>
                                <button type="button" onClick={handleSelectImageGen} title="Image Gen" className="w-10 h-10 flex items-center justify-center bg-secondary border border-primary rounded-full shadow-lg hover:bg-hover transition-transform hover:scale-110">
                                    <svg className="w-5 h-5 text-muted"><use href="#icon-image"></use></svg>
                                </button>
                                <button type="button" onClick={handleSelectAnalysis} title="Analysis" className="w-10 h-10 flex items-center justify-center bg-secondary border border-primary rounded-full shadow-lg hover:bg-hover transition-transform hover:scale-110">
                                     <svg className="w-5 h-5 text-muted"><use href="#icon-gemini-sparkle"></use></svg>
                                </button>
                            </div>
                            
                            <button 
                                type="button" 
                                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                                className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-muted rounded-full hover:bg-hover transition-all duration-300 ease-in-out"
                            >
                                <svg className={`w-6 h-6 text-muted transition-transform duration-300 ${isMenuOpen ? 'rotate-45' : 'rotate-0'}`}><use href="#icon-plus"></use></svg>
                            </button>
                            <input type="file" ref={analysisInputRef} onChange={handleAnalysisFileChange} hidden accept="image/*,video/*,audio/*,application/pdf" />
                        </div>

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={
                                isVideoGenMode ? "Describe a video scene..." :
                                isImageGenMode ? "Describe an image..." :
                                isAnalysisMode ? (analysisFile ? "Ask about the file..." : "Add a file and ask a question...") :
                                "Ask a question..."
                            }
                            className="flex-1 py-2 bg-transparent border-none focus:ring-0 focus:outline-none placeholder-muted text-primary resize-none text-base"
                            rows={1}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e); }}
                            disabled={isLoading}
                        />
                        
                        <button
                            type="button"
                            onClick={handleMicClick}
                            className={`self-end w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isListening ? 'mic-listening' : 'bg-muted hover:bg-hover'}`}
                            disabled={isLoading}
                            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                        >
                            <svg className="h-5 w-5 text-muted"><use href="#icon-microphone"></use></svg>
                        </button>

                        <button
                            type="submit"
                            className="self-end w-10 h-10 flex items-center justify-center rounded-full bg-primary-accent text-on-primary-accent hover:bg-accent-hover transition disabled:opacity-50"
                            disabled={isLoading || (!input.trim() && !analysisFile)}
                        >
                            <svg className="h-5 w-5"><use href="#icon-paper-plane"></use></svg>
                        </button>
                    </div>
                </form>
            </div>
         </div>
    );
};

export default ChatPage;
