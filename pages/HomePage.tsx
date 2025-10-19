import React, { useEffect, useRef } from 'react';
import { Page } from '../types';

interface HomePageProps {
    navigateTo: (page: Page) => void;
    openSignupModal: () => void;
}

const projectImages = [
    "https://scontent-yyz1-1.cdninstagram.com/v/t39.30808-6/448053683_18016089239462277_1706490523141910716_n.jpg?stp=dst-jpg_e35_s1080x1080_sh0.08_tt6&_nc_ht=scontent-yyz1-1.cdninstagram.com&_nc_cat=109&_nc_oc=Q6cZ2QG2_RuwZ_cuivMEVLYB8jOsuQzehcFaeVEzXu8RH9E8mEmV3WclLfyu6sZnpafAxHY&_nc_ohc=wjKrVwJEMQQ7kNvwE3E-aL&_nc_gid=ekLIMfi8Zy_948n0zTlPig&edm=AOQ1c0wAAAAA&ccb=7-5&oh=00_AfekU30Joc3Kekm-hHKY1O_rj_TTOoXpuWaes2rgequdEA&oe=68EC7AF5&_nc_sid=8b3546",
    "https://scontent-yyz1-1.cdninstagram.com/v/t51.29350-15/443818718_1382545049122221_4199523028025648075_n.jpg?stp=dst-jpg_e35_s1080x1080_tt6&_nc_ht=scontent-yyz1-1.cdninstagram.com&_nc_cat=109&_nc_oc=Q6cZ2QG2_RuwZ_cuivMEVLYB8jOsuQzehcFaeVEzXu8RH9E8mEmV3WclLfyu6sZnpafAxHY&_nc_ohc=LDwMU3PD-UIQ7kNvwEdY_gV&_nc_gid=ekLIMfi8Zy_948n0zTlPig&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AfdxshxffkYEupiNpSnVctG-qQ0BkTe8Dtc6uHfr58KASA&oe=68EC4365&_nc_sid=8b3546",
    "https://scontent-yyz1-1.cdninstagram.com/v/t51.29350-15/436293798_1195941888434583_1689967636691776728_n.jpg?stp=dst-jpg_e35_s1080x1080_tt6&_nc_ht=scontent-yyz1-1.cdninstagram.com&_nc_cat=103&_nc_oc=Q6cZ2QG2_RuwZ_cuivMEVLYB8jOsuQzehcFaeVEzXu8RH9E8mEmV3WclLfyu6sZnpafAxHY&_nc_ohc=dQDojFcTiYoQ7kNvwHSlbVs&_nc_gid=ekLIMfi8Zy_948n0zTlPig&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AfcCyi-ICJTt1fN8vLDdoUMeg_ibcMD_ufaY0ksevYP8uw&oe=68EC4C26&_nc_sid=8b3546",
    "https://scontent-yyz1-1.cdninstagram.com/v/t39.30808-6/467011234_18033346106462277_8299430617094443203_n.jpg?stp=dst-jpg_e35_s1080x1080_sh0.08_tt6&_nc_ht=scontent-yyz1-1.cdninstagram.com&_nc_cat=109&_nc_oc=Q6cZ2QG2_RuwZ_cuivMEVLYB8jOsuQzehcFaeVEzXu8RH9E8mEmV3WclLfyu6sZnpafAxHY&_nc_ohc=-K5J6DB7XbgQ7kNvwHet5XU&_nc_gid=ekLIMfi8Zy_948n0zTlPig&edm=AOQ1c0wAAAAA&ccb=7-5&oh=00_Afet36Soz1JKj2E6XfV1uQ2XCez5fZi0XTsapxH-5Ifb4A&oe=68EC7697&_nc_sid=8b3546",
];

const testimonials = [
    { name: "Saman Malik", title: "Brand Director", avatar: "https://placehold.co/40x40/9CA3AF/ffffff?text=S", text: "LazerDsgn guided our brand through a complex re-design process, providing ongoing expertise and ensuring our final look was pitch perfect." },
    { name: "Ahmed Khan", title: "Marketing Lead", avatar: null, avatarInitial: "A", text: "The new visual system LazerDsgn delivered instantly elevated our presence in a crowded market. Their process is smooth and highly collaborative." },
    { name: "Hassan Ali", title: "Digital Strategist", avatar: "https://placehold.co/40x40/1F2937/ffffff?text=H", text: "Our website conversions doubled after the UI/UX overhaul. LazerDsgn's focus on user experience married with beautiful design is unmatched." },
    { name: "Zainab Hussain", title: "Creative Manager", avatar: "https://placehold.co/40x40/D1D5DB/ffffff?text=Z", text: "The robust design consultation and fast delivery from LazerDsgn have streamlined our production workflow, making our internal marketing significantly more efficient." },
    { name: "Maria Rodriguez", title: "Founder, Small Retail", avatar: null, avatarInitial: "M", text: "The execution of our campaign assets exceeded expectations. Every touchpoint felt integrated and premium, improving overall brand perception." },
];


const HomePage: React.FC<HomePageProps> = ({ navigateTo, openSignupModal }) => {
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
            <section id="hero" className="py-24 md:py-40 text-center">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h1 className="hero-headline tracking-tighter text-black mb-6">
                        Design that makes <br className="hidden sm:block" /> your brand pop.
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
                        We specialize in sharp, modern graphic design and brand strategy. Stop settling for mediocre visuals and let LazerDsgn create an identity that genuinely connects with your audience.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                         <button onClick={() => navigateTo(Page.Portfolio)} className="inline-flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-xl text-black bg-white shadow-sm hover:bg-gray-50 transition">
                            View Projects
                        </button>
                        <button onClick={openSignupModal} className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-black shadow-lg hover:bg-gray-800 transition">
                            Start Your Project
                        </button>
                    </div>
                </div>
            </section>

            <section id="projects" className="py-24 md:py-32 bg-white text-black">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-8">
                        Curating high-impact visual identities.
                    </h2>
                </div>
                <div className="slider-container overflow-hidden relative">
                    <div className="slider-track">
                        {[...projectImages, ...projectImages].map((src, index) => (
                            <a href="#" key={index} onClick={(e) => { e.preventDefault(); navigateTo(Page.Portfolio);}} className="slider-item group inline-block relative aspect-[3/4] overflow-hidden rounded-lg shadow-xl transform transition-transform duration-300 hover:scale-[1.02]">
                                <img src={src} alt={`Project ${index + 1}`} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 group-hover:opacity-75" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                <div className="absolute bottom-4 left-4">
                                    <h3 className="text-2xl font-semibold text-white">Project {index % projectImages.length + 1}</h3>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            </section>

            <section id="testimonials" className="py-24 md:py-32 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-black mt-4 mb-3">
                            What our clients say
                        </h2>
                    </div>
                    <div className="reviews-scroll-container">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full">
                            {[1, 2, 3].map(col => (
                                <div key={col} className={`col-${col} ${col > 1 ? 'hidden' : ''} ${col === 2 ? 'md:block' : ''} ${col === 3 ? 'lg:block' : ''} overflow-hidden`}>
                                    <div className="review-column">
                                        {[...testimonials, ...testimonials].map((t, index) => (
                                            <div key={`${col}-${index}`} className="p-8 bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                <p className="text-gray-700 text-lg mb-6">{t.text}</p>
                                                <div className="flex items-center">
                                                    {t.avatar ? <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                                                        : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700">{t.avatarInitial}</div>
                                                    }
                                                    <div className="ml-4"><p className="font-semibold text-sm text-black">{t.name}</p><p className="text-xs text-gray-500">{t.title}</p></div>
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