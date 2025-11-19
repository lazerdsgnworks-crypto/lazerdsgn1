
import React, { useState, useRef, useEffect } from 'react';
import { Page, User, UserProfile } from '../types.ts';
import Avatar from './Avatar.tsx';

interface HeaderProps {
    user: User;
    userProfile: UserProfile | null;
    navigateTo: (page: Page) => void;
    onLogout: () => void;
    onLogin: () => void;
    onViewProfile: () => void;
    currentPage: Page;
    onOpenChangePasswordModal: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, userProfile, navigateTo, onLogout, onLogin, onViewProfile, currentPage, onOpenChangePasswordModal }) => {
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    const isHomePage = currentPage === Page.Home;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll(); // Check on mount

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);


    const handleNav = (page: Page, e: React.MouseEvent) => {
        e.preventDefault();
        navigateTo(page);
        setMobileMenuOpen(false);
    };

    const handleProfileNav = (e: React.MouseEvent) => {
        e.preventDefault();
        onViewProfile();
        setMobileMenuOpen(false);
    }
    
    const handleMobileMenuToggle = () => {
        setMobileMenuOpen(true);
    };
    
    // Dynamic styles based on page
    const navContainerClass = isHomePage 
        ? `fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10 py-4' : 'bg-transparent py-6'}`
        : `static-navbar-container ${isScrolled ? 'scrolled' : ''}`;
        
    const navInnerClass = isHomePage
        ? `w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
        : 'static-navbar';

    const textColorClass = isHomePage ? 'text-white' : 'text-primary';
    const secondaryTextColorClass = isHomePage ? 'text-neutral-400' : 'text-secondary';
    const hoverTextColorClass = isHomePage ? 'hover:text-white' : 'hover:text-primary';
    const logoColorClass = isHomePage ? 'text-white' : 'text-primary';

    const AuthLinks: React.FC<{isMobile: boolean}> = ({ isMobile }) => {
        const baseClassName = isMobile 
            ? "w-full text-center font-medium text-primary border border-secondary rounded-full px-5 py-2 hover:bg-hover transition" 
            : `font-medium rounded-full px-5 py-2 transition-all duration-200 text-sm font-bold ${isHomePage ? 'bg-white text-black hover:bg-neutral-200' : 'bg-primary-accent text-on-primary-accent hover:bg-accent-hover'}`;
            
        if (user) {
            if (isMobile) {
                return (
                    <button onClick={() => { onLogout(); setMobileMenuOpen(false); }} className={baseClassName}>
                        Logout
                    </button>
                );
            }

            return (
                <div className="relative" ref={profileMenuRef}>
                    <button onClick={() => setProfileMenuOpen(prev => !prev)} className={`flex items-center space-x-2 group p-1.5 -m-1.5 rounded-lg transition-colors ${isHomePage ? 'hover:bg-white/10' : 'hover:bg-hover'}`}>
                        <Avatar email={user.email!} photoURL={userProfile?.photoURL} size="sm" />
                        <span className={`hidden sm:inline text-sm font-medium transition-colors ${isHomePage ? 'text-neutral-300 group-hover:text-white' : 'text-secondary group-hover:text-primary'}`}>
                            {userProfile?.username ?? 'Profile'}
                        </span>
                        <svg className={`w-4 h-4 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''} ${isHomePage ? 'text-neutral-400' : 'text-muted'}`}>
                            <use href="#icon-chevron-down"></use>
                        </svg>
                    </button>
                    {isProfileMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-secondary rounded-xl shadow-lg py-1 z-20 border border-primary">
                            <button
                                onClick={() => { onViewProfile(); setProfileMenuOpen(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-hover flex items-center space-x-3"
                            >
                                <svg className="w-4 h-4 text-muted"><use href="#icon-user-default"></use></svg>
                                <span>My Profile</span>
                            </button>
                            <button
                                onClick={() => { onOpenChangePasswordModal(); setProfileMenuOpen(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-hover flex items-center space-x-3"
                            >
                                <svg className="w-4 h-4 text-muted"><use href="#icon-key"></use></svg>
                                <span>Change Password</span>
                            </button>
                            <div className="my-1 border-t border-primary/10"></div>
                            <button
                                onClick={() => { onLogout(); setProfileMenuOpen(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-hover flex items-center space-x-3"
                            >
                                <svg className="w-4 h-4"><use href="#icon-logout"></use></svg>
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            );
        }
        return (
            <button 
                className={baseClassName} 
                onClick={(e) => { e.preventDefault(); onLogin(); setMobileMenuOpen(false); }}
            >
                Log in
            </button>
        );
    };

    return (
        <>
            <header className={navContainerClass}>
                <div className={navInnerClass}>
                    <div className="flex justify-between items-center w-full">
                        {/* Left: Logo */}
                        <div className="flex-1 flex justify-start items-center">
                            <div className="text-xl font-extrabold tracking-tighter flex items-center gap-2 cursor-pointer" onClick={(e) => handleNav(Page.Home, e)}>
                                <svg viewBox="0 0 24 24" fill="currentColor" className={`w-6 h-6 ${logoColorClass}`}>
                                     <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.95 1.48-2.95 1.47-2.95-1.47L12 11zm0 3.9l-10 5 10 5 10-5-10-5z"/>
                                </svg>
                                <span className={logoColorClass}>LazerDsgn.</span>
                            </div>
                        </div>

                        {/* Center: Nav Links (Desktop) */}
                        <nav className={`hidden md:flex flex-1 justify-center space-x-8 text-sm font-medium items-center ${secondaryTextColorClass}`}>
                            {/* Only show navigational links if NOT on home page, or keep them consistent? 
                                Reference image shows minimal header. Let's keep links but subtle. */}
                            <a href="#" className={`transition-colors ${hoverTextColorClass}`} onClick={(e) => handleNav(Page.Portfolio, e)}>Portfolio</a>
                            <a href="#" className={`transition-colors ${hoverTextColorClass}`} onClick={(e) => handleNav(Page.Community, e)}>Community</a>
                            <a href="#" className={`transition-colors ${hoverTextColorClass}`} onClick={(e) => handleNav(Page.Chat, e)}>Chat</a>
                        </nav>

                        {/* Right: AuthLinks (Desktop) */}
                        <div className="hidden md:flex flex-1 justify-end items-center gap-4">
                            <AuthLinks isMobile={false} />
                        </div>

                        {/* Mobile Toggle */}
                        <div className="flex items-center md:hidden">
                            <button onClick={handleMobileMenuToggle} className={`p-2 ${isHomePage ? 'text-white' : 'text-primary'}`}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Menu */}
            <div className={`fixed inset-0 bg-secondary z-[100] flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex justify-between items-center p-6 flex-shrink-0 border-b border-primary">
                    <div className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
                             <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.95 1.48-2.95 1.47-2.95-1.47L12 11zm0 3.9l-10 5 10 5 10-5-10-5z"/>
                        </svg>
                        <a href="#" className="text-primary" onClick={(e) => handleNav(Page.Home, e)}>LazerDsgn.</a>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-primary hover:bg-hover rounded-full">
                        <svg className="w-6 h-6"><use href="#icon-x-close"></use></svg>
                    </button>
                </div>
                <nav className="flex-grow flex flex-col space-y-6 p-8 text-xl font-medium text-secondary">
                    <a href="#" className="hover:text-primary transition-colors" onClick={(e) => handleNav(Page.Home, e)}>Home</a>
                    <a href="#" className="hover:text-primary transition-colors" onClick={(e) => handleNav(Page.Portfolio, e)}>Portfolio</a>
                    <a href="#" className="hover:text-primary transition-colors" onClick={(e) => handleNav(Page.Community, e)}>Community</a>
                    <a href="#" className="hover:text-primary transition-colors" onClick={(e) => handleNav(Page.Chat, e)}>Chat</a>
                    {user && (
                        <div className="pt-6 border-t border-primary/10 mt-6">
                            <a href="#" className="flex items-center space-x-3 group" onClick={(e) => handleProfileNav(e)}>
                                <Avatar email={user.email!} photoURL={userProfile?.photoURL} size="md" />
                                <span className="font-medium text-secondary group-hover:text-primary">{userProfile?.username ?? 'Profile'}</span>
                            </a>
                        </div>
                    )}
                </nav>
                 <div className="p-8 border-t border-primary">
                    <AuthLinks isMobile={true} />
                </div>
            </div>
        </>
    );
};

export default Header;
