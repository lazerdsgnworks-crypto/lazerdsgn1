
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, CommunityPost, Author, UserProfile, RepostedPost } from '../types';
import { db } from '../services/firebase';
// FIX: Corrected a type mismatch where `serverTimestamp()` (which returns a `FieldValue`) was assigned to a field expecting a `Timestamp`. By casting `serverTimestamp() as Timestamp`, we satisfy the TypeScript compiler while ensuring Firestore correctly sets the server-side timestamp upon document creation. Added `Timestamp` to the `firebase/firestore` import to make the type available for casting.
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, QuerySnapshot, DocumentData, doc, updateDoc, where, getDocs, startAt, endAt, limit, deleteDoc, setDoc, runTransaction, Timestamp } from 'firebase/firestore';
import PostItem from '../components/community/PostItem';
import Avatar from '../components/Avatar';
import RightSidebar from '../components/community/RightSidebar';
import ImagePreviewModal from '../components/community/ImagePreviewModal';
import RepostModal from '../components/community/RepostModal';
import { compressImage, dataURLtoFile } from '../utils/files';

// --- Cloudinary Configuration ---
const CLOUDINARY_UPLOAD_PRESET = "communityposts";
const CLOUDINARY_CLOUD_NAME = "dsbtpkjvt";
const AI_QUERY_WEBHOOK_URL = "https://umarworks1.app.n8n.cloud/webhook/queries";
// const USER_SEARCH_WEBHOOK_URL = "https://umarworks1.app.n8n.cloud/webhook/user-search";


// Reusable & Standalone Components
const PostSkeleton: React.FC = () => (
    <div className="bg-secondary border-b sm:border border-primary sm:rounded-xl p-4 animate-pulse">
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
    onCreatePost: (text: string, mediaUrls: string[] | null, mediaType: 'image' | 'video' | null, isAiQuery: boolean) => void;
    isAiQuery: boolean;
    onAiQueryChange: (isAi: boolean) => void;
}> = ({ user, userProfile, onCreatePost, isAiQuery, onAiQueryChange }) => {
    const [text, setText] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [previews, setPreviews] = useState<string[]>([]);
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
        setImageFiles([]);
        setVideoFile(null);
        previews.forEach(p => URL.revokeObjectURL(p));
        setPreviews([]);
        setMediaType(null);
        if(imageInputRef.current) imageInputRef.current.value = "";
        if(videoInputRef.current) videoInputRef.current.value = "";
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        removeMedia();

        if (files.length > 4) {
            alert("You can upload a maximum of 4 images.");
            return;
        }

        // FIX: Explicitly type the return value of reduce to ensure `totalSize` is a number.
        const totalSize = files.reduce<number>((acc, file: File) => acc + file.size, 0);
        if (totalSize > 20 * 1024 * 1024) { // 20MB total limit
            alert("Total image size exceeds 20MB. Please select smaller files.");
            return;
        }
        
        setStatus('compressing');
        try {
            // FIX: Explicitly type 'file' as File to access its properties and pass it to functions.
            const compressedFiles = await Promise.all(files.map((file: File) => {
                 if (file.size > 1024 * 1024) {
                    return compressImage(file, 1024 * 1024).then(dataUrl => dataURLtoFile(dataUrl, file.name));
                }
                return Promise.resolve(file);
            }));

            setImageFiles(compressedFiles);
            setPreviews(compressedFiles.map(f => URL.createObjectURL(f)));
            setMediaType('image');
        } catch (err) {
            console.error("Image processing failed", err);
            alert("An error occurred while processing images. Please try again.");
            removeMedia();
        } finally {
            setStatus('idle');
        }
    };
    
    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        removeMedia();

        if (file.size > 50 * 1024 * 1024) { 
            alert("Video file is too large. Please select a video under 50MB.");
            return;
        }
        setVideoFile(file);
        setPreviews([URL.createObjectURL(file)]);
        setMediaType('video');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const mediaFile = videoFile;
        if (!user || (!text.trim() && !mediaFile && imageFiles.length === 0) || status !== 'idle') return;
        
        let finalMediaUrls: string[] | null = null;
        let finalMediaType: 'image' | 'video' | null = null;

        try {
             if (imageFiles.length > 0) {
                setStatus('uploading');
                finalMediaType = 'image';
                const uploadedUrls = await Promise.all(imageFiles.map(async file => {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
                    const response = await fetch(url, { method: 'POST', body: formData });
                    if (!response.ok) throw new Error('Cloudinary upload failed for an image');
                    const data = await response.json();
                    return data.secure_url.replace('/upload/', '/upload/w_600,q_auto,f_auto/');
                }));
                finalMediaUrls = uploadedUrls;
            } else if (videoFile) {
                setStatus('uploading');
                finalMediaType = 'video';
                const formData = new FormData();
                formData.append('file', videoFile);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
                const response = await fetch(url, { method: 'POST', body: formData });
                if (!response.ok) throw new Error('Cloudinary video upload failed');
                const data = await response.json();
                finalMediaUrls = [data.secure_url.replace('/upload/', '/upload/w_600,c_scale,q_auto/')];
            }
            
            setStatus('submitting');
            await onCreatePost(text, finalMediaUrls, finalMediaType, isAiQuery);
            
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
        compressing: 'Processing...',
        uploading: 'Uploading...',
        submitting: isAiQuery ? 'Asking...' : 'Posting...',
    };

    return (
        <div className={`transition-all duration-300 rounded-xl ${isAiQuery ? 'ask-ai-active' : ''}`}>
            <div className="p-4 flex space-x-4">
                <div className="flex-shrink-0">
                    <Avatar email={user.email!} photoURL={userProfile?.photoURL} size="lg" />
                </div>
                <div className="flex-1">
                    <form onSubmit={handleSubmit} className="w-full h-full">
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={handleTextChange}
                            placeholder={isAiQuery ? "Ask the AI a question..." : "Start a thread..."}
                            className="w-full bg-transparent text-lg text-primary placeholder-muted focus:ring-0 focus:outline-none resize-none overflow-hidden transition-all duration-200 py-2 px-1"
                            rows={1}
                        />
                        {previews.length > 0 && (
                             <div className="mt-3 relative">
                                <button type="button" onClick={removeMedia} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0 leading-none text-xl w-6 h-6 flex items-center justify-center hover:bg-black/80 transition-colors z-20">&times;</button>
                                
                                {mediaType === 'video' ? (
                                    <div className="rounded-xl w-full max-h-72 border border-primary shadow-sm overflow-hidden bg-black flex justify-center items-center">
                                        <video src={previews[0]} controls className="w-full h-full" />
                                    </div>
                                ) : (
                                    <div className="flex space-x-2 overflow-x-auto pb-2 -mb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                        <style>{`.overflow-x-auto::-webkit-scrollbar { display: none; }`}</style>
                                        {previews.map((src, index) => (
                                            <div key={index} className="flex-shrink-0 h-20 w-20 bg-muted rounded-lg overflow-hidden border border-primary">
                                                <img 
                                                    src={src} 
                                                    alt={`Preview ${index + 1}`} 
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
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
                            <input type="file" ref={imageInputRef} onChange={handleImageChange} accept="image/jpeg,image/png,image/webp" multiple hidden disabled={status !== 'idle'} />
                            <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/*" hidden disabled={status !== 'idle'} />
                            <button type="submit" disabled={status !== 'idle' || (!text.trim() && imageFiles.length === 0 && !videoFile)} className="px-6 py-2 bg-primary-accent text-on-primary-accent border-2 border-transparent font-semibold rounded-full hover:bg-accent-hover transition disabled:opacity-30 disabled:cursor-not-allowed text-base">
                                 {buttonText[status]}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const CreatePostModal: React.FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode }> = ({ isOpen, onClose, children }) => {
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
            className={`fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div 
                className={`bg-secondary w-full max-w-2xl rounded-2xl shadow-xl transition-all duration-300 ease-in-out transform ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-2 border-b border-primary flex justify-center items-center relative">
                    <h2 className="text-lg font-bold text-primary">Create Post</h2>
                    <button onClick={onClose} className="absolute top-1/2 right-3 -translate-y-1/2 text-2xl text-muted hover:text-primary">&times;</button>
                </div>
                {children}
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
            setLikedPostIds(new Set());
            return;
        }

        const savedPostsRef = collection(db, 'users', user.uid, 'savedPosts');
        const unsubscribeSaved = onSnapshot(savedPostsRef, (snapshot: QuerySnapshot<DocumentData>) => {
            const ids = snapshot.docs.map(doc => doc.id);
            setSavedPostIds(new Set(ids));
        });

        const likedPostsRef = collection(db, 'users', user.uid, 'likedPosts');
        const unsubscribeLiked = onSnapshot(likedPostsRef, (snapshot: QuerySnapshot<DocumentData>) => {
            const ids = snapshot.docs.map(doc => doc.id);
            setLikedPostIds(new Set(ids));
        });

        return () => {
            unsubscribeSaved();
            unsubscribeLiked();
        };
    }, [user]);

    const handleToggleSave = async (postId: string) => {
        if (!user) return;
        const savedPostRef = doc(db, 'users', user.uid, 'savedPosts', postId);
        const isSaved = savedPostIds.has(postId);

        const newSavedIds = new Set(savedPostIds);
        if (isSaved) {
            newSavedIds.delete(postId);
        } else {
            newSavedIds.add(postId);
        }
        setSavedPostIds(newSavedIds);

        try {
            if (isSaved) {
                await deleteDoc(savedPostRef);
            } else {
                await setDoc(savedPostRef, { savedAt: serverTimestamp() });
            }
        } catch (error) {
            console.error("Error toggling save status:", error);
            setSavedPostIds(savedPostIds);
        }
    };

    const handleToggleLike = async (postId: string) => {
        if (!user) return;
        const likedPostRef = doc(db, 'users', user.uid, 'likedPosts', postId);
        const isLiked = likedPostIds.has(postId);
    
        // Optimistically update UI
        const newLikedIds = new Set(likedPostIds);
        if (isLiked) {
            newLikedIds.delete(postId);
        } else {
            newLikedIds.add(postId);
        }
        setLikedPostIds(newLikedIds);
    
        try {
            if (isLiked) {
                await deleteDoc(likedPostRef);
            } else {
                await setDoc(likedPostRef, { likedAt: serverTimestamp() });
            }
            // NOTE: We are no longer updating the public likeCount on the post
            // to avoid permission errors if security rules are restrictive.
        } catch (error) {
            console.error("Error toggling like:", error);
            // Revert UI on error
            setLikedPostIds(likedPostIds);
        }
    };


    const handleSearch = useCallback((queryText: string) => {
        setSearchQuery(queryText);
        if (!queryText.trim()) {
            setSearchResults([]);
            return;
        }

        const lowerCaseQuery = queryText.toLowerCase();
        const results = uniqueAuthors.filter(author =>
            author.username.toLowerCase().includes(lowerCaseQuery)
        );

        const profileResults: UserProfile[] = results.map(author => ({
            id: author.id,
            username: author.username,
            email: author.email,
            photoURL: author.photoURL,
            bio: '', // Bio is not available in the Author type
        }));

        setSearchResults(profileResults.slice(0, 10)); // Limit results
    }, [uniqueAuthors]);


    const handleCreatePost = async (text: string, mediaUrls: string[] | null, mediaType: 'image' | 'video' | null, isAiQuery: boolean) => {
        if (!user || !userProfile || (!text.trim() && !mediaUrls)) return;
    
        const author: Author = { id: user.uid, email: user.email!, username: userProfile.username, photoURL: userProfile.photoURL || null };
        
        // Using `any` to allow adding aiReply dynamically.
        const postData: any = {
            author,
            text,
            createdAt: serverTimestamp(),
            commentCount: 0,
            likeCount: 0,
            repostCount: 0,
        };
        if (mediaUrls && mediaUrls.length > 0 && mediaType) {
            postData.mediaUrls = mediaUrls;
            postData.mediaType = mediaType;
        }
        
        if (isAiQuery) {
            postData.isAiPost = true;
            
            if (text.trim()) {
                try {
                    const response = await fetch(AI_QUERY_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: text, userId: user.uid })
                    });
                    if (!response.ok) throw new Error(`AI webhook failed with status ${response.status}`);
                    
                    const result = await response.json();
                    const aiResponseText = result.output || result.text || result.response || "Sorry, I couldn't get a response from the AI.";
    
                    postData.aiReply = { text: aiResponseText, createdAt: serverTimestamp() };
                } catch (error) {
                    console.error("Error fetching AI response:", error);
                    postData.aiReply = { text: "An error occurred while getting the AI response.", createdAt: serverTimestamp() };
                }
            }
        }
    
        // Now, create the document in one go.
        await addDoc(collection(db, 'community-posts'), postData);
    };
    
    const handleCreatePostAndCloseModal = async (text: string, mediaUrls: string[] | null, mediaType: 'image' | 'video' | null, isAiQuery: boolean) => {
        await handleCreatePost(text, mediaUrls, mediaType, isAiQuery);
        setCreatePostModalOpen(false);
    };
    
    const handleViewProfileAndCloseSidebar = (userId: string) => {
        onViewProfile(userId);
        setSearchSidebarOpen(false);
    }

    const handleImageClick = (url: string) => {
        setPreviewImageUrl(url);
    };

    const handleOpenRepostModal = (post: CommunityPost) => {
        setPostToRepost(post);
        setRepostModalOpen(true);
    };

    const handleCreateRepost = async (comment: string) => {
        if (!user || !userProfile || !postToRepost || !comment.trim()) return;

        const originalPostRef = doc(db, 'community-posts', postToRepost.id);
        const newPostRef = doc(collection(db, 'community-posts'));

        const repostData: RepostedPost = {
            id: postToRepost.id,
            author: postToRepost.author,
            text: postToRepost.text,
            createdAt: postToRepost.createdAt,
            ...(postToRepost.mediaUrls ? { mediaUrls: postToRepost.mediaUrls } : {}),
            ...(postToRepost.mediaType ? { mediaType: postToRepost.mediaType } : {}),
        };

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
                if (!originalPostDoc.exists()) {
                    throw "Original post does not exist.";
                }

                const currentRepostCount = originalPostDoc.data().repostCount || 0;
                transaction.update(originalPostRef, { repostCount: currentRepostCount + 1 });
                transaction.set(newPostRef, newPost);
            });
            setRepostModalOpen(false);
            setPostToRepost(null);
        } catch (error) {
            console.error("Failed to create repost:", error);
            alert("Could not create repost. Please try again.");
        }
    };

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
                            onViewProfile={handleViewProfileAndCloseSidebar}
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8">
                 <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-12 lg:col-span-7">
                        <div>
                            <div className="px-4 pt-4 sm:pt-8 pb-4 flex justify-between items-center">
                                <h1 className="text-xl font-bold text-primary">Community Feed</h1>
                                <button className="lg:hidden p-2 -mr-2" onClick={() => setSearchSidebarOpen(true)}>
                                    <svg className="w-6 h-6 text-primary"><use href="#icon-search"></use></svg>
                                </button>
                            </div>
                            
                            <div className="sm:space-y-4">
                                {error && (
                                    <div className="p-4 m-4 text-sm text-red-700 bg-red-100 rounded-lg">
                                        <strong>Loading Failed:</strong> {error}
                                    </div>
                                )}
                                {isLoading ? (
                                    <div className="space-y-4 p-4 sm:p-0">
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
                                        likedPostIds={likedPostIds}
                                        onToggleLike={handleToggleLike}
                                        onViewProfile={onViewProfile}
                                        onImageClick={handleImageClick}
                                        onRepost={handleOpenRepostModal}
                                    />)
                                )}
                                {!error && posts.length === 0 && !isLoading && <p className="text-center text-muted py-10">Be the first to post!</p>}
                            </div>
                        </div>
                    </div>

                    <div className="hidden lg:block lg:col-span-5 mt-8">
                        <RightSidebar 
                            posts={posts}
                            searchQuery={searchQuery}
                            onSearchChange={handleSearch}
                            searchResults={searchResults}
                            onViewProfile={onViewProfile}
                        />
                    </div>
                </div>
            </div>
            
            {user && (
                 <button
                    onClick={() => setCreatePostModalOpen(true)}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-secondary/50 backdrop-blur-lg border border-primary text-primary p-4 rounded-full shadow-lg hover:scale-105 transition-transform z-40"
                    aria-label="Create new post"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                </button>
            )}

            {user && userProfile && (
                <CreatePostModal isOpen={isCreatePostModalOpen} onClose={() => setCreatePostModalOpen(false)}>
                    <CreatePostForm
                        user={user}
                        userProfile={userProfile}
                        onCreatePost={handleCreatePostAndCloseModal}
                        isAiQuery={isCreatingPostAi}
                        onAiQueryChange={setIsCreatingPostAi}
                    />
                </CreatePostModal>
            )}
            {previewImageUrl && (
                <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
            )}
            <RepostModal
                isOpen={isRepostModalOpen}
                onClose={() => setRepostModalOpen(false)}
                onSubmit={handleCreateRepost}
                post={postToRepost}
                user={user}
                userProfile={userProfile}
            />
        </div>
    );
};

export default CommunityPage;
