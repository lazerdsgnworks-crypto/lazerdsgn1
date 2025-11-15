import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, CommunityPost, Comment, Reply, Author, UserProfile, RepostedPost, Poll } from '../../types.ts';
import { db } from '../../services/firebase.ts';
// FIX: Corrected the import for 'firebase/firestore' to ensure all required v9 SDK functions are available.
import { collection, query, orderBy, onSnapshot, runTransaction, doc, where, getDocs, QuerySnapshot, DocumentData, serverTimestamp, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import Avatar from '../Avatar.tsx';
import { ADMIN_UIDS } from '../../constants.ts';
import AudioPlayer from '../AudioPlayer.tsx';
import CommentItem from './CommentItem.tsx';
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

const TruncatedText: React.FC<{ text: string; className?: string; lineClamp?: string }> = ({ text, className, lineClamp = 'line-clamp-2' }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);
    const [isClamped, setIsClamped] = useState(false);
    const [showButton, setShowButton] = useState(false);

    useEffect(() => {
        const checkClamping = () => {
            if (textRef.current) {
                const currentlyClamped = textRef.current.scrollHeight > textRef.current.clientHeight;
                if(currentlyClamped) setIsClamped(true);
                setShowButton(currentlyClamped || isExpanded);
            }
        };
        // Check clamping after a short delay to allow for rendering
        const timeoutId = setTimeout(checkClamping, 100);
        window.addEventListener('resize', checkClamping);

        // Re-check when text changes
        checkClamping();
        
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', checkClamping);
        };
    }, [text, isExpanded]);

    return (
        <div>
            <div
                ref={textRef}
                className={`whitespace-pre-wrap break-words ${className} ${!isExpanded ? lineClamp : ''}`}
            >
                <Response>{text}</Response>
            </div>
            {showButton && (
                <button onClick={() => setIsExpanded(!isExpanded)} className="text-sm font-medium text-secondary hover:text-primary transition-colors mt-1">
                    {isExpanded ? 'Show less' : 'See more'}
                </button>
            )}
        </div>
    );
};

interface ProfileNavigable {
    onViewProfile: (userId: string) => void;
}

const PollResultsDisplay: React.FC<{ poll: Poll }> = ({ poll }) => {
    const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);

    return (
        <div className="mt-3 space-y-2">
            {poll.options.map((option, index) => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                return (
                    <div
                        key={index}
                        className="relative w-full text-sm font-semibold border border-primary rounded-full overflow-hidden p-2.5 text-left"
                    >
                        <div
                            className="absolute top-0 left-0 h-full progress-bar-fill"
                            style={{ width: `${percentage}%` }}
                        ></div>
                        <div className="relative flex justify-between">
                            <span className="truncate text-secondary">{option.text}</span>
                            <span className="flex-shrink-0 ml-2 text-secondary">{percentage.toFixed(0)}%</span>
                        </div>
                    </div>
                );
            })}
            <p className="text-xs text-muted pt-1">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
        </div>
    );
};

