
import React, { useEffect, useRef } from 'react';
import { Page, User } from '../types';

interface HomePageProps {
    user: User;
    navigateTo: (page: Page) => void;
    openSignupModal: () => void;
    openLoginModal: () => void;
}

const projectImages = [
    {
        url: "https://images.unsplash.com/photo-1572044162444-24c95621ec34?q=80&w=800",
        title: "Zenith",
        category: "Branding"
    },
    {
        url: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=800",
        title: "CodeConnect",
        category: "Web App UI"
    },
    {
        url: "https://images.unsplash.com/photo-1600132806370-bf17e65e942f?q=80&w=800",
        title: "Ocular",
        category: "Mobile UI/UX"
    },
    {
        url: "https://images.unsplash.com/photo-1526495124232-a04e1849168c?q=80&w=800",
        title: "Artisan Roast",
        category: "Packaging"
    },
    {
        url: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?q=80&w=800",
        title: "Flow",
        category: "SaaS Platform"
    },
    {
        url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=800",
        title: "Gallery One",
        category: "Print Design"
    }
];


const testimonials = [
    { name: "Saman Malik", title: "Brand Director", avatar: "https://placehold.co/40x40/333333/ffffff?text=S", text: "LazerDsgn guided our brand through a complex re-design process, providing ongoing expertise and ensuring our final look was pitch perfect." },
    { name: "Ahmed Khan", title: "Marketing Lead", avatar: null, avatarInitial: "A", text: "The new visual system LazerDsgn delivered instantly elevated our presence in a crowded market. Their process is smooth and highly collaborative." },
    { name: "Hassan Ali", title: "Digital Strategist", avatar: "https://placehold.co/40x40/333333/ffffff?text=H", text: "Our website conversions doubled after the UI/UX overhaul. LazerDsgn's focus on user experience married with beautiful design is unmatched." },
    { name: "Zainab Hussain", title: "Creative Manager", avatar: "https://i.ibb.co/c7BZmyt/Gemini-Generated-Image-qef4a1qef4a1qef4.png", text: "The robust design consultation and fast delivery from LazerDsgn have streamlined our production workflow, making our internal marketing significantly more efficient." },
    { name: "Maria Rodriguez", title: "Founder, Small Retail", avatar: null, avatarInitial: "M", text: "The execution of our campaign assets exceeded expectations. Every touchpoint felt integrated and premium, improving overall brand perception." },
];


