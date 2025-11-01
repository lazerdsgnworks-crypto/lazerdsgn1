import React, { useEffect, useRef } from 'react';

const AboutPage: React.FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      // Trigger fade-in animation
      const timer = setTimeout(() => {
          pageRef.current?.classList.add('visible');
      }, 10);
      return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={pageRef} className="page-transition bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {/* --- Hero Section --- */}
        <div className="text-center mb-20">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-primary">About LazerDsgn</h1>
          <p className="mt-4 max-w-3xl mx-auto text-lg text-secondary">
            We are a creative studio that partners with ambitious brands to create sharp, modern designs that make an impact.
          </p>
        </div>

        {/* --- Our Mission Section --- */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-primary mb-4">Our Mission</h2>
            <p className="text-secondary mb-4">
              Our mission is simple: to help brands connect with their audiences through exceptional design. We believe that great design is not just about aesthetics; it's about creating meaningful experiences that drive results. We're committed to understanding your vision and translating it into a visual identity that is both authentic and effective.
            </p>
            <p className="text-secondary">
              From startups to established enterprises, we provide the creative firepower to help you stand out in a crowded marketplace.
            </p>
          </div>
          <div 
            className="rounded-lg shadow-lg aspect-[3/4] bg-muted bg-cover bg-top"
            style={{ backgroundImage: `url('https://i.ibb.co/XrJb8y3X/Gemini-Generated-Image-qef4a1qef4a1qef4.png')` }}
            role="img"
            aria-label="LazerDsgn Founder"
          >
            {/* Image is set as a background */}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default AboutPage;
