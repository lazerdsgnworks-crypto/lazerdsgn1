
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChatMessage, UserProfile } from '../types.ts';
import Avatar from './Avatar.tsx';
import AudioPlayer from './AudioPlayer.tsx';
import Response from './ui/Response.tsx';
import AnalyzingIndicator from './AnalyzingIndicator.tsx';

const CHAR_ANIMATION_SPEED_MS = 10;

// This regex splits the text into text parts and code/table parts
const codeTableRegex = /(```[\s\S]*?```)|((?:^\|.*\|\r?\n)+(?:^\|.*-.*\|\r?\n)(?:^\|.*\|\r?\n?)+)/gm;

// --- MODIFIED AnimatedTextPart Component ---
const AnimatedTextPart: React.FC<{ text: string; isAnalysisResponse?: boolean }> = ({ text, isAnalysisResponse }) => {
    const [displayedText, setDisplayedText] = useState('');
    const animationFrameRef = useRef<number | null>(null);
    const textRef = useRef(text);
    const indexRef = useRef(0);
    const startTimeRef = useRef<number | null>(null);

    useEffect(() => {
        textRef.current = text; 
    }, [text]);

    useEffect(() => {
        indexRef.current = 0;
        setDisplayedText('');
        startTimeRef.current = null;

        const animate = (timestamp: number) => {
            if (!startTimeRef.current) {
                startTimeRef.current = timestamp;
            }
            const elapsed = timestamp - startTimeRef.current;
            const charsToShow = Math.floor(elapsed / CHAR_ANIMATION_SPEED_MS);

            if (indexRef.current < charsToShow && indexRef.current < textRef.current.length) {
                indexRef.current = Math.min(charsToShow, textRef.current.length);
                
                const fullText = textRef.current;
                const animatedLength = indexRef.current;
                
                const parts = fullText.split(codeTableRegex).filter(Boolean);
                let newDisplayedText = "";
                let lengthSoFar = 0;

                for (const part of parts) {
                    const partLength = part.length;
                    const isCodeOrTable = part.startsWith('```') || (part.trim().startsWith('|') && /\|.*-.*\|/.test(part));

                    if (isCodeOrTable) {
                        if (animatedLength > lengthSoFar) {
                            newDisplayedText += part;
                        }
                    } else {
                        const charsToTake = Math.min(partLength, animatedLength - lengthSoFar);
                        if (charsToTake > 0) {
                            newDisplayedText += part.substring(0, charsToTake);
                        }
                    }

                    lengthSoFar += partLength;
                    
                    if (animatedLength < lengthSoFar) {
                        break;
                    }
                }
                setDisplayedText(newDisplayedText);
            }

            if (indexRef.current < textRef.current.length) {
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    return <Response isAnalysisResponse={isAnalysisResponse}>{displayedText}</Response>;
};

const AnalysisResultBox: React.FC<{ result: Required<ChatMessage>['analysisResult'] }> = ({ result }) => {
    const downloadText = useMemo(() => {
        const name = result.name.toLowerCase();
        if (name.endsWith('.pdf')) return 'Download Pdf';
        if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'Download Image';
        if (name.endsWith('.zip')) return 'Download Zip';
        return 'Download File';
    }, [result.name]);

    return (
        <a
            href={result.url}
            download={result.name}
            className="mb-2 p-3 rounded-2xl border border-secondary flex items-center justify-start gap-3 hover:bg-hover transition-colors group"
            title={`Download ${result.name}`}
        >
            <div className="flex-shrink-0 w-10 h-10 bg-secondary rounded-full flex items-center justify-center border border-primary group-hover:border-secondary transition-colors">
                <svg className="w-5 h-5 text-primary"><use href="#icon-download"></use></svg>
            </div>
            <p className="text-sm font-semibold text-primary">{downloadText}</p>
        </a>
    );
};

const DownloadCard: React.FC<{ url: string; fileName: string; type: 'pdf' | 'word' | 'generic' }> = ({ url, fileName, type }) => {
    let iconId = '#icon-file-text'; // Default for PDF/Generic
    let iconBg = 'bg-red-500/10';
    let iconColor = 'text-red-500';
    let borderColor = 'border-red-500/20';
    let label = 'PDF FILE';

    if (type === 'word') {
        iconId = '#icon-file-word';
        iconBg = 'bg-blue-500/10';
        iconColor = 'text-blue-500';
        borderColor = 'border-blue-500/20';
        label = 'WORD FILE';
    } else if (type === 'pdf') {
        iconId = '#icon-file-text';
        iconBg = 'bg-red-500/10';
        iconColor = 'text-red-500';
        borderColor = 'border-red-500/20';
        label = 'PDF FILE';
    } else {
        iconId = '#icon-download';
        iconBg = 'bg-neutral-500/10';
        iconColor = 'text-neutral-400';
        borderColor = 'border-neutral-800';
        label = 'FILE DOWNLOAD';
    }

    return (
        <a
            href={url}
            download={fileName} 
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-4 p-4 mb-3 rounded-xl bg-secondary border ${borderColor} transition-all duration-300 hover:bg-hover hover:scale-[1.01] w-full max-w-md no-underline`}
        >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconBg} ${iconColor} flex-shrink-0`}>
                <svg className="w-6 h-6"><use href={iconId}></use></svg>
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-primary truncate" title={fileName}>{fileName}</h4>
                <p className="text-xs text-secondary font-medium mt-0.5 uppercase tracking-wide">{label}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-accent text-on-primary-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 shadow-lg">
                <svg className="w-5 h-5"><use href="#icon-download"></use></svg>
            </div>
        </a>
    );
};

const getFileIconId = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['doc', 'docx'].includes(ext || '')) return '#icon-file-word';
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return '#icon-file-sheet';
    if (['pdf'].includes(ext || '')) return '#icon-file-text';
    return '#icon-paperclip';
};

// --- EXISTING: Enhanced File Preview Card (Outside Bubble Style) ---
const FilePreviewCard: React.FC<{ fileName: string }> = ({ fileName }) => {
    const iconId = getFileIconId(fileName);
    const ext = fileName.split('.').pop()?.toLowerCase() || 'file';
    
    let iconBg = 'bg-neutral-800';
    let iconColor = 'text-neutral-400';
    
    if (['doc', 'docx'].includes(ext)) {
        iconBg = 'bg-blue-500/20';
        iconColor = 'text-blue-400';
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
        iconBg = 'bg-green-500/20';
        iconColor = 'text-green-400';
    } else if (['pdf'].includes(ext)) {
        iconBg = 'bg-red-500/20';
        iconColor = 'text-red-400';
    }

    return (
        <div className="group flex items-center p-3 pr-6 rounded-2xl bg-secondary border border-primary max-w-xs cursor-default transition-transform hover:scale-[1.02]">
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} ${iconColor} transition-colors`}>
                <svg className="w-6 h-6"><use href={iconId}></use></svg>
            </div>
            <div className="ml-3 min-w-0 flex flex-col justify-center text-left">
                <span className="text-sm font-semibold text-primary truncate w-full leading-tight" title={fileName}>{fileName}</span>
                <span className="text-[10px] font-medium text-secondary tracking-wide uppercase mt-0.5">{ext.toUpperCase()} File</span>
            </div>
        </div>
    );
};

// --- NEW: Image Preview Card (Matches FilePreviewCard Design) ---
const ImagePreviewCard: React.FC<{ url: string; fileName?: string; onClick?: () => void }> = ({ url, fileName = 'Image', onClick }) => {
    return (
        <div 
            onClick={onClick}
            className="group flex items-center p-3 pr-6 rounded-2xl bg-secondary border border-primary max-w-xs cursor-pointer transition-transform hover:scale-[1.02]"
        >
            {/* Thumbnail Container */}
            <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700/50 relative">
                <img src={url} alt={fileName} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
            </div>
            {/* Text Info */}
            <div className="ml-3 min-w-0 flex flex-col justify-center text-left">
                <span className="text-sm font-semibold text-primary truncate w-full leading-tight" title={fileName}>
                    {fileName}
                </span>
                <span className="text-[10px] font-medium text-secondary tracking-wide uppercase mt-0.5">
                    Image File
                </span>
            </div>
        </div>
    );
};

// --- NEW: Video Preview Card ---
const VideoPreviewCard: React.FC<{ url: string; fileName?: string; onClick?: () => void }> = ({ url, fileName = 'Video', onClick }) => {
    return (
        <div 
            className="group flex items-center p-3 pr-6 rounded-2xl bg-secondary border border-primary max-w-xs cursor-default transition-transform hover:scale-[1.02]"
        >
            <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700/50 relative flex items-center justify-center">
                 <svg className="w-5 h-5 text-white"><use href="#icon-video"></use></svg>
            </div>
            <div className="ml-3 min-w-0 flex flex-col justify-center text-left">
                <span className="text-sm font-semibold text-primary truncate w-full leading-tight" title={fileName}>
                    {fileName}
                </span>
                <span className="text-[10px] font-medium text-secondary tracking-wide uppercase mt-0.5">
                    Video File
                </span>
            </div>
        </div>
    );
};

// Helper to extract a display name from a URL
const getFileNameFromUrl = (url: string) => {
    try {
        const name = url.split('/').pop()?.split('?')[0];
        return decodeURIComponent(name || 'File');
    } catch {
        return 'File';
    }
};

// --- Main ChatMessageItem Component ---
const ChatMessageItem: React.FC<{
    message: ChatMessage;
    isLoading?: boolean;
    isStreaming: boolean;
    isGeneratingImage?: boolean;
    isGeneratingVideo?: boolean;
    isAnalyzing?: boolean;
    userProfile: UserProfile | null;
    animatedMessageIds: React.MutableRefObject<Set<string>>;
    onImageClick?: (url: string) => void;
}> = ({
    message,
    isLoading,
    isStreaming,
    isGeneratingImage,
    isGeneratingVideo,
    isAnalyzing,
    userProfile,
    animatedMessageIds,
    onImageClick,
}) => {
    const isUser = message.role === 'user';
    const [isCopied, setIsCopied] = useState(false);
    
    // State for like/dislike buttons
    const [isLiked, setIsLiked] = useState(false);
    const [isDisliked, setIsDisliked] = useState(false);

    const handleCopy = () => {
        if (!message.text || isCopied) return;
        navigator.clipboard.writeText(message.text).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    const handleLike = () => {
        setIsLiked(prev => !prev);
        if (isDisliked) setIsDisliked(false);
        console.log("Feedback: Like");
    };

    const handleDislike = () => {
        setIsDisliked(prev => !prev);
        if (isLiked) setIsLiked(false);
        console.log("Feedback: Dislike");
    };

    if (isLoading) {
        if (isAnalyzing)
            return (
                <div className="flex items-start justify-start animate-geminiFadeIn">
                    <div className="chat-message-bubble bg-transparent">
                        <AnalyzingIndicator />
                    </div>
                </div>
            );

        if (isGeneratingVideo)
            return (
                <div className="flex items-start justify-start animate-geminiFadeIn">
                      <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-secondary shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                        <div className="w-72 h-40 flex flex-col items-center justify-center relative z-10 bg-black/20 backdrop-blur-sm">
                             <div className="relative">
                                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                                <svg className="w-12 h-12 text-blue-400 relative z-10 animate-pulse-glow"><use href="#icon-video"></use></svg>
                             </div>
                             <p className="mt-4 text-sm font-semibold text-blue-200 flex items-center gap-2">
                                Rendering Video
                                <svg className="w-4 h-4 animate-spin text-blue-400"><use href="#icon-spinner"></use></svg>
                             </p>
                        </div>
                         <div className="absolute top-0 bottom-0 left-0 w-2 border-r border-blue-500/10 flex flex-col gap-1 py-1">
                            {Array.from({length: 8}).map((_, i) => <div key={i} className="w-1 h-3 bg-blue-500/20 rounded-r-sm mx-auto"></div>)}
                         </div>
                         <div className="absolute top-0 bottom-0 right-0 w-2 border-l border-blue-500/10 flex flex-col gap-1 py-1">
                            {Array.from({length: 8}).map((_, i) => <div key={i} className="w-1 h-3 bg-blue-500/20 rounded-l-sm mx-auto"></div>)}
                         </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent -skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
                    </div>
                </div>
            );

        if (isGeneratingImage)
            return (
                <div className="flex items-start justify-start animate-geminiFadeIn">
                    <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-secondary shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(59,130,246,0.1)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] animate-shimmer"></div>
                        <div className="w-72 h-72 flex flex-col items-center justify-center relative z-10 bg-black/20 backdrop-blur-sm">
                             <div className="relative">
                                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                                <svg className="w-12 h-12 text-blue-400 relative z-10 animate-pulse-glow"><use href="#icon-image-gen"></use></svg>
                             </div>
                             <div className="mt-6 space-y-2 text-center">
                                <p className="text-sm font-semibold text-blue-200">Generating Image</p>
                                <div className="flex gap-1 justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50 animate-bounce" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            );

        return (
            <div className="flex items-start justify-start animate-geminiFadeIn">
                <div className="chat-message-bubble bg-secondary">
                    <div className="typing-indicator p-2 flex items-center space-x-1.5">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        );
    }

    const alignment = isUser ? "justify-end" : "justify-start";

    if (isUser) {
        const hasText = !!message.text;
        const hasImages = message.imageUrls && message.imageUrls.length > 0;
        const hasLegacyImage = message.imageUrl && !message.imageUrls;
        // If we have analysisFile but NO preview image (like for docs/sheets), render the card
        const hasFileCard = message.analysisFile && !message.imageUrl;
        const hasVideo = !!message.videoUrl;

        // HasBubbleContent logic updated: we now show images OUTSIDE, so bubble only needs text
        const hasBubbleContent = hasText; 

        return (
            <div className={`flex items-end gap-3 ${alignment} animate-geminiFadeIn`}>
                <div className="group flex flex-col max-w-[85%] items-end gap-2">
                    
                    {/* 1. Render Image Previews (Card Style) */}
                    {hasImages && message.imageUrls!.map((url, i) => (
                        <ImagePreviewCard 
                            key={i} 
                            url={url} 
                            fileName={getFileNameFromUrl(url)} 
                            onClick={() => onImageClick?.(url)} 
                        />
                    ))}
                    {hasLegacyImage && (
                        <ImagePreviewCard 
                            url={message.imageUrl!} 
                            fileName={getFileNameFromUrl(message.imageUrl!)} 
                            onClick={() => onImageClick?.(message.imageUrl!)} 
                        />
                    )}

                    {/* 2. Render Video Preview (Card Style) */}
                    {hasVideo && (
                        <VideoPreviewCard
                            url={message.videoUrl!}
                            fileName={getFileNameFromUrl(message.videoUrl!)}
                        />
                    )}

                    {/* 3. Render File Preview (Card Style) */}
                    {hasFileCard && (
                        <FilePreviewCard fileName={message.analysisFile!.name} />
                    )}

                    {/* 4. Render Text Bubble */}
                    {hasBubbleContent && (
                        <div className="relative">
                            <div className="chat-message-bubble user-message overflow-hidden">
                                <Response>{message.text}</Response>
                            </div>
                            <button onClick={handleCopy} className="absolute -left-10 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-hover text-muted opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy text">
                                {isCopied ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-500">
                                        <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                )}
                            </button>
                        </div>
                    )}

                    {message.audioUrl && (
                        <div className={hasBubbleContent ? "mt-2" : ""}>
                            <AudioPlayer src={message.audioUrl} />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const aiText = message.text || "";
    const hasAnimated = animatedMessageIds.current.has(message.id);
    const shouldAnimate = isStreaming;

    useEffect(() => {
        if (!isStreaming && !hasAnimated && aiText) {
            animatedMessageIds.current.add(message.id);
        }
    }, [message.id, isStreaming, hasAnimated, animatedMessageIds, aiText]);
    
    if (message.isStopMessage) {
        return (
            <div className={`flex items-start ${alignment} animate-geminiFadeIn`}>
                <div className="stop-message">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6-6 6zm3-8H9v4h6V10z"/>
                    </svg>
                    <span>{message.text}</span>
                </div>
            </div>
        )
    }

    return (
        <div className={`flex items-start ${alignment} animate-geminiFadeIn`}>
            <div className="flex flex-col max-w-[85%] items-start">
                <div className={`chat-message-bubble ai-message overflow-hidden`}>
                    {message.videoUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden shadow-lg">
                            <video src={message.videoUrl} controls playsInline className="w-full h-auto" />
                        </div>
                    )}
                    {message.imageUrl && (
                        <img src={message.imageUrl} alt="Generated content" className="mb-2 rounded-xl shadow-lg cursor-pointer" onClick={() => onImageClick?.(message.imageUrl!)} />
                    )}
                    {message.audioUrl && (
                        <div className="mb-2"><AudioPlayer src={message.audioUrl} /></div>
                    )}
                    
                    {/* New Download Cards */}
                    {message.analysisPdf && (
                        <DownloadCard url={message.analysisPdf.url} fileName={message.analysisPdf.name} type="pdf" />
                    )}
                    {message.analysisWord && (
                        <DownloadCard url={message.analysisWord.url} fileName={message.analysisWord.name} type="word" />
                    )}
                    
                    {message.analysisResult && <AnalysisResultBox result={message.analysisResult} />}
                    
                    {(shouldAnimate && aiText) ? (
                        <AnimatedTextPart text={aiText} isAnalysisResponse={message.isAnalysisResponse} />
                    ) : (aiText) ? (
                        <Response isAnalysisResponse={message.isAnalysisResponse}>{aiText}</Response>
                    ) : null}

                </div>
                    {message.text && !message.isStopMessage && (
                        
                        <div className="mt-2 flex items-center gap-2">
                            <button 
                                onClick={handleCopy} 
                                className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-hover transition-all duration-200"
                                aria-label="Copy response"
                                title="Copy to clipboard"
                            >
                                {isCopied ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                )}
                            </button>

                            <button 
                                onClick={handleLike} 
                                className={`p-1.5 rounded-lg transition-all duration-200 ${isLiked ? 'text-blue-500 bg-blue-500/10' : 'text-muted hover:text-primary hover:bg-hover'}`} 
                                aria-label="Like response"
                                title="Good response"
                            >
                                {isLiked ? (
                                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="transform scale-110"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                ) : (
                                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                )}
                            </button>

                            <button 
                                onClick={handleDislike} 
                                className={`p-1.5 rounded-lg transition-all duration-200 ${isDisliked ? 'text-red-500 bg-red-500/10' : 'text-muted hover:text-primary hover:bg-hover'}`} 
                                aria-label="Dislike response"
                                title="Bad response"
                            >
                                 {isDisliked ? (
                                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="transform scale-110"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                                )}
                            </button>
                        </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessageItem;
