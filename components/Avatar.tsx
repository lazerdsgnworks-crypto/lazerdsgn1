import React from 'react';

const Avatar: React.FC<{ email: string, size?: 'sm' | 'md' | 'lg'}> = ({ email, size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-12 h-12 text-lg',
    }
    let colorClass = 'bg-gray-200 text-gray-700'; // Default
    
    // Special case for AI avatar
    if (email === 'ai@lazerdsgn.com') {
        colorClass = 'bg-blue-500 text-white';
    }

    return (
        <div className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 ${sizeClasses[size]} ${colorClass}`}>
            {email.charAt(0).toUpperCase()}
        </div>
    );
};

export default Avatar;