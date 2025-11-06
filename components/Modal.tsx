import React, { useEffect, useState } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    size?: 'md' | 'lg';
    fullscreen?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, size = 'md', fullscreen = false }) => {
    // isRendered controls if the modal is in the DOM
    const [isRendered, setIsRendered] = useState(isOpen);
    // isVisible controls the 'open' class for animations, allowing transitions to work correctly.
    const [isVisible, setIsVisible] = useState(false);

    const modalContentClasses = fullscreen
        ? 'w-screen h-screen max-w-full max-h-full rounded-none p-0 overflow-y-auto'
        : `p-8 rounded-2xl ${size === 'lg' ? 'max-w-lg' : 'max-w-md'}`;

    useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
            // Use a short timeout to allow the component to render before adding the 'open' class for the animation.
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 10);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
            // Wait for the closing animation to finish before removing from the DOM.
            const timer = setTimeout(() => {
                setIsRendered(false);
            }, 300); // This duration must match the CSS transition duration
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        // Only listen for Esc key when the modal is intended to be open
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    // Don't render anything if the component is not supposed to be visible
    if (!isRendered) {
        return null;
    }

    return (
        <div 
            className={`modal-overlay ${isVisible ? 'open' : ''}`}
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className={`modal-content bg-secondary shadow-2xl w-full relative ${modalContentClasses}`}
                onClick={(e) => e.stopPropagation()}
            >
                {!fullscreen && (
                    <button 
                        className="absolute top-4 right-4 text-muted hover:text-primary"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                {children}
            </div>
        </div>
    );
};

export default Modal;