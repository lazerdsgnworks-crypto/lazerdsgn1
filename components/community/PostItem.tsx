import React, { useState, useEffect, useRef } from 'react';
import { User, CommunityPost, Comment, Reply, Author, UserProfile } from '../../types';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot, runTransaction, doc, where, getDocs, QuerySnapshot, DocumentData, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import Avatar from '../Avatar';

const ADMIN_UID = 'kMJDwlP0IDferEsOluQdqc9tQHI3';

const formatTimeAgoShort = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
};

interface ProfileNavigable {
    onViewProfile: (userId: string) => void;
}

// --- Comment-related Components (scoped to this file) ---
const CommentForm: React.FC<{ user: User; userProfile: UserProfile | null; onSubmit: (text: string) => void; placeholder: string; autoFocus?: boolean }> = ({ user, userProfile, onSubmit, placeholder, autoFocus }) => {
    const [text, setText] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(text);
        setText('');
    };
    
    if (!user) return null;

    return (
        <form onSubmit={handleSubmit} className="flex items-center space-x-3 py-2">
            <Avatar email={user.email!} photoURL={userProfile?.photoURL} size="sm"/>
            <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={placeholder}
                className="flex-1 p-2 text-sm bg-muted border border-transparent rounded-lg focus:bg-secondary focus:border-secondary focus:ring-0 transition text-primary"
                autoFocus={autoFocus}
            />
            <button type="submit" className="text-sm text-primary font-semibold hover:text-muted transition disabled:text-secondary disabled:cursor-not-allowed" disabled={!text.trim()}>
                Reply
            </button>
        </form>
    );
};

