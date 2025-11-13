import React, { useState, useEffect } from 'react';
import { User, Comment, Reply, Author, UserProfile } from '../../types.ts';
import { db } from '../../services/firebase.ts';
// FIX: Corrected the import for 'firebase/firestore' to ensure all required v9 SDK functions are available.
import { collection, query, orderBy, onSnapshot, where, QuerySnapshot, DocumentData } from 'firebase/firestore';
import Avatar from '../Avatar.tsx';
import { ADMIN_UIDS } from '../../constants.ts';
import AudioPlayer from '../AudioPlayer.tsx';

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

const formatText = (text: string): string => {
    if (!text) return '';
    // 1. Escape HTML to prevent XSS.
    let safeText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2. UPDATED: Bold any text surrounded by *, **, or ***.
    // Process from most specific (***) to least specific (*) to avoid conflicts.
    safeText = safeText.replace(/\*\*\*(.*?)\*\*\*/g, '<strong>$1</strong>');
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safeText = safeText.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

    // 3. Handle newlines.
    safeText = safeText.replace(/\n/g, '<br />');
    
    return safeText;
};

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

interface ProfileNavigable {
    onViewProfile: (userId: string) => void;
}

interface CommentItemProps extends ProfileNavigable {
    comment: Comment;
    user: User;
    userProfile: UserProfile | null;
    onDelete: (comment: Comment) => void;
    onAddReply: (text: string, comment: Comment) => void;
    onDeleteReply: (replyId: string) => void;
    author: Author | null;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, user, userProfile, onDelete, onAddReply, onDeleteReply, author, onViewProfile }) => {
    const [replies, setReplies] = useState<Reply[]>([]);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [showReplies, setShowReplies] = useState(false);
    const timeAgo = comment.createdAt ? formatTimeAgoShort(comment.createdAt.toDate()) : '...';
    const isAiComment = comment.author.id === 'ai-assistant';

    useEffect(() => {
        if (!user || isAiComment) { // AI comments don't have replies from the DB
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
    }, [comment.id, comment.postId, user, isAiComment]);
    
    const handleAddReply = (text: string) => {
        onAddReply(text, comment);
        setShowReplyForm(false);
    };
    
    return (
        <div className="flex space-x-3">
            <div className="flex-shrink-0">
                {isAiComment ? (
                    <Avatar email={comment.author.email} photoURL={comment.author.photoURL} size="sm" />
                ) : (
                    <button onClick={() => onViewProfile(comment.author.id)} className="cursor-pointer">
                        <Avatar email={comment.author.email} photoURL={comment.author.photoURL} size="sm" />
                    </button>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            {isAiComment ? (
                                <p className="font-bold text-sm text-primary">{comment.author.username}</p>
                            ) : (
                                <button onClick={() => onViewProfile(comment.author.id)} className="font-bold text-sm text-primary hover:underline">{comment.author.username}</button>
                            )}
                            <p className="text-xs text-secondary">{timeAgo}</p>
                        </div>
                        {/* FIX: Disable delete button for AI comments */}
                        {(user && (user.uid === comment.author.id || ADMIN_UIDS.includes(user.uid)) && !isAiComment) && (
                            <button onClick={() => onDelete(comment)} className="text-muted hover:text-red-500 text-xs p-1">Delete</button>
                        )}
                    </div>
                    {comment.text && <p className="text-sm text-primary mt-1 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatText(comment.text) }}></p>}
                    {/* FIX: Add AudioPlayer for comments with audio */}
                    {comment.audioUrl && (
                        <div className="mt-2">
                            <AudioPlayer src={comment.audioUrl} variant="community" />
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-3 text-xs text-secondary mt-1">
                    {/* FIX: Disable reply button for AI comments */}
                    {!isAiComment && <button onClick={() => setShowReplyForm(!showReplyForm)} className="font-semibold hover:underline">Reply</button>}
                    {comment.replyCount > 0 && (
                        <button onClick={() => setShowReplies(!showReplies)} className="font-semibold hover:underline">
                            {showReplies ? 'Hide replies' : `View ${comment.replyCount} ${comment.replyCount > 1 ? 'replies' : 'reply'}`}
                        </button>
                    )}
                </div>

                {showReplyForm && <CommentForm user={user} userProfile={userProfile} onSubmit={handleAddReply} placeholder="Write a reply..." autoFocus />}

                {showReplies && replies.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-primary/50 space-y-2">
                        {replies.map(reply => (
                            <div key={reply.id} className="flex space-x-3">
                                <button onClick={() => onViewProfile(reply.author.id)} className="cursor-pointer flex-shrink-0">
                                    <Avatar email={reply.author.email} photoURL={reply.author.photoURL} size="sm" />
                                </button>
                                <div className="flex-1 min-w-0 bg-transparent">
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => onViewProfile(reply.author.id)} className="font-bold text-sm text-primary hover:underline">{reply.author.username}</button>
                                        <p className="text-xs text-secondary">{reply.createdAt ? formatTimeAgoShort(reply.createdAt.toDate()) : '...'}</p>
                                    </div>
                                    <p className="text-sm text-primary mt-1" dangerouslySetInnerHTML={{ __html: formatText(reply.text) }}></p>
                                    {(user && (user.uid === reply.author.id || ADMIN_UIDS.includes(user.uid))) && (
                                        <button onClick={() => onDeleteReply(reply.id)} className="text-xs text-muted hover:text-red-500 mt-1">Delete</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommentItem;