import React, { useEffect, useRef } from 'react';

const teamMembers = [
  {
    name: "Alex Johnson",
    role: "Lead Designer & Founder",
    imageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=580&q=80",
    bio: "With over a decade of experience in digital design, Alex leads the team with a passion for creating bold, impactful brands."
  },
  {
    name: "Maria Garcia",
    role: "Head of UX/UI",
    imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=580&q=80",
    bio: "Maria is obsessed with user-centric design, ensuring every digital experience is intuitive, accessible, and beautiful."
  },
  {
    name: "David Chen",
    role: "Senior Brand Strategist",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=580&q=80",
    bio: "David bridges the gap between creative and business goals, crafting brand narratives that resonate with audiences."
  }
];

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
            className="rounded-lg shadow-lg aspect-[3/4] bg-muted bg-cover bg-center"
            style={{ backgroundImage: `url('https://i.ibb.co/9HrMnbgs/503807556-18053884385462277-5332689352251121463-n.jpg')` }}
            role="img"
            aria-label="LazerDsgn Founder"
          >
            {/* Image is set as a background */}
          </div>
        </div>
        
        {/* --- Meet the Team Section --- */}
        <div className="text-center mb-20">
          <h2 className="text-3xl font-bold tracking-tight text-primary mb-12">Meet the Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {teamMembers.map((member) => (
              <div key={member.name} className="text-center">
                <img className="mx-auto h-32 w-32 rounded-full object-cover mb-4 shadow-md" src={member.imageUrl} alt={member.name} />
                <h3 className="text-lg font-semibold text-primary">{member.name}</h3>
                <p className="text-blue-500 dark:text-blue-400 font-medium">{member.role}</p>
                <p className="mt-2 text-secondary text-sm">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AboutPage;