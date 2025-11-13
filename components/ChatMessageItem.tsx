

import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage } from '../types.ts';
import AudioPlayer from './AudioPlayer.tsx';
import Response from './ui/Response.tsx';
import AnalyzingIndicator from './AnalyzingIndicator.tsx';

// NEW: A component to handle character-by-character animation for plain text.
// It tracks the previously rendered text to only animate the new "diff".
// FIX: Refactored to use a simpler, more idiomatic React approach for character-by-character animation.
// This avoids complex recursive setTimeout calls within useEffect that may have caused a misleading compile error.
const AnimatedTextPart: React.FC<{ children: string }> = ({ children: text }) => {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        // If the incoming text is not an extension of the current text, just snap to the new text.
        // This handles cases where the stream might correct itself or text is replaced.
        if (displayedText.length > text.length || !text.startsWith(displayedText)) {
            setDisplayedText(text);
            return;
        }

        // Animate the new portion of the text
        if (displayedText.length < text.length) {
            const timeoutId = setTimeout(() => {
                // Append one character from the target text
                setDisplayedText(text.slice(0, displayedText.length + 1));
            }, 10); // Typing speed

            // Cleanup function to clear the timeout if the component unmounts or text changes
            return () => clearTimeout(timeoutId);
        }
    }, [text, displayedText]);
    
    // Using Response component ensures markdown within the animated text is rendered correctly.
    return <Response>{displayedText}</Response>;
};

// NEW: A component to parse the AI's response and decide what to animate and what to render directly.
const StreamingResponseRenderer: React.FC<{ text: string }> = ({ text }) => {
    // Regex to split the text by complete code blocks.
    const codeBlockRegex = /(```(?:[a-zA-Z]+)?\n[\s\S]*?\n```)/g;
    const parts = text.split(codeBlockRegex);

    return (
        <>
            {parts.map((part, index) => {
                if (!part) return null;

                // If a part is a complete code block, render it instantly using the Response component.
                if (part.startsWith('```')) {
                    return <Response key={index}>{part}</Response>;
                }
                
                // For other parts, check for tables. Render them instantly.
                // An incomplete code block will be treated as plain text and animated here,
                // which is acceptable as it will flash into a formatted block once complete.
                const tableRegex = /((?:^\|.*\|\r?\n)+(?:^\|.*-.*\|\r?\n)(?:^\|.*\|\r?\n?)+)/gm;
                const tableParts = part.split(tableRegex);

                return (
                    <React.Fragment key={index}>
                        {tableParts.map((subPart, subIndex) => {
                            if (!subPart) return null;
                            const isTable = subPart.trim().startsWith('|') && /\|.*-.*\|/.test(subPart);
                            
                            if (isTable) {
                                return <Response key={`${index}-${subIndex}`}>{subPart}</Response>;
                            }
                            // The rest is plain text, animate it.
                            return <AnimatedTextPart key={`${index}-${subIndex}`}>{subPart}</AnimatedTextPart>;
                        })}
                    </React.Fragment>
                );
            })}
        </>
    );
};


const ChatMessageItem: React.FC<{ 
    message: ChatMessage, 
    isLoading?: boolean, 
    isStreaming: boolean,
    isGeneratingImage?: boolean, 
    isGeneratingVideo?: boolean, 
    isAnalyzing?: boolean,
    userProfile: UserProfile | null,
    animatedMessageIds: React.MutableRefObject<Set<string>>,
    onImageClick?: (url: string) => void;
}> = ({ message, isLoading, isStreaming, isGeneratingImage, isGeneratingVideo, isAnalyzing, userProfile, animatedMessageIds, onImageClick }) => {
    const isUser = message.role === 'user';
    const [showTranscription, setShowTranscription] = useState(false);

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

    if (message.isStopMessage) {
        return (
            <div className={`flex items-start gap-3 justify-start chat-message-container`}>
                <div className="stop-message">
                    <svg className="w-4 h-4 flex-shrink-0"><use href="#icon-stop-square"></use></svg>
                    <span>{message.text}</span>
                </div>
            </div>
        );
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
                (() => {
                    const urlRegex = /(https?:\/\/[^\s]+)/;
                    const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/;
                    let analysisLinkInfo: { url: string; name: string } | null = null;
                    let remainingText = message.text || '';

                    if (message.isAnalysisResponse && message.text) {
                        const markdownMatch = remainingText.match(markdownLinkRegex);
                        if (markdownMatch) {
                            analysisLinkInfo = { url: markdownMatch[2], name: markdownMatch[1] };
                            remainingText = remainingText.replace(markdownLinkRegex, '').trim();
                        } else {
                            const urlMatch = remainingText.match(urlRegex);
                            if (urlMatch) {
                                const url = urlMatch[0];
                                let name = 'Download File';
                                let isValidUrl = false;
                                try {
                                    const urlObj = new URL(url);
                                    const pathname = urlObj.pathname;
                                    const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
                                    if (filename) {
                                        name = decodeURIComponent(filename);
                                    }
                                    isValidUrl = true;
                                } catch (e) {
                                    // Not a valid URL, do nothing
                                }
                                if (isValidUrl) {
                                    analysisLinkInfo = { url: url, name: name };
                                    remainingText = remainingText.replace(urlRegex, '').trim();
                                }
                            }
                        }
                    }

                    return (
                        <div className={`flex flex-col max-w-[85%] items-start`}>
                            <div className={`chat-message-bubble relative ai-message`}>
                                <>
                                    {analysisLinkInfo && (
                                        <div className="mb-3 glass-surface rounded-xl p-3 flex items-center space-x-4 max-w-sm border border-primary">
                                            <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-full flex items-center justify-center border border-primary">
                                                <svg className="w-5 h-5 text-secondary"><use href="#icon-file-text"></use></svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-primary font-semibold truncate">{analysisLinkInfo.name}</p>
                                                <p className="text-xs text-muted">Analysis Result</p>
                                            </div>
                                            <button onClick={() => handleDownload(analysisLinkInfo!.url, analysisLinkInfo!.name)} className="flex-shrink-0 w-9 h-9 bg-primary-accent text-on-primary-accent rounded-full flex items-center justify-center transform transition-transform hover:scale-110" title="Download">
                                                <svg className="w-5 h-5"><use href="#icon-download"></use></svg>
                                            </button>
                                        </div>
                                    )}
                                    {(!message.audioUrl || showTranscription) && remainingText && (
                                       isStreaming 
                                        ? <StreamingResponseRenderer text={remainingText} />
                                        : <Response>{remainingText}</Response>
                                    )}

                                    {message.audioUrl && (
                                        <div className={showTranscription && remainingText ? "mt-2" : ""}>
                                            <AudioPlayer src={message.audioUrl} />
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
                                </>
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
                    )
                })()
            )}
        </div>
    );
};

export default ChatMessageItem;