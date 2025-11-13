

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, ChatSession, ChatMessage, UserProfile } from '../types.ts';
import { db } from '../services/firebase.ts';
// FIX: Corrected the import for 'firebase/firestore' to ensure all required v9 SDK functions are available.
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, QuerySnapshot, DocumentData, Timestamp, writeBatch, setDoc } from 'firebase/firestore';
import { createThumbnail, createPdfThumbnail, compressImage, dataURLtoFile, pcmToWav } from '../utils/files.ts';
import Avatar from '../components/Avatar.tsx';
import ImagePreviewModal from '../components/community/ImagePreviewModal.tsx';
import ChatMessageItem from '../components/ChatMessageItem.tsx';
import { GoogleGenAI, Modality } from '@google/genai';
// FIX: Added missing import for LiveWaveform component.
import LiveWaveform from '../components/ui/LiveWaveform.tsx';

// Add SpeechRecognition to the global window object for TypeScript
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

const TEMP_TITLE_PREFIX = 'New Chat -';
const WEBHOOK_URL = 'https://umarworks3.app.n8n.cloud/webhook/chatinput';
const VOICE_WEBHOOK_URL = 'https://umarworks3.app.n8n.cloud/webhook/voice';
const ANALYSIS_WEBHOOK_URL = 'https://umarworks3.app.n8n.cloud/webhook/analyze';
const ANALYSIS_TEXT_ONLY_WEBHOOK_URL = 'https://umarworks3.app.n8n.cloud/webhook/analysis';
const APP_ID = 'default-lazerdsgn-app';
const CHATS_COLLECTION = `artifacts/${APP_ID}/users/`;
const CLOUDINARY_UPLOAD_PRESET = "communityposts";
const CLOUDINARY_CLOUD_NAME = "dsbtpkjvt";

// Fix for line 86: Cannot find name 'ChatPageProps'
interface ChatPageProps {
    user: User;
    userProfile: UserProfile | null;
    openDeleteModal: (title: string, onConfirm: () => void) => void;
    onViewProfile: () => void;
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
    const animatedMessageIds = useRef(new Set<string>());
    const isInitialMessagesLoad = useRef(true);
    const [sessionsLoaded, setSessionsLoaded] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [isVoiceUIVisible, setVoiceUIVisible] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [streamingId, setStreamingId] = useState<string | null>(null);

    const createNewSession = useCallback(async (setActive = true) => {
        if (!user) return;
        const sessionsRef = collection(db, `${CHATS_COLLECTION}${user.uid}/sessions`);
        const newSessionRef = await addDoc(sessionsRef, {
            title: `${TEMP_TITLE_PREFIX}${new Date().toLocaleDateString()}`,
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp
        });
        if (setActive) {
            setCurrentSessionId(newSessionRef.id);
        }
    }, [user]);

    // Effect to create a new session every time the chat page is opened/mounted.
    useEffect(() => {
        createNewSession(true);
    }, [createNewSession]);

    // Effect to listen for session list changes for the sidebar.
     useEffect(() => {
        if (!user) {
            setSessions([]);
            setSessionsLoaded(true);
            return;
        }
        setSessionsLoaded(false); // Reset on user change
        setError(null);
        const sessionsRef = collection(db, `${CHATS_COLLECTION}${user.uid}/sessions`);
        const q = query(sessionsRef, orderBy('updatedAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const fetchedSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
            setSessions(fetchedSessions);
            setSessionsLoaded(true);
        }, (err) => {
            console.error("Firebase session listener error:", err);
            if (err.code === 'permission-denied') {
                setError("You don't have permission to view chats. This is likely a security rule misconfiguration.");
            } else {
                setError("Failed to load chat sessions.");
            }
            setSessionsLoaded(true);
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
            const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
            setMessages(newMessages);
        }, (err) => {
            console.error("Firebase messages listener error:", err);
        });

        return () => unsubscribe();
    }, [currentSessionId, user]);
    
    useEffect(() => {
        document.body.classList.toggle('sidebar-collapsed', isSidebarCollapsed);
    }, [isSidebarCollapsed]);
    
