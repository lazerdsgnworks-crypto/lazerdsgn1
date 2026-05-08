
import React, { useEffect, useRef, useState } from 'react';
import { Page, User } from '../types';
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ADMIN_UIDS } from '../constants';
import Modal from '../components/Modal';

interface HomePageProps {
    user: User;
    navigateTo: (page: Page) => void;
    openSignupModal: () => void;
    openLoginModal: () => void;
}

const projectImages = [
    {
        url: "https://i.ibb.co/nNcpt02s/IMG-5556.jpg",
        title: "Poster",
        category: "Design"
    },
    {
        url: "https://i.ibb.co/0yNmhN2M/IMG-5351.jpg",
        title: "Website hero page",
        category: "Web Design"
    },
    {
        url: "https://i.ibb.co/r2SgQ87s/IMG-4996.jpg",
        title: "Reve Brand identity",
        category: "Brand Identity"
    },
    {
        url: "https://i.ibb.co/Kz77x8qx/IMG-5374.jpg",
        title: "rmayd",
        category: "Design"
    },
    {
        url: "https://i.ibb.co/TDcP760j/SCULPT-Brand-Identity-FULL-PROJECT-ON-BEHANCE-Made-by-lazer-dsgn-For-commercial-works-and-p.jpg",
        title: "SCULPT Brand Identity",
        category: "Brand Identity"
    },
    {
        url: "https://i.ibb.co/xS76h0hd/Green-Grove-Gardens-Brand-Identity-For-commercial-work-visit-my-websitehttps-lazergraphics-odo-1.jpg",
        title: "Green Grove Gardens — vol. 1",
        category: "Brand Identity"
    },
    {
        url: "https://i.ibb.co/gbCcC2C9/Verve-Brand-Identity-Verve-is-a-tech-startup-specializing-in-virtual-reality-experiences-Our.jpg",
        title: "Verve Brand Identity",
        category: "Brand Identity"
    },
    {
        url: "https://i.ibb.co/BbS4kHM/Horizon-Quest-Brand-Identity-Horizon-Quest-is-an-outdoor-adventure-brand-that-encourages-explora.jpg",
        title: "Horizon Quest Brand Identity",
        category: "Brand Identity"
    },
    {
        url: "https://i.ibb.co/p64y3FHJ/Givenchy-reimagined-by-AI-a-surreal-tale-of-couture-light-and-fantasy-woven-into-every-pixel.jpg",
        title: "Givenchy — reimagined by AI",
        category: "AI Campaign"
    },
    {
        url: "https://i.ibb.co/sJ3T2yDQ/PUMA-AI-CAMPAIGN-UVU-COLLECTION-lazerdsgn.jpg",
        title: "PUMA — UVU collection AI campaign",
        category: "AI Campaign"
    }
];


const testimonials = [
    { name: "Saman Malik", title: "Brand Director", avatar: "https://placehold.co/40x40/333333/ffffff?text=S", text: "umardsgn_ guided our brand through a complex re-design process, providing ongoing expertise and ensuring our final look was pitch perfect." },
    { name: "Ahmed Khan", title: "Marketing Lead", avatar: null, avatarInitial: "A", text: "The new visual system umardsgn_ delivered instantly elevated our presence in a crowded market. Their process is smooth and highly collaborative." },
    { name: "Hassan Ali", title: "Digital Strategist", avatar: "https://placehold.co/40x40/333333/ffffff?text=H", text: "Our website conversions doubled after the UI/UX overhaul. umardsgn_'s focus on user experience married with beautiful design is unmatched." },
    { name: "Zainab Hussain", title: "Creative Manager", avatar: "https://i.ibb.co/c7BZmyt/Gemini-Generated-Image-qef4a1qef4a1qef4.png", text: "The robust design consultation and fast delivery from umardsgn_ have streamlined our production workflow, making our internal marketing significantly more efficient." },
    { name: "Maria Rodriguez", title: "Founder, Small Retail", avatar: null, avatarInitial: "M", text: "The execution of our campaign assets exceeded expectations. Every touchpoint felt integrated and premium, improving overall brand perception." },
];

const getTimeAgo = (date: Date | null) => {
    if (!date) return '';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
};

