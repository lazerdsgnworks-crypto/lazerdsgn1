
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

interface MobileNavLinkProps {
    onClick: (e: React.MouseEvent) => void;
    children: React.ReactNode;
}

const MobileNavLink: React.FC<MobileNavLinkProps> = ({ onClick, children }) => (
    <a 
        href="#" 
        onClick={onClick}
        className="block text-2xl font-medium text-neutral-400 hover:text-white transition-colors"
    >
        {children}
    </a>
);

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

    // Prevent scrolling when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isMobileMenuOpen]);


    const handleNav = (page: Page, e: React.MouseEvent) => {
        e.preventDefault();
        navigateTo(page);
        setMobileMenuOpen(false);
    };

    const handleMobileMenuToggle = () => {
        setMobileMenuOpen(!isMobileMenuOpen);
    };
    
    const navContainerClass = isHomePage 
        ? `fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10 py-3' : 'bg-transparent py-5'}`
        : `static-navbar-container ${isScrolled ? 'scrolled' : ''}`;
        
    const navInnerClass = isHomePage
        ? `w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
        : 'static-navbar';

    const hoverTextColorClass = isHomePage ? 'hover:text-white' : 'hover:text-primary';
    const secondaryTextColorClass = isHomePage ? 'text-neutral-400' : 'text-secondary';
    const logoColorClass = isHomePage ? 'text-white' : 'text-primary';

    const AuthLinks: React.FC<{isMobile: boolean}> = ({ isMobile }) => {
        const baseClassName = isMobile 
            ? "w-full text-center font-medium text-primary border border-secondary rounded-full px-5 py-2 hover:bg-hover transition" 
            : `font-medium rounded-full px-5 py-2 transition-all duration-200 text-sm font-bold ${isHomePage ? 'bg-white text-black hover:bg-neutral-200' : 'bg-primary-accent text-on-primary-accent hover:bg-accent-hover'}`;
            
        if (user) {
            if (isMobile) {
                return null; // Handled separately in mobile menu
            }

            return (
                <div className="relative" ref={profileMenuRef}>
                    <button onClick={() => setProfileMenuOpen(prev => !prev)} className={`flex items-center space-x-2 group p-1.5 -m-1.5 rounded-full transition-all duration-300 border border-transparent ${isProfileMenuOpen ? 'bg-white/10 border-white/10' : ''} ${isHomePage ? 'hover:bg-white/10' : 'hover:bg-hover'}`}>
                        <Avatar email={user.email!} photoURL={userProfile?.photoURL} size="sm" />
                        <span className={`hidden sm:inline text-sm font-medium transition-colors ${isHomePage ? 'text-neutral-300 group-hover:text-white' : 'text-secondary group-hover:text-primary'}`}>
                            {userProfile?.username ?? 'Profile'}
                        </span>
                        <svg className={`w-4 h-4 transition-transform duration-300 ${isProfileMenuOpen ? 'rotate-180' : ''} ${isHomePage ? 'text-neutral-400' : 'text-muted'}`}>
                            <use href="#icon-chevron-down"></use>
                        </svg>
                    </button>
                    
                    {/* Enhanced Dropdown Menu */}
                    <div 
                        className={`absolute right-0 mt-3 w-72 origin-top-right rounded-2xl bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/[0.08] shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.05] focus:outline-none overflow-hidden z-50 transform transition-all duration-200 ease-out ${isProfileMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}
                    >
                        <div className="px-5 py-4 border-b border-white/[0.08] bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                     <Avatar email={user.email!} photoURL={userProfile?.photoURL} size="md" />
                                     <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0a0a0a] rounded-full"></div>
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-white truncate">{userProfile?.username || 'User'}</p>
                                    <p className="text-xs text-neutral-400 truncate">{user.email}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-2 space-y-1">
                            <button
                                onClick={() => { onViewProfile(); setProfileMenuOpen(false); }}
                                className="group flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-neutral-300 rounded-xl hover:bg-white/[0.08] hover:text-white transition-all duration-200"
                            >
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.1] border border-white/[0.05] transition-colors shadow-sm">
                                     <svg className="w-4 h-4 text-neutral-400 group-hover:text-white"><use href="#icon-user-default"></use></svg>
                                </div>
                                <span>My Profile</span>
                            </button>
                            
                            <button
                                onClick={() => { onOpenChangePasswordModal(); setProfileMenuOpen(false); }}
                                className="group flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-neutral-300 rounded-xl hover:bg-white/[0.08] hover:text-white transition-all duration-200"
                            >
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.1] border border-white/[0.05] transition-colors shadow-sm">
                                    <svg className="w-4 h-4 text-neutral-400 group-hover:text-white"><use href="#icon-key"></use></svg>
                                </div>
                                <span>Change Password</span>
                            </button>
                        </div>
                        
                        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mx-4 my-1"></div>
                        
                        <div className="p-2">
                            <button
                                onClick={() => { onLogout(); setProfileMenuOpen(false); }}
                                className="group flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-400/90 rounded-xl hover:bg-red-500/[0.08] hover:text-red-400 transition-all duration-200"
                            >
                                 <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/[0.05] group-hover:bg-red-500/[0.1] border border-red-500/[0.1] transition-colors shadow-sm">
                                    <svg className="w-4 h-4 text-red-400 group-hover:text-red-500"><use href="#icon-logout"></use></svg>
                                </div>
                                <span>Log out</span>
                            </button>
                        </div>
                    </div>
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
                            <div className="text-xl font-extrabold tracking-tighter flex items-center gap-2 cursor-pointer z-[101]" onClick={(e) => { handleNav(Page.Home, e); setMobileMenuOpen(false); }}>
                                <svg viewBox="0 0 24 24" fill="currentColor" className={`w-6 h-6 ${isMobileMenuOpen ? 'text-white' : logoColorClass} transition-colors duration-300`}>
                                     <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.95 1.48-2.95 1.47-2.95-1.47L12 11zm0 3.9l-10 5 10 5 10-5-10-5z"/>
                                </svg>
                                <span className={`${isMobileMenuOpen ? 'text-white' : logoColorClass} transition-colors duration-300`}>LazerDsgn.</span>
                            </div>
                        </div>

                        {/* Center: Nav Links (Desktop) */}
                        <nav className={`hidden md:flex flex-1 justify-center space-x-8 text-sm font-medium items-center ${secondaryTextColorClass}`}>
                            <a href="#" className={`transition-colors ${hoverTextColorClass}`} onClick={(e) => handleNav(Page.Home, e)}>Home</a>
                            <a href="#" className={`transition-colors ${hoverTextColorClass}`} onClick={(e) => handleNav(Page.Portfolio, e)}>Portfolio</a>
                            <a href="#" className={`transition-colors ${hoverTextColorClass}`} onClick={(e) => handleNav(Page.Community, e)}>Community</a>
                            <a href="#" className={`transition-colors ${hoverTextColorClass}`} onClick={(e) => handleNav(Page.Chat, e)}>Chat</a>
                        </nav>

                        {/* Right: AuthLinks (Desktop) */}
                        <div className="hidden md:flex flex-1 justify-end items-center gap-4">
                            <AuthLinks isMobile={false} />
                        </div>

                        {/* Mobile Toggle (Only visible when menu is closed, menu has its own close button) */}
                        <div className={`flex items-center md:hidden z-[101] ${isMobileMenuOpen ? 'hidden' : 'block'}`}>
                            <button onClick={handleMobileMenuToggle} className={`p-2 ${isHomePage ? 'text-white' : 'text-primary'} transition-colors duration-300`}>
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

            {/* Mobile Menu - Fade Animation & Dark Theme */}
            <div className={`fixed inset-0 bg-black z-[100] flex flex-col transition-opacity duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                
                {/* Menu Header: Logo & Cross Icon */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-900/30">
                    <div className="flex items-center gap-2 text-white font-extrabold text-xl tracking-tighter">
                         <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                             <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.95 1.48-2.95 1.47-2.95-1.47L12 11zm0 3.9l-10 5 10 5 10-5-10-5z"/>
                        </svg>
                        <span>LazerDsgn.</span>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="text-white p-2 hover:text-neutral-300 transition-colors">
                        <svg className="w-8 h-8"><use href="#icon-x-close"></use></svg>
                    </button>
                </div>

                {/* Menu Links */}
                <nav className="flex flex-col px-8 mt-6 space-y-4">
                     <MobileNavLink onClick={(e) => handleNav(Page.Home, e)}>Home</MobileNavLink>
                     <MobileNavLink onClick={(e) => handleNav(Page.Portfolio, e)}>Portfolio</MobileNavLink>
                     <MobileNavLink onClick={(e) => handleNav(Page.Chat, e)}>Chat</MobileNavLink>
                     <MobileNavLink onClick={(e) => handleNav(Page.Community, e)}>Community</MobileNavLink>
                     {user && <MobileNavLink onClick={(e) => handleNav(Page.Profile, e)}>Dashboard</MobileNavLink>}

                     {/* Logout Icon / Login Button */}
                     {user ? (
                         <div className="pt-4">
                             <button onClick={() => { onLogout(); setMobileMenuOpen(false); }} className="text-neutral-500 hover:text-red-500 transition-colors p-2 -ml-2" title="Logout">
                                 <svg className="w-7 h-7"><use href="#icon-logout"></use></svg>
                             </button>
                         </div>
                     ) : (
                         <div className="pt-6">
                            <button onClick={() => { onLogin(); setMobileMenuOpen(false); }} className="text-xl font-semibold text-white hover:text-neutral-300 text-left">
                                Log In
                            </button>
                         </div>
                     )}
                </nav>
            </div>
        </>
    );
};

export default Header;
