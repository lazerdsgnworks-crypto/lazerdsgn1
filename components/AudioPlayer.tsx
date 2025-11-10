
import React, { useState, useEffect, useRef } from 'react';
import LiveWaveform from './ui/LiveWaveform.tsx';

interface AudioPlayerProps {
    src: string;
    variant?: 'chat' | 'community';
}

const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, variant = 'chat' }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [error, setError] = useState<string | null>(null);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio(src);
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;
        audio.preload = 'metadata';

        const handleCanPlay = () => {
            if (isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
            setIsLoading(false);
        };
        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handlePlay = () => setIsPlaying(true);
        const handlePauseOrEnd = () => setIsPlaying(false);
        const handleError = () => {
            setError('Error loading audio.');
            setIsLoading(false);
        };

        audio.addEventListener('loadedmetadata', handleCanPlay);
        audio.addEventListener('canplaythrough', handleCanPlay);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePauseOrEnd);
        audio.addEventListener('ended', handlePauseOrEnd);
        audio.addEventListener('error', handleError);

        return () => {
            audio.pause();
            audio.removeEventListener('loadedmetadata', handleCanPlay);
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePauseOrEnd);
            audio.removeEventListener('ended', handlePauseOrEnd);
            audio.removeEventListener('error', handleError);
        };
    }, [src]);


    const handlePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio || isLoading) return;

        if (audio.paused) {
            audio.play().catch(err => console.error("Audio play failed:", err));
        } else {
            audio.pause();
        }
    };
    
    if (error) {
        return <div className="text-sm p-3 rounded-lg flex items-center gap-2 bg-red-500/10 text-red-500">{error}</div>
    }

    if (variant === 'community') {
        return (
            <div className="flex items-center gap-2 w-full max-w-xs">
                <button
                    type="button"
                    onClick={handlePlayPause}
                    disabled={isLoading}
                    className="w-8 h-8 flex-shrink-0 bg-secondary border border-primary rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-muted focus:ring-primary-accent disabled:opacity-50 disabled:scale-100"
                    aria-label={isPlaying ? "Pause audio" : "Play audio"}
                >
                    {isLoading ? (
                        <svg className="w-4 h-4 animate-spin text-primary"><use href="#icon-spinner"></use></svg>
                    ) : (
                        <svg className="w-4 h-4 text-primary"><use href={isPlaying ? "#icon-pause" : "#icon-play"}></use></svg>
                    )}
                </button>
                <div className="flex-1 h-8">
                     <LiveWaveform
                        active={!isLoading}
                        processing={isPlaying}
                        mode="static"
                        height={32}
                    />
                </div>
                {!isLoading && duration > 0 && (
                    <span className="text-xs font-mono text-secondary w-12 text-left shrink-0">
                        {formatTime(duration)}
                    </span>
                )}
            </div>
        )
    }

    return (
        <div className="flex items-center gap-3 bg-bg-muted rounded-full px-2 py-1.5 w-full max-w-[240px] border border-primary" aria-label="Audio player">
            <button
                type="button"
                onClick={handlePlayPause}
                disabled={isLoading}
                className="w-8 h-8 flex-shrink-0 bg-secondary rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-muted focus:ring-primary-accent disabled:opacity-50 disabled:scale-100"
                aria-label={isPlaying ? "Pause audio" : "Play audio"}
            >
                {isLoading ? (
                    <svg className="w-4 h-4 animate-spin text-primary"><use href="#icon-spinner"></use></svg>
                ) : (
                    <svg className="w-4 h-4 text-primary"><use href={isPlaying ? "#icon-pause" : "#icon-play"}></use></svg>
                )}
            </button>
            
            <div className="flex-1 h-8">
                <LiveWaveform
                    active={!isLoading}
                    processing={isPlaying}
                    mode="static"
                    height={32}
                />
            </div>

            <span className="text-sm font-mono text-secondary w-12 text-right pr-1" aria-live="off">
                {formatTime(duration > 0 ? currentTime : 0)}
            </span>
        </div>
    );
};

export default AudioPlayer;
