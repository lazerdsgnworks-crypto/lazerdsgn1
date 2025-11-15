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
                    <div className="p-4 bg-muted rounded-2xl">
                        <div className="w-64 h-36 shimmer-bg flex flex-col items-center justify-center rounded-lg">
                            <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-secondary">
                                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                            </svg>
                            <p className="mt-2 text-sm text-secondary">Crafting your video...</p>
                        </div>
                    </div>
                </div>
            );

        if (isGeneratingImage)
            return (
                <div className="flex items-start justify-start animate-geminiFadeIn">
                    <div className="p-4 bg-muted rounded-2xl">
                        <div className="w-64 h-64 shimmer-bg flex flex-col items-center justify-center rounded-lg">
                            <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-secondary">
                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                            </svg>
                            <p className="mt-2 text-sm text-secondary">Conjuring pixels...</p>
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
        return (
            <div className={`flex items-end gap-3 ${alignment} animate-geminiFadeIn`}>
                <div className="group relative flex flex-col max-w-[85%] items-end">
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
                                <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                                </svg>
                                <span className="truncate">{message.analysisFile.name}</span>
                            </div>
                        )}
                    </div>
                        {message.text && (
                            <button onClick={handleCopy} className="absolute -left-10 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-hover text-muted opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy text">
                                {/* --- ICON SIZE INCREASED --- */}
                                {isCopied ? (
                                    <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-500">
                                        <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                                    </svg>
                                ) : (
                                    <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 640 640" fill="currentColor" className="w-5 h-5">
                                        <path d="M288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448L480 448C515.3 448 544 419.3 544 384L544 183.4C544 166 536.9 149.3 524.3 137.2L466.6 81.8C454.7 70.4 438.8 64 422.3 64L288 64zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L352 496L352 512L160 512L160 256L176 256L176 192L160 192z"/>
                                    </svg>
                                )}
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
            <div className={`flex items-start ${alignment} animate-geminiFadeIn`}>
                <div className="stop-message">
                    <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
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
                        <div className="mt-2 flex items-center gap-3">
                            
                            {/* 1. AI "Copy" Button */}
                            <button 
                                onClick={handleCopy} 
                                className={`p-1 rounded-full transition-colors ${isCopied ? 'text-green-500' : 'text-muted hover:text-primary hover:bg-hover'}`} 
                                aria-label="Copy response"
                            >
                                {/* --- ICON SIZE INCREASED --- */}
                                {isCopied ? (
                                    <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                                    </svg>
                                ) : (
                                    <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 640 640" fill="currentColor" className="w-5 h-5">
                                        <path d="M288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448L480 448C515.3 448 544 419.3 544 384L544 183.4C544 166 536.9 149.3 524.3 137.2L466.6 81.8C454.7 70.4 438.8 64 422.3 64L288 64zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L352 496L352 512L160 512L160 256L176 256L176 192L160 192z"/>
                                    </svg>
                                )}
                            </button>

                            {/* 2. "Like" Button */}
                            <button 
                                onClick={handleLike} 
                                className={`p-1 rounded-full transition-colors ${isLiked ? 'text-primary bg-hover' : 'text-muted hover:text-primary hover:bg-hover'}`} 
                                aria-label="Like response"
                            >
                                {/* --- ICON SIZE INCREASED --- */}
                                <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 640 640" fill="currentColor" className="w-5 h-5">
                                    <path d="M235.5 102.8C256.3 68 300.5 54 338 71.6L345.2 75.4C380 96.3 394 140.5 376.4 178L376.4 178L362.3 208L472 208L479.4 208.4C515.7 212.1 544 242.8 544 280C544 293.2 540.4 305.4 534.2 316C540.3 326.6 543.9 338.8 544 352C544 370.3 537.1 386.8 526 399.5C527.3 404.8 528 410.3 528 416C528 441.1 515.1 463 495.8 475.9C493.9 511.4 466.4 540.1 431.4 543.6L424 544L319.9 544C301.9 544 284 540.6 267.3 534.1L260.2 531.1L259.5 530.8L252.9 527.6L252.2 527.3L240 520.8C227.7 514.3 216.7 506.1 207.1 496.7C203 523.6 179.8 544.1 151.8 544.1L119.8 544.1C88.9 544.1 63.8 519 63.8 488.1L64 264C64 233.1 89.1 208 120 208L152 208C162.8 208 172.9 211.1 181.5 216.5L231.6 110L232.2 108.8L234.9 103.8L235.5 102.9zM120 256C115.6 256 112 259.6 112 264L112 488C112 492.4 115.6 496 120 496L152 496C156.4 496 160 492.4 160 488L160 264C160 259.6 156.4 256 152 256L120 256zM317.6 115C302.8 108.1 285.3 113.4 276.9 127L274.7 131L217.9 251.9C214.4 259.4 212.4 267.4 211.9 275.6L211.8 279.8L211.8 392.7L212 400.6C214.4 433.3 233.4 462.7 262.7 478.3L274.2 484.4L280.5 487.5C292.9 493.1 306.3 496 319.9 496L424 496L426.4 495.9C438.5 494.7 448 484.4 448 472L447.8 469.4C447.7 468.5 447.6 467.7 447.4 466.8C444.7 454.7 451.7 442.6 463.4 438.8C473.1 435.7 480 426.6 480 416C480 411.7 478.9 407.8 476.9 404.2C470.6 393.1 474.1 379 484.9 372.2C491.7 367.9 496.1 360.4 496.1 352C496.1 344.9 493 338.5 487.9 334C482.7 329.4 479.7 322.9 479.7 316C479.7 309.1 482.7 302.6 487.9 298C493 293.5 496.1 287.1 496.1 280L496 277.6C494.9 266.3 485.9 257.3 474.6 256.2L472.2 256.1L324.7 256.1C316.5 256.1 308.9 251.9 304.5 245C300.1 238.1 299.5 229.3 303 221.9L333 157.6C340 142.6 334.4 124.9 320.5 116.6L317.6 115z"/>
                                </svg>
                            </button>

                            {/* 3. "Dislike" Button */}
                            <button 
                                onClick={handleDislike} 
                                className={`p-1 rounded-full transition-colors ${isDisliked ? 'text-red-500 bg-red-500/10' : 'text-muted hover:text-primary hover:bg-hover'}`} 
                                aria-label="Dislike response"
                            >
                                {/* --- ICON SIZE INCREASED --- */}
                                <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 640 640" fill="currentColor" className="w-5 h-5">
                                    <path d="M424 96L431.4 96.4C466.4 100 493.9 128.6 495.8 164.1C513.6 175.9 525.9 195.5 527.8 218L528 224C528 229.7 527.3 235.2 526 240.5C536.2 252 542.8 266.8 543.8 283.2L544 288C544 301.2 540.4 313.4 534.2 324C539.1 332.4 542.4 341.9 543.5 352L543.9 360C543.9 397.3 515.6 427.9 479.3 431.6L471.9 432L362.2 432L376.3 462L379.4 469.6C391.9 505.3 377.6 545.1 345.2 564.6L338 568.5C300.5 586.1 256.3 572.1 235.4 537.3L234.8 536.4L232.1 531.4L231.5 530.2L201.4 466.2C192 484 173.4 496.1 151.9 496.1L119.9 496.1C89 496.1 63.9 471 63.9 440.1L64 216C64 185.1 89.1 160 120 160L152 160C164.4 160 175.9 164.1 185.2 171C198.4 149.6 217.2 131.6 240.2 119.4L252.4 112.9L253.1 112.6L259.7 109.4L260.4 109.1L267.5 106.1C284.2 99.5 302 96.2 320.1 96.2L424 96zM319.9 144C307.9 144 296 146.3 284.8 150.6L280.1 152.6L274.8 155.2L274.8 155.2L262.6 161.7C233.4 177.2 214.3 206.6 211.9 239.3L211.7 247.3L211.7 360.2L211.8 364.3C212.3 372.5 214.3 380.5 217.8 388L274.6 508.9L276.7 512.7C285.1 526.4 302.7 531.8 317.5 524.9L320.4 523.3C333.4 515.5 339.1 499.6 334.1 485.3L332.9 482.3L302.7 418.1C299.2 410.7 299.8 402 304.2 395C308.6 388 316.2 383.9 324.4 383.9L471.9 383.9L474.3 383.8C485.6 382.7 494.6 373.7 495.7 362.4L495.8 359.9C495.8 352.8 492.7 346.4 487.6 341.9C482.4 337.3 479.4 330.8 479.4 323.9C479.4 317 482.4 310.5 487.6 305.9C492 302 495 296.6 495.6 290.6L495.8 287.9C495.8 279.5 491.4 272 484.6 267.7C473.9 260.8 470.4 246.8 476.6 235.7C478.1 233.1 479.1 230.1 479.5 227.1L479.7 223.9C479.7 213.3 472.8 204.3 463.1 201.1C451.4 197.3 444.4 185.2 447.1 173.1C447.3 172.2 447.4 171.3 447.5 170.5L447.7 167.9C447.7 155.5 438.2 145.3 426.1 144.1L424 144L319.9 144zM120 208C115.6 208 112 211.6 112 216L112 440C112 444.4 115.6 448 120 448L152 448C156.4 448 160 444.4 160 440L160 216C160 211.6 156.4 208 152 208L120 208z"/>
                                </svg>
                            </button>
                        </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessageItem;