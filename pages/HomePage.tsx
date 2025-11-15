import React, { useEffect, useRef } from 'react';
import { Page, User } from '../types';

// Add TypeScript declaration for the Framer custom element
declare namespace JSX {
    interface IntrinsicElements {
        'framer-vIhm-prod': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
}

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
    },
    {
        url: "https://images.unsplash.com/photo-1559028006-44d08a52084c?q=80&w=800",
        title: "Nexus",
        category: "Product Design"
    },
    {
        url: "https://images.unsplash.com/photo-1611162616475-46b6352b1260?q=80&w=800",
        title: "Streamline",
        category: "App Branding"
    }
];


const testimonials = [
    { name: "Saman Malik", title: "Brand Director", avatar: "https://placehold.co/40x40/9CA3AF/ffffff?text=S", text: "LazerDsgn guided our brand through a complex re-design process, providing ongoing expertise and ensuring our final look was pitch perfect." },
    { name: "Ahmed Khan", title: "Marketing Lead", avatar: null, avatarInitial: "A", text: "The new visual system LazerDsgn delivered instantly elevated our presence in a crowded market. Their process is smooth and highly collaborative." },
    { name: "Hassan Ali", title: "Digital Strategist", avatar: "https://placehold.co/40x40/1F2937/ffffff?text=H", text: "Our website conversions doubled after the UI/UX overhaul. LazerDsgn's focus on user experience married with beautiful design is unmatched." },
    { name: "Zainab Hussain", title: "Creative Manager", avatar: "https://i.ibb.co/c7BZmyt/Gemini-Generated-Image-qef4a1qef4a1qef4.png", text: "The robust design consultation and fast delivery from LazerDsgn have streamlined our production workflow, making our internal marketing significantly more efficient." },
    { name: "Maria Rodriguez", title: "Founder, Small Retail", avatar: null, avatarInitial: "M", text: "The execution of our campaign assets exceeded expectations. Every touchpoint felt integrated and premium, improving overall brand perception." },
];

const LiquidBackground = () => {
    return React.createElement('framer-vIhm-prod', {
        style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: -1,
        }
    });
};

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
        <div ref={pageRef} className="page-transition">
            <section id="hero" className="relative pt-40 pb-16 md:pt-48 md:pb-24 text-center overflow-hidden">
                <LiquidBackground />
                <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="hero-headline tracking-tighter text-primary mb-6">
                    Unleash Your<br className="hidden sm:block" /> creativity
                    </h2>
                    <p className="text-lg md:text-xl text-secondary max-w-2xl mx-auto mb-10">
                        We specialize in sharp, modern graphic design and brand strategy. Stop settling for mediocre visuals and let LazerDsgn create an identity that genuinely connects with your audience.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4 mx-auto sm:max-w-none">
                        {user ? (
                            <>
                                <button onClick={() => navigateTo(Page.Chat)} className="btn btn-secondary">
                                    Let's Chat
                                </button>
                                <button onClick={() => navigateTo(Page.Community)} className="btn btn-primary">
                                    Join Community
                                </button>
                            </>
                        ) : (
                             <>
                                <button onClick={openLoginModal} className="btn btn-secondary">
                                    Enter Studio
                                </button>
                                <button onClick={openSignupModal} className="btn btn-primary">
                                    Start Creating
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            <section id="projects" className="py-16 md:py-24 bg-primary text-primary overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-8">
                        Curating high-impact visual identities.
                    </h2>
                </div>
                <div className="slider-track">
                    {[...projectImages, ...projectImages].map((project, index) => (
                        <div onClick={() => navigateTo(Page.Portfolio)} key={index} className="cursor-pointer slider-item group inline-block relative aspect-[3/4] overflow-hidden rounded-lg shadow-xl transform transition-transform duration-300 hover:scale-[1.02]">
                            <img src={project.url} alt={project.title} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 group-hover:opacity-75" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            <div className="absolute bottom-4 left-4">
                                <h3 className="text-2xl font-semibold text-white">{project.title}</h3>
                                <p className="text-sm text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">{project.category}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
            
            <section id="about" className="py-24 md:py-32 bg-primary relative overflow-hidden">
                <div className="absolute -left-32 -top-32 w-96 h-96 bg-secondary-accent/5 dark:bg-secondary-accent/10 rounded-full blur-3xl"></div>
                <div className="absolute -right-32 -bottom-48 w-96 h-96 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-x-16 gap-y-12 items-center relative z-10">
                    <div className="order-2 md:order-1">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary-accent mb-3">Our Mission</h2>
                        <h3 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-primary mb-6">We build brands that resonate.</h3>
                        <p className="text-secondary mb-4 text-lg leading-relaxed">
                            Our mission is simple: to help brands connect with their audiences through exceptional design. We believe that great design is not just about aesthetics; it's about creating meaningful experiences that drive results.
                        </p>
                        <p className="text-secondary text-lg leading-relaxed">
                            From startups to established enterprises, we provide the creative firepower to help you stand out.
                        </p>
                        <button onClick={() => navigateTo(Page.Chat)} className="btn btn-primary mt-8">Let's Talk Design</button>
                    </div>
                    <div 
                        className="order-1 md:order-2 rounded-2xl shadow-2xl aspect-[4/5] bg-muted bg-cover bg-center transform md:hover:scale-105 transition-transform duration-500 ease-in-out"
                        style={{ backgroundImage: `url('https://i.ibb.co/v4q4PtnQ/IMG-1247.jpg')` }}
                        role="img"
                        aria-label="A portrait of the designer"
                    >
                    </div>
                </div>
            </section>

            <section id="testimonials" className="py-24 md:py-32 bg-primary">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-primary mt-4 mb-3">
                            What our clients say
                        </h2>
                    </div>
                    <div className="reviews-scroll-container">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full">
                            {[1, 2, 3].map(col => (
                                <div key={col} className={`col-${col} ${col > 1 ? 'hidden' : ''} ${col === 2 ? 'md:block' : ''} ${col === 3 ? 'lg:block' : ''} overflow-hidden`}>
                                    <div className="review-column">
                                        {[...testimonials, ...testimonials].map((t, index) => (
                                            <div key={`${col}-${index}`} className="p-8 bg-secondary border border-primary rounded-2xl shadow-sm">
                                                <p className="text-secondary text-lg mb-6">{t.text}</p>
                                                <div className="flex items-center">
                                                    {t.avatar ? <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                                                        : <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-secondary">{t.avatarInitial}</div>
                                                    }
                                                    <div className="ml-4"><p className="font-semibold text-sm text-primary">{t.name}</p><p className="text-xs text-muted">{t.title}</p></div>
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