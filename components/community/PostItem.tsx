import React, { useState, useEffect, useRef } from 'react';
// FIX: Import UserProfile type to be used for casting Firestore data.
import { User, CommunityPost, Comment, Reply, Author, UserProfile } from '../../types';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot, runTransaction, doc, where, getDocs, QuerySnapshot, DocumentData, serverTimestamp, getDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../Avatar';

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
                className="flex-1 p-2 text-sm bg-gray-100 border border-transparent rounded-lg focus:bg-white focus:border-gray-300 focus:ring-0 transition"
                autoFocus={autoFocus}
            />
            <button type="submit" className="text-sm text-black font-semibold hover:text-gray-500 transition disabled:text-gray-300 disabled:cursor-not-allowed" disabled={!text.trim()}>
                Reply
            </button>
        </form>
    );
};

const CommentItem: React.FC<{ comment: Comment, user: User, onDelete: (comment: Comment) => void }> = ({ comment, user, onDelete }) => {
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
            collection(db, 'user-comments-and-replies'),
            where('commentId', '==', comment.id),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            setReplies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reply)));
        });
        return unsubscribe;
    }, [comment.id, user]);
    
    const getAuthor = async (user: User): Promise<Author> => {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        // FIX: Cast userDoc.data() to UserProfile to access username property safely.
        const username = userDoc.exists() ? (userDoc.data() as UserProfile).username : user.email!.split('@')[0];
        return { id: user.uid, email: user.email!, username };
    };

    const handleAddReply = async (text: string) => {
        if (!user || !text.trim()) return;
        const author = await getAuthor(user);
         await runTransaction(db, async (transaction) => {
            const commentRef = doc(db, 'user-comments-and-replies', comment.id);
            const postRef = doc(db, 'community-posts', comment.postId);
            const newReplyRef = doc(collection(db, 'user-comments-and-replies'));
            
            // --- READ FIRST ---
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) throw "Parent post does not exist!";

            // --- THEN WRITE ---
            transaction.set(newReplyRef, {
                author,
                text,
                postId: comment.postId,
                commentId: comment.id,
                createdAt: serverTimestamp(),
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
            const commentRef = doc(db, 'user-comments-and-replies', comment.id);
            const postRef = doc(db, 'community-posts', comment.postId);
            const replyRef = doc(db, 'user-comments-and-replies', replyId);
            
            // --- READ FIRST ---
            const commentDoc = await transaction.get(commentRef);
            if (!commentDoc.exists()) throw "Parent comment does not exist!";
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) throw "Parent post does not exist!";

            // --- THEN WRITE ---
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
                    {replies.length > 0 && <div className="w-0.5 grow bg-gray-200/80 mt-2 rounded"></div>}
                </div>
                <div className="flex-1 min-w-0">
                     <header className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                             <p className="font-bold truncate text-sm hover:underline cursor-pointer">{comment.author.username}</p>
                             {isAiComment && <span className="ai-badge">AI</span>}
                             <p className="text-xs text-gray-500 flex-shrink-0">{timeAgo}</p>
                        </div>
                        {user?.uid === comment.author.id && (
                            <button onClick={() => onDelete(comment)} className="text-gray-400 hover:text-red-500 p-1 rounded-full"><svg className="w-4 h-4"><use href="#icon-ellipsis"></use></svg></button>
                        )}
                    </header>
                    <p className="text-gray-800 text-sm whitespace-pre-wrap">{comment.text}</p>
                    <div className="flex items-center space-x-4 text-gray-500 mt-2">
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
                                            <p className="font-bold truncate text-sm hover:underline cursor-pointer">{reply.author.username}</p>
                                            <p className="text-xs text-gray-500 flex-shrink-0">{reply.createdAt ? formatDistanceToNow(reply.createdAt.toDate(), { addSuffix: true }) : '...'}</p>
                                        </div>
                                        {user?.uid === reply.author.id && (
                                            <button onClick={() => handleDeleteReply(reply.id)} className="text-gray-400 hover:text-red-500 p-1 rounded-full"><svg className="w-4 h-4"><use href="#icon-ellipsis"></use></svg></button>
                                        )}
                                    </header>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{reply.text}</p>
                                     <div className="flex items-center space-x-4 text-gray-500 mt-2">
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

const CommentSection: React.FC<{ post: CommunityPost, user: User }> = ({ post, user }) => {
    const [comments, setComments] = useState<Comment[]>([]);

    useEffect(() => {
        if (!user) {
            setComments([]);
            return;
        }
        const q = query(
            collection(db, 'user-comments-and-replies'),
            where('postId', '==', post.id),
            where('commentId', '==', null), // Ensure we only fetch top-level comments
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
        });
        return unsubscribe;
    }, [post.id, user]);
    
    const getAuthor = async (user: User): Promise<Author> => {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        // FIX: Cast userDoc.data() to UserProfile to access username property safely.
        const username = userDoc.exists() ? (userDoc.data() as UserProfile).username : user.email!.split('@')[0];
        return { id: user.uid, email: user.email!, username };
    };

    const handleAddComment = async (text: string) => {
        if (!user || !text.trim()) return;
        const author = await getAuthor(user);
        await runTransaction(db, async (transaction) => {
            const postRef = doc(db, 'community-posts', post.id);
            const newCommentRef = doc(collection(db, 'user-comments-and-replies'));
            
            // --- READ FIRST ---
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) throw "Parent post does not exist!";

            // --- THEN WRITE ---
            transaction.set(newCommentRef, {
                author,
                text,
                postId: post.id,
                createdAt: serverTimestamp(),
                replyCount: 0,
                commentId: null, // Explicitly null for top-level comments
            });
            transaction.update(postRef, { commentCount: (postDoc.data().commentCount || 0) + 1 });
        });
    };

    const handleDeleteComment = async (comment: Comment) => {
        if (!user || user.uid !== comment.author.id) return;
        await runTransaction(db, async (transaction) => {
            const postRef = doc(db, 'community-posts', post.id);
            const commentRef = doc(db, 'user-comments-and-replies', comment.id);

            // --- READ FIRST ---
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) throw "Parent post does not exist!";
            
            // This is a non-transactional read, but required to know how many replies to decrement.
            // It must happen before writes.
            const repliesQuery = query(
                collection(db, 'user-comments-and-replies'),
                where('commentId', '==', comment.id)
            );
            const repliesSnapshot = await getDocs(repliesQuery);
            const totalReplies = repliesSnapshot.size;

            // --- THEN WRITE ---
            repliesSnapshot.docs.forEach(replyDoc => transaction.delete(replyDoc.ref));
            transaction.delete(commentRef);
            transaction.update(postRef, { commentCount: Math.max(0, (postDoc.data().commentCount || 1) - 1 - totalReplies) });
        });
    };

    return (
        <div className="pl-10 pr-4 pb-2">
            <CommentForm user={user} onSubmit={handleAddComment} placeholder="Post your reply..." />
            <div className="space-y-1 mt-1">
                {comments.map(comment => (
                    <CommentItem key={comment.id} comment={comment} user={user} onDelete={handleDeleteComment} />
                ))}
            </div>
        </div>
    );
};

