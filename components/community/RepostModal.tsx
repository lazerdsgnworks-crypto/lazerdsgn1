import React, { useState, useRef, useEffect } from 'react';
import { CommunityPost, User, UserProfile } from '../../types';
import Avatar from '../Avatar';
import AudioPlayer from '../AudioPlayer';
import Response from '../ui/Response';

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

interface RepostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (text: string) => Promise<void>; // Make onSubmit async
    post: CommunityPost | null;
    user: User;
    userProfile: UserProfile | null;
}

const RepostModal: React.FC<RepostModalProps> = ({ isOpen, onClose, onSubmit, post, user, userProfile }) => {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setTimeout(() => textareaRef.current?.focus(), 100);
        } else {
            document.body.style.overflow = 'auto';
            setText('');
            setIsLoading(false); // Reset loading state on close
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    if (!isOpen || !post || !user || !userProfile) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading || !text.trim()) return;

        setIsLoading(true);
        try {
            await onSubmit(text);
            // On success, the parent component will close the modal, which will reset state via useEffect
        } catch (error) {
            console.error("Repost submission failed in modal", error);
            // If submission fails, modal stays open, so we must reset loading state
            setIsLoading(false);
        }
    };
    
    const timeAgo = post.createdAt ? formatTimeAgoShort(post.createdAt.toDate()) : '...';

    return (
        <div 
            className={`fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div 
                className={`bg-secondary w-full max-w-2xl rounded-2xl shadow-xl transition-all duration-300 ease-in-out transform ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-2 border-b border-primary flex justify-center items-center relative">
                    <h2 className="text-lg font-bold text-primary">Repost</h2>
                    <button onClick={onClose} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted hover:text-primary">
                        <svg className="w-6 h-6"><use href="#icon-x-close"></use></svg>
                    </button>
                </div>
                
                <div className="p-4">
                    <form onSubmit={handleSubmit}>
                        <div className="flex space-x-4">
                            <Avatar email={user.email!} photoURL={userProfile.photoURL} size="lg" />
                            <div className="flex-1">
                                <textarea
                                    ref={textareaRef}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="w-full bg-transparent text-lg text-primary placeholder-muted focus:ring-0 focus:outline-none resize-none overflow-hidden"
                                    rows={2}
                                />
                            </div>
                        </div>
                        
                        {/* Embedded Post Preview */}
                        <div className="ml-16 mt-2 bg-muted rounded-xl p-3">
                            <div className="flex items-center space-x-2 mb-2">
                                <Avatar email={post.author.email} photoURL={post.author.photoURL} size="sm" />
                                <p className="font-bold text-sm truncate text-primary">{post.author.username}</p>
                                <p className="text-xs text-muted flex-shrink-0">{timeAgo}</p>
                            </div>
                            <div className="text-sm"><Response>{post.text}</Response></div>
                            {post.mediaUrls && post.mediaUrls.length > 0 && post.mediaType !== 'audio' && (
                                <div className="mt-2">
                                    <div className="rounded-lg overflow-hidden max-h-48 flex items-center justify-center bg-muted">
                                        <img src={post.mediaUrls[0]} alt="media" className="max-h-full max-w-full object-contain" />
                                    </div>
                                </div>
                            )}
                            {post.audioUrl && (
                                <div className="mt-2">
                                    <AudioPlayer src={post.audioUrl} variant="community" />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end mt-4">
                            <button type="submit" className="px-6 py-2 bg-primary-accent text-on-primary-accent font-semibold rounded-full hover:bg-accent-hover transition disabled:opacity-50 flex items-center justify-center min-w-[100px]" disabled={!text.trim() || isLoading}>
                                {isLoading ? (
                                    <svg className="animate-spin h-5 w-5"><use href="#icon-spinner"></use></svg>
                                ) : (
                                    'Repost'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RepostModal;