const HomePage: React.FC<HomePageProps> = ({ user, navigateTo, openSignupModal, openLoginModal }) => {
    const pageRef = useRef<HTMLDivElement>(null);
    const [badgeConfig, setBadgeConfig] = useState<{ timestamp: Date | null, text: string }>({ timestamp: new Date(), text: 'New Design System' });
    const [isEditBadgeModalOpen, setIsEditBadgeModalOpen] = useState(false);
    const [editText, setEditText] = useState('');
    const [shouldUpdateTimestamp, setShouldUpdateTimestamp] = useState(false);
    const [isSavingBadge, setIsSavingBadge] = useState(false);
    const [timeAgo, setTimeAgo] = useState('');

    // Scroll Logic State
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isPaused, setIsPaused] = useState(false);

    const isAdmin = user && ADMIN_UIDS.includes(user.uid);

    useEffect(() => {
        // Trigger fade-in animation
        const timer = setTimeout(() => {
            pageRef.current?.classList.add('visible');
        }, 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'config', 'homepage'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const ts = data.timestamp ? data.timestamp.toDate() : new Date();
                setBadgeConfig({ 
                    timestamp: ts,
                    text: data.text || 'New Design System' 
                });
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Update "time ago" every minute
        const updateTime = () => {
            setTimeAgo(getTimeAgo(badgeConfig.timestamp));
        };
        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, [badgeConfig.timestamp]);

    // Infinite Horizontal Auto-Scroll Logic
    useEffect(() => {
        const scrollContainer = scrollRef.current;
        if (!scrollContainer) return;

        let animationFrameId: number;

        const scroll = () => {
            const halfWidth = scrollContainer.scrollWidth / 2;

            // Infinite scroll reset: if we've scrolled past the first set (halfway), loop back.
            // Checks boundaries on every frame to support seamless manual scrolling.
            // Using subtraction instead of setting to 0 preserves pixel-level scroll precision.
            if (scrollContainer.scrollLeft >= halfWidth) {
                scrollContainer.scrollLeft -= halfWidth;
            }

            if (!isPaused) {
                scrollContainer.scrollLeft += 0.8; // Adjust speed here (lower is slower)
            }
            animationFrameId = requestAnimationFrame(scroll);
        };

        animationFrameId = requestAnimationFrame(scroll);

        return () => cancelAnimationFrame(animationFrameId);
    }, [isPaused]);

    const handleEditBadgeClick = () => {
        setEditText(badgeConfig.text);
        setShouldUpdateTimestamp(false);
        setIsEditBadgeModalOpen(true);
    };

    const handleSaveBadgeConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingBadge(true);
        try {
            const payload: any = {
                text: editText
            };
            if (shouldUpdateTimestamp) {
                payload.timestamp = Timestamp.now();
            }
            
            // Using merge: true to preserve timestamp if we aren't updating it, 
            // but here we might want to be explicit.
            await setDoc(doc(db, 'config', 'homepage'), payload, { merge: true });
            
            setIsEditBadgeModalOpen(false);
        } catch (error) {
            console.error("Failed to save badge config:", error);
            alert("Failed to update badge.");
        } finally {
            setIsSavingBadge(false);
        }
    };
    
    return (
        <div ref={pageRef} className="page-transition bg-black min-h-screen w-full text-white selection:bg-blue-500/30 selection:text-white font-sans">
            
            {/* --- HERO SECTION --- */}
            <section className="relative pt-24 md:pt-32 flex flex-col min-h-screen">
                <div className="flex-1 flex flex-col justify-center items-start w-full px-4 max-w-[1400px] mx-auto z-10 relative pt-10 md:pt-20">

                    {/* Buttons */}
                    <div className="flex flex-row gap-4 animate-fadeIn w-full justify-start mb-6 md:mb-8" style={{ animationDelay: '0.1s' }}>
                        {user ? (
                            <>
                                 <button 
                                    onClick={() => navigateTo(Page.Community)} 
                                    className="px-8 py-2.5 md:px-10 md:py-3 rounded-full bg-white text-black font-bold text-sm md:text-base hover:bg-neutral-200 transition-colors tracking-tighter"
                                >
                                    Community
                                </button>
                                <button 
                                    onClick={() => navigateTo(Page.Chat)} 
                                    className="px-8 py-2.5 md:px-10 md:py-3 rounded-full bg-black text-white border border-white font-bold text-sm md:text-base hover:bg-white/10 transition-colors tracking-tighter"
                                >
                                    Let's Chat
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                    onClick={openLoginModal} 
                                    className="px-8 py-2.5 md:px-10 md:py-3 rounded-full bg-white text-black font-bold text-sm md:text-base hover:bg-neutral-200 transition-colors tracking-tighter"
                                >
                                    login
                                </button>
                                <button 
                                    onClick={openSignupModal} 
                                    className="px-8 py-2.5 md:px-10 md:py-3 rounded-full bg-black text-white border border-white font-bold text-sm md:text-base hover:bg-white/10 transition-colors tracking-tighter"
                                >
                                    Sign up
                                </button>
                            </>
                        )}
                    </div>

                    {/* Headline */}
                    {/* Desktop Version */}
                    <h1 className="hidden md:block text-[80px] lg:text-[110px] font-bold text-white leading-none animate-fadeIn whitespace-nowrap" style={{ letterSpacing: '-1px' }}>
                        Design that <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontStyle: 'italic', letterSpacing: '0px' }}>slays</span> everytime
                    </h1>
                    
                    {/* Mobile Version */}
                    <h1 className="md:hidden text-[14vw] sm:text-[12vw] font-bold text-white leading-[1] animate-fadeIn uppercase" style={{ letterSpacing: '-2px' }}>
                        DESIGN<br/>
                        THAT <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontStyle: 'italic', textTransform: 'capitalize', letterSpacing: '0px' }}>Slays</span><br/>
                        EVERYTIME
                    </h1>

                </div>

                <div className="w-full mt-6 flex-1 relative animate-fadeIn min-h-[40vh]" style={{ animationDelay: '0.2s' }}>
                    <img 
                        src="https://i.ibb.co/wrbCrjYd/umar-5.jpg" 
                        alt="Hero background" 
                        className="hidden md:block absolute inset-0 w-full h-full object-cover object-top"
                    />
                    <img 
                        src="https://i.ibb.co/DHKtB5kc/umar-8.jpg" 
                        alt="Hero background mobile" 
                        className="md:hidden absolute inset-0 w-full h-full object-cover object-top"
                    />
                </div>
            </section>

            {/* --- PROJECTS SECTION --- */}
            <section id="projects" className="pt-8 pb-20 md:pt-12 md:pb-32 border-t border-neutral-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 flex justify-end items-end">
                    <button onClick={() => navigateTo(Page.Portfolio)} className="hidden md:block text-sm font-bold text-white border-b border-white/20 pb-1 hover:border-white transition-colors">View All Projects</button>
                </div>
                
                <div className="w-full overflow-hidden relative group/scroll">
                    {/* Using JS scroll instead of CSS animation to allow manual intervention */}
                    <div 
                        ref={scrollRef}
                        className="flex overflow-x-auto scrollbar-hide w-full cursor-grab active:cursor-grabbing space-x-4 pb-4"
                        onMouseEnter={() => setIsPaused(true)}
                        onMouseLeave={() => setIsPaused(false)}
                        onTouchStart={() => setIsPaused(true)}
                        onTouchEnd={() => {
                            // Slight delay to allow momentum to finish or user to read
                            setTimeout(() => setIsPaused(false), 1500);
                        }}
                    >
                        {[...projectImages, ...projectImages].map((project, index) => (
                            <div 
                                onClick={() => navigateTo(Page.Portfolio)} 
                                key={index} 
                                className="flex-shrink-0 w-[280px] sm:w-[320px] group relative aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 transition-transform duration-300 hover:scale-[0.98]"
                            >
                                <img src={project.url} alt={project.title} className="absolute inset-0 w-full h-full object-cover opacity-80 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90"></div>
                                <div className="absolute bottom-0 left-0 p-6 w-full">
                                    <h3 className="text-xl font-semibold text-white mb-1">{project.title}</h3>
                                    <p className="text-sm text-neutral-400 font-medium">{project.category}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            
            {/* --- ABOUT SECTION --- */}
            <section id="about" className="py-16 bg-[#050505] border-t border-neutral-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-16 items-center">
                    <div className="order-2 md:order-1">
                        <span className="inline-block py-1 px-3 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-widest mb-6">Our Mission</span>
                        <h3 className="text-3xl md:text-5xl font-semibold tracking-tighter text-white mb-6">We build brands that resonate.</h3>
                        
                        <div className="space-y-4 text-neutral-400 text-sm md:text-[15px] leading-relaxed mb-6">
                            <p>
                                umardsgn_ is a modern design studio built for brands that want clarity, identity, and impact — not just visuals. In a world full of noise and copy-paste design, we focus on precision, originality, and results. Every project is built with purpose, whether it’s branding, UI/UX, social media design, or full digital systems.
                            </p>
                            <p>
                                The studio is led by Umar Arif, a designer with 5+ years of professional experience and 1,000+ completed projects across startups, creators, and growing businesses worldwide. His approach blends strategy, creativity, and clean aesthetics to create designs that not only look premium but connect with real audiences.
                            </p>
                            <p>
                                At umardsgn_, design is more than decoration — it’s communication. We research your brand, understand your goals, and craft visuals that strengthen your identity and help you stand out in competitive spaces. From logos to full brand systems, every detail is intentional.
                            </p>
                            <p>
                                Built for the new generation of founders and creators, umardsgn_ also integrates modern tools and community-driven creativity to help brands evolve faster.
                            </p>
                            <p>
                                If you want design that speaks clearly, performs confidently, and feels unmistakably yours — you’re in the right place.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <div className="text-3xl font-bold text-white">1000+</div>
                                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mt-1">Projects</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">100+</div>
                                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mt-1">Influencers</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">50+</div>
                                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mt-1">Brands</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">100%</div>
                                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mt-1">Satisfaction rate</div>
                            </div>
                        </div>

                        <button onClick={() => navigateTo(Page.Chat)} className="inline-flex items-center font-bold text-white hover:text-neutral-300 transition-colors">
                            Let's Talk Design
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                        </button>
                    </div>
                    <div 
                        className="order-1 md:order-2 rounded-3xl overflow-hidden h-full relative group min-h-[400px]"
                    >
                         <img src="https://i.ibb.co/v4q4PtnQ/IMG-1247.jpg" alt="Designer" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                         <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl pointer-events-none"></div>
                    </div>
                </div>
            </section>

            {/* --- TESTIMONIALS SECTION --- */}
            <section id="testimonials" className="py-16 border-t border-neutral-900 bg-black relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                         <span className="text-neutral-500 font-semibold tracking-wide uppercase text-xs">Testimonials</span>
                        <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-white mt-3">
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
                                                        <p className="font-semibold text-sm text-white">{t.name}</p>
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

            {/* Edit Badge Modal */}
            <Modal isOpen={isEditBadgeModalOpen} onClose={() => setIsEditBadgeModalOpen(false)}>
                <div className="p-1">
                    <h2 className="text-2xl font-bold text-primary mb-4">Edit Homepage Badge</h2>
                    <form onSubmit={handleSaveBadgeConfig} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Content Text (e.g., "New Design System")</label>
                            <input 
                                type="text" 
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full px-4 py-2 bg-muted border border-secondary rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        
                        <div className="flex items-center space-x-3">
                             <input 
                                type="checkbox" 
                                id="update-timestamp"
                                checked={shouldUpdateTimestamp}
                                onChange={(e) => setShouldUpdateTimestamp(e.target.checked)}
                                className="w-5 h-5 rounded border-secondary text-primary bg-muted focus:ring-primary"
                            />
                            <label htmlFor="update-timestamp" className="text-sm text-primary cursor-pointer select-none">
                                Reset Timer to Now (Sets time to "0s ago")
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-primary/10">
                            <button 
                                type="button"
                                onClick={() => setIsEditBadgeModalOpen(false)}
                                className="px-4 py-2 rounded-lg border border-secondary text-secondary hover:bg-hover transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={isSavingBadge}
                                className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
                            >
                                {isSavingBadge ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>
        </div>
    );
};

export default HomePage;