// --- Main PostItem Component ---
const PostItem: React.FC<{ post: CommunityPost, user: User, onDelete: (post: CommunityPost) => void }> = ({ post, user, onDelete }) => {
    const [showComments, setShowComments] = useState(false);
    const [isMenuOpen, setMenuOpen] = useState(false);
    const timeAgo = post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : '...';
    const menuRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <article className="hover:bg-gray-50/50 transition-colors duration-200 border-b border-gray-200/80">
             <div className="flex space-x-4 p-4">
                 <div className="flex flex-col items-center flex-shrink-0 pt-1">
                     <Avatar email={post.author.email}/>
                     {showComments && post.commentCount > 0 && <div className="w-0.5 grow bg-gray-200/80 mt-2 rounded"></div>}
                </div>
                <div className="flex-1 min-w-0">
                    <header className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <p className="font-bold text-base truncate hover:underline cursor-pointer">{post.author.username}</p>
                            <p className="text-sm text-gray-500 flex-shrink-0">{timeAgo}</p>
                        </div>
                         <div className="relative" ref={menuRef}>
                            <button onClick={() => setMenuOpen(!isMenuOpen)} className="text-gray-500 hover:text-black p-1 rounded-full"><svg className="w-5 h-5"><use href="#icon-ellipsis"></use></svg></button>
                            {isMenuOpen && user?.uid === post.author.id && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-md z-10 w-32">
                                    <button onClick={() => {onDelete(post); setMenuOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2">
                                         <svg className="w-4 h-4"><use href="#icon-trash"></use></svg>
                                         <span>Delete</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>
                    <p className="text-gray-800 whitespace-pre-wrap mt-1 text-base">{post.text}</p>
                    {post.mediaUrl && (
                        <div className="mt-3 rounded-xl w-full border border-gray-200/80 shadow-sm overflow-hidden bg-gray-100 flex justify-center">
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
                    <footer className="mt-4 flex items-center justify-around text-gray-500 max-w-xs">
                         <button className="flex items-center space-x-2 hover:text-red-500 transition-colors group">
                            <svg className="w-5 h-5 group-hover:text-red-500"><use href="#icon-heart"></use></svg>
                         </button>
                         <button onClick={() => setShowComments(!showComments)} className="flex items-center space-x-2 hover:text-blue-500 transition-colors group">
                            <svg className="w-5 h-5 group-hover:text-blue-500"><use href="#icon-comment"></use></svg>
                         </button>
                         <button className="flex items-center space-x-2 hover:text-green-500 transition-colors group">
                             <svg className="w-5 h-5 group-hover:text-green-500"><use href="#icon-repost"></use></svg>
                         </button>
                         <button className="flex items-center space-x-2 hover:text-yellow-500 transition-colors group">
                             <svg className="w-5 h-5 group-hover:text-yellow-500"><use href="#icon-bookmark"></use></svg>
                         </button>
                    </footer>
                    {post.commentCount > 0 && (
                        <p className="text-sm text-gray-500 mt-3 cursor-pointer hover:underline" onClick={() => setShowComments(!showComments)}>
                            {post.commentCount} {post.commentCount === 1 ? 'reply' : 'replies'}
                        </p>
                    )}
                </div>
            </div>
             {showComments && <CommentSection post={post} user={user} />}
        </article>
    );
};

export default PostItem;