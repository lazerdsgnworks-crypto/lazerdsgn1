import React, { useState, useRef, useEffect } from 'react';
import { Page, User, UserProfile } from '../types';
import Avatar from './Avatar';

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
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Add glass effect after scrolling a bit (e.g., 20px)
            setIsScrolled(window.scrollY > 20);
        };

        if (currentPage === Page.Home) {
            window.addEventListener('scroll', handleScroll, { passive: true });
            // Initial check in case the page loads already scrolled
            handleScroll();
        } else {
            // Ensure it's false if we navigate away from home
            setIsScrolled(false);
        }

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [currentPage]); // Re-run effect if the page changes

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
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
    
    const AuthLinks: React.FC<{isMobile: boolean}> = ({ isMobile }) => {
        const baseClassName = isMobile 
            ? "w-full text-center font-medium text-primary border border-secondary rounded-full px-5 py-2 hover:bg-hover transition" 
            : "font-medium text-primary border border-secondary rounded-full px-4 py-1.5 hover:bg-hover transition";
            
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
                    <button onClick={() => setProfileMenuOpen(prev => !prev)} className="flex items-center space-x-2 group">
                        <Avatar email={user.email!} photoURL={userProfile?.photoURL} size="sm" />
                        <span className="text-sm font-medium text-secondary group-hover:text-primary">
                            {userProfile?.username ?? 'Profile'}
                        </span>
                    </button>
                    {isProfileMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-secondary rounded-xl shadow-lg py-1 z-20">
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
                            <div className="my-1"></div>
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
        return <a href="#" className={baseClassName} onClick={(e) => { e.preventDefault(); onLogin(); setMobileMenuOpen(false); }}>Login</a>;
    };

    return (
        <>
            <header className={`sticky top-0 z-20 ${currentPage !== Page.Home || isScrolled ? 'glass-header' : ''}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center h-17">
                    {/* Left: Logo */}
                    <div className="flex-1 flex justify-start">
                        <div className="text-2xl font-bold tracking-tight">
                            <a href="#" className="text-primary" onClick={(e) => handleNav(Page.Home, e)}>LazerDsgn.</a>
                        </div>
                    </div>

                    {/* Center: Nav Links */}
                    <nav className="hidden md:flex flex-1 justify-center space-x-8 text-sm font-medium text-secondary items-center">
                        <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Home, e)}>Home</a>
                        <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Portfolio, e)}>Portfolio</a>
                        <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Community, e)}>Community</a>
                        <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Chat, e)}>Chat</a>
                        <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.About, e)}>About</a>
                    </nav>

                    {/* Right: AuthLinks */}
                    <div className="hidden md:flex flex-1 justify-end">
                        <AuthLinks isMobile={false} />
                    </div>

                    {/* Mobile Toggle */}
                    <div className="flex items-center md:hidden">
                        <button onClick={handleMobileMenuToggle} className="p-2 rounded-full hover:bg-hover">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu */}
            <div className={`fixed inset-0 bg-secondary z-50 flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex justify-between items-center p-4 flex-shrink-0">
                    <div className="text-2xl font-bold tracking-tight">
                        <a href="#" className="text-primary" onClick={(e) => handleNav(Page.Home, e)}>LazerDsgn.</a>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <nav className="flex-grow flex flex-col space-y-6 p-6 text-lg font-medium text-secondary">
                    <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Home, e)}>Home</a>
                    <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Portfolio, e)}>Portfolio</a>
                    <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Community, e)}>Community</a>
                    <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Chat, e)}>Chat</a>
                    <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.About, e)}>About</a>
                    {user && (
                        <div className="pt-6">
                            <a href="#" className="flex items-center space-x-3 group" onClick={(e) => handleProfileNav(e)}>
                                <Avatar email={user.email!} photoURL={userProfile?.photoURL} size="md" />
                                <span className="font-medium text-secondary group-hover:text-primary">{userProfile?.username ?? 'Profile'}</span>
                            </a>
                        </div>
                    )}
                </nav>
                 <div className="p-6">
                    <AuthLinks isMobile={true} />
                </div>
            </div>
        </>
    );
};

export default Header;