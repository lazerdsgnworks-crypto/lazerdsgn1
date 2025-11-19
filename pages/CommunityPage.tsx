










import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, CommunityPost, Author, UserProfile, RepostedPost, Poll } from '../types.ts';
import { db } from '../services/firebase.ts';
// FIX: Corrected the import for 'firebase/firestore' to ensure all required v9 SDK functions are available.
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, QuerySnapshot, DocumentData, doc, updateDoc, where, getDocs, startAt, endAt, limit, deleteDoc, setDoc, runTransaction, Timestamp } from 'firebase/firestore';
import PostItem from '../components/community/PostItem.tsx';
import Avatar from '../components/Avatar.tsx';
import RightSidebar from '../components/community/RightSidebar.tsx';
import ImagePreviewModal from '../components/community/ImagePreviewModal.tsx';
import RepostModal from '../components/community/RepostModal.tsx';
import { compressImage, dataURLtoFile } from '../utils/files.ts';
import Modal from '../components/Modal.tsx';
import AudioPlayer from '../components/AudioPlayer.tsx';


// --- Cloudinary Configuration ---
const CLOUDINARY_UPLOAD_PRESET = "communityposts";
const CLOUDINARY_CLOUD_NAME = "dsbtpkjvt";
const AI_QUERY_WEBHOOK_URL = "https://umarworks3.app.n8n.cloud/webhook/queries";
const ENHANCE_POST_WEBHOOK_URL = "https://umarworks3.app.n8n.cloud/webhook/enhancepost";
const POST_MAX_LENGTH = 500;
// const USER_SEARCH_WEBHOOK_URL = "https://umarworks1.app.n8n.cloud/webhook/user-search";


// Reusable & Standalone Components
const PostSkeleton: React.FC = () => (
    <div className="bg-secondary sm:rounded-xl p-4 animate-pulse">
        <div className="flex space-x-4">
            <div className="w-12 h-12 bg-muted rounded-full flex-shrink-0"></div>
            <div className="flex-1 space-y-3">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
        </div>
    </div>
);


