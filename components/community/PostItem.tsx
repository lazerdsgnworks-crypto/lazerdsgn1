import React, { useState, useEffect, useRef } from 'react';
import { User, CommunityPost, Comment, Reply, Author, UserProfile } from '../../types';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot, runTransaction, doc, where, getDocs, QuerySnapshot, DocumentData, serverTimestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../Avatar';

interface ProfileNavigable {
    onViewProfile: (userId: string) => void;
}

// --- Comment-related Components (scoped to this file) ---
const CommentForm: React.FC<{ user: User, onSubmit: (text: string) => void, placeholder: string, autoFocus?: boolean }> = ({ user, onSubmit, placeholder, autoFocus }) => {
    const [text, setText] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(text);
        setText('');
    };
    
    if (!user) return null;

    return (
        <form onSubmit={handleSubmit} className="flex items-center space-x-3 py-2">
            <Avatar email={user.email!} size="sm"/>
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
    onDelete: (comment: Comment) => void;
    author: Author | null;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, user, onDelete, author, onViewProfile }) => {
    const [replies, setReplies] = useState<Reply[]>([]);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const timeAgo = comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : '...';
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
            setReplies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reply)));
        });
        return unsubscribe;
    }, [comment.id, comment.postId, user]);
    
    const handleAddReply = async (text: string) => {
        if (!user || !text.trim() || !author) return;
         await runTransaction(db, async (transaction) => {
            const commentRef = doc(db, 'usercomments', comment.id);
            const postRef = doc(db, 'community-posts', comment.postId);
            const newReplyRef = doc(collection(db, 'usercomments'));
            
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) throw "Parent post does not exist!";

            transaction.set(newReplyRef, {
                author, text, postId: comment.postId, commentId: comment.id, createdAt: serverTimestamp(),
            });
            transaction.update(commentRef, { replyCount: (comment.replyCount || 0) + 1 });
            transaction.update(postRef, { commentCount: (postDoc.data().commentCount || 0) + 1 });
        });
        setShowReplyForm(false);
    };
    
    const handleDeleteReply = async (replyId: string) => {
        const replyToDelete = replies.find(r => r.id === replyId);
        if (!user || !replyToDelete || user.uid !== replyToDelete.author.id) return;
        
        await runTransaction(db, async (transaction) => {
            const commentRef = doc(db, 'usercomments', comment.id);
            const postRef = doc(db, 'community-posts', comment.postId);
            const replyRef = doc(db, 'usercomments', replyId);
            
            const commentDoc = await transaction.get(commentRef);
            if (!commentDoc.exists()) throw "Parent comment does not exist!";
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) throw "Parent post does not exist!";

            transaction.delete(replyRef);
            transaction.update(commentRef, { replyCount: Math.max(0, (commentDoc.data().replyCount || 1) - 1) });
            transaction.update(postRef, { commentCount: Math.max(0, (postDoc.data().commentCount || 1) - 1) });
        });
    };

    return (
        <div className="pt-4">
            <div className="flex space-x-3">
                <div className="flex flex-col items-center flex-shrink-0 pt-1">
                    <Avatar email={comment.author.email} size="sm"/>
                    {replies.length > 0 && <div className="w-0.5 grow bg-primary/20 mt-2 rounded"></div>}
                </div>
                <div className="flex-1 min-w-0">
                     <header className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                             <p onClick={() => !isAiComment && onViewProfile(comment.author.id)} className={`font-bold truncate text-sm text-primary ${!isAiComment ? 'hover:underline cursor-pointer' : ''}`}>{comment.author.username}</p>
                             {isAiComment && <span className="ai-badge">AI</span>}
                             <p className="text-xs text-muted flex-shrink-0">{timeAgo}</p>
                        </div>
                        {user?.uid === comment.author.id && (
                            <button onClick={() => onDelete(comment)} className="text-muted hover:text-red-500 p-1 rounded-full"><svg className="w-4 h-4"><use href="#icon-ellipsis"></use></svg></button>
                        )}
                    </header>
                    <p className="text-primary text-sm whitespace-pre-wrap">{comment.text}</p>
                    <div className="flex items-center space-x-4 text-muted mt-2">
                        <button className="hover:text-red-500 transition-colors"><svg className="w-4 h-4"><use href="#icon-heart"></use></svg></button>
                        <button onClick={() => setShowReplyForm(!showReplyForm)} className="hover:text-blue-500 transition-colors"><svg className="w-4 h-4"><use href="#icon-comment"></use></svg></button>
                    </div>
                </div>
            </div>
             {showReplyForm && (
                <div className="pl-11 pt-2">
                    <CommentForm user={user} onSubmit={handleAddReply} placeholder="Write a reply..." autoFocus />
                </div>
            )}
            {replies.length > 0 && (
                <div className="pl-5 mt-1 space-y-1">
                    {replies.map(reply => (
                        <div key={reply.id} className="pt-3">
                            <div className="flex items-start space-x-3">
                                <Avatar email={reply.author.email} size="sm"/>
                                <div className="flex-1 min-w-0">
                                    <header className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <p onClick={() => onViewProfile(reply.author.id)} className="font-bold truncate text-sm text-primary hover:underline cursor-pointer">{reply.author.username}</p>
                                            <p className="text-xs text-muted flex-shrink-0">{reply.createdAt ? formatDistanceToNow(reply.createdAt.toDate(), { addSuffix: true }) : '...'}</p>
                                        </div>
                                        {user?.uid === reply.author.id && (
                                            <button onClick={() => handleDeleteReply(reply.id)} className="text-muted hover:text-red-500 p-1 rounded-full"><svg className="w-4 h-4"><use href="#icon-ellipsis"></use></svg></button>
                                        )}
                                    </header>
                                    <p className="text-sm text-primary whitespace-pre-wrap">{reply.text}</p>
                                     <div className="flex items-center space-x-4 text-muted mt-2">
                                        <button className="hover:text-red-500 transition-colors"><svg className="w-4 h-4"><use href="#icon-heart"></use></svg></button>
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
    author: Author | null;
}

const CommentSection: React.FC<CommentSectionProps> = ({ post, user, author, onViewProfile }) => {
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
            setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
        });
        return unsubscribe;
    }, [post.id, user]);
    
    const handleAddComment = async (text: string) => {
        if (!user || !text.trim() || !author) return;
        await runTransaction(db, async (transaction) => {
            const postRef = doc(db, 'community-posts', post.id);
            const newCommentRef = doc(collection(db, 'usercomments'));
            
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) throw "Parent post does not exist!";

            transaction.set(newCommentRef, {
                author, text, postId: post.id, createdAt: serverTimestamp(), replyCount: 0, commentId: null,
            });
            transaction.update(postRef, { commentCount: (postDoc.data().commentCount || 0) + 1 });
        });
    };

    const handleDeleteComment = async (comment: Comment) => {
        if (!user || user.uid !== comment.author.id) return;

        const repliesQuery = query(
            collection(db, 'usercomments'),
            where('postId', '==', post.id),
            where('commentId', '==', comment.id)
        );
        const repliesSnapshot = await getDocs(repliesQuery);
        const totalReplies = repliesSnapshot.size;

        await runTransaction(db, async (transaction) => {
            const postRef = doc(db, 'community-posts', post.id);
            const commentRef = doc(db, 'usercomments', comment.id);

            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) throw "Parent post does not exist!";

            repliesSnapshot.docs.forEach(replyDoc => transaction.delete(replyDoc.ref));
            transaction.delete(commentRef);
            
            const currentCount = postDoc.data().commentCount || 0;
            const newCount = Math.max(0, currentCount - 1 - totalReplies);
            transaction.update(postRef, { commentCount: newCount });
        });
    };
    
    const aiAuthor: Author = {
        id: 'ai-assistant',
        email: 'ai@lazerdsgn.com',
        username: 'AI Assistant',
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
        <div className="pl-10 pr-4 pb-2">
            <CommentForm user={user} onSubmit={handleAddComment} placeholder="Post your reply..." />
            <div className="space-y-1 mt-1">
                 {aiComment && (
                    <CommentItem 
                        key={aiComment.id} 
                        comment={aiComment} 
                        user={user} 
                        author={author}
                        onDelete={() => {}} // No-op for AI
                        onViewProfile={onViewProfile} 
                    />
                )}
                {comments.map(comment => (
                    <CommentItem key={comment.id} comment={comment} user={user} author={author} onDelete={handleDeleteComment} onViewProfile={onViewProfile} />
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
}

const PostItem: React.FC<PostItemProps> = ({ post, user, userProfile, onDelete, savedPostIds, onToggleSave, onViewProfile }) => {
    const [showComments, setShowComments] = useState(false);
    const [isMenuOpen, setMenuOpen] = useState(false);
    const timeAgo = post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : '...';
    const menuRef = useRef<HTMLDivElement>(null);
    
    const isSaved = savedPostIds.has(post.id);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const author = user && userProfile ? { id: user.uid, email: user.email!, username: userProfile.username } : null;

    return (
        <article className="hover:bg-primary/50 transition-colors duration-200 border-b border-primary">
             <div className="flex space-x-4 p-4">
                 <div className="flex flex-col items-center flex-shrink-0 pt-1">
                     <Avatar email={post.author.email}/>
                     {(showComments || (post.aiReply && post.commentCount === 0)) && (post.commentCount > 0 || post.aiReply) && <div className="w-0.5 grow bg-primary/20 mt-2 rounded"></div>}
                </div>
                <div className="flex-1 min-w-0">
                    <header className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <p onClick={() => onViewProfile(post.author.id)} className="font-bold text-base truncate hover:underline cursor-pointer text-primary">{post.author.username}</p>
                            <p className="text-sm text-muted flex-shrink-0">{timeAgo}</p>
                        </div>
                         <div className="relative" ref={menuRef}>
                            <button onClick={() => setMenuOpen(!isMenuOpen)} className="text-muted hover:text-primary p-1 rounded-full"><svg className="w-5 h-5"><use href="#icon-ellipsis"></use></svg></button>
                            {isMenuOpen && user?.uid === post.author.id && (
                                <div className="absolute right-0 top-full mt-1 bg-secondary border border-primary rounded-lg shadow-md z-10 w-32">
                                    <button onClick={() => {onDelete(post); setMenuOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-500/10 flex items-center space-x-2">
                                         <svg className="w-4 h-4"><use href="#icon-trash"></use></svg>
                                         <span>Delete</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>
                    <p className="text-primary whitespace-pre-wrap mt-1 text-base">{post.text}</p>
                    {post.mediaUrl && (
                        <div className="mt-3 rounded-xl w-full border border-primary shadow-sm overflow-hidden bg-muted flex justify-center">
                            {post.mediaType === 'video' ? (
                                <video
                                    src={post.mediaUrl}
                                    controls
                                    playsInline
                                    className="w-full max-h-[450px] bg-black"
                                />
                            ) : (
                                <img src={post.mediaUrl} alt="Post content" className="w-full max-h-[450px] object-cover" />
                            )}
                        </div>
                    )}

                    <footer className="mt-4 flex items-center justify-around text-muted max-w-xs">
                         <button className="flex items-center space-x-2 hover:text-red-500 transition-colors group">
                            <svg className="w-5 h-5 group-hover:text-red-500"><use href="#icon-heart"></use></svg>
                         </button>
                         <button onClick={() => setShowComments(!showComments)} className="flex items-center space-x-2 hover:text-blue-500 transition-colors group">
                            <svg className="w-5 h-5 group-hover:text-blue-500"><use href="#icon-comment"></use></svg>
                         </button>
                         <button className="flex items-center space-x-2 hover:text-green-500 transition-colors group">
                             <svg className="w-5 h-5 group-hover:text-green-500"><use href="#icon-repost"></use></svg>
                         </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); onToggleSave(post.id); }} 
                            className={`flex items-center space-x-2 transition-colors group ${isSaved ? 'text-yellow-500' : 'hover:text-yellow-500'}`}
                         >
                             <svg className="w-5 h-5"><use href={isSaved ? "#icon-bookmark-filled" : "#icon-bookmark"}></use></svg>
                         </button>
                    </footer>
                    
                    { (post.commentCount > 0 || post.aiReply) && (
                        <p className="text-sm text-muted mt-3 cursor-pointer hover:underline" onClick={() => setShowComments(!showComments)}>
                            View replies {post.commentCount > 0 ? `(${post.commentCount})` : ''}
                        </p>
                    )}
                </div>
            </div>
             {showComments && <CommentSection post={post} user={user} author={author} onViewProfile={onViewProfile} />}
        </article>
    );
};

export default PostItem;
