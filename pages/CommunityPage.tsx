import React, { useState, useEffect, useRef } from 'react';
import { User, CommunityPost, Author, UserProfile } from '../types';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, QuerySnapshot, DocumentData, doc, getDoc, updateDoc } from 'firebase/firestore';
import PostItem from '../components/community/PostItem';
import Avatar from '../components/Avatar';
import RightSidebar from '../components/community/RightSidebar';
import { compressImage, dataURLtoFile } from '../utils/files';

// --- Cloudinary Configuration ---
const CLOUDINARY_UPLOAD_PRESET = "communityposts";
const CLOUDINARY_CLOUD_NAME = "dsbtpkjvt";
const AI_QUERY_WEBHOOK_URL = "https://umarworks1.app.n8n.cloud/webhook/queries";

// Reusable & Standalone Components
const PostSkeleton: React.FC = () => (
    <div className="flex space-x-4 p-4 border-b border-gray-200/80 animate-pulse">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
        <div className="flex-1 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
    </div>
);

const CreatePostForm: React.FC<{
    user: User;
    onCreatePost: (text: string, mediaUrl: string | null, mediaType: 'image' | 'video' | null, isAiQuery: boolean) => void;
    isAiQuery: boolean;
    onAiQueryChange: (isAi: boolean) => void;
}> = ({ user, onCreatePost, isAiQuery, onAiQueryChange }) => {
    const [text, setText] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [status, setStatus] = useState<'idle' | 'compressing' | 'uploading' | 'submitting'>('idle');
    
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };
    
    const removeMedia = () => {
        setImageFile(null);
        setVideoFile(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        setMediaType(null);
        if(imageInputRef.current) imageInputRef.current.value = "";
        if(videoInputRef.current) videoInputRef.current.value = "";
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setVideoFile(null);
        if (preview) URL.revokeObjectURL(preview);
        if(videoInputRef.current) videoInputRef.current.value = "";

        if (file.size > 10 * 1024 * 1024) { 
            alert("File is too large. Please select an image under 10MB.");
            removeMedia();
            return;
        }

        if (file.size > 1024 * 1024) { 
            setStatus('compressing');
            try {
                const compressedDataUrl = await compressImage(file, 1024 * 1024);
                const compressedFile = dataURLtoFile(compressedDataUrl, file.name);
                setImageFile(compressedFile);
                setPreview(URL.createObjectURL(compressedFile));
                setMediaType('image');
            } catch (err) {
                console.error("Image compression failed", err);
                alert("Image compression failed. Please try a different image.");
                removeMedia();
            } finally {
                setStatus('idle');
            }
        } else {
            setImageFile(file);
            setPreview(URL.createObjectURL(file));
            setMediaType('image');
        }
    };
    
    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImageFile(null);
        if (preview) URL.revokeObjectURL(preview);
        if(imageInputRef.current) imageInputRef.current.value = "";

        if (file.size > 50 * 1024 * 1024) { 
            alert("Video file is too large. Please select a video under 50MB.");
            removeMedia();
            return;
        }
        setVideoFile(file);
        setPreview(URL.createObjectURL(file));
        setMediaType('video');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const mediaFile = imageFile || videoFile;
        if (!user || (!text.trim() && !mediaFile) || status !== 'idle') return;
        
        let finalMediaUrl: string | null = null;
        let finalMediaType: 'image' | 'video' | null = null;

        try {
            if (mediaFile) {
                setStatus('uploading');
                finalMediaType = imageFile ? 'image' : 'video';
                const resourceType = finalMediaType;
                const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

                const formData = new FormData();
                formData.append('file', mediaFile);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

                const response = await fetch(url, { method: 'POST', body: formData });
                if (!response.ok) throw new Error('Cloudinary upload failed');
                
                const data = await response.json();
                let optimizedUrl = data.secure_url;
                if (finalMediaType === 'image') {
                    optimizedUrl = optimizedUrl.replace('/upload/', '/upload/w_600,q_auto,f_auto/');
                } else {
                    optimizedUrl = optimizedUrl.replace('/upload/', '/upload/w_600,c_scale/');
                }
                finalMediaUrl = optimizedUrl;
            }
            
            setStatus('submitting');
            await onCreatePost(text, finalMediaUrl, finalMediaType, isAiQuery);
            
            setText('');
            removeMedia();
            onAiQueryChange(false);
            if (textareaRef.current) textareaRef.current.style.height = 'auto';

        } catch (error) {
            console.error("Failed to create post:", error);
            alert("Could not create post. Please try again.");
        } finally {
            setStatus('idle');
        }
    };

    if (!user) return null;
    
    const buttonText = {
        idle: isAiQuery ? 'Ask AI' : 'Post',
        compressing: 'Compressing...',
        uploading: 'Uploading...',
        submitting: isAiQuery ? 'Asking...' : 'Posting...',
    };

    return (
        <div className="p-4 flex space-x-3">
            <Avatar email={user.email!} />
            <div className={`flex-1 transition-all duration-300 ${isAiQuery ? 'ask-ai-active' : ''}`}>
                <form onSubmit={handleSubmit} className={`w-full h-full p-3 transition-colors duration-300 rounded-[calc(1.5rem-2px)] ${isAiQuery ? 'bg-white' : 'bg-transparent'}`}>
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={handleTextChange}
                        placeholder={isAiQuery ? "Ask the AI a question..." : "Start a thread..."}
                        className="w-full bg-transparent text-lg text-gray-800 placeholder-gray-500 focus:ring-0 focus:outline-none resize-none overflow-hidden transition-all duration-200 py-2 px-1"
                        rows={1}
                    />
                    {preview && (
                        <div className="mt-3 relative">
                            {mediaType === 'image' ? (
                                <img src={preview} alt="Preview" className="rounded-xl max-h-80 w-auto border border-gray-200/80" />
                            ) : (
                                 <video src={preview} controls className="rounded-xl max-h-80 w-auto border border-gray-200/80 bg-black" />
                            )}
                             <button type="button" onClick={removeMedia} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 leading-none text-xl w-7 h-7 flex items-center justify-center hover:bg-black/80 transition-colors">&times;</button>
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-3 pt-2">
                        <div className="flex items-center space-x-4">
                            <button type="button" onClick={() => imageInputRef.current?.click()} className="text-gray-500 hover:text-black transition-colors disabled:opacity-50" disabled={status !== 'idle'}>
                                <svg className="w-5 h-5"><use href="#icon-image"></use></svg>
                            </button>
                            <button type="button" onClick={() => videoInputRef.current?.click()} className="text-gray-500 hover:text-black transition-colors disabled:opacity-50" disabled={status !== 'idle'}>
                                <svg className="w-5 h-5"><use href="#icon-video"></use></svg>
                            </button>
                            <label className="flex items-center space-x-2 cursor-pointer group">
                                <div className="ai-toggle-switch">
                                    <input type="checkbox" checked={isAiQuery} onChange={() => onAiQueryChange(!isAiQuery)} />
                                    <span className="ai-toggle-slider"></span>
                                </div>
                                <span className={`text-sm font-medium transition-colors duration-300 ${isAiQuery ? 'text-blue-600 font-bold' : 'text-gray-600 group-hover:text-black'}`}>Ask AI</span>
                            </label>
                        </div>
                        <input type="file" ref={imageInputRef} onChange={handleImageChange} accept="image/jpeg,image/png,image/webp" hidden disabled={status !== 'idle'} />
                        <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/*" hidden disabled={status !== 'idle'} />
                        <button type="submit" disabled={status !== 'idle' || (!text.trim() && !imageFile && !videoFile)} className="px-6 py-2 bg-transparent text-black border-2 border-black font-semibold rounded-full hover:bg-black hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed text-base">
                             {buttonText[status]}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Main Page Component
const CommunityPage: React.FC<{ user: User, onDeletePost: (post: CommunityPost) => void }> = ({ user, onDeletePost }) => {
    const pageRef = useRef<HTMLDivElement>(null);
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingPostAi, setIsCreatingPostAi] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => pageRef.current?.classList.add('visible'), 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            setPosts([]);
            return;
        }
        setIsLoading(true);
        const postsQuery = query(collection(db, 'community-posts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(postsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
            setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityPost)));
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching community posts:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleCreatePost = async (text: string, mediaUrl: string | null, mediaType: 'image' | 'video' | null, isAiQuery: boolean) => {
        if (!user || (!text.trim() && !mediaUrl)) return;

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const username = userDoc.exists() ? (userDoc.data() as UserProfile).username : user.email!.split('@')[0];

        const author: Author = { id: user.uid, email: user.email!, username };
        const postData: { author: Author; text: string; createdAt: any; commentCount: number; mediaUrl?: string; mediaType?: 'image' | 'video'; } = {
            author, text, createdAt: serverTimestamp(), commentCount: 0,
        };
        if (mediaUrl && mediaType) {
            postData.mediaUrl = mediaUrl;
            postData.mediaType = mediaType;
        }

        const newPostRef = await addDoc(collection(db, 'community-posts'), postData);

        if (isAiQuery && text.trim()) {
            try {
                const response = await fetch(AI_QUERY_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: text, userId: user.uid })
                });
                if (!response.ok) throw new Error(`AI webhook failed with status ${response.status}`);
                
                const result = await response.json();
                const aiResponseText = result.output || result.text || result.response || "Sorry, I couldn't get a response from the AI.";

                // Securely update the post with the AI's reply
                await updateDoc(newPostRef, {
                    aiReply: {
                        text: aiResponseText,
                        createdAt: serverTimestamp()
                    }
                });

            } catch (error) {
                console.error("Error fetching AI response:", error);
                // Optionally, update the post with an error message for the user
                await updateDoc(newPostRef, {
                    aiReply: {
                        text: "An error occurred while getting the AI response. Please try again later.",
                        createdAt: serverTimestamp()
                    }
                });
            }
        }
    };

    return (
        <div ref={pageRef} className="page-transition bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                 <div className="grid grid-cols-12 gap-8">
                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-8">
                        <div className="bg-white border border-gray-200/80 rounded-3xl mt-8">
                            <div className="p-4 border-b border-gray-200/80">
                                <h1 className="text-xl font-bold">Community Feed</h1>
                            </div>
                            {user && <CreatePostForm
                                user={user}
                                onCreatePost={handleCreatePost}
                                isAiQuery={isCreatingPostAi}
                                onAiQueryChange={setIsCreatingPostAi}
                            />}
                            <div>
                                {isLoading ? (
                                    <div className="py-4">
                                        <PostSkeleton /><PostSkeleton /><PostSkeleton />
                                    </div>
                                ) : (
                                    posts.map(post => <PostItem key={post.id} post={post} user={user} onDelete={onDeletePost} />)
                                )}
                                {posts.length === 0 && !isLoading && <p className="text-center text-gray-500 py-10">Be the first to post!</p>}
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="hidden lg:block lg:col-span-4 mt-8">
                        <RightSidebar posts={posts} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunityPage;
