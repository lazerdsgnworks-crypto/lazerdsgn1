import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { UserProfile, ChatMessage } from '../types.ts';
import AudioPlayer from './AudioPlayer.tsx';
import Response from './ui/Response.tsx';
import AnalyzingIndicator from './AnalyzingIndicator.tsx';

const AnimatedTextPart: React.FC<{ text: string; onComplete: () => void; }> = ({ text, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const onCompleteRef = useRef(onComplete);

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        const tokens = text.match(/(\s+|\S+)/g) || [];
        if (tokens.length === 0) {
            onCompleteRef.current();
            return;
        }

        let tokenIndex = 0;
        const intervalId = setInterval(() => {
            if (tokenIndex < tokens.length) {
                setDisplayedText(prev => prev + tokens[tokenIndex]);
                tokenIndex++;
            } else {
                clearInterval(intervalId);
                onCompleteRef.current();
            }
        }, 30);

        return () => clearInterval(intervalId);
    }, [text]);

    return <Response>{displayedText}</Response>;
};

const ChatMessageItem: React.FC<{ 
    message: ChatMessage, 
    isLoading?: boolean, 
    isGeneratingImage?: boolean, 
    isGeneratingVideo?: boolean, 
    isAnalyzing?: boolean,
    userProfile: UserProfile | null,
    animatedMessageIds: React.MutableRefObject<Set<string>>,
    onImageClick?: (url: string) => void;
}> = ({ message, isLoading, isGeneratingImage, isGeneratingVideo, isAnalyzing, userProfile, animatedMessageIds, onImageClick }) => {
    const isUser = message.role === 'user';
    const isAi = message.role === 'ai';
    const [showTranscription, setShowTranscription] = useState(false);

    type MessagePart = { type: 'text' | 'code' | 'table'; content: string };

    const allParts = useMemo<MessagePart[]>(() => {
        if (!isAi || !message.text) return [];
        
        const rawParts = message.text.split(/(```[\s\S]*?```)/g);
        const structuredParts: MessagePart[] = [];
        rawParts.forEach(part => {
            if (!part) return;
            if (part.startsWith('```')) {
                structuredParts.push({ type: 'code', content: part });
            } else {
                const subParts = part.split(/((?:\|.*\|[ \t]*\r?\n)+(?:\|.*\|))/g);
                subParts.forEach(subPart => {
                    if (!subPart) return;
                    const trimmedSubPart = subPart.trim();
                    const isTable = trimmedSubPart.startsWith('|') && /\|.*-.*\|/.test(trimmedSubPart);
                    if (isTable) {
                        structuredParts.push({ type: 'table', content: subPart });
                    } else if (subPart.trim()) {
                        structuredParts.push({ type: 'text', content: subPart });
                    }
                });
            }
        });
        return structuredParts;
    }, [isAi, message.text]);

    const [renderedPartsCount, setRenderedPartsCount] = useState(0);
    const shouldAnimate = isAi && !animatedMessageIds.current.has(message.id);

    useEffect(() => {
        if (shouldAnimate) {
            setRenderedPartsCount(allParts.length > 0 ? 1 : 0);
        } else {
            setRenderedPartsCount(allParts.length);
        }
    }, [message.id, allParts.length, shouldAnimate]);

    const handleAnimationComplete = useCallback(() => {
        if (renderedPartsCount >= allParts.length) {
            animatedMessageIds.current.add(message.id);
            return;
        }
        setRenderedPartsCount(count => count + 1);
    }, [renderedPartsCount, allParts.length, message.id, animatedMessageIds]);

    useEffect(() => {
        if (shouldAnimate && renderedPartsCount > 0 && renderedPartsCount <= allParts.length) {
            const lastRenderedPart = allParts[renderedPartsCount - 1];
            if (lastRenderedPart.type !== 'text') {
                const timer = setTimeout(() => {
                    handleAnimationComplete();
                }, 100); 
                return () => clearTimeout(timer);
            }
        }
    }, [renderedPartsCount, allParts, shouldAnimate, handleAnimationComplete]);

    const partsToRender = allParts.slice(0, renderedPartsCount);

    const copyToClipboard = (text: string, button: HTMLButtonElement) => {
        navigator.clipboard.writeText(text);
        const original = button.innerHTML;
        button.innerHTML = `<svg class="w-4 h-4 text-green-500"><use href="#icon-check"></use></svg>`;
        setTimeout(() => button.innerHTML = original, 1500);
    };

    const handleDownload = (mediaUrl: string, fileName: string) => {
        try {
            let downloadUrl = mediaUrl;
            if (mediaUrl.includes('drive.google.com') && mediaUrl.includes('/view')) {
                const fileIdMatch = mediaUrl.match(/file\/d\/([a-zA-Z0-9_-]+)/);
                if (fileIdMatch && fileIdMatch[1]) {
                    const fileId = fileIdMatch[1];
                    downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                }
            }
            
            const newWindow = window.open(downloadUrl, '_blank', 'noopener,noreferrer');
            if (newWindow) newWindow.opener = null;

        } catch (error) {
            console.error('Download initiation failed:', error);
            alert(`Sorry, the download could not be started automatically. Please try right-clicking the content and choosing "Save As...".`);
            window.open(mediaUrl, '_blank');
        }
    };

    if (isLoading) {
        if (isAnalyzing) {
            return (
                <div className="flex items-start gap-3 justify-start">
                    <div className="chat-message-bubble bg-transparent">
                        <AnalyzingIndicator />
                    </div>
                </div>
            );
        }
        if (isGeneratingVideo) {
            return (
                <div className="flex items-start gap-3 justify-start">
                    <div className="p-4 bg-muted rounded-2xl">
                        <div className="w-64 h-36 rounded-lg flex flex-col items-center justify-center overflow-hidden">
                            <div className="w-full h-full shimmer-bg flex flex-col items-center justify-center">
                                <svg className="w-12 h-12 text-secondary"><use href="#icon-video"></use></svg>
                                <p className="mt-2 text-sm text-secondary">Crafting your video...</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        if (isGeneratingImage) {
            return (
                <div className="flex items-start gap-3 justify-start">
                    <div className="p-4 bg-muted rounded-2xl">
                        <div className="w-64 h-64 rounded-lg flex flex-col items-center justify-center overflow-hidden">
                            <div className="w-full h-full shimmer-bg flex flex-col items-center justify-center">
                                <svg className="w-12 h-12 text-secondary"><use href="#icon-image-gen"></use></svg>
                                <p className="mt-2 text-sm text-secondary">Conjuring pixels...</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return (
             <div className="flex items-start gap-3 justify-start">
                <div className="chat-message-bubble bg-secondary">
                    <div className="typing-indicator flex items-center space-x-1.5 p-2">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        );
    }

    const messageAlignmentClass = isUser ? 'justify-end' : 'justify-start';

    const renderUserFilePreview = (msg: ChatMessage) => {
        let content = null;
        if (msg.audioUrl) {
            content = <AudioPlayer src={msg.audioUrl} />;
        } else if (msg.analysisFile) {
            if (msg.imageUrl) {
                 content = (
                    <div className="relative bg-hover border border-secondary rounded-lg p-3 flex items-start space-x-3">
                        <img src={msg.imageUrl} alt="File preview" className="w-16 h-16 object-cover rounded flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <span className="text-sm text-primary truncate block font-medium">{msg.analysisFile.name}</span>
                            <span className="text-xs text-muted">{msg.analysisFile.type}</span>
                        </div>
                    </div>
                );
            } else {
                let iconHref = '#icon-file-text';
                if (msg.analysisFile.type.startsWith('video/')) iconHref = '#icon-video';
                else if (msg.analysisFile.type.startsWith('audio/')) iconHref = '#icon-music';
                content = (
                    <div className="relative bg-hover border border-secondary rounded-lg p-3 flex items-center space-x-3">
                        <svg className="w-8 h-8 text-muted flex-shrink-0"><use href={iconHref}></use></svg>
                        <span className="text-sm text-secondary truncate">{msg.analysisFile.name}</span>
                    </div>
                );
            }
        } else if (msg.imageUrl && !msg.imageUrls) {
            content = <img src={msg.imageUrl} alt="Uploaded content" className="rounded-lg max-w-xs max-h-48" />;
        } else if (msg.imageUrls) {
            content = (
                <div className={`grid gap-2 ${msg.imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {msg.imageUrls.map((url, index) => <img key={index} src={url} alt={`Uploaded content ${index + 1}`} className="rounded-lg w-full h-auto object-cover" />)}
                </div>
            );
        }
        return content ? <div className="mb-2">{content}</div> : null;
    }

    return (
        <div className={`flex items-start gap-3 ${messageAlignmentClass} chat-message-container`}>
            {isUser ? (
                <div className={`flex flex-col max-w-[85%] items-end`}>
                    {renderUserFilePreview(message)}
                    
                    {message.text && (!message.audioUrl || showTranscription) && (
                        <div className={`chat-message-bubble relative user-message`}>
                            <Response>{message.text}</Response>
                        </div>
                    )}

                    <div className={`chat-actions flex items-center text-sm text-muted mt-2 space-x-2 `}>
                        {message.text && !message.audioUrl && <button title="Copy" onClick={(e) => copyToClipboard(message.text, e.currentTarget)} className="p-1 hover:text-primary"><svg className="w-4 h-4"><use href="#icon-copy"></use></svg></button>}
                        {message.audioUrl && (
                            <button title={showTranscription ? "Hide transcription" : "Show transcription"} onClick={() => setShowTranscription(s => !s)} className={`p-1 hover:text-primary ${showTranscription ? 'text-primary' : ''}`}>
                                <svg className="w-4 h-4"><use href="#icon-transcribe"></use></svg>
                            </button>
                        )}
                    </div>
                </div>
            ) : ( // AI Message
                <div className={`flex flex-col max-w-[85%] items-start`}>
                    <div className={`chat-message-bubble relative ai-message`}>
                        {(!message.audioUrl || showTranscription) && message.text && (
                             <>
                                {shouldAnimate ? (
                                    partsToRender.map((part, index) => {
                                        const isCurrentlyAnimatingPart = index === renderedPartsCount - 1;
                                        if (part.type === 'text' && isCurrentlyAnimatingPart) {
                                            return <AnimatedTextPart key={index} text={part.content} onComplete={handleAnimationComplete} />;
                                        }
                                        // Render completed text parts, and all code/table parts, statically
                                        return <Response key={index}>{part.content}</Response>;
                                    })
                                ) : (
                                    <Response>{message.text}</Response>
                                )}
                            </>
                        )}

                        {message.audioUrl && (
                            <div className={showTranscription && message.text ? "mt-2" : ""}>
                                <AudioPlayer src={message.audioUrl} />
                            </div>
                        )}
                        
                        {message.analysisResult?.type === 'application/pdf' && (
                            <div className="mt-2 relative bg-hover border border-secondary rounded-lg p-3 flex items-center space-x-3 max-w-sm">
                                <svg className="w-8 h-8 text-muted flex-shrink-0"><use href="#icon-file-text"></use></svg>
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm text-primary truncate block font-medium">{message.analysisResult.name}</span>
                                    <button onClick={() => handleDownload(message.analysisResult!.url, message.analysisResult!.name)} className="text-sm font-semibold text-blue-500 hover:underline">
                                        Download PDF
                                    </button>
                                </div>
                            </div>
                        )}
                        {message.videoUrl && (
                            <div className="mt-2 relative group max-w-sm sm:max-w-md">
                                <video src={message.videoUrl} controls playsInline className="rounded-lg w-full h-auto shadow-md bg-black" />
                                <button onClick={() => handleDownload(message.videoUrl!, `lazerdsgn-generated-${Date.now()}.mp4`)} className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Download Video">
                                    <svg className="w-5 h-5"><use href="#icon-download"></use></svg>
                                </button>
                            </div>
                        )}
                        {message.imageUrl && (
                            <div className="mt-2 relative group max-w-full sm:max-w-md">
                                <button onClick={() => onImageClick?.(message.imageUrl!)} className="block w-full h-auto appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg">
                                    <img src={message.imageUrl} alt="AI generated content" className="rounded-lg w-full h-auto shadow-md" />
                                </button>
                                <button onClick={() => handleDownload(message.imageUrl!, `lazerdsgn-generated-${Date.now()}.png`)} className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Download Image">
                                    <svg className="w-5 h-5"><use href="#icon-download"></use></svg>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className={`chat-actions flex items-center text-sm text-muted mt-2 space-x-2 `}>
                        {message.text && (!message.audioUrl || showTranscription) && <button title="Copy" onClick={(e) => copyToClipboard(message.text, e.currentTarget)} className="p-1 hover:text-primary"><svg className="w-4 h-4"><use href="#icon-copy"></use></svg></button>}
                        
                        {message.audioUrl && message.text && (
                            <button title={showTranscription ? "Hide transcription" : "Show transcription"} onClick={() => setShowTranscription(s => !s)} className={`p-1 hover:text-primary ${showTranscription ? 'text-primary' : ''}`}>
                                <svg className="w-4 h-4"><use href="#icon-transcribe"></use></svg>
                            </button>
                        )}

                        <button title="Good" className="p-1 hover:text-primary"><svg className="w-4 h-4"><use href="#icon-heart"></use></svg></button>
                        <button title="Bad" className="p-1 hover:text-primary"><svg className="w-4 h-4"><use href="#icon-flag"></use></svg></button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatMessageItem;