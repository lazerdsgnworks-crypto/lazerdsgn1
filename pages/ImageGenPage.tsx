import React, { useState, useEffect, useRef } from 'react';

const ImageGenPage: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [error, setError] = useState('');
    const pageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Trigger fade-in animation
        const timer = setTimeout(() => {
            pageRef.current?.classList.add('visible');
        }, 10);
        return () => clearTimeout(timer);
    }, []);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a prompt.");
            return;
        }
        setIsLoading(true);
        setImageUrl('');
        setError('');
        try {
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
            // Preload the image to ensure it's generated before showing
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });
            setImageUrl(url); 
        } catch (err) {
            console.error("Image generation error:", err);
            setError("Failed to generate image. The service may be busy. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = async () => {
        if (!imageUrl) return;
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `lazerdsgn-${prompt.slice(0, 20).replace(/\s+/g, '_') || 'image'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            setError('Could not download the image. Please try again.');
        }
    };

    return (
        <div ref={pageRef} className="page-transition bg-primary">
            <section className="py-12 md:py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-primary mb-4">
                        AI Image Generation
                    </h1>
                    <p className="text-lg text-secondary max-w-2xl mx-auto mb-8">
                        Describe the image you want to create. Be as specific as possible for the best results.
                    </p>

                    <div className="max-w-2xl mx-auto">
                        <div className="flex items-center bg-muted rounded-2xl shadow-sm overflow-hidden p-2 space-x-2">
                            <input
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., A photorealistic astronaut riding a horse on Mars"
                                className="flex-1 p-3 text-base bg-transparent border-none focus:ring-0 focus:outline-none placeholder-muted text-primary"
                                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleGenerate()}
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className="bg-primary-accent text-on-primary-accent px-6 py-3 rounded-xl hover:bg-accent-hover transition disabled:opacity-50"
                            >
                                {isLoading ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                        {error && <p className="text-red-500 mt-2">{error}</p>}
                    </div>

                    <div className="mt-12 flex flex-col justify-center items-center min-h-[300px] w-full max-w-xl mx-auto">
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center w-full">
                                <div className="w-full aspect-square bg-muted rounded-lg shimmer-bg"></div>
                                <p className="mt-4 text-muted">Generating your masterpiece...</p>
                            </div>
                        )}
                        {imageUrl && !isLoading && (
                            <div className="image-reveal w-full">
                                <img src={imageUrl} alt={prompt} className="w-full h-auto rounded-lg shadow-lg" />
                                <div className="flex items-center justify-center space-x-4 mt-4">
                                    <button onClick={handleDownload} title="Download Image" className="action-button p-2 bg-muted rounded-full hover:bg-hover">
                                         <svg className="w-5 h-5 text-primary"><use href="#icon-download"></use></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ImageGenPage;
