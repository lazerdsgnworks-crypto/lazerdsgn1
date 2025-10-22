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

    // This effect hook handles the lifecycle of any blob URL.
    // When the component unmounts, or when imageUrl changes to something else,
    // the cleanup function is called for the old URL if it was a blob URL to prevent memory leaks.
    useEffect(() => {
        return () => {
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a prompt.");
            return;
        }
        setIsLoading(true);
        setImageUrl(''); // This will trigger the cleanup for the old URL if it was a blob URL
        setError('');

        try {
            const response = await fetch('https://umarworks1.app.n8n.cloud/webhook/imagegen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                 try {
                    const errorJson = await response.json();
                    throw new Error(errorJson.message || `Webhook failed with status ${response.status}`);
                } catch {
                    const errorText = await response.text();
                    throw new Error(`Webhook failed with status ${response.status}: ${errorText}`);
                }
            }
            
            const result = await response.json();
            const newImageUrl = result.url;

            if (!newImageUrl || typeof newImageUrl !== 'string') {
                throw new Error("The AI service did not return a valid image URL.");
            }
            
            // Preload the image to ensure it's loaded before showing
            await new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("The generated image could not be loaded. It might be an invalid URL or a network issue."));
                img.src = newImageUrl;
            });
            setImageUrl(newImageUrl);
        } catch (err) {
            console.error("Image generation error:", err);
            setError(err instanceof Error ? err.message : "Failed to generate image. The service may be busy. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = async () => {
        if (!imageUrl) return;
        try {
            // Fetch the image data to handle potential CORS issues with the download attribute.
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error('Network response was not ok while fetching image for download.');
            }
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `lazerdsgn-${prompt.slice(0, 20).replace(/\s+/g, '_') || 'image'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Revoke the temporary blob URL to free up memory.
            URL.revokeObjectURL(blobUrl);

        } catch (error) {
            console.error('Download failed:', error);
            setError('Could not download the image. Try right-clicking the image to save it.');
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
