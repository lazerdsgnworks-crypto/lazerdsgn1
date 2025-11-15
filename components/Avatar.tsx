import React from 'react';

const Avatar: React.FC<{ email: string, photoURL?: string | null, size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl'}> = ({ email, photoURL, size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
        xl: 'w-24 h-24',
        xxl: 'w-20 h-20 sm:w-28 sm:h-28',
    };
    
    const fontSizeClasses = {
        sm: 'text-lg',
        md: 'text-xl',
        lg: 'text-2xl',
        xl: 'text-5xl',
        xxl: 'text-4xl sm:text-6xl',
    };

    if (photoURL) {
        return (
            <img 
                src={photoURL} 
                alt={email} 
                className={`rounded-full object-cover flex-shrink-0 ${sizeClasses[size]}`}
            />
        );
    }

    if (email === 'ai@lazerdsgn.com') {
        return (
            <div className={`rounded-full flex items-center justify-center flex-shrink-0 bg-primary-accent text-on-primary-accent font-bold ${sizeClasses[size]}`}>
                <span className={fontSizeClasses[size]}>L</span>
            </div>
        );
    }

    return (
        <div className={`rounded-full flex items-center justify-center flex-shrink-0 bg-muted text-secondary border border-primary ${sizeClasses[size]}`}>
            <svg className="w-3/4 h-3/4"><use href="#icon-user-default"></use></svg>
        </div>
    );
};

export default Avatar;