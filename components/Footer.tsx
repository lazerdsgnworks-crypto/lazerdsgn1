import React from 'react';
import { Page } from '../types';

interface FooterProps {
    navigateTo: (page: Page) => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

const Footer: React.FC<FooterProps> = ({ navigateTo, theme, toggleTheme }) => {
    const handleNav = (page: Page, e: React.MouseEvent) => {
        e.preventDefault();
        navigateTo(page);
    };

    return (
        <footer id="footer" className="pt-16 pb-8 border-t border-primary glass-surface">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pb-16">
                    <div className="col-span-2 md:col-span-1">
                        <h3 className="text-3xl font-extrabold tracking-tighter text-primary mb-4">Stay <br /> Connected</h3>
                        <p className="text-secondary text-sm mb-4">
                            Join our newsletter for the latest updates and exclusive offers from LazerDsgn.
                        </p>
                        <div className="flex items-center border border-secondary rounded-xl overflow-hidden p-1 bg-secondary max-w-xs">
                            <input type="email" placeholder="Enter your email" className="w-full px-3 py-2 text-sm border-none focus:ring-0 focus:outline-none placeholder-muted bg-transparent text-primary" />
                            <button className="bg-primary-accent text-on-primary-accent p-2 rounded-lg hover:bg-accent-hover transition">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        </div>
                    </div>
                     <div>
                        <h4 className="font-semibold text-primary mb-4">Quick Links</h4>
                        <ul className="space-y-2 text-sm text-secondary">
                            <li><a href="#" className="hover:text-primary transition" onClick={(e) => handleNav(Page.Home, e)}>Home</a></li>
                            <li><a href="#" className="hover:text-primary transition" onClick={(e) => handleNav(Page.Portfolio, e)}>Portfolio</a></li>
                            <li><a href="#" className="hover:text-primary transition" onClick={(e) => handleNav(Page.Community, e)}>Community</a></li>
                            <li><a href="#" className="hover:text-primary transition" onClick={(e) => handleNav(Page.About, e)}>About</a></li>
                            <li><a href="#" className="hover:text-primary transition" onClick={(e) => handleNav(Page.Chat, e)}>Chat</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-primary mb-4">Get in Touch</h4>
                        <address className="space-y-2 text-sm not-italic text-secondary">
                            <p>101 Design Hub</p>
                            <p>Creative City, CC 90210</p>
                            <p>Email: <a href="mailto:lazerdsgnworks@gmail.com" className="hover:text-primary transition">lazerdsgnworks@gmail.com</a></p>
                        </address>
                    </div>
                    <div className="md:text-left">
                        <h4 className="font-semibold text-primary mb-4">Follow Us</h4>
                         <div className="flex space-x-3 mb-6">
                            <a href="https://www.instagram.com/umardesigns_" target="_blank" rel="noopener noreferrer" className="p-3 border border-secondary rounded-full text-secondary hover:text-primary hover:border-primary hover:bg-hover transition-colors">
                                <svg className="h-5 w-5"><use href="#icon-instagram"></use></svg>
                            </a>
                            <a href="#" className="p-3 border border-secondary rounded-full text-secondary hover:text-primary hover:border-primary hover:bg-hover transition-colors">
                                <svg className="h-5 w-5"><use href="#icon-x"></use></svg>
                            </a>
                             <a href="#" className="p-3 border border-secondary rounded-full text-secondary hover:text-primary hover:border-primary hover:bg-hover transition-colors">
                                <svg className="h-5 w-5"><use href="#icon-behance"></use></svg>
                            </a>
                         </div>
                        <h4 className="font-semibold text-primary mb-4">Theme</h4>
                        <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-muted"><use href="#icon-sun"></use></svg>
                            <button onClick={toggleTheme} className="theme-toggle-switch relative rounded-full p-1 flex items-center cursor-pointer">
                                <div className="theme-toggle-circle absolute rounded-full shadow-md transition-transform duration-300"></div>
                            </button>
                            <svg className="w-5 h-5 text-muted"><use href="#icon-moon"></use></svg>
                        </div>
                    </div>
                </div>
                <div className="pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-muted">
                    <p>&copy; 2024 LazerDsgn. All rights reserved.</p>
                    <div className="flex space-x-6 mt-4 md:mt-0">
                        <a href="#" className="hover:text-primary transition">Privacy Policy</a>
                        <a href="#" className="hover:text-primary transition">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;