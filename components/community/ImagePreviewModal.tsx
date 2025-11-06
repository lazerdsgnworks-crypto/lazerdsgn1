

import React, { useEffect } from 'react';

interface ImagePreviewModalProps {
    imageUrl: string;
    onClose: () => void;
    fileName?: string;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageUrl, onClose, fileName }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [onClose]);

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            // Fetch the image
            const response = await fetch(imageUrl);
            const blob = await response.blob();
    
            // Create a temporary URL for the blob
            const url = window.URL.createObjectURL(blob);
    
            // Create a temporary anchor element and trigger the download
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName || 'lazerdsgn-image.png'; // Use provided filename or a default
            document.body.appendChild(a);
            a.click();
    
            // Clean up by revoking the object URL and removing the anchor
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            console.error('Download failed:', error);
             // As a fallback, open the image in a new tab, which the user can save.
             // This is useful for CORS issues or other fetch errors.
            window.open(imageUrl, '_blank');
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-fadeIn"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
        >
             <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out forwards;
                }
            `}</style>
            <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <img src={imageUrl} alt="Post preview" className="block object-contain max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                <button
                    onClick={onClose}
                    className="absolute -top-3 -right-3 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center font-bold hover:bg-gray-200 transition-colors z-10"
                    aria-label="Close image preview"
                >
                    <svg className="w-5 h-5"><use href="#icon-x-close"></use></svg>
                </button>
                <button
                    onClick={handleDownload}
                    className="absolute bottom-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-colors z-10"
                    title="Download Image"
                    aria-label="Download image"
                >
                     <svg className="w-5 h-5"><use href="#icon-download"></use></svg>
                </button>
            </div>
        </div>
    );
};

export default ImagePreviewModal;