import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, ChatSession, ChatMessage, UserProfile } from '../types.ts';
import { db } from '../services/firebase.ts';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, QuerySnapshot, DocumentData, Timestamp, writeBatch } from 'firebase/firestore';
import { createThumbnail, createPdfThumbnail, compressImage, dataURLtoFile, pcmToWav } from '../utils/files.ts';
import Avatar from '../components/Avatar.tsx';
import ImagePreviewModal from '../components/community/ImagePreviewModal.tsx';
import ChatMessageItem from '../components/ChatMessageItem.tsx';
import { GoogleGenAI, Modality } from '@google/genai';

// Add SpeechRecognition to the global window object for TypeScript
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

const TEMP_TITLE_PREFIX = 'New Chat -';
const WEBHOOK_URL = 'https://umarworks2.app.n8n.cloud/webhook/chatinput';
const VOICE_WEBHOOK_URL = 'https://umarworks2.app.n8n.cloud/webhook/voice';
const ANALYSIS_WEBHOOK_URL = 'https://umarworks2.app.n8n.cloud/webhook/analyze';
const ANALYSIS_TEXT_ONLY_WEBHOOK_URL = 'https://umarworks2.app.n8n.cloud/webhook/analysis';
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
    const [sessionsLoaded, setSessionsLoaded] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [isVoiceUIVisible, setVoiceUIVisible] = useState(false);

    // FIX: Moved state and ref declarations to the top of the component to fix `used before declaration` errors.
    const [messageText, setMessageText] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isRecording, setIsRecording] = useState(false);

    const animatedMessageIds = useRef(new Set<string>());
    const isInitialMessagesLoad = useRef(true);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        createNewSession(true);
    }, [createNewSession]);

     useEffect(() => {
        if (!user) {
            setSessions([]);
            setSessionsLoaded(true);
            return;
        }
        setSessionsLoaded(false);
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
        
        isInitialMessagesLoad.current = true;
        animatedMessageIds.current.clear();

        const messagesRef = collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`);
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            if (snapshot.empty) {
                setMessages([]);
                isInitialMessagesLoad.current = false;
                return;
            }

            if (isInitialMessagesLoad.current) {
                const initialMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
                initialMessages.forEach(msg => {
                    if (msg.role === 'ai') {
                        animatedMessageIds.current.add(msg.id);
                    }
                });
                setMessages(initialMessages);
                isInitialMessagesLoad.current = false;
            } else {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const newMessage = { id: change.doc.id, ...change.doc.data() } as ChatMessage;
                        setMessages(prev => prev.find(m => m.id === newMessage.id) ? prev : [...prev, newMessage]);
                    }
                });
            }
        }, (err) => {
            console.error("Firebase messages listener error:", err);
        });

        return () => unsubscribe();
    }, [currentSessionId, user]);
    
    useEffect(() => {
        document.body.classList.toggle('sidebar-collapsed', isSidebarCollapsed);
    }, [isSidebarCollapsed]);
    
    const handleSendMessage = async (message: string, imageFiles: File[], audioFile: File | null) => {
        if (!user || !currentSessionId || !userProfile) return;
        if (!message.trim() && imageFiles.length === 0 && !analysisFile && !audioFile) return;

        setIsLoading(true);
        if (isImageGenMode) setIsGeneratingImage(true);
        if (isVideoGenMode) setIsGeneratingVideo(true);
        
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
                const response = await fetch(url, { method: 'POST', body: formData });
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
                 if (isImageGenMode) {
                    newTitleText = `Image: ${message}`;
                } else if (isVideoGenMode) {
                    newTitleText = `Video: ${message}`;
                } else if (analysisFile) {
                    newTitleText = `Analysis of ${analysisFile.name}`;
                } else if (audioFile) {
                    newTitleText = "Voice Message";
                } else {
                    newTitleText = message;
                }

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
                        if (typeof dataToInspect[key] === 'string' && dataToInspect[key].startsWith('http')) {
                            return dataToInspect[key];
                        }
                    }
                    for (const value of Object.values(dataToInspect)) {
                        if (typeof value === 'string' && value.startsWith('http')) {
                            return value as string;
                        }
                    }
                }
                return null;
            };

            if (isImageGenMode) {
                const genResponse = await fetch('https://umarworks2.app.n8n.cloud/webhook/imagegen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...webhookPayload, prompt: message }),
                });
                if (!genResponse.ok) throw new Error('Image generation service failed.');
                
                let genResult;
                try {
                    genResult = await genResponse.json();
                } catch (e) {
                    console.error("Failed to parse image generation JSON:", e);
                    throw new Error("Image generation service returned an invalid response.");
                }

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
                if (!cloudinaryResponse.ok) {
                    const errorData = await cloudinaryResponse.json().catch(() => ({}));
                    throw new Error(errorData?.error?.message || `Cloudinary upload failed with status: ${cloudinaryResponse.status}`);
                }
                
                let cloudinaryData;
                try {
                    cloudinaryData = await cloudinaryResponse.json();
                } catch(e) {
                    console.error("Failed to parse Cloudinary response:", e);
                    throw new Error("Cloudinary returned an invalid response after upload.");
                }
                const permanentImageUrl = cloudinaryData.secure_url;

                await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                    text: `Here's the image for your prompt:`,
                    role: 'ai',
                    imageUrl: permanentImageUrl,
                    createdAt: serverTimestamp() as Timestamp,
                });
            } else if (isVideoGenMode) {
                const genResponse = await fetch('https://umarworks2.app.n8n.cloud/webhook/videogen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...webhookPayload, prompt: message, ratio: videoAspectRatio }),
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
                if (!cloudinaryResponse.ok) {
                    const errorData = await cloudinaryResponse.json().catch(() => ({}));
                    throw new Error(errorData?.error?.message || `Cloudinary video upload failed with status: ${cloudinaryResponse.status}`);
                }
                
                let cloudinaryData;
                 try {
                    cloudinaryData = await cloudinaryResponse.json();
                } catch(e) {
                    console.error("Failed to parse Cloudinary video response:", e);
                    throw new Error("Cloudinary returned an invalid response after video upload.");
                }
                let permanentVideoUrl = cloudinaryData.secure_url;
                const FOUR_MB = 4 * 1024 * 1024;
                if (videoBlob.size > FOUR_MB) {
                    permanentVideoUrl = permanentVideoUrl.replace('/upload/', '/upload/vc_auto,q_auto/');
                }

                await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                    text: `Here's the video for your prompt:`,
                    role: 'ai',
                    videoUrl: permanentVideoUrl,
                    createdAt: serverTimestamp() as Timestamp,
                });
            } else {
                const isAnalysis = isAnalysisMode;
                let targetUrl = isAnalysis ? ANALYSIS_WEBHOOK_URL : (audioFile ? VOICE_WEBHOOK_URL : WEBHOOK_URL);
                let fetchOptions: RequestInit;
                 if (isAnalysis && !analysisFile && message.trim()) {
                    targetUrl = ANALYSIS_TEXT_ONLY_WEBHOOK_URL;
                    fetchOptions = {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...webhookPayload, message: message }),
                    };
                } else if (isAnalysis || imageFiles.length > 0 || audioFile) {
                    const payload = new FormData();
                    payload.append('message', message);
                    Object.entries(webhookPayload).forEach(([key, value]) => {
                        payload.append(key, value);
                    });
                    if (isAnalysis && analysisFile) {
                        payload.append('file', analysisFile, analysisFile.name);
                    } else if (audioFile) {
                        payload.append('file', audioFile, audioFile.name);
                    } else {
                        imageFiles.forEach((file) => {
                            payload.append(`files`, file, file.name);
                        });
                    }
                    fetchOptions = { method: 'POST', body: payload };
                } else {
                    fetchOptions = {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...webhookPayload, message: message }),
                    };
                }

                const response = await fetch(targetUrl, fetchOptions);
                if (!response.ok) throw new Error(`Webhook failed with status ${response.status}`);
                
                let result;
                try {
                    result = await response.json();
                } catch (e) {
                    console.error("Failed to parse chat/analysis JSON response:", e);
                    throw new Error("The server returned an invalid response.");
                }
                
                const resultData = Array.isArray(result) ? result[0] : result;
                const driveLink = resultData?.output || resultData?.webViewLink || resultData?.url;

                if (isAnalysis && driveLink && typeof driveLink === 'string' && driveLink.includes('drive.google.com')) {
                    await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                        text: `The analysis of ${analysisFile?.name || 'your file'} is complete. You can view the generated PDF below.`,
                        role: 'ai',
                        analysisResult: {
                            url: driveLink,
                            name: analysisFile?.name || `analysis-result-${Date.now()}.pdf`,
                            type: 'application/pdf',
                        },
                        createdAt: serverTimestamp() as Timestamp,
                    });
                } else {
                    const aiResponseText = resultData?.output || resultData?.text || resultData?.response || "Sorry, I couldn't get a response.";
                    
                    let audioUrl: string | undefined = undefined;
                    if (userSentAudio && aiResponseText && aiResponseText.trim().length > 0) {
                        try {
                            const ai = new GoogleGenAI({ apiKey: "AIzaSyC-OAaC8a4Le1CoCtmsNAZrWGYnTa6CDeo" });
                            const ttsResponse = await ai.models.generateContent({
                                model: "gemini-2.5-flash-preview-tts",
                                contents: [{ parts: [{ text: aiResponseText }] }],
                                config: {
                                    responseModalities: [Modality.AUDIO],
                                    speechConfig: {
                                        voiceConfig: {
                                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                                        },
                                    },
                                },
                            });

                            const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                            
                            if (base64Audio) {
                                const bstr = atob(base64Audio);
                                let n = bstr.length;
                                const u8arr = new Uint8Array(n);
                                while(n--){
                                    u8arr[n] = bstr.charCodeAt(n);
                                }
                                
                                const audioBlob = pcmToWav(u8arr, 24000, 1, 16);
                                const audioFile = new File([audioBlob], `ai-speech-${Date.now()}.wav`, { type: 'audio/wav' });

                                const formData = new FormData();
                                formData.append('file', audioFile);
                                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                                const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
                                const uploadResponse = await fetch(url, { method: 'POST', body: formData });
                                
                                if (!uploadResponse.ok) {
                                    console.error("AI audio upload to Cloudinary failed", await uploadResponse.text());
                                } else {
                                    const uploadData = await uploadResponse.json();
                                    audioUrl = uploadData.secure_url;
                                }
                            }
                        } catch (ttsError) {
                            console.error("TTS generation or upload failed:", ttsError);
                        }
                    }
                    
                    await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                        text: aiResponseText,
                        role: 'ai',
                        audioUrl: audioUrl,
                        createdAt: serverTimestamp() as Timestamp,
                    });
                }
            }
        } catch (err: any) {
            console.error("Message sending failed:", err);
            const errorMessage = err.message || "An unexpected error occurred.";
            setError(`Failed to send message: ${errorMessage}`);
            setIsGeneratingImage(false);
            setIsGeneratingVideo(false);
        } finally {
            setIsLoading(false);
            if (!isVideoGenMode) setIsGeneratingVideo(false);
            if (!isImageGenMode) setIsGeneratingImage(false);
            setAnalysisFile(null);
        }
    };
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading, isGeneratingImage, isGeneratingVideo]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSendMessage(messageText, imageFiles, null);
        setMessageText('');
        setImageFiles([]);
        setImagePreviews([]);
        setAnalysisFile(null);
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessageText(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (isAnalysisMode) {
            setAnalysisFile(files[0]);
            setMessageText(files[0].name);
        } else {
            const imageFilesToProcess = files.filter(f => f.type.startsWith('image/')).slice(0, 4 - imageFiles.length);
            const compressedFiles = await Promise.all(imageFilesToProcess.map(file => compressImage(file, 1024 * 1024).then(dataUrl => dataURLtoFile(dataUrl, file.name))));
            setImageFiles(prev => [...prev, ...compressedFiles]);
            setImagePreviews(prev => [...prev, ...compressedFiles.map(f => URL.createObjectURL(f))]);
        }

        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleVoiceSubmit = () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            return;
        }

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
            recorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`);
                handleSendMessage('', [], audioFile);
                stream.getTracks().forEach(track => track.stop());
                setIsRecording(false);
            };
            recorder.start();
            setIsRecording(true);
        }).catch(err => console.error("Mic access error:", err));
    };
    
    const handleDeleteSession = async (sessionId: string) => {
        if (!user) return;
        const sessionRef = doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${sessionId}`);
        const messagesRef = collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${sessionId}/messages`);

        try {
            const messagesSnapshot = await getDocs(messagesRef);
            const batch = writeBatch(db);
            messagesSnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            await deleteDoc(sessionRef);

            if (currentSessionId === sessionId) {
                if (sessions.length > 1) {
                    const nextSession = sessions.find(s => s.id !== sessionId) || sessions[0];
                    setCurrentSessionId(nextSession.id);
                } else {
                    await createNewSession(true);
                }
            }
        } catch (error) {
            console.error("Error deleting session:", error);
            setError("Failed to delete the session.");
        }
    };

    const removeImage = (indexToRemove: number) => {
        URL.revokeObjectURL(imagePreviews[indexToRemove]);
        setImageFiles(prev => prev.filter((_, i) => i !== indexToRemove));
        setImagePreviews(prev => prev.filter((_, i) => i !== indexToRemove));
    };

    const isInputEmpty = !messageText.trim() && imageFiles.length === 0 && !analysisFile;
    
    return (
        <div className={`flex h-screen w-full bg-primary text-primary transition-all duration-300 ${isSidebarOpen ? 'md:pl-64' : (isSidebarCollapsed ? 'md:pl-16' : 'md:pl-0')}`}>
            {/* Sidebar */}
            <aside id="chat-sidebar" className={`fixed top-0 left-0 h-full bg-secondary z-40 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
                <div className="p-3 flex items-center justify-between border-b border-primary h-[69px]">
                    {!isSidebarCollapsed && (
                        <h2 className="text-lg font-bold">Chat Sessions</h2>
                    )}
                    <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:block p-1 rounded-full hover:bg-hover">
                        <svg className="w-5 h-5 text-muted"><use href="#icon-sidebar-toggle"></use></svg>
                    </button>
                </div>
                <div className="p-3">
                    <button onClick={() => createNewSession(true)} className={`w-full flex items-center p-2 rounded-lg border-2 border-dashed border-secondary hover:border-primary hover:bg-hover transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                        <svg className="w-5 h-5 text-muted"><use href="#icon-plus-square"></use></svg>
                        {!isSidebarCollapsed && <span className="ml-2 text-sm font-medium text-secondary">New Chat</span>}
                    </button>
                </div>
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                     {sessionsLoaded ? sessions.map(session => (
                        <div key={session.id} className={`session-item-container group ${currentSessionId === session.id ? 'active' : ''}`}>
                            <div className="flex-1" onClick={() => setCurrentSessionId(session.id)}>
                                <p className={`text-sm text-secondary truncate session-text ${isSidebarCollapsed ? 'hidden' : ''}`}>{session.title.replace(TEMP_TITLE_PREFIX, '')}</p>
                            </div>
                            {!isSidebarCollapsed && (
                                <button onClick={() => openDeleteModal(session.title, () => handleDeleteSession(session.id))} className="text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg className="w-4 h-4"><use href="#icon-trash"></use></svg>
                                </button>
                            )}
                        </div>
                    )) : Array(5).fill(0).map((_, i) => (
                        <div key={i} className={`h-10 rounded-lg shimmer-bg ${isSidebarCollapsed ? 'w-10 mx-auto' : ''}`}></div>
                    ))}
                </nav>
            </aside>

            <div className="flex-1 flex flex-col h-full bg-secondary">
                {/* Chat Header */}
                <header className="flex items-center justify-between p-4 border-b border-primary bg-secondary flex-shrink-0">
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 -ml-2 text-muted hover:text-primary">
                        <svg className="w-6 h-6"><use href="#icon-sidebar-toggle"></use></svg>
                    </button>
                    <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1.5 text-sm font-semibold rounded-full cursor-pointer transition-colors ${!isAnalysisMode && !isImageGenMode && !isVideoGenMode ? 'bg-primary text-on-primary-accent' : 'bg-muted text-secondary hover:bg-hover'}`} onClick={() => { setAnalysisMode(false); setIsImageGenMode(false); setIsVideoGenMode(false); }}>Chat</span>
                        <span className={`px-3 py-1.5 text-sm font-semibold rounded-full cursor-pointer transition-colors ${isAnalysisMode ? 'bg-primary text-on-primary-accent mode-active-glow' : 'bg-muted text-secondary hover:bg-hover'}`} onClick={() => { setAnalysisMode(true); setIsImageGenMode(false); setIsVideoGenMode(false); }}>Analyze</span>
                        <span className={`px-3 py-1.5 text-sm font-semibold rounded-full cursor-pointer transition-colors ${isImageGenMode ? 'bg-primary text-on-primary-accent mode-active-glow' : 'bg-muted text-secondary hover:bg-hover'}`} onClick={() => { setAnalysisMode(false); setIsImageGenMode(true); setIsVideoGenMode(false); }}>Image</span>
                        <span className={`px-3 py-1.5 text-sm font-semibold rounded-full cursor-pointer transition-colors ${isVideoGenMode ? 'bg-primary text-on-primary-accent mode-active-glow' : 'bg-muted text-secondary hover:bg-hover'}`} onClick={() => { setAnalysisMode(false); setIsImageGenMode(false); setIsVideoGenMode(true); }}>Video</span>
                    </div>
                    {isVideoGenMode && (
                        <div className="flex items-center space-x-2">
                            <button onClick={() => setVideoAspectRatio('16:9')} className={`px-2 py-1 text-xs font-mono rounded ${videoAspectRatio === '16:9' ? 'bg-secondary-accent text-white' : 'bg-muted'}`}>16:9</button>
                            <button onClick={() => setVideoAspectRatio('9:16')} className={`px-2 py-1 text-xs font-mono rounded ${videoAspectRatio === '9:16' ? 'bg-secondary-accent text-white' : 'bg-muted'}`}>9:16</button>
                        </div>
                    )}
                </header>
                
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {error && <div className="p-3 bg-red-500/10 text-red-500 rounded-lg text-sm">{error}</div>}
                    {messages.map((msg) => (
                        <ChatMessageItem key={msg.id} message={msg} userProfile={userProfile} animatedMessageIds={animatedMessageIds} onImageClick={setPreviewImageUrl} />
                    ))}
                    {(isLoading || isGeneratingImage || isGeneratingVideo) && <ChatMessageItem message={{id:'loading', text:'', role:'ai', createdAt: Timestamp.now()}} isLoading={true} isGeneratingImage={isGeneratingImage} isGeneratingVideo={isVideoGenMode} isAnalyzing={isAnalysisMode && isLoading} userProfile={userProfile} animatedMessageIds={animatedMessageIds} />}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="mt-auto p-4 border-t border-primary bg-secondary">
                    <form onSubmit={handleFormSubmit} className={`relative ${(isImageGenMode || isVideoGenMode) ? 'ask-ai-active' : ''} rounded-2xl`}>
                        <div className="bg-secondary rounded-2xl p-2 flex items-end gap-2">
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-muted hover:text-primary rounded-full hover:bg-hover transition-colors flex-shrink-0" title="Attach file">
                                <svg className="w-5 h-5"><use href="#icon-paperclip"></use></svg>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={isAnalysisMode ? '*' : 'image/*'} multiple={!isAnalysisMode} hidden />
                            </button>
                            <div className="flex-1 flex flex-col">
                                {(imagePreviews.length > 0 || analysisFile) && (
                                    <div className="flex items-center gap-2 p-2 bg-muted rounded-t-lg">
                                        {analysisFile ? (
                                            <div className="flex items-center gap-2 text-sm text-secondary">
                                                <svg className="w-4 h-4"><use href="#icon-file-text"></use></svg>
                                                <span>{analysisFile.name}</span>
                                                <button onClick={() => setAnalysisFile(null)} className="p-1 hover:bg-hover rounded-full">&times;</button>
                                            </div>
                                        ) : imagePreviews.map((src, i) => (
                                            <div key={i} className="relative">
                                                <img src={src} className="h-12 w-12 object-cover rounded" />
                                                <button onClick={() => removeImage(i)} className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full h-4 w-4 text-xs flex items-center justify-center">&times;</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <textarea
                                    ref={textareaRef}
                                    value={messageText}
                                    onChange={handleTextareaChange}
                                    placeholder={isAnalysisMode ? "Upload a file and ask a question..." : (isImageGenMode || isVideoGenMode) ? "Describe the media you want to create..." : "Type your message here..."}
                                    className={`w-full bg-transparent p-2 text-base resize-none focus:outline-none placeholder-muted ${imagePreviews.length > 0 || analysisFile ? 'rounded-b-lg' : 'rounded-lg'}`}
                                    rows={1}
                                />
                            </div>

                            {isInputEmpty ? (
                                <button type="button" onClick={handleVoiceSubmit} className={`p-3 rounded-full flex-shrink-0 transition-colors ${isRecording ? 'mic-recording' : 'text-muted hover:text-primary hover:bg-hover'}`} title={isRecording ? 'Stop Recording' : 'Use Microphone'}>
                                    <svg className="w-5 h-5"><use href={isRecording ? "#icon-stop-square" : "#icon-microphone"}></use></svg>
                                </button>
                            ) : (
                                <button type="submit" disabled={isLoading} className="p-3 bg-primary-accent text-on-primary-accent rounded-full hover:bg-accent-hover transition-colors disabled:opacity-50 flex-shrink-0" title="Send Message">
                                    {isLoading ? <svg className="w-5 h-5 animate-spin"><use href="#icon-spinner"></use></svg> : <svg className="w-5 h-5"><use href="#icon-paper-plane"></use></svg>}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
            {previewImageUrl && <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />}
        </div>
    );
};

export default ChatPage;