const CreatePostForm: React.FC<{
    user: User;
    userProfile: UserProfile | null;
    onCreatePost: (text: string, imageUrls: string[] | null, audioUrl: string | null, isAiQuery: boolean, pollOptions: string[] | null) => void;
    isAiQuery: boolean;
    onAiQueryChange: (isAi: boolean) => void;
}> = ({ user, userProfile, onCreatePost, isAiQuery, onAiQueryChange }) => {
    const [text, setText] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [status, setStatus] = useState<'idle' | 'compressing' | 'uploading' | 'submitting'>('idle');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [enhancedText, setEnhancedText] = useState<string | null>(null);
    
    // New state for poll creation
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (audioFile) {
            const url = URL.createObjectURL(audioFile);
            setAudioPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setAudioPreviewUrl(null);
        }
    }, [audioFile]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };
    
    const removeImage = (indexToRemove: number) => {
        URL.revokeObjectURL(imagePreviews[indexToRemove]);
        setImageFiles(prev => prev.filter((_, i) => i !== indexToRemove));
        setImagePreviews(prev => prev.filter((_, i) => i !== indexToRemove));
    };

    const removeAudio = () => {
        if (isRecording && mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setAudioFile(null);
    };


    const removePoll = () => {
        setShowPollCreator(false);
        setPollOptions(['', '']);
    }

    const handleMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles: File[] = Array.from(e.target.files || []);
        if (!newFiles.length) return;
        if (mediaInputRef.current) mediaInputRef.current.value = "";
    
        const firstFile = newFiles[0];
    
        if (firstFile.type.startsWith('video/')) {
            alert("Video cannot be combined with other media. Please create a separate post for videos.");
            return;
        } 
        
        if (firstFile.type.startsWith('image/')) {
            if (!newFiles.every(f => f.type.startsWith('image/'))) { alert("You can only select images with this button."); return; }
            
            const filesToAdd = newFiles.slice(0, 4 - imageFiles.length);
            if (filesToAdd.length < newFiles.length) { alert(`You can only upload a maximum of 4 images. The first ${filesToAdd.length} have been added.`); }
            
            const totalSize = filesToAdd.reduce((acc, file) => acc + file.size, 0);
            if (totalSize > 20 * 1024 * 1024) { alert("Total image size exceeds 20MB. Please select smaller files."); return; }
            
            setStatus('compressing');
            try {
                const compressedNewFiles = await Promise.all(filesToAdd.map(file => 
                    file.size > 1024 * 1024 ? compressImage(file, 1024 * 1024).then(dataUrl => dataURLtoFile(dataUrl, file.name)) : Promise.resolve(file)
                ));
                setImageFiles(prev => [...prev, ...compressedNewFiles]);
                setImagePreviews(prev => [...prev, ...compressedNewFiles.map(f => URL.createObjectURL(f))]);
            } catch (err) {
                console.error("Image processing failed", err);
                alert("An error occurred while processing images. Please try again.");
            } finally {
                setStatus('idle');
            }
        } else {
            alert("Unsupported file type. Please select images.");
            return;
        }
    };

    const handleMicClick = () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            return;
        }
        
        removeAudio();
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const recorder = new MediaRecorder(stream);
                mediaRecorderRef.current = recorder;
                audioChunksRef.current = [];

                recorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunksRef.current.push(event.data);
                };

                recorder.onstop = () => {
                    if (audioChunksRef.current.length > 0) {
                        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                        const newAudioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
                        setAudioFile(newAudioFile);
                    }
                    stream.getTracks().forEach(track => track.stop());
                    setIsRecording(false);
                };

                recorder.start();
                setIsRecording(true);
            })
            .catch(err => {
                console.error("Microphone access error:", err);
                alert("Could not access microphone. Please check your browser permissions.");
            });
    };
     
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validPollOptions = pollOptions.map(o => o.trim()).filter(Boolean);
        const hasContent = text.trim() || imageFiles.length > 0 || audioFile || (showPollCreator && validPollOptions.length >= 2);
        
        if (!user || !hasContent || status !== 'idle') return;
        
        let finalImageUrls: string[] | null = null;
        let finalAudioUrl: string | null = null;

        try {
             if (imageFiles.length > 0) {
                setStatus('uploading');
                const uploadedUrls = await Promise.all(imageFiles.map(async file => {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
                    const response = await fetch(url, { method: 'POST', body: formData });
                    if (!response.ok) throw new Error((await response.json()).error.message);
                    const data = await response.json();
                    return data.secure_url.replace('/upload/', '/upload/w_600,q_auto,f_auto/');
                }));
                finalImageUrls = uploadedUrls;
            }
            if (audioFile) {
                setStatus('uploading');
                const formData = new FormData();
                formData.append('file', audioFile);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`; // Audio uses video endpoint
                const response = await fetch(url, { method: 'POST', body: formData });
                if (!response.ok) throw new Error((await response.json()).error.message);
                const data = await response.json();
                finalAudioUrl = data.secure_url;
            }
            
            setStatus('submitting');
            await onCreatePost(text, finalImageUrls, finalAudioUrl, isAiQuery, showPollCreator ? validPollOptions : null);
            
            setText('');
            removeImage(0); // This will clear all images
            setImageFiles([]);
            setImagePreviews([]);
            removeAudio();
            removePoll();
            onAiQueryChange(false);
            if (textareaRef.current) textareaRef.current.style.height = 'auto';

        } catch (error) {
            console.error("Failed to create post:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            alert(`Could not create post: ${errorMessage}`);
        } finally {
            setStatus('idle');
        }
    };

    const handleEnhance = async () => {
        const hasContentToEnhance = text.trim() || imageFiles.length > 0;
        if (isEnhancing || !hasContentToEnhance) return;

        setIsEnhancing(true);
        setEnhancedText(null);
        try {
            let response;
            const hasMedia = imageFiles.length > 0;

            if (hasMedia) {
                const formData = new FormData();
                formData.append('text', text);
                formData.append('userId', user.uid);
                imageFiles.forEach(file => formData.append('files', file));
                response = await fetch(ENHANCE_POST_WEBHOOK_URL, {
                    method: 'POST',
                    body: formData
                });
            } else { // Only text
                response = await fetch(ENHANCE_POST_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, userId: user.uid })
                });
            }
            
            if (!response.ok) throw new Error(`AI enhancer failed with status ${response.status}`);
            const result = await response.json();
            const aiText = result.output || result.text || result.enhancedText || "Sorry, the AI couldn't enhance this text.";
            setEnhancedText(aiText);
        } catch (error) {
            console.error("Error enhancing post:", error);
            setEnhancedText("An error occurred while enhancing the text. Please try again.");
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleReplaceText = () => {
        if (enhancedText) {
            setText(enhancedText);
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                }
            }, 0);
        }
        setEnhancedText(null);
    };

    const handlePollOptionChange = (index: number, value: string) => {
        const newOptions = [...pollOptions];
        newOptions[index] = value;
        setPollOptions(newOptions);
    };

    const addPollOption = () => {
        if (pollOptions.length < 4) {
            setPollOptions([...pollOptions, '']);
        }
    };

    const removePollOption = (index: number) => {
        if (pollOptions.length > 2) {
            setPollOptions(pollOptions.filter((_, i) => i !== index));
        }
    };

    if (!user) return null;
    
    const buttonText = {
        idle: isAiQuery ? 'Ask AI' : 'Post',
        compressing: 'Processing...',
        uploading: 'Uploading...',
        submitting: isAiQuery ? 'Asking...' : 'Posting...',
    };
    
    const isPostable = text.trim() || imageFiles.length > 0 || audioFile || (showPollCreator && pollOptions.filter(o => o.trim()).length >= 2);
    const hasContentToEnhance = text.trim() || imageFiles.length > 0;

    return (
        <div className="p-4">
            <div className="flex space-x-4">
                <div className="flex-shrink-0">
                    <Avatar email={user.email!} photoURL={userProfile?.photoURL} size="lg" />
                </div>
                <div className="flex-1 min-w-0">
                    <form onSubmit={handleSubmit} className="w-full h-full">
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={handleTextChange}
                            placeholder={isAiQuery ? "Ask the AI a question..." : "Start a thread..."}
                            className="w-full bg-transparent text-lg text-primary placeholder-muted focus:ring-0 focus:outline-none resize-none overflow-y-auto max-h-60"
                            style={{ wordBreak: 'break-word', minHeight: '80px' }}
                            rows={1}
                            maxLength={POST_MAX_LENGTH}
                        />

                        {audioPreviewUrl && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1">
                                    <AudioPlayer src={audioPreviewUrl} variant="community" />
                                </div>
                                <button type="button" onClick={removeAudio} className="p-1 text-muted hover:text-primary rounded-full flex-shrink-0">
                                    <svg className="h-5 w-5"><use href="#icon-x-close"></use></svg>
                                </button>
                            </div>
                        )}
                        
                        {enhancedText && (
                            <div className="mt-3 p-3 border border-primary rounded-xl text-sm transition-all duration-300 ease-in-out max-h-40 overflow-y-auto">
                                <h4 className="font-semibold text-primary mb-1 flex items-center space-x-1.5">
                                    <svg className="w-4 h-4 text-secondary-accent"><use href="#icon-sparkle"></use></svg>
                                    <span>AI Suggestion</span>
                                </h4>
                                <p className="text-secondary whitespace-pre-wrap">{enhancedText}</p>
                                <div className="flex justify-end space-x-2 mt-3">
                                    <button type="button" onClick={() => setEnhancedText(null)} className="px-3 py-1 text-xs font-semibold border border-secondary rounded-full hover:bg-hover">Dismiss</button>
                                    <button type="button" onClick={handleReplaceText} className="px-3 py-1 text-xs font-semibold bg-primary-accent text-on-primary-accent rounded-full hover:bg-accent-hover">Accept</button>
                                </div>
                            </div>
                        )}

                        {imagePreviews.length > 0 && (
                            <div className="mt-4 -mx-4">
                                <div className="flex overflow-x-auto space-x-3 pb-2 scrollbar-hide px-4">
                                    {imagePreviews.map((src, index) => (
                                        <div key={src} className="relative flex-shrink-0 w-32 h-32 sm:w-36 sm:h-36">
                                            <img 
                                                src={src} 
                                                alt={`Preview ${index + 1}`} 
                                                className="h-full w-full object-cover rounded-xl"
                                            />
                                            <button type="button" onClick={() => removeImage(index)} className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors z-10">
                                                <svg className="w-4 h-4"><use href="#icon-x-close"></use></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {showPollCreator && (
                            <div className="mt-3 space-y-2">
                                {pollOptions.map((option, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => handlePollOptionChange(index, e.target.value)}
                                            placeholder={`Option ${index + 1}`}
                                            maxLength={50}
                                            className="flex-1 p-2 text-sm bg-muted border border-secondary rounded-lg focus:bg-secondary focus:border-secondary focus:ring-0 transition text-primary"
                                        />
                                        {pollOptions.length > 2 && (
                                            <button type="button" onClick={() => removePollOption(index)} className="p-2 text-muted hover:text-red-500 rounded-full transition-colors">
                                                 <svg className="h-5 w-5"><use href="#icon-x-close"></use></svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {pollOptions.length < 4 && (
                                    <button type="button" onClick={addPollOption} className="text-sm font-semibold text-blue-500 hover:underline">Add option</button>
                                )}
                            </div>
                        )}

                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-primary">
                            <div className="flex items-center space-x-0">
                                <button type="button" onClick={() => mediaInputRef.current?.click()} className="p-2 text-secondary hover:text-blue-500 hover:bg-blue-500/10 rounded-full transition-colors disabled:opacity-50" disabled={status !== 'idle' || imageFiles.length >= 4} title="Add media">
                                    <svg className="w-5 h-5"><use href="#icon-paperclip"></use></svg>
                                </button>
                                <button type="button" onClick={handleMicClick} className={`p-2 rounded-full transition-colors disabled:opacity-50 ${isRecording ? 'mic-recording' : 'text-secondary hover:text-red-500 hover:bg-red-500/10'}`} disabled={status !== 'idle'} title={isRecording ? 'Stop recording' : 'Record audio'}>
                                    <svg className="w-5 h-5"><use href="#icon-microphone"></use></svg>
                                </button>
                                 <button type="button" onClick={() => setShowPollCreator(!showPollCreator)} className="p-2 text-secondary hover:text-green-500 hover:bg-green-500/10 rounded-full transition-colors disabled:opacity-50" disabled={status !== 'idle'} title="Create poll">
                                    <svg className="w-5 h-5"><use href="#icon-poll"></use></svg>
                                </button>
                                <button type="button" onClick={handleEnhance} className="p-2 text-secondary hover:text-purple-500 hover:bg-purple-500/10 rounded-full transition-colors disabled:opacity-50" disabled={status !== 'idle' || isEnhancing || !hasContentToEnhance} title="Enhance with AI">
                                    {isEnhancing ? (
                                        <svg className="w-5 h-5 animate-spin"><use href="#icon-spinner"></use></svg>
                                    ) : (
                                        <svg className="w-5 h-5"><use href="#icon-enhance"></use></svg>
                                    )}
                                </button>
                                <label className="flex items-center space-x-2 cursor-pointer group ml-1">
                                    <div className="ai-toggle-switch">
                                        <input type="checkbox" checked={isAiQuery} onChange={() => onAiQueryChange(!isAiQuery)} />
                                        <span className="ai-toggle-slider">
                                            <span className="ai-toggle-circle">
                                                <svg className="w-3 h-3 text-secondary-accent ai-toggle-icon-on"><use href="#icon-sparkle"></use></svg>
                                            </span>
                                        </span>
                                    </div>
                                    <span className={`hidden sm:inline text-sm font-medium transition-colors duration-300 ${isAiQuery ? 'text-secondary-accent font-bold' : 'text-secondary group-hover:text-primary'}`}>Ask AI</span>
                                </label>
                            </div>
                            <div className="flex items-center space-x-4">
                                <input type="file" ref={mediaInputRef} onChange={handleMediaChange} accept="image/*" multiple hidden disabled={status !== 'idle'} />
                                <button type="submit" disabled={status !== 'idle' || !isPostable} className="btn btn-primary !py-1.5 !px-5 !text-sm">
                                    {buttonText[status]}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const CreatePostModal: React.FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode; isAiQuery: boolean; }> = ({ isOpen, onClose, children, isAiQuery }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    return (
        <div 
            className={`fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div 
                className={`create-post-glass w-full max-w-xl rounded-2xl shadow-xl transition-all duration-300 ease-in-out transform ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} ${isAiQuery ? 'ask-ai-active' : ''}`}
                style={{ maxHeight: '85vh' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-secondary rounded-2xl flex flex-col" style={{ maxHeight: 'inherit' }}>
                    <div className="p-3 border-b border-primary flex justify-center items-center relative flex-shrink-0">
                        <h2 className="text-lg font-bold text-primary">Create Post</h2>
                        <button onClick={onClose} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted hover:bg-hover p-1.5 rounded-full transition-colors">
                             <svg className="h-6 w-6"><use href="#icon-x-close"></use></svg>
                        </button>
                    </div>
                    <div className="overflow-y-auto">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};


// Main Page Component
interface CommunityPageProps {
    user: User;
    userProfile: UserProfile | null;
    onDeletePost: (post: CommunityPost) => void;
    onViewProfile: (userId: string) => void;
}

const CommunityPage: React.FC<CommunityPageProps> = ({ user, userProfile, onDeletePost, onViewProfile }) => {
    const pageRef = useRef<HTMLDivElement>(null);
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingPostAi, setIsCreatingPostAi] = useState(false);
    const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
    const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [isCreatePostModalOpen, setCreatePostModalOpen] = useState(false);
    const [isRepostModalOpen, setRepostModalOpen] = useState(false);
    const [postToRepost, setPostToRepost] = useState<CommunityPost | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearchSidebarOpen, setSearchSidebarOpen] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    
    const uniqueAuthors = useMemo(() => {
        const authors = new Map<string, Author>();
        posts.forEach(post => {
            if (!authors.has(post.author.id)) {
                authors.set(post.author.id, post.author);
            }
        });
        return Array.from(authors.values());
    }, [posts]);

    useEffect(() => {
        const timer = setTimeout(() => pageRef.current?.classList.add('visible'), 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            setPosts([]);
            return;
        }
        setIsLoading(true);
        setError(null);
        const postsQuery = query(collection(db, 'community-posts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(postsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
            setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityPost)));
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching posts:", err);
            setError("Failed to load community feed. Please try again later.");
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!user) {
            setSavedPostIds(new Set());
            setLikedPostIds(new Set());
            return;
        }
// FIX: Explicitly type the snapshot parameter as QuerySnapshot<DocumentData> to resolve incorrect type inference from Firebase's onSnapshot.
        const savedSub = onSnapshot(collection(db, 'users', user.uid, 'savedPosts'), (snapshot: QuerySnapshot<DocumentData>) => {
            setSavedPostIds(new Set(snapshot.docs.map(doc => doc.id)));
        });
// FIX: Explicitly type the snapshot parameter as QuerySnapshot<DocumentData> to resolve incorrect type inference from Firebase's onSnapshot.
        const likedSub = onSnapshot(collection(db, 'users', user.uid, 'likedPosts'), (snapshot: QuerySnapshot<DocumentData>) => {
            setLikedPostIds(new Set(snapshot.docs.map(doc => doc.id)));
        });
        return () => {
            savedSub();
            likedSub();
        };
    }, [user]);

    const handleCreatePost = useCallback(async (text: string, imageUrls: string[] | null, audioUrl: string | null, isAiQuery: boolean, pollOptions: string[] | null) => {
        if (!user || !userProfile) return;

        const postData: Omit<CommunityPost, 'id'> = {
            author: {
                id: user.uid,
                email: user.email!,
                username: userProfile.username,
                photoURL: userProfile.photoURL || null,
            },
            text,
            createdAt: serverTimestamp() as Timestamp,
            commentCount: 0,
            likeCount: 0,
            repostCount: 0,
            isAiPost: isAiQuery,
        };

        if (imageUrls && imageUrls.length > 0) {
            postData.mediaUrls = imageUrls;
            postData.mediaType = 'image';
        }
        if (audioUrl) {
            postData.audioUrl = audioUrl;
            postData.mediaType = postData.mediaType === 'image' ? 'mixed' : 'audio';
        }

        if (pollOptions && pollOptions.length >= 2) {
            postData.poll = {
                options: pollOptions.map(opt => ({ text: opt, votes: 0 })),
                voters: {}
            };
        }

        try {
            if (isAiQuery) {
                // Fetch the AI response synchronously before creating the post.
                const response = await fetch(AI_QUERY_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.uid,
                        query: text,
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`AI service failed: ${errorText}`);
                }

                const result = await response.json();
                
                const resultData = Array.isArray(result) ? result[0] : result;
                
                // --- NEW: Robustly handle and clean AI text response ---
                const potentialText = resultData?.output || resultData?.text || resultData?.response;
                let aiResponseText = String(potentialText || '').trim(); // Coerce to string

                // Check for invalid coerced strings and provide a fallback
                if (!aiResponseText || aiResponseText === 'null' || aiResponseText === 'undefined' || aiResponseText === '[object Object]') {
                    aiResponseText = "Sorry, the AI could not provide a response.";
                    if (potentialText != null && potentialText !== '') { 
                        console.warn("Received an unusual but empty AI response:", potentialText);
                    }
                }
                // Embed the AI reply directly into the post data.
                postData.aiReply = {
                    text: aiResponseText,
                    createdAt: serverTimestamp() as Timestamp,
                };
                // The AI reply counts as a comment.
                postData.commentCount = 1;
            }

            // Create the post document, now with the AI reply if applicable.
            await addDoc(collection(db, 'community-posts'), postData);

            setCreatePostModalOpen(false);
        } catch (error) {
            console.error("Error creating post:", error);
            alert(`There was an error creating your post: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [user, userProfile]);

    const handleToggleSave = useCallback(async (postId: string) => {
        if (!user) return;
        const savedPostRef = doc(db, 'users', user.uid, 'savedPosts', postId);
        const isSaved = savedPostIds.has(postId);

        try {
            if (isSaved) {
                await deleteDoc(savedPostRef);
            } else {
                await setDoc(savedPostRef, { savedAt: serverTimestamp() });
            }
        } catch (error) {
            console.error("Error toggling save status:", error);
        }
    }, [user, savedPostIds]);

    const handleToggleLike = useCallback(async (postId: string) => {
        if (!user) return;
    
        const postRef = doc(db, 'community-posts', postId);
        const likedPostRef = doc(db, 'users', user.uid, 'likedPosts', postId);
        const isLiked = likedPostIds.has(postId);
    
        // Optimistic UI update
        const originalLikedPostIds = likedPostIds;
        const newLikedPostIds = new Set(originalLikedPostIds);
        if (isLiked) {
            newLikedPostIds.delete(postId);
        } else {
            newLikedPostIds.add(postId);
        }
        setLikedPostIds(newLikedPostIds);
    
        try {
            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) throw "Post does not exist!";
                
                const currentLikeCount = postDoc.data().likeCount || 0;
                const newLikeCount = isLiked ? currentLikeCount - 1 : currentLikeCount + 1;
    
                transaction.update(postRef, { likeCount: Math.max(0, newLikeCount) });
    
                if (isLiked) {
                    transaction.delete(likedPostRef);
                } else {
                    transaction.set(likedPostRef, { likedAt: serverTimestamp() });
                }
            });
        } catch (error) {
            console.error("Like transaction failed: ", error);
            // Revert optimistic update on failure
            setLikedPostIds(originalLikedPostIds);
            alert("Could not update like status. Please try again.");
        }
    }, [user, likedPostIds]);

    const handleOpenRepostModal = (post: CommunityPost) => {
        setPostToRepost(post);
        setRepostModalOpen(true);
    };
    
    const handleCreateRepost = async (comment: string) => {
        if (!user || !userProfile || !postToRepost) return;

        const originalPostRef = doc(db, 'community-posts', postToRepost.id);
        const newPostRef = doc(collection(db, 'community-posts'));

        const repostData: RepostedPost = {
            id: postToRepost.id,
            author: postToRepost.author,
            text: postToRepost.text,
            createdAt: postToRepost.createdAt,
        };
        
        if (postToRepost.mediaUrls) repostData.mediaUrls = postToRepost.mediaUrls;
        if (postToRepost.mediaType) repostData.mediaType = postToRepost.mediaType;
        if (postToRepost.audioUrl) repostData.audioUrl = postToRepost.audioUrl;
        if (postToRepost.poll) repostData.poll = postToRepost.poll;

        const newPost: Omit<CommunityPost, 'id'> = {
            author: {
                id: user.uid,
                email: user.email!,
                username: userProfile.username,
                photoURL: userProfile.photoURL || null,
            },
            text: comment,
            createdAt: serverTimestamp() as Timestamp,
            commentCount: 0,
            likeCount: 0,
            repostCount: 0,
            repostedPost: repostData
        };

        try {
            await runTransaction(db, async (transaction) => {
                const originalPostDoc = await transaction.get(originalPostRef);
                if (!originalPostDoc.exists()) throw "Original post does not exist.";
                const currentRepostCount = originalPostDoc.data().repostCount || 0;
                transaction.update(originalPostRef, { repostCount: currentRepostCount + 1 });
                transaction.set(newPostRef, newPost);
            });
        } catch (error) {
            console.error("Failed to create repost:", error);
            alert("Could not create the repost. Please try again.");
        } finally {
            setRepostModalOpen(false);
            setPostToRepost(null);
        }
    };
    
    // FIX: Renamed the `query` parameter to `searchQueryString` to avoid a name collision
    // with the imported `query` function from `firebase/firestore`.
    const handleSearch = useCallback(async (searchQueryString: string) => {
        setSearchQuery(searchQueryString);
        if (searchQueryString.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const usersRef = collection(db, 'users');
        const q = query(usersRef, 
            orderBy('username'), 
            startAt(searchQueryString.toLowerCase()), 
            endAt(searchQueryString.toLowerCase() + '\uf8ff'),
            limit(10)
        );

        try {
            const querySnapshot = await getDocs(q);
            // FIX: Reordered properties to place the spread operator after explicit properties. This resolves a TypeScript type inference issue.
            // FIX: Cast doc.data() to any to avoid spread error
            const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as UserProfile));
            setSearchResults(results);
        } catch (error) {
            console.error("Error searching users:", error);
            setSearchResults([]);
        }
    }, []);

    const handleImageClick = (url: string) => {
        setPreviewImageUrl(url);
    };

    return (
        <div ref={pageRef} className="page-transition bg-primary">
            <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8">
                <div className="grid grid-cols-12 gap-8">
                    <main className="col-span-12 lg:col-span-8 xl:col-span-7 border-r border-primary">
                        {/* Sticky Header with explicit bg-primary to cover scrolled content */}
                        <div className="sticky top-[68px] z-20 bg-primary -mx-4 sm:mx-0 px-4 sm:px-0 py-3 border-b border-primary">
                            <h1 className="text-xl font-bold text-primary px-4">Community Feed</h1>
                        </div>
                        
                        <div className="sm:space-y-4 p-0 sm:p-4">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)
                            ) : error ? (
                                 <div className="text-center py-10 text-red-500">{error}</div>
                            ) : posts.length === 0 ? (
                                <div className="text-center py-20 text-muted">
                                    <h3 className="text-lg font-semibold">It's quiet in here...</h3>
                                    <p>Be the first to start a conversation!</p>
                                </div>
                            ) : (
                                posts.map(post => (
                                    <PostItem
                                        key={post.id}
                                        post={post}
                                        user={user}
                                        userProfile={userProfile}
                                        onDelete={onDeletePost}
                                        savedPostIds={savedPostIds}
                                        onToggleSave={handleToggleSave}
                                        likedPostIds={likedPostIds}
                                        onToggleLike={handleToggleLike}
                                        onViewProfile={onViewProfile}
                                        onImageClick={handleImageClick}
                                        onRepost={handleOpenRepostModal}
                                    />
                                ))
                            )}
                        </div>
                    </main>

                    <aside className="hidden lg:block col-span-4 xl:col-span-5">
                        <RightSidebar
                            posts={posts}
                            searchQuery={searchQuery}
                            onSearchChange={handleSearch}
                            searchResults={searchResults}
                            onViewProfile={onViewProfile}
                        />
                    </aside>
                </div>
            </div>
            
            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-6 right-6 p-3 bg-secondary border border-primary rounded-full shadow-lg z-30 hover:bg-hover transition-all duration-300 text-primary"
                    aria-label="Scroll to top"
                >
                    <svg className="w-6 h-6"><use href="#icon-arrow-up"></use></svg>
                </button>
            )}

            <button
                onClick={() => setCreatePostModalOpen(true)}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 btn create-post-fab !rounded-full !p-4 shadow-lg z-30 transform transition-transform hover:scale-110"
            >
                <svg className="w-6 h-6"><use href="#icon-plus"></use></svg>
            </button>

            <CreatePostModal isOpen={isCreatePostModalOpen} onClose={() => setCreatePostModalOpen(false)} isAiQuery={isCreatingPostAi}>
                <CreatePostForm user={user} userProfile={userProfile} onCreatePost={handleCreatePost} isAiQuery={isCreatingPostAi} onAiQueryChange={setIsCreatingPostAi} />
            </CreatePostModal>

            <RepostModal
                isOpen={isRepostModalOpen}
                onClose={() => setRepostModalOpen(false)}
                onSubmit={handleCreateRepost}
                post={postToRepost}
                user={user}
                userProfile={userProfile}
            />
            
            {previewImageUrl && <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} fileName={`lazerdsgn-community-${Date.now()}.png`} />}
        </div>
    );
};

export default CommunityPage;