// --- Poll Component ---
const PollDisplay: React.FC<{ post: CommunityPost; user: User; }> = ({ post, user }) => {
    const [votingForOption, setVotingForOption] = useState<number | null>(null);
    const poll = post.poll!;
    const userVoteIndex = user ? poll.voters[user.uid] : undefined;
    const hasVoted = userVoteIndex !== undefined;
    const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);

    const handleVote = async (optionIndex: number) => {
        if (!user || votingForOption !== null) return;
        
        const currentUserVote = poll.voters[user.uid];
        if (currentUserVote === optionIndex) return;

        setVotingForOption(optionIndex);

        const postRef = doc(db, 'community-posts', post.id);
        try {
            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) throw "Post does not exist.";
                const currentPost = postDoc.data() as CommunityPost;
                const currentPoll = currentPost.poll;
                if (!currentPoll) throw "Poll does not exist on this post.";

                const previousVoteIndex = currentPoll.voters[user.uid];
                
                if (previousVoteIndex !== undefined) {
                    if (currentPoll.options[previousVoteIndex].votes > 0) {
                        currentPoll.options[previousVoteIndex].votes -= 1;
                    }
                }
                
                currentPoll.options[optionIndex].votes += 1;
                currentPoll.voters[user.uid] = optionIndex;
                
                transaction.update(postRef, { poll: currentPoll });
            });
        } catch (e) {
            console.error("Vote transaction failed: ", e);
            alert("Your vote could not be counted. Please try again.");
        } finally {
            setVotingForOption(null);
        }
    };

    return (
        <div className="mt-3 space-y-2">
            {poll.options.map((option, index) => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                const isUsersChoice = index === userVoteIndex;

                if (hasVoted) {
                    return (
                        <button 
                            key={index} 
                            onClick={() => handleVote(index)}
                            className="relative w-full text-sm font-bold border border-primary rounded-full overflow-hidden p-2.5 text-left disabled:opacity-70 disabled:cursor-not-allowed"
                            disabled={votingForOption !== null}
                        >
                            <div 
                                className="absolute top-0 left-0 h-full progress-bar-fill"
                                style={{ width: `${percentage}%`, transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                            ></div>
                            {votingForOption === index && (
                                <div className="absolute inset-0 bg-secondary/30">
                                    <div className="w-full h-full bg-gray-300/50 dark:bg-gray-600/50 overflow-hidden">
                                        <div className="animate-[progress_1.5s_ease-in-out_infinite] bg-gray-400 dark:bg-gray-500 h-full w-1/3"></div>
                                    </div>
                                </div>
                            )}
                            <div className="relative flex justify-between">
                                <span className={`truncate ${isUsersChoice ? 'text-primary' : 'text-secondary'}`}>
                                    {option.text}
                                </span>
                                <span className="flex-shrink-0 ml-2">{percentage.toFixed(0)}%</span>
                            </div>
                        </button>
                    );
                } else {
                    return (
                        <button 
                            key={index} 
                            onClick={() => handleVote(index)}
                            className="w-full text-sm font-bold border border-primary rounded-full p-2.5 text-secondary hover:bg-hover hover:border-secondary transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex justify-start items-center min-h-[42px] text-left relative overflow-hidden px-4"
                            disabled={!user || votingForOption !== null}
                        >
                           {votingForOption === index ? (
                                <div className="absolute inset-0 flex items-center justify-center p-2">
                                     <div className="w-full h-1 bg-gray-300 dark:bg-gray-600 overflow-hidden rounded">
                                        <div className="animate-[progress_1.5s_ease-in-out_infinite] bg-gray-400 dark:bg-gray-500 h-full w-1/3"></div>
                                    </div>
                                </div>
                           ) : (
                                option.text
                           )}
                        </button>
                    );
                }
            })}
            <p className="text-xs text-muted pt-1">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
        </div>
    );
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

// --- Post Component ---
interface PostItemProps extends ProfileNavigable {
    post: CommunityPost;
    user: User;
    userProfile: UserProfile | null;
    onDelete: (post: CommunityPost) => void;
    savedPostIds: Set<string>;
    onToggleSave: (postId: string) => void;
    likedPostIds: Set<string>;
    onToggleLike: (postId: string) => void;
    onImageClick: (url: string) => void;
    onRepost: (post: CommunityPost) => void;
}

const PostItem: React.FC<PostItemProps> = ({ post, user, userProfile, onDelete, savedPostIds, onToggleSave, likedPostIds, onToggleLike, onViewProfile, onImageClick, onRepost }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [showComments, setShowComments] = useState(post.isAiPost && !!post.aiReply && user?.uid === post.author.id);
    const [isMenuOpen, setMenuOpen] = useState(false);
    
    const menuRef = useRef<HTMLDivElement>(null);
    const timeAgo = post.createdAt ? formatTimeAgoShort(post.createdAt.toDate()) : '...';
    
    const commentAuthor = user && userProfile ? { id: user.uid, email: user.email!, username: userProfile.username, photoURL: userProfile.photoURL || null } : null;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!user || !showComments) {
            setComments([]);
            return;
        }
        const q = query(
            collection(db, 'usercomments'), 
            where('postId', '==', post.id),
            where('commentId', '==', null),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
        });
        return () => unsubscribe();
    }, [post.id, user, showComments]);

    const commentsToRender = useMemo(() => {
        let allComments = [...comments];
        if (post.isAiPost && post.aiReply) {
            const aiComment: Comment = {
                id: 'ai-reply-' + post.id,
                author: {
                    id: 'ai-assistant',
                    email: 'ai@lazerdsgn.com',
                    username: 'AI Assistant',
                },
                text: post.aiReply.text,
                createdAt: post.aiReply.createdAt,
                postId: post.id,
                replyCount: 0,
                audioUrl: post.aiReply.audioUrl,
            };
            allComments.unshift(aiComment);
        }
        return allComments;
    }, [comments, post.isAiPost, post.aiReply, post.id]);

    const handleAddComment = async (text: string) => {
        if (!user || !text.trim() || !commentAuthor) return;
        
        const postRef = doc(db, 'community-posts', post.id);
        const newCommentRef = doc(collection(db, 'usercomments'));

        try {
            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) throw "Post does not exist!";

                const newCommentCount = (postDoc.data().commentCount || 0) + 1;
                transaction.update(postRef, { commentCount: newCommentCount });

                transaction.set(newCommentRef, {
                    author: commentAuthor,
                    text,
                    postId: post.id,
                    commentId: null,
                    createdAt: serverTimestamp() as Timestamp,
                    replyCount: 0,
                });
            });
        } catch (error) {
            console.error("Failed to add comment:", error);
            alert("Could not post your comment. Please try again.");
        }
    };

    const handleDeleteComment = async (comment: Comment) => {
        if (!user || (user.uid !== comment.author.id && !ADMIN_UIDS.includes(user.uid))) return;
        
        const postRef = doc(db, 'community-posts', post.id);
        const commentRef = doc(db, 'usercomments', comment.id);
        const repliesQuery = query(collection(db, 'usercomments'), where('commentId', '==', comment.id));

        try {
            const repliesSnapshot = await getDocs(repliesQuery);
            const numReplies = repliesSnapshot.size;

            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (postDoc.exists()) {
                    const decrementAmount = 1 + numReplies;
                    const newCommentCount = Math.max(0, (postDoc.data().commentCount || 0) - decrementAmount);
                    transaction.update(postRef, { commentCount: newCommentCount });
                }
                
                repliesSnapshot.forEach(replyDoc => transaction.delete(replyDoc.ref));
                transaction.delete(commentRef);
            });
        } catch (error) {
            console.error("Error deleting comment and its replies:", error);
            alert("Could not delete the comment. Please try again.");
        }
    };

    const handleAddReply = async (text: string, parentComment: Comment) => {
        if (!user || !text.trim() || !commentAuthor) return;
        const postRef = doc(db, 'community-posts', parentComment.postId);
        const commentRef = doc(db, 'usercomments', parentComment.id);
        const newReplyRef = doc(collection(db, 'usercomments'));

        try {
            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                const commentDoc = await transaction.get(commentRef);

                if (!postDoc.exists() || !commentDoc.exists()) throw "Parent post or comment does not exist!";

                const newPostCommentCount = (postDoc.data().commentCount || 0) + 1;
                transaction.update(postRef, { commentCount: newPostCommentCount });

                const newReplyCount = (commentDoc.data().replyCount || 0) + 1;
                transaction.update(commentRef, { replyCount: newReplyCount });
                
                transaction.set(newReplyRef, {
                    author: commentAuthor,
                    text,
                    postId: parentComment.postId,
                    commentId: parentComment.id,
                    createdAt: serverTimestamp() as Timestamp,
                });
            });
        } catch (error) {
            console.error("Failed to add reply:", error);
            alert("Could not post your reply. Please try again.");
        }
    };

    const handleDeleteReply = async (replyId: string) => {
        const replyToDelete = comments.flatMap(c => c.id === replyId ? c : (c as any).replies || []).find(r => r.id === replyId) as Reply | undefined;
        if (!user || !replyToDelete || (user.uid !== replyToDelete.author.id && !ADMIN_UIDS.includes(user.uid))) return;
        
        const postRef = doc(db, 'community-posts', replyToDelete.postId);
        const commentRef = doc(db, 'usercomments', replyToDelete.commentId);
        const replyRef = doc(db, 'usercomments', replyId);

        try {
            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                const commentDoc = await transaction.get(commentRef);

                if (postDoc.exists()) {
                    transaction.update(postRef, { commentCount: Math.max(0, (postDoc.data().commentCount || 0) - 1) });
                }
                if (commentDoc.exists()) {
                    transaction.update(commentRef, { replyCount: Math.max(0, (commentDoc.data().replyCount || 0) - 1) });
                }
                transaction.delete(replyRef);
            });
        } catch (error) {
            console.error("Failed to delete reply:", error);
            alert("Could not delete reply. Please try again.");
        }
    };
    
    const RepostPreview: React.FC<{ reposted: RepostedPost } & ProfileNavigable> = ({ reposted, onViewProfile }) => {
        const repostTimeAgo = reposted.createdAt ? formatTimeAgoShort(reposted.createdAt.toDate()) : '...';
        const hasMedia = reposted.mediaUrls?.length > 0 || reposted.audioUrl || reposted.poll;
        return (
            <div className="mt-2 border border-secondary rounded-xl p-3 cursor-pointer hover:bg-hover transition-colors" onClick={() => { /* maybe navigate to original post in future */ }}>
                <div className="flex items-center space-x-2 mb-2">
                    <button onClick={(e) => { e.stopPropagation(); onViewProfile(reposted.author.id); }} className="flex-shrink-0">
                        <Avatar email={reposted.author.email} photoURL={reposted.author.photoURL} size="sm" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onViewProfile(reposted.author.id); }} className="font-bold text-sm truncate text-primary hover:underline">{reposted.author.username}</button>
                    <p className="text-xs text-muted flex-shrink-0">{repostTimeAgo}</p>
                </div>
                <div className="space-y-2">
                    {reposted.text && reposted.text.trim() && (
                        hasMedia ? (
                            <TruncatedText text={reposted.text} className="text-sm text-primary" />
                        ) : (
                            <Response>{reposted.text}</Response>
                        )
                    )}
                    
                    {reposted.mediaUrls && reposted.mediaUrls.length > 0 && (
                        <div className="mt-2">
                            {reposted.mediaType === 'video' ? (
                                <div className="rounded-lg overflow-hidden max-h-64 flex items-center justify-center bg-muted">
                                    <video src={reposted.mediaUrls[0]} controls muted className="max-h-full max-w-full object-contain" />
                                </div>
                            ) : (
                                <div className="rounded-lg overflow-hidden max-h-64 flex items-center justify-center bg-muted">
                                    <img src={reposted.mediaUrls[0]} alt="reposted media" className="max-h-full max-w-full object-contain cursor-pointer" onClick={(e) => {e.stopPropagation(); onImageClick(reposted.mediaUrls![0]);}}/>
                                </div>
                            )}
                        </div>
                    )}

                     {reposted.audioUrl && (
                        <div className="mt-2">
                            <AudioPlayer src={reposted.audioUrl} variant="community" />
                        </div>
                    )}

                    {reposted.poll && <PollResultsDisplay poll={reposted.poll} />}
                </div>
            </div>
        );
    };

    const hasMedia = post.mediaUrls?.length > 0 || post.audioUrl || post.poll;

    return (
        <div className="bg-secondary sm:rounded-xl p-4 overflow-hidden border-b border-primary sm:border-b-0">
            <div className="flex space-x-4">
                <div className="flex-shrink-0">
                    <button onClick={() => onViewProfile(post.author.id)}>
                        <Avatar email={post.author.email} photoURL={post.author.photoURL} size="lg" />
                    </button>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => onViewProfile(post.author.id)} className="font-bold text-primary hover:underline truncate">{post.author.username}</button>
                            {post.author.id && ADMIN_UIDS.includes(post.author.id) && (
                                <svg className="w-5 h-5 text-blue-500 flex-shrink-0"><use href="#icon-verified"></use></svg>
                            )}
                            <p className="text-sm text-muted">{timeAgo}</p>
                            {post.isAiPost && (
                                <span className="ai-badge">
                                    <svg className="w-3 h-3 mr-1 text-secondary-accent"><use href="#icon-sparkle"></use></svg>
                                    Used AI
                                </span>
                            )}
                        </div>

                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setMenuOpen(!isMenuOpen)} className="p-1 text-muted hover:text-primary">
                                <svg className="w-5 h-5"><use href="#icon-ellipsis"></use></svg>
                            </button>
                            {isMenuOpen && (
                                <div className="absolute right-0 mt-1 w-36 bg-secondary rounded-lg shadow-lg py-1 z-10">
                                    {user && (user.uid === post.author.id || ADMIN_UIDS.includes(user.uid)) && (
                                        <button onClick={() => { onDelete(post); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-hover flex items-center space-x-2">
                                            <svg className="w-4 h-4"><use href="#icon-trash"></use></svg>
                                            <span>Delete</span>
                                        </button>
                                    )}
                                    <button onClick={() => { /* Add report logic */ setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-hover flex items-center space-x-2">
                                        <svg className="w-4 h-4"><use href="#icon-flag"></use></svg>
                                        <span>Report</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-1">
                        {post.text && post.text.trim() && (
                            hasMedia ? (
                                <TruncatedText text={post.text} className="text-primary" />
                            ) : (
                                <Response>{post.text}</Response>
                            )
                        )}
                        
                        {post.repostedPost && <RepostPreview reposted={post.repostedPost} onViewProfile={onViewProfile} />}

                        {post.mediaUrls && post.mediaUrls.length > 0 && (
                            <div className="mt-3">
                                {post.mediaType === 'video' ? (
                                    <div className="rounded-xl shadow-sm overflow-hidden bg-black">
                                        <video src={post.mediaUrls[0]} controls playsInline className="w-full h-auto" />
                                    </div>
                                ) : post.mediaUrls.length === 1 ? (
                                     <div className="rounded-xl overflow-hidden cursor-pointer relative bg-muted" onClick={() => onImageClick(post.mediaUrls[0])}>
                                        <img src={post.mediaUrls[0]} alt="Post media 1" className="w-full h-auto max-h-[512px] object-cover" />
                                    </div>
                                ) : (
                                    <div className="flex overflow-x-auto space-x-2 scrollbar-hide h-80">
                                        {post.mediaUrls.map((url, index) => (
                                            <div key={index} className="flex-shrink-0 h-full w-auto rounded-xl overflow-hidden cursor-pointer" onClick={() => onImageClick(url)}>
                                                <img 
                                                    src={url} 
                                                    alt={`Post media ${index + 1}`} 
                                                    className="h-full w-auto object-cover" 
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {post.audioUrl && (
                             <div className="mt-3">
                                <AudioPlayer src={post.audioUrl} variant="community" />
                            </div>
                        )}
                        
                        {post.poll && <PollDisplay post={post} user={user} />}
                        
                    </div>
                    
                    <div className="flex justify-start items-center text-secondary mt-4 -ml-2 text-sm">
                        <button onClick={() => onToggleLike(post.id)} className={`flex items-center space-x-1.5 p-2 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors ${likedPostIds.has(post.id) ? 'text-red-500' : ''}`}>
                            <svg className="w-5 h-5"><use href={likedPostIds.has(post.id) ? "#icon-heart-filled" : "#icon-heart"}></use></svg>
                            {post.likeCount > 0 && (
                                <span className="text-xs font-semibold">{post.likeCount}</span>
                            )}
                        </button>
                        <button onClick={() => setShowComments(!showComments)} className="flex items-center space-x-1.5 p-2 rounded-full hover:bg-hover hover:text-blue-500 transition-colors">
                            <svg className="w-5 h-5"><use href="#icon-comment"></use></svg>
                            {post.commentCount > 0 && (
                                <span className="text-xs font-semibold">{post.commentCount}</span>
                            )}
                        </button>
                        <button onClick={() => onRepost(post)} className="flex items-center space-x-1.5 p-2 rounded-full hover:bg-hover hover:text-green-500 transition-colors">
                            <svg className="w-5 h-5"><use href="#icon-repost"></use></svg>
                             {post.repostCount > 0 && (
                                <span className="text-xs font-semibold">{post.repostCount}</span>
                            )}
                        </button>
                        <button onClick={() => onToggleSave(post.id)} className={`flex items-center p-2 rounded-full hover:bg-yellow-500/10 hover:text-yellow-500 transition-colors ${savedPostIds.has(post.id) ? 'text-yellow-500' : ''}`}>
                            <svg className="w-5 h-5"><use href={savedPostIds.has(post.id) ? "#icon-bookmark-filled" : "#icon-bookmark"}></use></svg>
                        </button>
                    </div>
                </div>
            </div>

            {showComments && (
                <div className="mt-4 pt-4 border-t border-primary space-y-4">
                    {user && <CommentForm user={user} userProfile={userProfile} onSubmit={handleAddComment} placeholder="Post your reply" />}
                    {commentsToRender.map(comment => (
                        <CommentItem 
                            key={comment.id} 
                            comment={comment} 
                            user={user}
                            userProfile={userProfile}
                            onDelete={handleDeleteComment}
                            onAddReply={handleAddReply}
                            onDeleteReply={handleDeleteReply}
                            author={commentAuthor}
                            onViewProfile={onViewProfile}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default PostItem;