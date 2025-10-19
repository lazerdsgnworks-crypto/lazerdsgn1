import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, CommunityPost, Author, UserProfile } from '../types';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, QuerySnapshot, DocumentData, doc, updateDoc, where, getDocs, startAt, endAt, limit, deleteDoc, setDoc } from 'firebase/firestore';
import PostItem from '../components/community/PostItem';
import Avatar from '../components/Avatar';
import RightSidebar from '../components/community/RightSidebar';
import { compressImage, dataURLtoFile } from '../utils/files';

// --- Cloudinary Configuration ---
const CLOUDINARY_UPLOAD_PRESET = "communityposts";
const CLOUDINARY_CLOUD_NAME = "dsbtpkjvt";
const AI_QUERY_WEBHOOK_URL = "https://umarworks1.app.n8n.cloud/webhook/queries";
// const USER_SEARCH_WEBHOOK_URL = "https://umarworks1.app.n8n.cloud/webhook/user-search";


// Reusable & Standalone Components
const PostSkeleton: React.FC = () => (
    <div className="flex space-x-4 p-4 border-b border-primary animate-pulse">
        <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0"></div>
        <div className="flex-1 space-y-3">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
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
                <form onSubmit={handleSubmit} className={`w-full h-full p-3 transition-colors duration-300 rounded-[calc(1.5rem-2px)] ${isAiQuery ? 'bg-secondary' : 'bg-transparent'}`}>
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={handleTextChange}
                        placeholder={isAiQuery ? "Ask the AI a question..." : "Start a thread..."}
                        className="w-full bg-transparent text-lg text-primary placeholder-muted focus:ring-0 focus:outline-none resize-none overflow-hidden transition-all duration-200 py-2 px-1"
                        rows={1}
                    />
                    {preview && (
                        <div className="mt-3 relative">
                            {mediaType === 'image' ? (
                                <img src={preview} alt="Preview" className="rounded-xl max-h-80 w-auto border border-primary" />
                            ) : (
                                 <video src={preview} controls className="rounded-xl max-h-80 w-auto border border-primary bg-black" />
                            )}
                             <button type="button" onClick={removeMedia} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 leading-none text-xl w-7 h-7 flex items-center justify-center hover:bg-black/80 transition-colors">&times;</button>
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-3 pt-2">
                        <div className="flex items-center space-x-4">
                            <button type="button" onClick={() => imageInputRef.current?.click()} className="text-muted hover:text-primary transition-colors disabled:opacity-50" disabled={status !== 'idle'}>
                                <svg className="w-5 h-5"><use href="#icon-image"></use></svg>
                            </button>
                            <button type="button" onClick={() => videoInputRef.current?.click()} className="text-muted hover:text-primary transition-colors disabled:opacity-50" disabled={status !== 'idle'}>
                                <svg className="w-5 h-5"><use href="#icon-video"></use></svg>
                            </button>
                            <label className="flex items-center space-x-2 cursor-pointer group">
                                <div className="ai-toggle-switch">
                                    <input type="checkbox" checked={isAiQuery} onChange={() => onAiQueryChange(!isAiQuery)} />
                                    <span className="ai-toggle-slider"></span>
                                </div>
                                <span className={`text-sm font-medium transition-colors duration-300 ${isAiQuery ? 'text-secondary-accent font-bold' : 'text-secondary group-hover:text-primary'}`}>Ask AI</span>
                            </label>
                        </div>
                        <input type="file" ref={imageInputRef} onChange={handleImageChange} accept="image/jpeg,image/png,image/webp" hidden disabled={status !== 'idle'} />
                        <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/*" hidden disabled={status !== 'idle'} />
                        <button type="submit" disabled={status !== 'idle' || (!text.trim() && !imageFile && !videoFile)} className="px-6 py-2 bg-transparent text-primary border-2 border-primary font-semibold rounded-full hover:bg-primary-accent hover:text-on-primary-accent transition disabled:opacity-30 disabled:cursor-not-allowed text-base">
                             {buttonText[status]}
                        </button>
                    </div>
                </form>
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
    const [error, setError] = useState<string | null>(null);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchSidebarOpen, setSearchSidebarOpen] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        setError(null);
        const postsQuery = query(collection(db, 'community-posts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(postsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
            setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityPost)));
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching community posts:", err);
            if (err.code === 'permission-denied') {
                setError("Could not load community posts due to a permission error. Please ensure Firestore security rules allow reads on the 'community-posts' collection.");
            } else {
                setError("An error occurred while loading posts.");
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // Fetch user's saved posts to determine icon state
    useEffect(() => {
        if (!user) {
            setSavedPostIds(new Set());
            return;
        }
        const savedPostsRef = collection(db, 'users', user.uid, 'savedPosts');
        // FIX: Add explicit type to snapshot to avoid incorrect type inference by TypeScript.
        const unsubscribe = onSnapshot(savedPostsRef, (snapshot: QuerySnapshot<DocumentData>) => {
            const ids = snapshot.docs.map(doc => doc.id);
            setSavedPostIds(new Set(ids));
        });
        return () => unsubscribe();
    }, [user]);

    const handleToggleSave = async (postId: string) => {
        if (!user) return;
        const savedPostRef = doc(db, 'users', user.uid, 'savedPosts', postId);
        const isSaved = savedPostIds.has(postId);

        // Optimistic UI update for instant feedback
        const newSavedIds = new Set(savedPostIds);
        if (isSaved) {
            newSavedIds.delete(postId);
        } else {
            newSavedIds.add(postId);
        }
        setSavedPostIds(newSavedIds);

        // Asynchronous Firestore update
        try {
            if (isSaved) {
                await deleteDoc(savedPostRef);
            } else {
                await setDoc(savedPostRef, { savedAt: serverTimestamp() });
            }
        } catch (error) {
            console.error("Error toggling save status:", error);
            // Revert UI on failure
            setSavedPostIds(savedPostIds);
        }
    };

    const handleSearch = useCallback((queryText: string) => {
        setSearchQuery(queryText);
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        if (!queryText.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const usersRef = collection(db, 'users');
                // Use a range query to find usernames that start with the query text.
                // This is a common pattern for implementing basic "starts-with" search in Firestore.
                const q = query(
                    usersRef,
                    orderBy('username'),
                    startAt(queryText),
                    endAt(queryText + '\uf8ff'), // \uf8ff is a high-end Unicode character to create a range
                    limit(10)
                );

                const querySnapshot = await getDocs(q);
                const results: UserProfile[] = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...(doc.data() as Omit<UserProfile, 'id'>)
                }));
                setSearchResults(results);

            } catch (error) {
                console.error("Error searching users:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300); // 300ms debounce
    }, []);

    const handleCreatePost = async (text: string, mediaUrl: string | null, mediaType: 'image' | 'video' | null, isAiQuery: boolean) => {
        if (!user || !userProfile || (!text.trim() && !mediaUrl)) return;

        const author: Author = { id: user.uid, email: user.email!, username: userProfile.username };
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

                await updateDoc(newPostRef, {
                    aiReply: { text: aiResponseText, createdAt: serverTimestamp() }
                });

            } catch (error) {
                console.error("Error fetching AI response:", error);
                await updateDoc(newPostRef, {
                    aiReply: { text: "An error occurred while getting the AI response.", createdAt: serverTimestamp() }
                });
            }
        }
    };
    
    const handleViewProfileAndCloseSidebar = (userId: string) => {
        onViewProfile(userId);
        setSearchSidebarOpen(false);
    }

    return (
        <div ref={pageRef} className="page-transition bg-primary min-h-screen">
            <div className={`fixed inset-0 bg-black/60 z-50 transition-opacity duration-300 lg:hidden ${isSearchSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSearchSidebarOpen(false)}>
                <div className={`absolute top-0 right-0 h-full w-full max-w-xs bg-secondary shadow-xl transition-transform duration-300 ease-in-out transform ${isSearchSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`} onClick={e => e.stopPropagation()}>
                    <div className="p-4 h-full overflow-y-auto">
                         <button onClick={() => setSearchSidebarOpen(false)} className="absolute top-4 right-4 text-muted hover:text-primary text-2xl">&times;</button>
                        <RightSidebar 
                            posts={posts}
                            searchQuery={searchQuery}
                            onSearchChange={handleSearch}
                            searchResults={searchResults}
                            isSearching={isSearching}
                            onViewProfile={handleViewProfileAndCloseSidebar}
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                 <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-12 lg:col-span-8">
                        <div className="bg-secondary border border-primary rounded-3xl mt-8">
                            <div className="p-4 border-b border-primary sticky top-[68px] bg-secondary/80 backdrop-blur-sm z-10 flex justify-between items-center">
                                <h1 className="text-xl font-bold text-primary">Community Feed</h1>
                                <button className="lg:hidden p-2 -mr-2" onClick={() => setSearchSidebarOpen(true)}>
                                    <svg className="w-6 h-6 text-primary"><use href="#icon-search"></use></svg>
                                </button>
                            </div>
                            {user && <CreatePostForm
                                user={user}
                                onCreatePost={handleCreatePost}
                                isAiQuery={isCreatingPostAi}
                                onAiQueryChange={setIsCreatingPostAi}
                            />}
                            <div className="border-t border-primary">
                                {error && (
                                    <div className="p-4 m-4 text-sm text-red-700 bg-red-100 rounded-lg">
                                        <strong>Loading Failed:</strong> {error}
                                    </div>
                                )}
                                {isLoading ? (
                                    <div className="py-4">
                                        <PostSkeleton /><PostSkeleton /><PostSkeleton />
                                    </div>
                                ) : !error && (
                                    posts.map(post => <PostItem 
                                        key={post.id} 
                                        post={post} 
                                        user={user} 
                                        userProfile={userProfile} 
                                        onDelete={onDeletePost}
                                        savedPostIds={savedPostIds}
                                        onToggleSave={handleToggleSave}
                                        onViewProfile={onViewProfile}
                                    />)
                                )}
                                {!error && posts.length === 0 && !isLoading && <p className="text-center text-muted py-10">Be the first to post!</p>}
                            </div>
                        </div>
                    </div>

                    <div className="hidden lg:block lg:col-span-4 mt-8">
                        <RightSidebar 
                            posts={posts}
                            searchQuery={searchQuery}
                            onSearchChange={handleSearch}
                            searchResults={searchResults}
                            isSearching={isSearching}
                            onViewProfile={onViewProfile}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunityPage;