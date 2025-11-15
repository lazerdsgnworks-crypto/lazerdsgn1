import React, { useState, useMemo, useEffect, useRef } from 'react'; // <-- THIS LINE IS FIXED
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
const AnimatedTextPart: React.FC<{ text: string }> = ({ text }) => {
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
    return <Response>{displayedText}</Response>;
};

// --- Main ChatMessageItem Component (No Changes Below) ---
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
                <div className="flex items-start justify-start">
                    <div className="chat-message-bubble bg-transparent">
                        <AnalyzingIndicator />
                    </div>
                </div>
            );

        if (isGeneratingVideo)
            return (
                <div className="flex items-start justify-start">
                    <div className="p-4 bg-muted rounded-2xl">
                        <div className="w-64 h-36 shimmer-bg flex flex-col items-center justify-center rounded-lg">
                            <svg className="w-12 h-12 text-secondary">
                                <use href="#icon-video"></use>
                            </svg>
                            <p className="mt-2 text-sm text-secondary">Crafting your video...</p>
                        </div>
                    </div>
                </div>
            );

        if (isGeneratingImage)
            return (
                <div className="flex items-start justify-start">
                    <div className="p-4 bg-muted rounded-2xl">
                        <div className="w-64 h-64 shimmer-bg flex flex-col items-center justify-center rounded-lg">
                            <svg className="w-12 h-12 text-secondary">
                                <use href="#icon-image-gen"></use>
                            </svg>
                            <p className="mt-2 text-sm text-secondary">Conjuring pixels...</p>
                        </div>
                    </div>
                </div>
            );

        // Standard "thinking" dots (before streaming begins)
        return (
            <div className="flex items-start justify-start">
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
        return (
            // This 'flex' and 'justify-end' is the core of the user message layout
            <div className={`flex items-end gap-3 ${alignment}`}>
                {/* max-w-[85%] is the key responsive constraint here */}
                <div className="group relative flex flex-col max-w-[85%] items-end">
                    {/* Add overflow-hidden here as well to ensure user message bubbles 
                      don't break layout if they also contain wide content in the future.
                    */}
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
                        {message.audioUrl && <div className="mt-2"><AudioPlayer src={message.audioUrl} /></div>}
                        {message.analysisFile && !message.imageUrl && (
                            <div className="mt-2 p-2 bg-black/20 rounded-lg flex items-center gap-2 text-sm">
                                <svg className="w-5 h-5 flex-shrink-0"><use href="#icon-file-text"></use></svg>
                                <span className="truncate">{message.analysisFile.name}</span>
                            </div>
                        )}
                    </div>
                       {message.text && (
                        <button onClick={handleCopy} className="absolute -left-10 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-hover text-muted opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy text">
                            {isCopied ? <svg className="w-4 h-4 text-green-500"><use href="#icon-check"></use></svg> : <svg className="w-4 h-4"><use href="#icon-copy"></use></svg>}
                        </button>
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
            <div className={`flex items-start ${alignment}`}>
                <div className="stop-message">
                    <svg className="w-5 h-5 flex-shrink-0"><use href="#icon-stop-square"></use></svg>
                    <span>{message.text}</span>
                </div>
            </div>
        )
    }

    return (
        // This 'flex' and 'justify-start' is the core of the AI message layout
        <div className={`flex items-start ${alignment}`}>
            {/* max-w-[85%] is the key responsive constraint here */}
            <div className="flex flex-col max-w-[85%] items-start">
                {/* --- THIS IS THE FIX ---
                  Added 'overflow-hidden' to force this div to respect its parent's
                  'max-w-[85%]' and clip any content that tries to break out.
                  This allows the 'overflow-x-auto' on the table inside to work.
                */}
                <div className={`chat-message-bubble ai-message ${message.isAnalysisResponse ? 'border-2 border-green-500/50' : ''} overflow-hidden`}>
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
                    
                    {/* This logic remains the same, but AnimatedTextPart is now smarter */}
                    {(shouldAnimate && aiText) ? (
                        <AnimatedTextPart text={aiText} />
                    ) : (aiText) ? (
                        <Response>{aiText}</Response>
                    ) : null}

                </div>
                   {message.text && !message.isStopMessage && (
                        
                        // --- This is the new button group ---
                        <div className="mt-2 flex items-center gap-3">
                            <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors" aria-label="Copy response">
                                   {isCopied ? (
                                    <>
                                        <svg className="w-3.5 h-3.5 text-green-500"><use href="#icon-check"></use></svg>
                                        <span>Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5"><use href="#icon-copy"></use></svg>
        
                                        <span>Copy</span>
                                    </>
                                )}
                            </button>

                            {/* --- Like/Dislike Buttons --- */}
                            <button 
                                onClick={handleLike} 
                                className={`p-1 rounded-full transition-colors ${isLiked ? 'text-primary bg-hover' : 'text-muted hover:text-primary hover:bg-hover'}`} 
                                aria-label="Like response"
                            >
                                <svg className="w-4 h-4">
                                    <use href="#icon-thumbs-up"></use>
                                </svg>
                            </button>

                            <button 
                                onClick={handleDislike} 
                                className={`p-1 rounded-full transition-colors ${isDisliked ? 'text-red-500 bg-red-500/10' : 'text-muted hover:text-primary hover:bg-hover'}`} 
                                aria-label="Dislike response"
                            >
                                <svg className="w-4 h-4">
                                    <use href="#icon-thumbs-down"></use>
                                </svg>
                            </button>
                            {/* --- End Like/Dislike Buttons --- */}

                        </div>
                        // --- End button group ---
                )}
            </div>
        </div>
    );
};

export default ChatMessageItem;