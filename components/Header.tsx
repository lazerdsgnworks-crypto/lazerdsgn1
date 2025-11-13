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

        if (!isHomePage) {
            window.addEventListener('scroll', handleScroll);
            handleScroll(); // Check on mount
        } else {
            setIsScrolled(false);
        }

        return () => window.removeEventListener('scroll', handleScroll);
    }, [isHomePage]);


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
                    <button onClick={() => setProfileMenuOpen(prev => !prev)} className="flex items-center space-x-2 group p-1.5 -m-1.5 rounded-lg hover:bg-hover transition-colors">
                        <Avatar email={user.email!} photoURL={userProfile?.photoURL} size="sm" />
                        <span className="hidden sm:inline text-sm font-medium text-secondary group-hover:text-primary transition-colors">
                            {userProfile?.username ?? 'Profile'}
                        </span>
                        <svg className={`w-4 h-4 text-muted transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`}>
                            <use href="#icon-chevron-down"></use>
                        </svg>
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
            <header className={isHomePage ? 'floating-navbar-container' : `static-navbar-container ${isScrolled ? 'scrolled' : ''}`}>
                <div className={isHomePage ? 'floating-navbar' : 'static-navbar'}>
                    <div className="flex justify-between items-center w-full">
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
                </div>
            </header>

            {/* Mobile Menu */}
            <div className={`fixed inset-0 bg-secondary z-50 flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex justify-between items-center p-4 flex-shrink-0">
                    <div className="text-2xl font-bold tracking-tight">
                        <a href="#" className="text-primary" onClick={(e) => handleNav(Page.Home, e)}>LazerDsgn.</a>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-primary">
                        <svg className="w-6 h-6"><use href="#icon-x-close"></use></svg>
                    </button>
                </div>
                <nav className="flex-grow flex flex-col space-y-6 p-6 text-lg font-medium text-secondary">
                    <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Home, e)}>Home</a>
                    <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Portfolio, e)}>Portfolio</a>
                    <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Community, e)}>Community</a>
                    <a href="#" className="hover:text-primary" onClick={(e) => handleNav(Page.Chat, e)}>Chat</a>
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