    const handleStopGenerating = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    const handleSendMessage = async (message: string, imageFiles: File[], audioFile: File | null) => {
        if (!user || !currentSessionId || !userProfile) return;
        if (!message.trim() && imageFiles.length === 0 && !analysisFile && !audioFile) return;

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setIsLoading(true);
        if (isImageGenMode) setIsGeneratingImage(true);
        if (isVideoGenMode) setIsGeneratingVideo(true);
        
        const userMessagesInHistory = messages.filter(m => m.role === 'user');
        const shouldGenerateTitle = userMessagesInHistory.length === 0;

        const currentSession = sessions.find(s => s.id === currentSessionId);
        const isFirstMessage = currentSession?.title.startsWith(TEMP_TITLE_PREFIX) ?? false;
        
        const userMessage: Omit<ChatMessage, 'id' | 'createdAt'> = { text: message, role: 'user' };
        
        const webhookPayload = {
            sessionId: currentSessionId,
            userId: user.uid,
            username: userProfile.username,
            email: user.email!,
        };

        const userSentAudio = !!audioFile;

        try {
            if (audioFile) {
                const formData = new FormData();
                formData.append('file', audioFile);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
                const response = await fetch(url, { method: 'POST', body: formData, signal });
                if (!response.ok) throw new Error('Audio upload failed');
                const data = await response.json();
                userMessage.audioUrl = data.secure_url;
            }
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
                    }
                }
            }

            await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                ...userMessage,
                createdAt: serverTimestamp() as Timestamp,
            });

            if (isFirstMessage) {
                let newTitleText: string | null = null;
                 if (isImageGenMode) newTitleText = `Image: ${message}`;
                 else if (isVideoGenMode) newTitleText = `Video: ${message}`;
                 else if (analysisFile) newTitleText = `Analysis of ${analysisFile.name}`;
                 else if (audioFile) newTitleText = "Voice Message";
                 else newTitleText = message;

                if (newTitleText && newTitleText.trim()) {
                    const newTitle = newTitleText.trim().substring(0, 40) + (newTitleText.length > 40 ? '...' : '');
                    await updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}`), { title: newTitle, updatedAt: serverTimestamp() as Timestamp });
                } else {
                    await updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}`), { updatedAt: serverTimestamp() as Timestamp });
                }
            } else {
                 await updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}`), { updatedAt: serverTimestamp() as Timestamp });
            }

            const extractUrlFromResponse = (responseData: any): string | null => {
                if (!responseData) return null;
                const dataToInspect = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
                if (dataToInspect && typeof dataToInspect === 'object') {
                    const commonKeys = ['videoUrl', 'imageUrl', 'url', 'output'];
                    for (const key of commonKeys) {
                        if (typeof dataToInspect[key] === 'string' && dataToInspect[key].startsWith('http')) return dataToInspect[key];
                    }
                    for (const value of Object.values(dataToInspect)) {
                        if (typeof value === 'string' && value.startsWith('http')) return value as string;
                    }
                }
                return null;
            };

            if (isImageGenMode) {
                const genResponse = await fetch('https://umarworks3.app.n8n.cloud/webhook/imagegen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...webhookPayload, prompt: message }), signal });
                if (!genResponse.ok) throw new Error('Image generation service failed.');
                const genResult = await genResponse.json();
                const tempImageUrl = extractUrlFromResponse(genResult);
                if (!tempImageUrl) throw new Error('Image generation did not return a URL.');
                const imageResponse = await fetch(tempImageUrl, { signal });
                if (!imageResponse.ok) throw new Error('Could not fetch the generated image.');
                const imageBlob = await imageResponse.blob();
                const imageFile = new File([imageBlob], "generated.png", { type: imageBlob.type });
                const formData = new FormData();
                formData.append('file', imageFile);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
                const cloudinaryResponse = await fetch(cloudinaryUrl, { method: 'POST', body: formData, signal });
                if (!cloudinaryResponse.ok) throw new Error((await cloudinaryResponse.json().catch(() => ({})))?.error?.message || `Cloudinary upload failed with status: ${cloudinaryResponse.status}`);
                const cloudinaryData = await cloudinaryResponse.json();
                await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), { text: `Here's the image for your prompt:`, role: 'ai', imageUrl: cloudinaryData.secure_url, createdAt: serverTimestamp() as Timestamp });
            } else if (isVideoGenMode) {
                const genResponse = await fetch('https://umarworks3.app.n8n.cloud/webhook/videogen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...webhookPayload, prompt: message, ratio: videoAspectRatio }), signal });
                if (!genResponse.ok) throw new Error(`Video generation service failed with status ${genResponse.status}.`);
                const genResult = await genResponse.json();
                const tempVideoUrl = extractUrlFromResponse(genResult);
                if (!tempVideoUrl) throw new Error('Video generation did not return a URL.');
                const videoResponse = await fetch(tempVideoUrl, { signal });
                if (!videoResponse.ok) throw new Error('Could not fetch the generated video.');
                const videoBlob = await videoResponse.blob();
                const videoFile = new File([videoBlob], "generated.mp4", { type: videoBlob.type });
                const formData = new FormData();
                formData.append('file', videoFile);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
                const cloudinaryResponse = await fetch(cloudinaryUrl, { method: 'POST', body: formData, signal });
                if (!cloudinaryResponse.ok) throw new Error((await cloudinaryResponse.json().catch(() => ({})))?.error?.message || `Cloudinary video upload failed with status: ${cloudinaryResponse.status}`);
                let cloudinaryData = await cloudinaryResponse.json();
                let permanentVideoUrl = cloudinaryData.secure_url;
                if (videoBlob.size > 4 * 1024 * 1024) permanentVideoUrl = permanentVideoUrl.replace('/upload/', '/upload/vc_auto,q_auto/');
                await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), { text: `Here's the video for your prompt:`, role: 'ai', videoUrl: permanentVideoUrl, createdAt: serverTimestamp() as Timestamp });
            } else {
                let targetUrl = WEBHOOK_URL;
                let fetchOptions: RequestInit;

                if (isAnalysisMode) {
                    if (analysisFile) {
                        targetUrl = ANALYSIS_WEBHOOK_URL;
                        const payload = new FormData();
                        payload.append('message', message);
                        Object.entries(webhookPayload).forEach(([key, value]) => payload.append(key, value as string));
                        payload.append('file', analysisFile, analysisFile.name);
                        fetchOptions = { method: 'POST', body: payload };
                    } else {
                        targetUrl = ANALYSIS_TEXT_ONLY_WEBHOOK_URL;
                        fetchOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...webhookPayload, message: message }) };
                    }
                } else if (audioFile) {
                    targetUrl = VOICE_WEBHOOK_URL;
                    const payload = new FormData();
                    payload.append('message', message);
                    Object.entries(webhookPayload).forEach(([key, value]) => payload.append(key, value as string));
                    payload.append('file', audioFile, audioFile.name);
                    fetchOptions = { method: 'POST', body: payload };
                } else {
                    targetUrl = WEBHOOK_URL;
                    fetchOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...webhookPayload, message: message }) };
                }

                const response = await fetch(targetUrl, { ...fetchOptions, signal });
                if (!response.ok) throw new Error(`Webhook failed with status ${response.status}`);

                // All modes including file analysis now expect a streaming markdown response.
                if (!response.body) throw new Error("Response body is not available for streaming.");
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let aiResponseText = '';
                const aiMessageRef = doc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`));
                setStreamingId(aiMessageRef.id);
                await setDoc(aiMessageRef, { 
                    text: '', 
                    role: 'ai', 
                    createdAt: serverTimestamp() as Timestamp,
                    isAnalysisResponse: isAnalysisMode 
                });
                
                let buffer = '';

                const processChunk = async (chunk: string) => {
                    let textToAdd = '';
                    try {
                        const parsed = JSON.parse(chunk);
                        const content = parsed.output || parsed.text || parsed.response || '';
                        if (typeof content === 'string') {
                            textToAdd = content;
                        }
                    } catch (e) {
                        textToAdd = chunk;
                    }
                    
                    if (textToAdd) {
                        aiResponseText += textToAdd;
                        await updateDoc(aiMessageRef, { text: aiResponseText });
                    }
                };
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (signal.aborted) {
                       reader.cancel();
                       throw new DOMException('Aborted by user', 'AbortError');
                    }
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    let boundary = buffer.indexOf('\n');
                    while (boundary !== -1) {
                        const line = buffer.substring(0, boundary);
                        buffer = buffer.substring(boundary + 1);
                        if (line.trim()) {
                            await processChunk(line);
                        }
                        boundary = buffer.indexOf('\n');
                    }
                }

                if (buffer.trim()) {
                    await processChunk(buffer);
                }
                
                const finalAiText = aiResponseText;
                let audioUrl: string | undefined = undefined;
                if (userSentAudio && finalAiText && finalAiText.trim().length > 0 && finalAiText !== "Sorry, I couldn't get a response.") {
                    try {
                        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                        const ttsResponse = await ai.models.generateContent({ model: "gemini-2.5-flash-preview-tts", contents: [{ parts: [{ text: finalAiText }] }], config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } } });
                        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            const bstr = atob(base64Audio);
                            let n = bstr.length;
                            const u8arr = new Uint8Array(n);
                            while(n--) u8arr[n] = bstr.charCodeAt(n);
                            const audioBlob = pcmToWav(u8arr, 24000, 1, 16);
                            const audioFile = new File([audioBlob], `ai-speech-${Date.now()}.wav`, { type: 'audio/wav' });
                            const formData = new FormData();
                            formData.append('file', audioFile);
                            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                            const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
                            const uploadResponse = await fetch(url, { method: 'POST', body: formData, signal });
                            if (uploadResponse.ok) {
                                const uploadData = await uploadResponse.json();
                                audioUrl = uploadData.secure_url;
                            } else {
                                console.error("AI audio upload to Cloudinary failed", await uploadResponse.text());
                            }
                        }
                    } catch (ttsError) { console.error("TTS generation or upload failed:", ttsError); }
                }
                if (audioUrl) await updateDoc(aiMessageRef, { audioUrl });

                if (shouldGenerateTitle && !isAnalysisMode) {
                    fetch('https://umarworks3.app.n8n.cloud/webhook/titlegen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...webhookPayload, history: [{ role: 'user', text: message }, { role: 'ai', text: finalAiText }] }) })
                    .then(res => res.ok ? res.json() : null)
                    .then(titleResult => {
                        if (!titleResult) return;
                        let newTitle: string | null = null;
                        const data = Array.isArray(titleResult) ? titleResult[0] : titleResult;
                        if (typeof data === 'string') newTitle = data.trim();
                        else if (typeof data === 'object' && data !== null) newTitle = data.title || data.output || data.text || data.response || null;
                        if (newTitle) {
                            let cleanedTitle = String(newTitle).replace(/^"|"$/g, '').substring(0, 50).trim().replace(/undefined\s*$/, '').trim();
                            if (cleanedTitle) updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}`), { title: cleanedTitle });
                        }
                    }).catch(e => console.error("Failed to generate/update session title:", e));
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Fetch aborted by user.');
                await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                    text: `Generation stopped.`,
                    role: 'ai',
                    createdAt: serverTimestamp() as Timestamp,
                    isStopMessage: true,
                });
            } else {
                console.error("Error during message send:", error);
                const errorMessage = error instanceof Error ? error.message : "An error occurred. Please try again.";
                await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                    text: `Sorry, something went wrong: ${errorMessage}`, role: 'ai', createdAt: serverTimestamp() as Timestamp,
                });
            }
        } finally {
            setIsLoading(false);
            setIsGeneratingImage(false);
            setIsGeneratingVideo(false);
            if (isAnalysisMode) setAnalysisFile(null);
            if (isImageGenMode) setIsImageGenMode(false);
            if (isVideoGenMode) setIsVideoGenMode(false);
            abortControllerRef.current = null;
            setStreamingId(null);
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
        
        try {
            const sessionRef = doc(db, `${CHATS_COLLECTION}${user.uid}/sessions`, sessionId);
            const messagesRef = collection(sessionRef, 'messages');
            
            const messagesSnapshot = await getDocs(messagesRef);
            const batch = writeBatch(db);
            messagesSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            batch.delete(sessionRef);

            await batch.commit();

            if (currentSessionId === sessionId) {
                const remainingSessions = sessions.filter(s => s.id !== sessionId);
                if (remainingSessions.length > 0) {
                    setCurrentSessionId(remainingSessions[0].id);
                } else {
                    createNewSession(true);
                }
            }
        } catch (error) {
            console.error("Error deleting session:", error);
            alert("There was an error deleting the chat session. Please try again.");
        }
    };
    
    const handleRenameSession = async (sessionId: string, newTitle: string) => {
        if (!user) return;
        await updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions`, sessionId), { title: newTitle, updatedAt: serverTimestamp() as Timestamp });
    };

    const currentSession = sessions.find(s => s.id === currentSessionId);

    return (
        <div className="flex h-[calc(100vh-68px)] bg-primary w-full overflow-hidden">
             {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-[55] md:hidden" onClick={() => setSidebarOpen(false)}></div>}
            <ChatSidebar
                sessions={sessions}
                activeSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onNewChat={() => createNewSession(true)}
                onDeleteSession={(id, title) => openDeleteModal(title, () => handleDeleteSession(id))}
                onRenameSession={handleRenameSession}
                userProfile={userProfile}
                isOpen={isSidebarOpen}
                onClose={() => setSidebarOpen(false)}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!isSidebarCollapsed)}
                error={error}
                onViewProfile={onViewProfile}
            />
            <div className="flex-1 flex flex-col overflow-hidden h-full bg-primary">
                <header className="p-4 flex items-center justify-between z-10 flex-shrink-0 relative h-[68px]">
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 rounded-full hover:bg-muted md:hidden" aria-label="Open sidebar">
                        <svg className="w-6 h-6 text-muted"><use href="#icon-sidebar-toggle"></use></svg>
                    </button>
                    <div className="flex-1"></div>
                    <button onClick={() => createNewSession(true)} className="p-2 rounded-full hover:bg-muted md:hidden" aria-label="New Chat">
                         <svg className="w-6 h-6 text-muted"><use href="#icon-rename"></use></svg>
                    </button>
                </header>
                <ChatMessages 
                    messages={messages} 
                    streamingId={streamingId}
                    isLoading={isLoading} 
                    isGeneratingImage={isGeneratingImage} 
                    isGeneratingVideo={isGeneratingVideo} 
                    isAnalyzing={isAnalysisMode}
                    userProfile={userProfile} 
                    animatedMessageIds={animatedMessageIds}
                    onImageClick={setPreviewImageUrl}
                />
                <div className="px-2 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3 md:px-6 flex-shrink-0">
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
                        onActivateVoiceMode={() => setVoiceUIVisible(true)}
                        onStopGenerating={handleStopGenerating}
                    />
                </div>
            </div>
            {previewImageUrl && (
                <ImagePreviewModal 
                    imageUrl={previewImageUrl} 
                    onClose={() => setPreviewImageUrl(null)}
                    fileName={`lazerdsgn-ai-generated-${Date.now()}.png`}
                />
            )}
            <VoiceUIMenu
                isOpen={isVoiceUIVisible}
                onClose={() => setVoiceUIVisible(false)}
                onSendAudio={(audioFile) => {
                    handleSendMessage('', [], audioFile);
                    setVoiceUIVisible(false);
                }}
            />
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
    onClose: () => void,
    isCollapsed: boolean,
    onToggleCollapse: () => void;
    error: string | null,
    onViewProfile: () => void,
}> = ({ sessions, activeSessionId, onSelectSession, onNewChat, onDeleteSession, onRenameSession, userProfile, isOpen, onClose, isCollapsed, onToggleCollapse, error, onViewProfile }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSessions = sessions
        .filter(s => !s.title.startsWith(TEMP_TITLE_PREFIX))
        .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));

    if (isCollapsed && typeof window !== 'undefined' && window.innerWidth >= 768) {
        return (
             <div id="chat-sidebar" className="h-full flex flex-col items-center py-4 w-[72px] border-r border-primary transition-all duration-300 ease-in-out flex-shrink-0">
                <button onClick={onToggleCollapse} className="p-2 rounded-full hover:bg-muted mb-4">
                    <svg className="w-6 h-6 text-muted"><use href="#icon-sidebar-toggle"></use></svg>
                </button>
                <button onClick={onNewChat} title="New Chat" className="p-2 rounded-full hover:bg-muted">
                    <svg className="w-6 h-6 text-muted"><use href="#icon-plus-square"></use></svg>
                </button>
            </div>
        );
    }


    return (
        <div id="chat-sidebar" className={`fixed top-0 bottom-0 left-0 h-full z-[60] md:relative md:z-auto md:h-full transition-all duration-300 ease-in-out flex flex-col w-72 flex-shrink-0 md:transform-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
             <div className="p-4 flex-shrink-0 h-[68px] flex justify-between items-center border-b border-primary">
                 {/* Mobile Header */}
                 <div className="flex items-center justify-between w-full md:hidden">
                    <div className="text-xl font-bold tracking-tight text-primary">LazerDsgn.</div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
                        <svg className="w-6 h-6 text-muted"><use href="#icon-x-close"></use></svg>
                    </button>
                </div>
                {/* Desktop Header */}
                <div className="hidden md:flex w-full items-center justify-between">
                    <button id="new-chat-btn" onClick={onNewChat} className="flex items-center justify-center w-full px-4 py-2 bg-primary-accent text-on-primary-accent rounded-full font-medium hover:bg-accent-hover transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-lg">
                        <svg className="w-5 h-5 mr-2"><use href="#icon-rename"></use></svg>
                        New Chat
                    </button>
                    <button onClick={onToggleCollapse} className="p-2 rounded-full hover:bg-muted ml-2">
                        <svg className="w-6 h-6 text-muted"><use href="#icon-sidebar-toggle"></use></svg>
                    </button>
                </div>
            </div>
            {/* New Chat Button for Mobile */}
            <div className="p-4 md:hidden">
                <button onClick={() => { onNewChat(); onClose(); }} className="flex items-center justify-center w-full px-4 py-2 bg-primary-accent text-on-primary-accent rounded-full font-medium hover:bg-accent-hover transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-lg">
                    <svg className="w-5 h-5 mr-2"><use href="#icon-rename"></use></svg>
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
                        className="w-full bg-transparent border border-primary rounded-full py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-secondary transition text-primary"
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
    const [editInputValue, setEditInputValue] = useState(session.title);
    const inputRef = useRef<HTMLInputElement>(null);
    const [displayedTitle, setDisplayedTitle] = useState(session.title);
    const previousTitleRef = useRef<string>(session.title);

    useEffect(() => {
        const prevTitle = previousTitleRef.current;
        const newTitle = session.title;
        const isTempTitleUpdate = prevTitle.startsWith(TEMP_TITLE_PREFIX) && !newTitle.startsWith(TEMP_TITLE_PREFIX);

        // Animate only if the title has genuinely changed from a temporary one or been renamed.
        if (!isEditing && (isTempTitleUpdate || (prevTitle !== newTitle && !prevTitle.startsWith(TEMP_TITLE_PREFIX)))) {
            setDisplayedTitle('');
            let i = 0;
            const intervalId = setInterval(() => {
                if (i < newTitle.length) {
                    setDisplayedTitle(prev => prev + newTitle.charAt(i));
                    i++;
                } else {
                    clearInterval(intervalId);
                }
            }, 20); // Typing speed
            
            return () => clearInterval(intervalId);
        } else if (prevTitle !== newTitle) {
            // For initial load or non-animated changes, just set the title.
            setDisplayedTitle(newTitle);
        }
        
        // Always update the ref for the next render.
        previousTitleRef.current = newTitle;
    }, [session.title, isEditing]);


    useEffect(() => { setEditInputValue(session.title) }, [session.title]);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleRename = () => {
        if (editInputValue.trim() && editInputValue.trim() !== session.title) {
            onRename(session.id, editInputValue.trim());
        } else {
            setEditInputValue(session.title);
        }
        setIsEditing(false);
    };

    return (
        <div 
            className={`session-item-container group flex items-center justify-between gap-2 ${isActive ? 'active' : 'md:hover:bg-hover'}`}
            onClick={!isEditing ? onSelect : undefined}
        >
            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editInputValue}
                        onChange={(e) => setEditInputValue(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                        className="session-text text-sm w-full bg-transparent border border-primary rounded-full px-2 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className={`session-text text-sm block truncate ${isActive ? 'text-primary font-semibold' : 'text-secondary md:group-hover:text-primary'}`}>{displayedTitle}</span>
                )}
            </div>
             <div className={`flex flex-shrink-0 items-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}>
                <button title="Rename" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1.5 text-muted hover:text-primary rounded"><svg className="w-4 h-4"><use href="#icon-rename"></use></svg></button>
                <button title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-muted hover:text-primary rounded"><svg className="w-4 h-4"><use href="#icon-trash"></use></svg></button>
            </div>
        </div>
    );
};

const ChatMessages: React.FC<{ 
    messages: ChatMessage[], 
    streamingId: string | null,
    isLoading: boolean, 
    isGeneratingImage: boolean, 
    isGeneratingVideo: boolean, 
    isAnalyzing?: boolean,
    userProfile: UserProfile | null,
    animatedMessageIds: React.MutableRefObject<Set<string>>,
    onImageClick: (url: string) => void;
}> = ({ messages, streamingId, isLoading, isGeneratingImage, isGeneratingVideo, isAnalyzing, userProfile, animatedMessageIds, onImageClick }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-10 w-full max-w-4xl mx-auto">
            <div className="flex flex-col space-y-5">
                {messages.map(msg => <ChatMessageItem key={msg.id} message={msg} userProfile={userProfile} animatedMessageIds={animatedMessageIds} onImageClick={onImageClick} isStreaming={msg.id === streamingId} />)}
                {isLoading && <ChatMessageItem key="loading" message={{ role: 'ai', id: 'loading' } as ChatMessage} isLoading={true} isGeneratingImage={isGeneratingImage} isGeneratingVideo={isGeneratingVideo} isAnalyzing={isAnalyzing} userProfile={userProfile} animatedMessageIds={animatedMessageIds} isStreaming={false}/>}
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

const ChatInput: React.FC<{
    onSendMessage: (message: string, files: File[], audioFile: File | null) => void,
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
    onActivateVoiceMode: () => void;
    onStopGenerating: () => void;
}> = ({ onSendMessage, isAnalysisMode, onToggleAnalysisMode, isImageGenMode, onToggleImageGenMode, isVideoGenMode, onToggleVideoGenMode, videoAspectRatio, onVideoAspectRatioChange, onAnalysisFileSelect, analysisFile, isLoading, onActivateVoiceMode, onStopGenerating }) => {
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

    // Set up Speech Recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                let newTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        newTranscript += event.results[i][0].transcript;
                    }
                }
                setInput(prev => (prev ? prev.trim() + ' ' : '') + newTranscript.trim());
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        } else {
            console.warn("Speech recognition not supported in this browser.");
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const handleToggleListening = () => {
        const recognition = recognitionRef.current;
        if (!recognition) {
            alert("Speech recognition is not supported by your browser.");
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
                setIsListening(true);
            } catch (e) {
                console.error("Could not start recognition", e);
                if (recognitionRef.current.state !== 'listening') {
                    setIsListening(false);
                }
            }
        }
    };


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
        onSendMessage(input, [], null);
        setInput('');
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
    };

    const dismissMode = () => {
        if (isImageGenMode) onToggleImageGenMode();
        if (isVideoGenMode) onToggleVideoGenMode();
        if (isAnalysisMode) onToggleAnalysisMode();
        onAnalysisFileSelect(null);
    };
    
    const isAnyModeActive = isImageGenMode || isAnalysisMode || isVideoGenMode;
    const showSendIcon = input.trim().length > 0 || !!analysisFile;


    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className={isAnyModeActive ? 'ask-ai-active rounded-3xl' : ''}>
                <form 
                    onSubmit={handleSubmit} 
                    className="relative transition-all duration-300 shadow-lg rounded-3xl glass-surface"
                >
                    {/* NEW: Redesigned Active Mode Indicator */}
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isAnyModeActive ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="px-4 pt-3 pb-1 flex justify-between items-center">
                            <div className="flex items-center space-x-2 text-primary text-sm font-semibold min-w-0">
                                {isImageGenMode && <><svg className="w-5 h-5 text-purple-500 flex-shrink-0"><use href="#icon-image-gen"></use></svg><span className="truncate">Image Generation</span></>}
                                {isVideoGenMode && <><svg className="w-5 h-5 text-blue-500 flex-shrink-0"><use href="#icon-video"></use></svg><span className="truncate">Video Generation</span></>}
                                {isAnalysisMode && <><svg className="w-5 h-5 text-green-500 flex-shrink-0"><use href="#icon-enhance"></use></svg><span className="truncate">{analysisFile ? `Analyzing: ${analysisFile.name}` : 'Analysis Mode'}</span></>}
                            </div>
                            <button type="button" onClick={dismissMode} className="p-1 rounded-full hover:bg-hover flex-shrink-0">
                                <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        {isVideoGenMode && (
                             <div className="px-4 pb-2 flex items-center justify-start">
                                <div className="flex items-center bg-muted border border-primary rounded-full p-0.5">
                                    <button type="button" onClick={() => onVideoAspectRatioChange('16:9')} className={`px-2 py-0.5 text-xs rounded-full transition-colors ${videoAspectRatio === '16:9' ? 'bg-primary-accent text-on-primary-accent' : 'text-secondary hover:bg-hover'}`}>16:9</button>
                                    <button type="button" onClick={() => onVideoAspectRatioChange('9:16')} className={`px-2 py-0.5 text-xs rounded-full transition-colors ${videoAspectRatio === '9:16' ? 'bg-primary-accent text-on-primary-accent' : 'text-secondary hover:bg-hover'}`}>9:16</button>
                                </div>
                             </div>
                        )}
                    </div>

                    <div className="flex items-end p-2 space-x-1.5">
                        <div className="relative self-end" ref={menuRef}>
                            <div className={`absolute bottom-full mb-3 flex flex-col items-center gap-3 transition-all duration-300 ease-in-out ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                                <button type="button" onClick={handleSelectVideoGen} title="Video Gen" className="w-10 h-10 flex items-center justify-center bg-secondary border border-primary rounded-full shadow-lg hover:bg-hover transition-transform hover:scale-110">
                                    <svg className="w-5 h-5 text-muted"><use href="#icon-video"></use></svg>
                                </button>
                                <button type="button" onClick={handleSelectImageGen} title="Image Gen" className="w-10 h-10 flex items-center justify-center bg-secondary border border-primary rounded-full shadow-lg hover:bg-hover transition-transform hover:scale-110">
                                    <svg className="w-5 h-5 text-muted"><use href="#icon-image-gen"></use></svg>
                                </button>
                                <button type="button" onClick={handleSelectAnalysis} title="Analysis" className="w-10 h-10 flex items-center justify-center bg-secondary border border-primary rounded-full shadow-lg hover:bg-hover transition-transform hover:scale-110">
                                     <svg className="w-5 h-5 text-muted"><use href="#icon-enhance"></use></svg>
                                </button>
                            </div>
                            
                            <button 
                                type="button" 
                                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                                className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-hover rounded-full hover:bg-primary/20 transition-all duration-300 ease-in-out"
                            >
                                <svg className={`w-6 h-6 text-muted transition-transform duration-300 ${isMenuOpen ? 'rotate-45' : 'rotate-0'}`}><use href="#icon-plus"></use></svg>
                            </button>
                        </div>
                        
                        {isAnalysisMode ? (
                             <div className="self-end">
                                <button type="button" onClick={() => analysisInputRef.current?.click()} className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-hover rounded-full hover:bg-primary/20 text-muted transition">
                                    <svg className="w-6 h-6"><use href="#icon-paperclip"></use></svg>
                                </button>
                                <input type="file" ref={analysisInputRef} onChange={handleAnalysisFileChange} hidden />
                            </div>
                        ) : (
                             <div className="self-end">
                                <button type="button" onClick={handleToggleListening} title="Speech-to-Text" className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition ${isListening ? 'mic-recording' : 'bg-hover text-muted hover:bg-primary/20'}`}>
                                    <svg className="w-5 h-5"><use href="#icon-microphone"></use></svg>
                                </button>
                            </div>
                        )}
                        
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                            placeholder="Ask me anything..."
                            className="flex-1 bg-transparent text-primary placeholder-muted focus:outline-none focus:ring-0 resize-none self-center py-2 px-3 text-base"
                            rows={1}
                            style={{ wordBreak: 'break-word' }}
                        />

                        <div className="flex items-center self-end">
                             {isLoading ? (
                                <button 
                                    type="button"
                                    onClick={onStopGenerating}
                                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary-accent text-on-primary-accent rounded-full hover:bg-accent-hover transition-transform duration-200 ease-in-out hover:scale-110"
                                    aria-label="Stop generating response"
                                >
                                    <svg className="w-5 h-5"><use href="#icon-stop-square"></use></svg>
                                </button>
                            ) : showSendIcon ? (
                                <button type="submit" className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary-accent text-on-primary-accent rounded-full hover:bg-accent-hover transition-transform duration-200 ease-in-out enabled:hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <svg className="w-6 h-6"><use href="#icon-arrow-up"></use></svg>
                                </button>
                            ) : (
                                <button type="button" onClick={onActivateVoiceMode} className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-colors bg-hover text-muted hover:bg-primary/20">
                                    <svg className="w-6 h-6"><use href="#icon-waves-sound"></use></svg>
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};


// FIX: Completed the VoiceUIMenu component which was previously truncated. This component now returns JSX and handles the audio recording lifecycle correctly, fixing the type error.
const VoiceUIMenu: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSendAudio: (audioFile: File) => void;
}> = ({ isOpen, onClose, onSendAudio }) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Start recording automatically when the modal opens
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                    mediaRecorderRef.current = recorder;
                    audioChunksRef.current = [];
                    
                    recorder.ondataavailable = e => {
                        if (e.data.size > 0) audioChunksRef.current.push(e.data);
                    };

                    recorder.onstop = () => {
                        stream.getTracks().forEach(track => track.stop());
                        setIsRecording(false);
                    };

                    recorder.start();
                    setIsRecording(true);
                })
                .catch(err => {
                    alert("Microphone access denied. Please check browser permissions to use voice chat.");
                    onClose();
                });
        } else {
            // Cleanup on close
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        }

        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, [isOpen, onClose]);

    const handleStopAndSend = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size > 0) {
                    const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
                    onSendAudio(audioFile);
                }
                onClose();
            };
            mediaRecorderRef.current.stop();
        } else {
            onClose();
        }
    };
    
    return (
        <div
            className={`fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex flex-col items-center justify-center transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div className="text-center text-white mb-8" onClick={e => e.stopPropagation()}>
                <p className="text-2xl font-bold">Speak now...</p>
                <p className="text-muted">Your message is being recorded.</p>
            </div>
            
            <div className="w-full max-w-md h-24" onClick={e => e.stopPropagation()}>
                <LiveWaveform active={true} processing={isRecording} />
            </div>

            <div className="mt-12 flex items-center space-x-6" onClick={e => e.stopPropagation()}>
                <button 
                    onClick={onClose} 
                    className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transform transition-transform hover:scale-110"
                    aria-label="Cancel recording"
                >
                    <svg className="w-7 h-7"><use href="#icon-x-close"></use></svg>
                </button>
                <button 
                    onClick={handleStopAndSend} 
                    className="w-20 h-20 bg-primary-accent rounded-full flex items-center justify-center text-on-primary-accent shadow-lg transform transition-transform hover:scale-110"
                    aria-label="Stop and send recording"
                >
                    <svg className="w-8 h-8"><use href="#icon-arrow-up"></use></svg>
                </button>
            </div>
        </div>
    );
};

// FIX: Added default export for ChatPage component to resolve module not found error.
export default ChatPage;