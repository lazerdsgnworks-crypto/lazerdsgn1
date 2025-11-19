
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
// This component now animates text parts and renders code/tables instantly.
const AnimatedTextPart: React.FC<{ text: string; isAnalysisResponse?: boolean }> = ({ text, isAnalysisResponse }) => {
    const [displayedText, setDisplayedText] = useState('');
    const animationFrameRef = useRef<number | null>(null);
    const textRef = useRef(text);
    const indexRef = useRef(0);
    const startTimeRef = useRef<number | null>(null);

    // This hook correctly keeps the ref updated with the *latest*
    // full text from the stream.
    useEffect(() => {
        textRef.current = text; 
    }, [text]);

    // This hook runs the animation.
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

            // Use the ref (textRef.current) to get the *latest* full text
            if (indexRef.current < charsToShow && indexRef.current < textRef.current.length) {
                indexRef.current = Math.min(charsToShow, textRef.current.length);
                
                // --- NEW LOGIC to build the displayed string ---
                const fullText = textRef.current;
                const animatedLength = indexRef.current;
                
                const parts = fullText.split(codeTableRegex).filter(Boolean);
                let newDisplayedText = "";
                let lengthSoFar = 0;

                for (const part of parts) {
                    const partLength = part.length;
                    // Check if the part is code or a table
                    const isCodeOrTable = part.startsWith('```') || (part.trim().startsWith('|') && /\|.*-.*\|/.test(part));

                    if (isCodeOrTable) {
                        // If animation has reached this block, display all of it instantly
                        if (animatedLength > lengthSoFar) {
                            newDisplayedText += part;
                        }
                    } else {
                        // This is a text part. Animate it.
                        const charsToTake = Math.min(partLength, animatedLength - lengthSoFar);
                        if (charsToTake > 0) {
                            newDisplayedText += part.substring(0, charsToTake);
                        }
                    }

                    lengthSoFar += partLength;
                    
                    // If the animation hasn't reached the end of this part, stop building.
                    if (animatedLength < lengthSoFar) {
                        break;
                    }
                }
                setDisplayedText(newDisplayedText);
                // --- END NEW LOGIC ---
            }

            // Continue animating as long as we haven't reached the end
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
    }, []); // <-- This empty array is still correct and necessary

    // This single <Response> component receives the intelligently-built string,
    // ensuring lists and other markdown elements render correctly.
    return <Response isAnalysisResponse={isAnalysisResponse}>{displayedText}</Response>;
};

const AnalysisResultBox: React.FC<{ result: Required<ChatMessage>['analysisResult'] }> = ({ result }) => {
    // Determine a user-friendly file type from the name
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


// --- Main ChatMessageItem Component (Icons Updated Below) ---
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
    const [showTranscription, setShowTranscription] = useState(false);
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

    // Handlers for like/dislike. You can add feedback logic here.
    const handleLike = () => {
        setIsLiked(prev => !prev);
        if (isDisliked) setIsDisliked(false);
        // TODO: Add logic to send feedback
        console.log("Feedback: Like");
    };

    const handleDislike = () => {
        setIsDisliked(prev => !prev);
        if (isLiked) setIsLiked(false);
        // TODO: Add logic to send feedback
        console.log("Feedback: Dislike");
    };

    /* ---------------------------------------------------------------------- */
    /* Loading states                                                         */
    /* ---------------------------------------------------------------------- */

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
                        {/* Film strip edge effect */}
                         <div className="absolute top-0 bottom-0 left-0 w-2 border-r border-blue-500/10 flex flex-col gap-1 py-1">
                            {Array.from({length: 8}).map((_, i) => <div key={i} className="w-1 h-3 bg-blue-500/20 rounded-r-sm mx-auto"></div>)}
                         </div>
                         <div className="absolute top-0 bottom-0 right-0 w-2 border-l border-blue-500/10 flex flex-col gap-1 py-1">
                            {Array.from({length: 8}).map((_, i) => <div key={i} className="w-1 h-3 bg-blue-500/20 rounded-l-sm mx-auto"></div>)}
                         </div>
                         {/* Moving light effect */}
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

        // Standard "thinking" dots (before streaming begins)
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

    /* ---------------------------------------------------------------------- */
    /* Actual Message Rendering                                               */
    /* ---------------------------------------------------------------------- */

    const alignment = isUser ? "justify-end" : "justify-start";

    /* -------------------------- User Message ------------------------------- */

    if (isUser) {
        const hasContent = message.text || (message.imageUrls && message.imageUrls.length > 0) || (message.imageUrl && !message.imageUrls) || (message.analysisFile && !message.imageUrl);

        return (
            <div className={`flex items-end gap-3 ${alignment} animate-geminiFadeIn`}>
                <div className="group flex flex-col max-w-[85%] items-end">
                    {hasContent && (
                        <div className="relative">
                            <div className="chat-message-bubble user-message overflow-hidden">
                                {message.imageUrls && message.imageUrls.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        {message.imageUrls.map((url, i) => (
                                            <img key={i} src={url} alt={`upload ${i}`} className="rounded-lg object-cover cursor-pointer" onClick={() => onImageClick?.(url)} />
                                        ))}
                                    </div>
                                )}
                                {message.imageUrl && !message.imageUrls && (
                                    <img src={message.imageUrl} alt="analysis file preview" className="rounded-lg mb-2 object-cover cursor-pointer" onClick={() => onImageClick?.(message.imageUrl!)} />
                                )}
                                {message.text && <Response>{message.text}</Response>}
                                {message.analysisFile && !message.imageUrl && (
                                    <div className="mt-2 p-2 bg-black/20 rounded-lg flex items-center gap-2 text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                                        </svg>
                                        <span className="truncate">{message.analysisFile.name}</span>
                                    </div>
                                )}
                            </div>
                            {message.text && (
                                <button onClick={handleCopy} className="absolute -left-10 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-hover text-muted opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy text">
                                    {isCopied ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-500">
                                            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Audio Player rendered outside the white message bubble */}
                    {message.audioUrl && (
                        <div className={hasContent ? "mt-2" : ""}>
                            <AudioPlayer src={message.audioUrl} />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* ----------------------------- AI Message ------------------------------ */

    const aiText = message.text || "";
    const hasAnimated = animatedMessageIds.current.has(message.id);
    const shouldAnimate = isStreaming;

    useEffect(() => {
        // Once the stream is done, mark this message as "animated"
        if (!isStreaming && !hasAnimated && aiText) {
            animatedMessageIds.current.add(message.id);
        }
    }, [message.id, isStreaming, hasAnimated, animatedMessageIds, aiText]);
    
    if (message.isStopMessage) {
        return (
            <div className={`flex items-start ${alignment} animate-geminiFadeIn`}>
                <div className="stop-message">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm3-8H9v4h6V10z"/>
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
                    {message.analysisResult && <AnalysisResultBox result={message.analysisResult} />}
                    
                    {(shouldAnimate && aiText) ? (
                        <AnimatedTextPart text={aiText} isAnalysisResponse={message.isAnalysisResponse} />
                    ) : (aiText) ? (
                        <Response isAnalysisResponse={message.isAnalysisResponse}>{aiText}</Response>
                    ) : null}

                </div>
                    {message.text && !message.isStopMessage && (
                        
                        // --- AI BUTTON GROUP UPDATED ---
                        <div className="mt-2 flex items-center gap-2">
                            
                            {/* 1. AI "Copy" Button */}
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

                            {/* 2. "Like" Button */}
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

                            {/* 3. "Dislike" Button */}
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