interface CommentItemProps extends ProfileNavigable {
    comment: Comment;
    user: User;
    userProfile: UserProfile | null;
    onDelete: (comment: Comment) => void;
    author: Author | null;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, user, userProfile, onDelete, author, onViewProfile }) => {
    const [replies, setReplies] = useState<Reply[]>([]);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const timeAgo = comment.createdAt ? formatTimeAgoShort(comment.createdAt.toDate()) : '...';
    const isAiComment = comment.author.id === 'ai-assistant';

    useEffect(() => {
        if (!user) {
            setReplies([]);
            return;
        }
        const q = query(
            collection(db, 'usercomments'),
            where('postId', '==', comment.postId),
            where('commentId', '==', comment.id),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const fetchedReplies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reply));
            setReplies(fetchedReplies);
        });
        return unsubscribe;
    }, [comment.id, comment.postId, user]);
    
    const handleAddReply = async (text: string) => {
        if (!user || !text.trim() || !author) return;
        await addDoc(collection(db, 'usercomments'), {
            author, text, postId: comment.postId, commentId: comment.id, createdAt: serverTimestamp(),
        });
        // NOTE: We are no longer updating public counters to avoid permission errors.
        setShowReplyForm(false);
    };
    
    const handleDeleteReply = async (replyId: string) => {
        const replyToDelete = replies.find(r => r.id === replyId);
        if (!user || !replyToDelete || (user.uid !== replyToDelete.author.id && user.uid !== ADMIN_UID)) return;
        
        const replyRef = doc(db, 'usercomments', replyId);
        await deleteDoc(replyRef);
        // NOTE: We are no longer updating public counters to avoid permission errors.
    };

    return (
        <div className="pt-4">
            <div className="flex space-x-3">
                <div className="flex flex-col items-center flex-shrink-0 pt-1">
                    <Avatar email={comment.author.email} photoURL={comment.author.photoURL} size="sm"/>
                    {replies.length > 0 && <div className="w-0.5 grow bg-primary/20 mt-2 rounded"></div>}
                </div>
                <div className="flex-1 min-w-0">
                     <header className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                             <p onClick={() => !isAiComment && onViewProfile(comment.author.id)} className={`font-bold truncate text-sm text-primary ${!isAiComment ? 'hover:underline cursor-pointer' : ''}`}>{comment.author.username}</p>
                             {comment.author.id === ADMIN_UID && <svg className="w-4 h-4 text-primary inline-block"><use href="#icon-verified"></use></svg>}
                             {isAiComment && <span className="ai-badge">AI</span>}
                             <p className="text-xs text-muted flex-shrink-0">{timeAgo}</p>
                        </div>
                        {(user?.uid === comment.author.id || user?.uid === ADMIN_UID) && (
                            <button onClick={() => onDelete(comment)} className="text-muted hover:text-red-500 p-1 rounded-full"><svg className="w-4 h-4"><use href="#icon-ellipsis"></use></svg></button>
                        )}
                    </header>
                    <p className="text-primary text-sm whitespace-pre-wrap">{comment.text}</p>
                    <div className="flex items-center space-x-4 text-muted mt-2">
                        <button className="hover:text-primary transition-colors"><svg className="w-4 h-4"><use href="#icon-heart"></use></svg></button>
                        <button onClick={() => setShowReplyForm(!showReplyForm)} className="hover:text-primary transition-colors"><svg className="w-4 h-4"><use href="#icon-comment"></use></svg></button>
                    </div>
                </div>
            </div>
             {showReplyForm && (
                <div className="pl-11 pt-2">
                    <CommentForm user={user} userProfile={userProfile} onSubmit={handleAddReply} placeholder="Write a reply..." autoFocus />
                </div>
            )}
            {replies.length > 0 && (
                <div className="pl-5 mt-1 space-y-1">
                    {replies.map(reply => (
                        <div key={reply.id} className="pt-3">
                            <div className="flex items-start space-x-3">
                                <Avatar email={reply.author.email} photoURL={reply.author.photoURL} size="sm"/>
                                <div className="flex-1 min-w-0">
                                    <header className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <p onClick={() => onViewProfile(reply.author.id)} className="font-bold truncate text-sm text-primary hover:underline cursor-pointer">{reply.author.username}</p>
                                            {reply.author.id === ADMIN_UID && <svg className="w-4 h-4 ml-1 text-primary inline-block"><use href="#icon-verified"></use></svg>}
                                            <p className="text-xs text-muted flex-shrink-0">{reply.createdAt ? formatTimeAgoShort(reply.createdAt.toDate()) : '...'}</p>
                                        </div>
                                        {(user?.uid === reply.author.id || user?.uid === ADMIN_UID) && (
                                            <button onClick={() => handleDeleteReply(reply.id)} className="text-muted hover:text-red-500 p-1 rounded-full"><svg className="w-4 h-4"><use href="#icon-ellipsis"></use></svg></button>
                                        )}
                                    </header>
                                    <p className="text-sm text-primary whitespace-pre-wrap">{reply.text}</p>
                                     <div className="flex items-center space-x-4 text-muted mt-2">
                                        <button className="hover:text-primary transition-colors"><svg className="w-4 h-4"><use href="#icon-heart"></use></svg></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface CommentSectionProps extends ProfileNavigable {
    post: CommunityPost;
    user: User;
    userProfile: UserProfile | null;
    author: Author | null;
}

const CommentSection: React.FC<CommentSectionProps> = ({ post, user, userProfile, author, onViewProfile }) => {
    const [comments, setComments] = useState<Comment[]>([]);

    useEffect(() => {
        if (!user) {
            setComments([]);
            return;
        }
        const q = query(
            collection(db, 'usercomments'),
            where('postId', '==', post.id),
            where('commentId', '==', null), // Ensure we only fetch top-level comments
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
            setComments(fetchedComments);
        });
        return unsubscribe;
    }, [post.id, user]);
    
    const handleAddComment = async (text: string) => {
        if (!user || !text.trim() || !author) return;
        await addDoc(collection(db, 'usercomments'), {
            author, text, postId: post.id, createdAt: serverTimestamp(), replyCount: 0, commentId: null,
        });
        // NOTE: We are no longer updating the public commentCount on the post
        // to avoid permission errors.
    };

    const handleDeleteComment = async (comment: Comment) => {
        if (!user || (user.uid !== comment.author.id && user.uid !== ADMIN_UID)) return;
    
        const repliesQuery = query(
            collection(db, 'usercomments'),
            where('postId', '==', post.id),
            where('commentId', '==', comment.id)
        );
        const repliesSnapshot = await getDocs(repliesQuery);
        
        await runTransaction(db, async (transaction) => {
            const postRef = doc(db, 'community-posts', post.id);
            const commentRef = doc(db, 'usercomments', comment.id);
    
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) throw "Parent post does not exist!";
    
            // Delete all replies first
            repliesSnapshot.docs.forEach(replyDoc => transaction.delete(replyDoc.ref));
            // Delete the main comment
            transaction.delete(commentRef);
            
            // NOTE: The counter update has been removed to prevent permission errors.
        });
    };
    
    const aiAuthor: Author = {
        id: 'ai-assistant',
        email: 'ai@lazerdsgn.com',
        username: 'AI Assistant',
        photoURL: null,
    };

    const aiComment: Comment | null = post.aiReply ? {
        id: 'ai-reply-' + post.id,
        author: aiAuthor,
        text: post.aiReply.text,
        createdAt: post.aiReply.createdAt,
        postId: post.id,
        replyCount: 0,
    } : null;

    return (
        <div className="pl-16 pr-4 pb-2">
            <CommentForm user={user} userProfile={userProfile} onSubmit={handleAddComment} placeholder="Post your reply..." />
            <div className="space-y-1 mt-1">
                 {aiComment && (
                    <CommentItem 
                        key={aiComment.id} 
                        comment={aiComment} 
                        user={user}
                        userProfile={userProfile} 
                        author={author}
                        onDelete={() => {}} // No-op for AI
                        onViewProfile={onViewProfile} 
                    />
                )}
                {comments.map(comment => (
                    <CommentItem key={comment.id} comment={comment} user={user} userProfile={userProfile} author={author} onDelete={handleDeleteComment} onViewProfile={onViewProfile} />
                ))}
            </div>
        </div>
    );
};

// --- Main PostItem Component ---
interface PostItemProps extends ProfileNavigable {
    post: CommunityPost;
    user: User;
    userProfile: UserProfile | null;
    onDelete: (post: CommunityPost) => void;
    savedPostIds: Set<string>;
    onToggleSave: (postId: string) => void;
    likedPostIds: Set<string>;
    onToggleLike: (postId: string) => void;
}

const PostItem: React.FC<PostItemProps> = ({ post, user, userProfile, onDelete, savedPostIds, onToggleSave, likedPostIds, onToggleLike, onViewProfile }) => {
    const [showComments, setShowComments] = useState(false);
    const [isMenuOpen, setMenuOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const timeAgo = post.createdAt ? formatTimeAgoShort(post.createdAt.toDate()) : '...';
    const menuRef = useRef<HTMLDivElement>(null);
    
    const anyPost = post as any;
    const mediaUrlsToRender = Array.isArray(anyPost.mediaUrls) && anyPost.mediaUrls.length > 0
        ? anyPost.mediaUrls
        : (anyPost.mediaUrl ? [anyPost.mediaUrl] : []);

    const hasMedia = mediaUrlsToRender.length > 0;
    const isSaved = savedPostIds.has(post.id);
    const isLiked = likedPostIds.has(post.id);

    useEffect(() => {
        setCurrentImageIndex(0);
    }, [post.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const author = user && userProfile ? { id: user.uid, email: user.email!, username: userProfile.username, photoURL: userProfile.photoURL || null } : null;

    const goToPreviousImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        const isFirst = currentImageIndex === 0;
        const newIndex = isFirst ? mediaUrlsToRender.length - 1 : currentImageIndex - 1;
        setCurrentImageIndex(newIndex);
    };

    const goToNextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        const isLast = currentImageIndex === mediaUrlsToRender.length - 1;
        const newIndex = isLast ? 0 : currentImageIndex + 1;
        setCurrentImageIndex(newIndex);
    };

    return (
        <div className="bg-secondary border-b sm:border border-primary sm:rounded-xl overflow-hidden">
            <div className="p-4">
                <div className="flex space-x-4">
                    <div className="flex flex-col items-center flex-shrink-0 pt-1">
                        <Avatar email={post.author.email} photoURL={post.author.photoURL} size="lg"/>
                        {(showComments || (post.aiReply && post.commentCount === 0)) && (post.commentCount > 0 || post.aiReply) && <div className="w-0.5 grow bg-primary/20 mt-2 rounded"></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                        <header className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <p onClick={() => onViewProfile(post.author.id)} className="font-bold text-sm sm:text-base truncate hover:underline cursor-pointer text-primary">{post.author.username}</p>
                                {post.author.id === ADMIN_UID && <svg className="w-4 h-4 ml-1 text-primary inline-block"><use href="#icon-verified"></use></svg>}
                                {post.isAiPost && <span className="ai-badge">Used AI</span>}
                                <p className="text-xs sm:text-sm text-muted flex-shrink-0">{timeAgo}</p>
                            </div>
                            <div className="relative" ref={menuRef}>
                                <button onClick={() => setMenuOpen(!isMenuOpen)} className="text-muted hover:text-primary p-1 rounded-full"><svg className="w-5 h-5"><use href="#icon-ellipsis"></use></svg></button>
                                {isMenuOpen && (user?.uid === post.author.id || user?.uid === ADMIN_UID) && (
                                    <div className="absolute right-0 top-full mt-1 bg-secondary border border-primary rounded-lg shadow-md z-10 w-32">
                                        <button onClick={() => {onDelete(post); setMenuOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-500/10 flex items-center space-x-2">
                                            <svg className="w-4 h-4"><use href="#icon-trash"></use></svg>
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </header>
                        <p className="text-primary whitespace-pre-wrap mt-1 text-sm sm:text-base">{post.text}</p>
                        {hasMedia && (
                            <div className="mt-3 relative group/slider">
                                <div className={`rounded-xl w-full border border-primary shadow-sm overflow-hidden bg-muted flex justify-center items-center ${post.mediaType === 'video' || mediaUrlsToRender.length > 1 ? 'aspect-video' : 'max-h-[400px]'}`}>
                                    {post.mediaType === 'video' ? (
                                        <video
                                            src={mediaUrlsToRender[0]}
                                            controls
                                            playsInline
                                            className="w-full h-full bg-black"
                                        />
                                    ) : (
                                        <img 
                                            src={mediaUrlsToRender[currentImageIndex]} 
                                            alt={`Post content ${currentImageIndex + 1}`} 
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    )}
                                </div>
                                {post.mediaType === 'image' && mediaUrlsToRender.length > 1 && (
                                    <>
                                        <button onClick={goToPreviousImage} className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity z-10 hover:bg-black/80">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <button onClick={goToNextImage} className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity z-10 hover:bg-black/80">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5">
                                            {mediaUrlsToRender.map((_, index) => (
                                                <div key={index} className={`w-2 h-2 rounded-full transition-colors ${index === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}></div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <footer className="mt-4 flex items-center justify-start space-x-6 text-muted">
                            <button onClick={() => onToggleLike(post.id)} className={`flex items-center transition-colors group ${isLiked ? 'text-primary' : 'hover:text-primary'}`}>
                                <svg className="w-5 h-5"><use href={isLiked ? "#icon-heart-filled" : "#icon-heart"}></use></svg>
                            </button>
                            <button onClick={() => setShowComments(!showComments)} className="flex items-center hover:text-primary transition-colors group">
                                <svg className="w-5 h-5"><use href="#icon-comment"></use></svg>
                            </button>
                            <button className="flex items-center hover:text-primary transition-colors group">
                                <svg className="w-5 h-5"><use href="#icon-repost"></use></svg>
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onToggleSave(post.id); }} 
                                className={`flex items-center transition-colors group ${isSaved ? 'text-primary' : 'hover:text-primary'}`}
                            >
                                <svg className="w-5 h-5"><use href={isSaved ? "#icon-bookmark-filled" : "#icon-bookmark"}></use></svg>
                            </button>
                        </footer>
                    </div>
                </div>
            </div>
            {showComments && (
                <div className="border-t border-primary">
                    <CommentSection post={post} user={user} userProfile={userProfile} author={author} onViewProfile={onViewProfile} />
                </div>
            )}
        </div>
    );
};

export default PostItem;