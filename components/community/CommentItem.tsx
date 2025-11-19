
import React, { useState, useEffect } from 'react';
import { User, Comment, Reply, Author, UserProfile } from '../../types.ts';
import { db } from '../../services/firebase.ts';
import { collection, query, orderBy, onSnapshot, where, QuerySnapshot, DocumentData } from 'firebase/firestore';
import Avatar from '../Avatar.tsx';
import { ADMIN_UIDS } from '../../constants.ts';
import AudioPlayer from '../AudioPlayer.tsx';
import Response from '../ui/Response.tsx';

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
    followingIds?: Set<string>;
    onToggleFollow?: (userId: string) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, user, userProfile, onDelete, onAddReply, onDeleteReply, author, onViewProfile, followingIds, onToggleFollow }) => {
    const [replies, setReplies] = useState<Reply[]>([]);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [showReplies, setShowReplies] = useState(false);
    const timeAgo = comment.createdAt ? formatTimeAgoShort(comment.createdAt.toDate()) : '...';
    const isAiComment = comment.author.id === 'ai-assistant';
    const isFollowing = followingIds?.has(comment.author.id);
    const isOwnComment = user?.uid === comment.author.id;

    useEffect(() => {
        if (!user || isAiComment) {
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
            const fetchedReplies = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Reply));
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
                            
                            {comment.author.id && ADMIN_UIDS.includes(comment.author.id) && !isAiComment && (
                                <div className="bg-blue-500 rounded-full p-0.5 flex-shrink-0 flex items-center justify-center w-3.5 h-3.5">
                                    <svg className="w-2 h-2 text-white fill-current"><use href="#icon-sparkle-solid"></use></svg>
                                </div>
                            )}

                             {!isOwnComment && !isAiComment && onToggleFollow && (
                                <button 
                                    onClick={() => onToggleFollow(comment.author.id)}
                                    className={`p-1 rounded-full transition-colors ${isFollowing ? 'text-primary' : 'text-secondary hover:text-primary hover:bg-hover'}`}
                                    title={isFollowing ? 'Unfollow' : 'Follow'}
                                >
                                    {isFollowing ? (
                                        <svg className="w-3.5 h-3.5"><use href="#icon-user-check"></use></svg>
                                    ) : (
                                        <svg className="w-3.5 h-3.5"><use href="#icon-user-plus"></use></svg>
                                    )}
                                </button>
                            )}

                            <p className="text-xs text-secondary">{timeAgo}</p>
                        </div>
                        {(user && (user.uid === comment.author.id || ADMIN_UIDS.includes(user.uid)) && !isAiComment) && (
                            <button onClick={() => onDelete(comment)} className="text-muted hover:text-red-500 text-xs p-1">Delete</button>
                        )}
                    </div>
                    {comment.text && <div className="text-sm text-primary mt-1"><Response>{comment.text}</Response></div>}
                    {comment.audioUrl && (
                        <div className="mt-2">
                            <AudioPlayer src={comment.audioUrl} variant="community" />
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-3 text-xs text-secondary mt-1">
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
                                        {reply.author.id && ADMIN_UIDS.includes(reply.author.id) && (
                                            <div className="bg-blue-500 rounded-full p-0.5 flex-shrink-0 flex items-center justify-center w-3.5 h-3.5">
                                                <svg className="w-2 h-2 text-white fill-current"><use href="#icon-sparkle-solid"></use></svg>
                                            </div>
                                        )}
                                        <p className="text-xs text-secondary">{reply.createdAt ? formatTimeAgoShort(reply.createdAt.toDate()) : '...'}</p>
                                    </div>
                                    <div className="text-sm text-primary mt-0.5"><Response>{reply.text}</Response></div>
                                </div>
                                {(user && (user.uid === reply.author.id || ADMIN_UIDS.includes(user.uid))) && (
                                    <button onClick={() => onDeleteReply(reply.id)} className="text-muted hover:text-red-500 text-xs self-start">Delete</button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommentItem;
