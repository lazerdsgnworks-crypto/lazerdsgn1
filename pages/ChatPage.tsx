

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, ChatSession, ChatMessage, UserProfile } from '../types';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, QuerySnapshot, DocumentData, Timestamp, writeBatch } from 'firebase/firestore';
import { createThumbnail, createPdfThumbnail, compressImage, dataURLtoFile } from '../utils/files';
import Avatar from '../components/Avatar';
import ImagePreviewModal from '../components/community/ImagePreviewModal';

const TEMP_TITLE_PREFIX = 'New Chat -';
const WEBHOOK_URL = 'https://umarworks2.app.n8n.cloud/webhook/chatinput';
const ANALYSIS_WEBHOOK_URL = 'https://umarworks2.app.n8n.cloud/webhook/analyze';
const ANALYSIS_TEXT_ONLY_WEBHOOK_URL = 'https://umarworks2.app.n8n.cloud/webhook/analysis';
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

function highlightSyntax(code: string): string {
    const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'from', 'export', 'default', 'async', 'await', 'class', 'new', 'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue', 'debugger', 'delete', 'in', 'instanceof', 'typeof', 'void', 'true', 'false', 'null', 'undefined'];

    // Each part is a capturing group. This makes the callback logic simple.
    const tokenRegex = new RegExp([
        // 1. Comments
        `(${/(\/\/.*|\/\*[\s\S]*?\*\/)/.source})`,
        // 2. Strings
        `(${/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/.source})`,
        // 3. Keywords
        `(\\b(?:${keywords.join('|')})\\b)`,
        // 4. Numbers
        `(\\b\\d+(?:\\.\\d+)?\\b)`,
        // 5. Function calls
        `([a-zA-Z_]\\w*)(?=\\s*\\()`,
        // 6. Punctuation
        `([().,;[\\]{}<>=+\\-*\\/%&|!^?:])`
    ].join('|'), 'g');
    
    // Callback parameters: match, g1, g2, g3, g4, g5, g6, offset, string
    return code.replace(tokenRegex, (match, g1_comment, g2_string, g3_keyword, g4_number, g5_function, g6_punctuation) => {
        if (g1_comment !== undefined) return `<span class="code-comment">${g1_comment}</span>`;
        if (g2_string !== undefined) return `<span class="code-string">${g2_string}</span>`;
        if (g3_keyword !== undefined) return `<span class="code-keyword">${g3_keyword}</span>`;
        if (g4_number !== undefined) return `<span class="code-number">${g4_number}</span>`;
        if (g5_function !== undefined) return `<span class="code-function">${g5_function}</span>`;
        if (g6_punctuation !== undefined) return `<span class="code-punctuation">${g6_punctuation}</span>`;
        return match;
    });
}

function formatAIResponse(text: any): string {
    if (typeof text !== 'string') {
        if (text && typeof text === 'object') {
            try {
                // Format objects as a JSON code block.
                text = "```json\n" + JSON.stringify(text, null, 2) + "\n```";
            } catch (e) {
                return '[Invalid AI Response]';
            }
        } else {
             text = String(text || '');
        }
    }

    if (!text) return '';

    // Split by code blocks, keeping the delimiters.
    const parts = text.split(/(```[a-zA-Z]*\n[\s\S]*?```)/g);

    return parts.map((part) => {
        if (!part) return '';

        const codeBlockMatch = part.match(/^```([a-zA-Z]*)\n([\s\S]*)```$/);
        if (codeBlockMatch) {
            const language = codeBlockMatch[1];
            const code = codeBlockMatch[2];
            const escapedCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const highlightedCode = highlightSyntax(escapedCode);
            
            return `<div class="code-block-wrapper">
                        <div class="code-block-header">
                            <span class="code-language">${language || 'code'}</span>
                            <button class="copy-code-btn" title="Copy code">
                                <svg class="w-4 h-4 icon-copy-initial"><use href="#icon-copy"></use></svg>
                                <svg class="w-4 h-4 icon-copy-success hidden text-green-500"><use href="#icon-check"></use></svg>
                            </button>
                        </div>
                        <pre><code class="language-${language}">${highlightedCode}</code></pre>
                    </div>`;
        }
        
        // This is a non-code block part.
        // A simple regex to detect the presence of any HTML tag.
        const hasHtmlTags = /<\/?[a-zA-Z][^>]*>/.test(part);

        if (hasHtmlTags) {
            // If the original text has HTML, we will render it in a sandboxed container.
            // We must encode it to safely store it in a data attribute.
            const encodedHtml = part
                .replace(/&/g, "&amp;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
            
            return `<div class="html-render-box" data-html-content="${encodedHtml}"></div>`;
        } else {
            // Otherwise, it's plain text. Sanitize and apply markdown.
            let safeText = part
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");

            safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            safeText = safeText.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
            safeText = safeText.replace(/\n/g, '<br />');
            return safeText;
        }
    }).join('');
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
        
        // Reset for the new session
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
                // Pre-populate animated IDs to prevent animation on load
                initialMessages.forEach(msg => {
                    if (msg.role === 'ai') {
                        animatedMessageIds.current.add(msg.id);
                    }
                });
                setMessages(initialMessages);
                isInitialMessagesLoad.current = false;
            } else {
                // Handle subsequent changes (new messages)
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
    
    const handleSendMessage = async (message: string, imageFiles: File[]) => {
        if (!user || !currentSessionId || !userProfile) return;
        if (!message.trim() && imageFiles.length === 0 && !analysisFile) return;

        setIsLoading(true);
        if (isImageGenMode) setIsGeneratingImage(true);
        if (isVideoGenMode) setIsGeneratingVideo(true);
        
        const userMessagesInHistory = messages.filter(m => m.role === 'user');
        const shouldGenerateTitle = userMessagesInHistory.length === 1;

        const currentSession = sessions.find(s => s.id === currentSessionId);
        const isFirstMessage = currentSession?.title.startsWith(TEMP_TITLE_PREFIX) ?? false;
        
        const userMessage: Omit<ChatMessage, 'id' | 'createdAt'> = { text: message, role: 'user' };
        
        const webhookPayload = {
            sessionId: currentSessionId,
            userId: user.uid,
            username: userProfile.username,
            email: user.email!,
        };

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
                createdAt: serverTimestamp() as Timestamp,
            });

            // --- UPDATED: Set initial title on first message for ALL chat types. Webhook will override for text chats. ---
            if (isFirstMessage) {
                let newTitleText: string | null = null;
                if (isImageGenMode) {
                    newTitleText = `Image: ${message}`;
                } else if (isVideoGenMode) {
                    newTitleText = `Video: ${message}`;
                } else if (analysisFile) {
                    newTitleText = `Analysis of ${analysisFile.name}`;
                } else {
                    // This is a regular text chat's first message. Use it for the initial title.
                    // This title will act as a fallback if the webhook fails later.
                    newTitleText = message;
                }

                if (newTitleText && newTitleText.trim()) {
                    const newTitle = newTitleText.trim().substring(0, 40) + (newTitleText.length > 40 ? '...' : '');
                    await updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}`), { title: newTitle, updatedAt: serverTimestamp() as Timestamp });
                } else {
                    // Fallback for empty initial messages, just update timestamp
                    await updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}`), { updatedAt: serverTimestamp() as Timestamp });
                }
            } else {
                 // For subsequent messages, just update the timestamp to bump it in the session list.
                 await updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}`), { updatedAt: serverTimestamp() as Timestamp });
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

                // If video is larger than 4MB, apply Cloudinary's on-the-fly compression transformations.
                const FOUR_MB = 4 * 1024 * 1024;
                if (videoBlob.size > FOUR_MB) {
                    // vc_auto: automatically chooses the best video codec.
                    // q_auto: automatically determines the best quality/compression level.
                    permanentVideoUrl = permanentVideoUrl.replace('/upload/', '/upload/vc_auto,q_auto/');
                }

                await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                    text: `Here's the video for your prompt:`,
                    role: 'ai',
                    videoUrl: permanentVideoUrl,
                    createdAt: serverTimestamp() as Timestamp,
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
                        body: JSON.stringify({ ...webhookPayload, message: message }),
                    };
                } else if (isAnalysis || imageFiles.length > 0) {
                    // This covers: analysis with file, and normal chat with files
                    const payload = new FormData();
                    payload.append('message', message);
                    Object.entries(webhookPayload).forEach(([key, value]) => {
                        payload.append(key, value);
                    });


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
                
                // Robustly check for a Google Drive link in the webhook response.
                const resultData = Array.isArray(result) ? result[0] : result;
                const driveLink = resultData?.output || resultData?.webViewLink || resultData?.url;

                if (isAnalysis && driveLink && typeof driveLink === 'string' && driveLink.includes('drive.google.com')) {
                    // Analysis resulted in a Google Drive link. Save it to Firestore.
                    await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                        text: `The analysis of ${analysisFile?.name || 'your file'} is complete. You can view the generated PDF below.`,
                        role: 'ai',
                        analysisResult: {
                            url: driveLink, // Store the provided Drive link
                            name: analysisFile?.name || `analysis-result-${Date.now()}.pdf`,
                            type: 'application/pdf',
                        },
                        createdAt: serverTimestamp() as Timestamp,
                    });
                } else {
                    // Handle standard text response for normal chat or fallback for analysis.
                    const aiResponseText = resultData?.output || resultData?.text || resultData?.response || "Sorry, I couldn't get a response.";

                    await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                        text: aiResponseText, role: 'ai', createdAt: serverTimestamp() as Timestamp,
                    });

                    // Automatically generate a title after the second user message
                    if (shouldGenerateTitle && !isAnalysisMode) {
                        const chatHistoryForTitleGen = messages
                            .map(m => ({ role: m.role, text: m.text }))
                            .concat([
                                { role: 'user', text: message },
                                { role: 'ai', text: aiResponseText }
                            ]);
                        
                        // Fire-and-forget fetch to generate and update title
                        fetch('https://umarworks2.app.n8n.cloud/webhook/titlegen', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...webhookPayload, history: chatHistoryForTitleGen })
                        })
                        .then(async res => {
                            if (!res.ok) {
                                console.error('Title generation webhook failed.', res.status);
                                return null;
                            }
                            try {
                                return await res.json();
                            } catch (e) {
                                console.error("Failed to parse title generation JSON response:", e);
                                return null;
                            }
                        })
                        .then(titleResult => {
                            if (!titleResult) return;

                            // FIX: Robustly extract title from various possible webhook response structures.
                            let newTitle: string | null = null;
                            const data = Array.isArray(titleResult) ? titleResult[0] : titleResult;

                            if (typeof data === 'string') {
                                newTitle = data.trim();
                            } else if (typeof data === 'object' && data !== null) {
                                // Check for common keys where a title might be found.
                                newTitle = data.title || data.output || data.text || data.response || null;
                            }

                            if (newTitle && typeof newTitle === 'string') {
                                const cleanedTitle = newTitle.replace(/^"|"$/g, '').substring(0, 50);
                                return updateDoc(doc(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}`), { 
                                    title: cleanedTitle
                                });
                            }
                        })
                        .catch(e => {
                            console.error("Failed to generate/update session title:", e);
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error during message send:", error);
            const errorMessage = error instanceof Error ? error.message : "An error occurred. Please try again.";
            await addDoc(collection(db, `${CHATS_COLLECTION}${user.uid}/sessions/${currentSessionId}/messages`), {
                text: `Sorry, something went wrong: ${errorMessage}`, role: 'ai', createdAt: serverTimestamp() as Timestamp,
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
        
        try {
            const sessionRef = doc(db, `${CHATS_COLLECTION}${user.uid}/sessions`, sessionId);
            const messagesRef = collection(sessionRef, 'messages');
            
            // Get all messages to delete them in a batch
            const messagesSnapshot = await getDocs(messagesRef);
            const batch = writeBatch(db);
            messagesSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete the session document itself
            batch.delete(sessionRef);

            await batch.commit();

            if (currentSessionId === sessionId) {
                // After deletion, find the next session to make active.
                // The `sessions` state array is already sorted by `updatedAt` descending.
                const remainingSessions = sessions.filter(s => s.id !== sessionId);
                if (remainingSessions.length > 0) {
                    // Switch to the most recent remaining session.
                    setCurrentSessionId(remainingSessions[0].id);
                } else {
                    // If no sessions are left, create a new one.
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
            <div className="flex-1 flex flex-col overflow-hidden h-full bg-primary">
                <header className="p-4 flex items-center justify-between z-10 flex-shrink-0 relative">
                     <div className="flex items-center">
                        <button onClick={() => {
                            if (window.innerWidth < 768) setSidebarOpen(!isSidebarOpen)
                            else setSidebarCollapsed(!isSidebarCollapsed)
                        }} id="sidebar-toggle-btn" className="p-2 rounded-full hover:bg-muted">
                            <svg className="w-6 h-6 transition-transform text-muted"><use href="#icon-sidebar-toggle"></use></svg>
                        </button>
                         <button onClick={() => createNewSession(true)} id="collapsed-new-chat-btn" className={`${isSidebarCollapsed ? 'inline-flex' : 'hidden'} p-2 rounded-full hover:bg-muted ml-2`}>
                             <svg className="w-6 h-6 text-muted"><use href="#icon-rename"></use></svg>
                        </button>
                    </div>

                    <button onClick={() => createNewSession(true)} className="p-2 rounded-full hover:bg-muted md:hidden" aria-label="New Chat">
                         <svg className="w-6 h-6 text-muted"><use href="#icon-rename"></use></svg>
                    </button>
                </header>
                <ChatMessages 
                    messages={messages} 
                    isLoading={isLoading} 
                    isGeneratingImage={isGeneratingImage} 
                    isGeneratingVideo={isGeneratingVideo} 
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
        <div id="chat-sidebar" className={`fixed top-0 bottom-0 left-0 h-full z-40 md:relative md:h-full transition-all duration-300 ease-in-out flex flex-col w-72 flex-shrink-0 md:transform-none ${isOpen ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'collapsed' : ''}`}>
             <div className="p-4 flex-shrink-0 h-[68px]">
                    <button id="new-chat-btn" onClick={onNewChat} className="flex items-center justify-center w-full px-4 py-2 bg-primary-accent text-on-primary-accent rounded-full font-medium hover:bg-accent-hover transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-lg">
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
    const [displayedTitle, setDisplayedTitle] = useState('');
    const previousTitleRef = useRef<string | null>(null);

    useEffect(() => {
        const isInitialLoad = previousTitleRef.current === null;
        const titleChanged = previousTitleRef.current !== session.title;
        const isTempTitle = session.title.startsWith(TEMP_TITLE_PREFIX);

        if (isInitialLoad || isTempTitle || isEditing) {
            setDisplayedTitle(session.title);
        } else if (titleChanged) {
            setDisplayedTitle('');
            let i = 0;
            const intervalId = setInterval(() => {
                if (i < session.title.length) {
                    setDisplayedTitle(prev => prev + session.title.charAt(i));
                    i++;
                } else {
                    clearInterval(intervalId);
                }
            }, 20); // Typing speed

            return () => clearInterval(intervalId);
        }
        previousTitleRef.current = session.title;
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
    isLoading: boolean, 
    isGeneratingImage: boolean, 
    isGeneratingVideo: boolean, 
    userProfile: UserProfile | null,
    animatedMessageIds: React.MutableRefObject<Set<string>>,
    onImageClick: (url: string) => void;
}> = ({ messages, isLoading, isGeneratingImage, isGeneratingVideo, userProfile, animatedMessageIds, onImageClick }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-10 w-full max-w-4xl mx-auto">
            <div className="flex flex-col space-y-5">
                {messages.map(msg => <ChatMessageItem key={msg.id} message={msg} userProfile={userProfile} animatedMessageIds={animatedMessageIds} onImageClick={onImageClick}/>)}
                {isLoading && <ChatMessageItem message={{ role: 'ai', id: 'loading' } as ChatMessage} isLoading={true} isGeneratingImage={isGeneratingImage} isGeneratingVideo={isGeneratingVideo} userProfile={userProfile} animatedMessageIds={animatedMessageIds}/>}
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

const ChatMessageItem: React.FC<{ 
    message: ChatMessage, 
    isLoading?: boolean, 
    isGeneratingImage?: boolean, 
    isGeneratingVideo?: boolean, 
    userProfile: UserProfile | null,
    animatedMessageIds: React.MutableRefObject<Set<string>>,
    onImageClick?: (url: string) => void;
}> = ({ message, isLoading, isGeneratingImage, isGeneratingVideo, userProfile, animatedMessageIds, onImageClick }) => {
    const isUser = message.role === 'user';
    const isAi = message.role === 'ai';
    const [displayedText, setDisplayedText] = useState('');
    const bubbleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isAi && message.text && !animatedMessageIds.current.has(message.id)) {
            const hasCodeBlock = /```/.test(message.text);
            const hasHtmlTags = /<\/?[a-zA-Z][^>]*>/.test(message.text);

            if (hasCodeBlock || hasHtmlTags) {
                // If code or HTML is present, render the whole message at once to avoid formatting issues.
                setDisplayedText(message.text);
                animatedMessageIds.current.add(message.id);
            } else {
                // Otherwise, use the typing animation for text-only messages.
                let i = 0;
                const textToAnimate = message.text;
                animatedMessageIds.current.add(message.id);
                
                const intervalId = setInterval(() => {
                    if (i < textToAnimate.length) {
                        setDisplayedText(textToAnimate.substring(0, i + 1));
                        i++;
                    } else {
                        clearInterval(intervalId);
                    }
                }, 5); // Typing speed
                
                return () => clearInterval(intervalId);
            }
        } else {
            setDisplayedText(message.text || '');
        }
    }, [message.id, message.text, isAi, animatedMessageIds]);
    
    // Effect for handling delegated code copy clicks
    useEffect(() => {
        const bubble = bubbleRef.current;
        if (!bubble) return;

        const handleCopyClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const button = target.closest('.copy-code-btn');
            
            if (button) {
                e.stopPropagation(); // Prevent other clicks
                const wrapper = button.closest('.code-block-wrapper');
                const pre = wrapper?.querySelector('pre');
                if (pre) {
                    navigator.clipboard.writeText(pre.innerText);
                    const initialIcon = button.querySelector('.icon-copy-initial');
                    const successIcon = button.querySelector('.icon-copy-success');
                    if (initialIcon && successIcon) {
                        initialIcon.classList.add('hidden');
                        successIcon.classList.remove('hidden');
                        setTimeout(() => {
                            initialIcon.classList.remove('hidden');
                            successIcon.classList.add('hidden');
                        }, 2000);
                    }
                }
            }
        };

        bubble.addEventListener('click', handleCopyClick);
        return () => {
            if (bubble) bubble.removeEventListener('click', handleCopyClick);
        };
    }, []); // Runs once when component mounts.

    // Effect for rendering sandboxed HTML
    useEffect(() => {
        if (isAi && bubbleRef.current) {
            const htmlBoxes = bubbleRef.current.querySelectorAll<HTMLDivElement>('.html-render-box');
            htmlBoxes.forEach(box => {
                if (box.querySelector('iframe')) return; // Already rendered

                const htmlContent = box.dataset.htmlContent;
                if (htmlContent) {
                    const iframe = document.createElement('iframe');
                    // This sandbox is secure (no scripts) but allows links, forms, etc.
                    iframe.setAttribute('sandbox', 'allow-forms allow-modals allow-popups allow-presentation allow-same-origin');
                    iframe.style.width = '100%';
                    iframe.style.border = 'none';
                    iframe.style.height = '1px'; // Start with a minimal height to be in the layout flow
                    iframe.style.display = 'block';
                    iframe.style.transition = 'height 0.3s ease-in-out'; // Smooth resize
                    
                    iframe.onload = () => {
                        try {
                            const doc = iframe.contentWindow?.document;
                            const body = doc?.body;
                            if (!body) return;

                            const resize = () => {
                                // Using body.scrollHeight is more reliable with padding.
                                const contentHeight = body.scrollHeight; 
                                if (contentHeight > 0) {
                                    iframe.style.height = `${contentHeight}px`;
                                }
                            };

                            resize(); // Initial resize
                            
                            // Observe for changes inside the iframe (like images loading, etc.)
                            const observer = new MutationObserver(resize);
                            observer.observe(body, {
                                attributes: true,
                                childList: true,
                                subtree: true,
                                characterData: true,
                            });
                            
                            // Fallback for tricky situations like slow-loading webfonts
                            setTimeout(resize, 300);

                        } catch (e) {
                            console.warn("Could not auto-resize sandboxed iframe.", e);
                        }
                    };

                    const rootStyle = getComputedStyle(document.documentElement);
                    const textColor = rootStyle.getPropertyValue('--text-primary').trim();
                    const fontFamily = rootStyle.getPropertyValue('--font-main').trim();
                    
                    const decodedHtml = htmlContent
                        .replace(/&#39;/g, "'")
                        .replace(/&quot;/g, '"')
                        .replace(/&amp;/g, "&");
                    
                    iframe.srcdoc = `
                        <html>
                            <head>
                                <style>
                                    :root { color-scheme: ${document.documentElement.classList.contains('dark') ? 'dark' : 'light'}; }
                                    body { 
                                        font-family: ${fontFamily}, sans-serif;
                                        color: ${textColor}; 
                                        background-color: transparent;
                                        margin: 0; /* Use padding for reliable height calculation */
                                        padding: 1rem;
                                        font-size: 0.95rem;
                                        line-height: 1.7;
                                        overflow: hidden; /* Prevent iframe's own scrollbars */
                                        word-break: break-word;
                                    }
                                    /* Basic responsive and aesthetic styles */
                                    a { color: #60a5fa; text-decoration: none; }
                                    a:hover { text-decoration: underline; }
                                    img { max-width: 100%; height: auto; border-radius: 0.5rem; }
                                    h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; letter-spacing: -0.025em; }
                                    table { width: 100%; border-collapse: collapse; margin: 1em 0; table-layout: fixed; }
                                    th, td { border: 1px solid ${rootStyle.getPropertyValue('--border-secondary').trim()}; padding: 8px; text-align: left; }
                                    th { background-color: ${rootStyle.getPropertyValue('--bg-muted').trim()}; }
                                    blockquote { border-left: 4px solid ${rootStyle.getPropertyValue('--border-primary').trim()}; padding-left: 1em; margin-left: 0; font-style: italic; }
                                </style>
                            </head>
                            <body>${decodedHtml}</body>
                        </html>
                    `;

                    box.innerHTML = '';
                    box.appendChild(iframe);
                }
            });
        }
    }, [isAi, displayedText]);

    const copyToClipboard = (text: string, button: HTMLButtonElement) => {
        navigator.clipboard.writeText(text);
        const original = button.innerHTML;
        button.innerHTML = `<svg class="w-4 h-4 text-green-500"><use href="#icon-check"></use></svg>`;
        setTimeout(() => button.innerHTML = original, 1500);
    };

    const handleDownload = (mediaUrl: string, fileName: string) => {
        try {
            let downloadUrl = mediaUrl;

            // Check if it's a Google Drive webViewLink and transform it for direct download.
            if (mediaUrl.includes('drive.google.com') && mediaUrl.includes('/view')) {
                const fileIdMatch = mediaUrl.match(/file\/d\/([a-zA-Z0-9_-]+)/);
                if (fileIdMatch && fileIdMatch[1]) {
                    const fileId = fileIdMatch[1];
                    downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                }
            }
            
            // Using window.open is more reliable for triggering downloads from services
            // that use specific URL parameters, like Google Drive.
            const newWindow = window.open(downloadUrl, '_blank', 'noopener,noreferrer');
            if (newWindow) newWindow.opener = null;

        } catch (error) {
            console.error('Download initiation failed:', error);
            alert(`Sorry, the download could not be started automatically. Please try right-clicking the content and choosing "Save As...".`);
            // As a final fallback, open the original content in a new tab.
            window.open(mediaUrl, '_blank');
        }
    };

    if (isLoading) {
        if (isGeneratingVideo) {
            return (
                <div className="flex items-start gap-3 justify-start">
                    
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
                    
                    <div className="p-4 bg-muted rounded-2xl">
                        <div className="w-64 h-64 rounded-lg flex flex-col items-center justify-center overflow-hidden">
                            <div className="w-full h-full shimmer-bg flex flex-col items-center justify-center">
                                <svg className="w-12 h-12 text-secondary"><use href="#icon-image-gen"></use></svg>
                                <p className="mt-2 text-sm text-secondary">Conjuring pixels...</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return (
             <div className="flex items-start gap-3 justify-start">
                
                <div className="chat-message-bubble bg-secondary">
                    <div className="typing-indicator flex items-center space-x-1.5 p-2">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        );
    }

    const messageAlignmentClass = isUser ? 'justify-end' : 'justify-start';

    const renderFilePreview = (msg: ChatMessage) => {
        let content = null;
        if (msg.analysisResult && msg.analysisResult.type === 'application/pdf') {
            content = (
                <div className="relative bg-hover border border-secondary rounded-lg p-3 flex items-center space-x-3 max-w-sm">
                    <svg className="w-8 h-8 text-muted flex-shrink-0"><use href="#icon-file-text"></use></svg>
                    <div className="flex-1 min-w-0">
                        <span className="text-sm text-primary truncate block font-medium">{msg.analysisResult.name}</span>
                        <button onClick={() => handleDownload(msg.analysisResult!.url, msg.analysisResult!.name)} className="text-sm font-semibold text-blue-500 hover:underline">
                            Download PDF
                        </button>
                    </div>
                </div>
            );
        } else if (msg.videoUrl) {
            content = (
                <div className="relative group max-w-sm sm:max-w-md">
                    <video src={msg.videoUrl} controls playsInline className="rounded-lg w-full h-auto shadow-md bg-black" />
                    <button 
                        onClick={() => handleDownload(msg.videoUrl!, `lazerdsgn-generated-${Date.now()}.mp4`)} 
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
                        <button onClick={() => onImageClick?.(msg.imageUrl!)} className="block w-full h-auto appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg">
                            <img src={msg.imageUrl} alt="AI generated content" className="rounded-lg w-full h-auto shadow-md" />
                        </button>
                        <button 
                            onClick={() => handleDownload(msg.imageUrl!, `lazerdsgn-generated-${Date.now()}.png`)} 
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
            <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                {renderFilePreview(message)}
                
                {message.text && (
                    <div ref={bubbleRef} className={`chat-message-bubble relative ${isUser ? 'user-message' : 'ai-message'}`}>
                        <div dangerouslySetInnerHTML={{__html: formatAIResponse(displayedText)}}></div>
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
    };

    const dismissMode = () => {
        if (isImageGenMode) onToggleImageGenMode();
        if (isVideoGenMode) onToggleVideoGenMode();
        if (isAnalysisMode) onToggleAnalysisMode();
        onAnalysisFileSelect(null);
    };
    
    const isAnyModeActive = isImageGenMode || isAnalysisMode || isVideoGenMode;

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
                                <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
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


                    <div className="flex items-end p-2 space-x-2">
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
                        
                        {isAnalysisMode && (
                             <div className="self-end">
                                <button type="button" onClick={() => analysisInputRef.current?.click()} className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-hover rounded-full hover:bg-primary/20 text-muted transition">
                                    <svg className="w-6 h-6"><use href="#icon-paperclip"></use></svg>
                                </button>
                                <input type="file" ref={analysisInputRef} onChange={handleAnalysisFileChange} hidden />
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
                            <button type="button" onClick={handleMicClick} className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-hover text-muted transition ${isListening ? 'mic-listening' : ''}`}>
                                <svg className="w-5 h-5"><use href="#icon-microphone"></use></svg>
                            </button>
                            <button type="submit" disabled={isLoading || (!input.trim() && !analysisFile)} className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary-accent text-on-primary-accent rounded-full hover:bg-accent-hover transition-transform duration-200 ease-in-out enabled:hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed">
                                {isLoading ? <svg className="w-5 h-5 animate-spin"><use href="#icon-spinner"></use></svg> : <svg className="w-6 h-6 p-0.5"><use href="#icon-arrow-up"></use></svg>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default ChatPage;