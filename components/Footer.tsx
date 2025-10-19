import React from 'react';
import { Page } from '../types';

interface FooterProps {
    navigateTo: (page: Page) => void;
}

const Footer: React.FC<FooterProps> = ({ navigateTo }) => {
    const handleNav = (page: Page, e: React.MouseEvent) => {
        e.preventDefault();
        navigateTo(page);
    };

    return (
        <footer id="footer" className="bg-white border-t border-gray-100 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pb-16">
                    <div className="col-span-2 md:col-span-1">
                        <h3 className="text-3xl font-extrabold tracking-tighter text-black mb-4">Stay <br /> Connected</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            Join our newsletter for the latest updates and exclusive offers from LazerDsgn.
                        </p>
                        <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden p-1 bg-white max-w-xs">
                            <input type="email" placeholder="Enter your email" className="w-full px-3 py-2 text-sm border-none focus:ring-0 focus:outline-none placeholder-gray-500" />
                            <button className="bg-black text-white p-2 rounded-lg hover:bg-gray-800 transition">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                     <div>
                        <h4 className="font-semibold text-black mb-4">Quick Links</h4>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li><a href="#" className="hover:text-black transition" onClick={(e) => handleNav(Page.Home, e)}>Home</a></li>
                            <li><a href="#" className="hover:text-black transition" onClick={(e) => handleNav(Page.Portfolio, e)}>Portfolio</a></li>
                            <li><a href="#" className="hover:text-black transition" onClick={(e) => handleNav(Page.Community, e)}>Community</a></li>
                            <li><a href="#" className="hover:text-black transition" onClick={(e) => handleNav(Page.About, e)}>About</a></li>
                            <li><a href="#" className="hover:text-black transition" onClick={(e) => handleNav(Page.Chat, e)}>Chat</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-black mb-4">Get in Touch</h4>
                        <address className="space-y-2 text-sm not-italic text-gray-600">
                            <p>101 Design Hub</p>
                            <p>Creative City, CC 90210</p>
                            <p>Email: <a href="mailto:hello@lazerdsgn.com" className="hover:text-black transition">hello@lazerdsgn.com</a></p>
                        </address>
                    </div>
                    <div className="md:text-left">
                        <h4 className="font-semibold text-black mb-4">Follow Us</h4>
                         <div className="flex space-x-3 mb-6">
                            <a href="#" className="p-2 border border-gray-300 rounded-full text-gray-600 hover:text-black hover:border-black transition">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3 8h-2v4h2v6h-3v-6h-2V7h2V5h3v2h2v3z"/></svg>
                            </a>
                         </div>
                    </div>
                </div>
                <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
                    <p>&copy; 2024 LazerDsgn. All rights reserved.</p>
                    <div className="flex space-x-6 mt-4 md:mt-0">
                        <a href="#" className="hover:text-black transition">Privacy Policy</a>
                        <a href="#" className="hover:text-black transition">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