const HomePage: React.FC<HomePageProps> = ({ user, navigateTo, openSignupModal, openLoginModal }) => {
    const pageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Trigger fade-in animation
        const timer = setTimeout(() => {
            pageRef.current?.classList.add('visible');
        }, 10);
        return () => clearTimeout(timer);
    }, []);
    
    return (
        <div ref={pageRef} className="page-transition bg-black min-h-screen w-full text-white selection:bg-blue-500/30 selection:text-white font-sans">
            
            {/* --- HERO SECTION --- */}
            <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 flex flex-col items-center text-center px-4 max-w-7xl mx-auto">
                {/* Pill Badge */}
                <div className="mb-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1a1a1a] border border-[#333] transition-all hover:border-[#444] cursor-default animate-fadeIn">
                    <span className="text-sm font-medium text-neutral-400">6d ago: <span className="text-white">New Design System</span></span>
                </div>

                {/* Headline */}
                <h1 className="text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter text-white mb-8 leading-[1.05] animate-fadeIn" style={{ animationDelay: '0.1s' }}>
                    Build better<br /> sites, faster
                </h1>

                {/* Subheadline */}
                <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-fadeIn" style={{ animationDelay: '0.2s' }}>
                    LazerDsgn is the design tool for websites. Design freely, publish fast, and scale with CMS, SEO, analytics, and more.
                </p>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 animate-fadeIn w-full sm:w-auto justify-center" style={{ animationDelay: '0.3s' }}>
                    {user ? (
                        <>
                             <button 
                                onClick={() => navigateTo(Page.Chat)} 
                                className="px-8 py-3.5 rounded-full bg-white text-black font-bold text-base hover:bg-neutral-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] min-w-[160px]"
                            >
                                Start Creating
                            </button>
                            <button 
                                onClick={() => navigateTo(Page.Community)} 
                                className="px-8 py-3.5 rounded-full bg-[#1a1a1a] text-white border border-[#333] font-bold text-base hover:bg-[#252525] transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 min-w-[160px]"
                            >
                                <span>Start with AI</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={openSignupModal} 
                                className="px-8 py-3.5 rounded-full bg-white text-black font-bold text-base hover:bg-neutral-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] min-w-[160px]"
                            >
                                Start for free
                            </button>
                            <button 
                                onClick={openLoginModal} 
                                className="px-8 py-3.5 rounded-full bg-[#1a1a1a] text-white border border-[#333] font-bold text-base hover:bg-[#252525] transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 min-w-[160px]"
                            >
                                <span>Start with AI</span>
                            </button>
                        </>
                    )}
                </div>
            </section>

            {/* --- PROJECTS SECTION --- */}
            <section id="projects" className="py-20 md:py-32 border-t border-neutral-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
                            Selected Works
                        </h2>
                        <p className="text-neutral-500">Curated high-impact visual identities.</p>
                    </div>
                    <button onClick={() => navigateTo(Page.Portfolio)} className="hidden md:block text-sm font-bold text-white border-b border-white/20 pb-1 hover:border-white transition-colors">View All Projects</button>
                </div>
                
                <div className="w-full overflow-hidden">
                    <div className="slider-track">
                        {[...projectImages, ...projectImages].map((project, index) => (
                            <div onClick={() => navigateTo(Page.Portfolio)} key={index} className="cursor-pointer slider-item group relative aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 transition-transform duration-500 hover:-translate-y-2">
                                <img src={project.url} alt={project.title} className="absolute inset-0 w-full h-full object-cover opacity-80 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90"></div>
                                <div className="absolute bottom-0 left-0 p-6 w-full">
                                    <h3 className="text-xl font-bold text-white mb-1">{project.title}</h3>
                                    <p className="text-sm text-neutral-400 font-medium">{project.category}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            
            {/* --- ABOUT SECTION --- */}
            <section id="about" className="py-24 bg-[#050505] border-t border-neutral-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-16 items-center">
                    <div className="order-2 md:order-1">
                        <span className="inline-block py-1 px-3 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-widest mb-6">Our Mission</span>
                        <h3 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white mb-6">We build brands that resonate.</h3>
                        <p className="text-neutral-400 text-lg leading-relaxed mb-8">
                            Our mission is simple: to help brands connect with their audiences through exceptional design. We believe that great design is not just about aesthetics; it's about creating meaningful experiences that drive results.
                        </p>
                        <button onClick={() => navigateTo(Page.Chat)} className="inline-flex items-center font-bold text-white hover:text-neutral-300 transition-colors">
                            Let's Talk Design
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                        </button>
                    </div>
                    <div 
                        className="order-1 md:order-2 rounded-3xl overflow-hidden aspect-[4/5] relative group"
                    >
                         <img src="https://i.ibb.co/v4q4PtnQ/IMG-1247.jpg" alt="Designer" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                         <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl pointer-events-none"></div>
                    </div>
                </div>
            </section>

            {/* --- TESTIMONIALS SECTION --- */}
            <section id="testimonials" className="py-24 border-t border-neutral-900 bg-black relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                         <span className="text-neutral-500 font-semibold tracking-wide uppercase text-xs">Testimonials</span>
                        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white mt-3">
                            Loved by creators.
                        </h2>
                    </div>
                    <div className="reviews-scroll-container" style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full">
                            {[1, 2, 3].map(col => (
                                <div key={col} className={`col-${col} ${col > 1 ? 'hidden' : ''} ${col === 2 ? 'md:block' : ''} ${col === 3 ? 'lg:block' : ''} overflow-hidden`}>
                                    <div className="review-column">
                                        {[...testimonials, ...testimonials].map((t, index) => (
                                            <div key={`${col}-${index}`} className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-2xl backdrop-blur-sm hover:bg-neutral-900 transition-colors">
                                                <p className="text-neutral-300 text-base leading-relaxed mb-6">"{t.text}"</p>
                                                <div className="flex items-center pt-4 border-t border-neutral-800">
                                                    {t.avatar ? <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover border border-neutral-700" />
                                                        : <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold text-white border border-neutral-700">{t.avatarInitial}</div>
                                                    }
                                                    <div className="ml-3 text-left">
                                                        <p className="font-bold text-sm text-white">{t.name}</p>
                                                        <p className="text-xs text-neutral-500">{t.title}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HomePage;
