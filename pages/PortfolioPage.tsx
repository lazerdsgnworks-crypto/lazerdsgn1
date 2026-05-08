import React, { useEffect, useRef } from 'react';

const projects = [
  {
    title: "Poster",
    category: "Design",
    imageUrl: "https://i.ibb.co/nNcpt02s/IMG-5556.jpg"
  },
  {
    title: "Website hero page",
    category: "Web Design",
    imageUrl: "https://i.ibb.co/0yNmhN2M/IMG-5351.jpg"
  },
  {
    title: "Reve Brand identity",
    category: "Brand Identity",
    imageUrl: "https://i.ibb.co/r2SgQ87s/IMG-4996.jpg"
  },
  {
    title: "rmayd",
    category: "Design",
    imageUrl: "https://i.ibb.co/Kz77x8qx/IMG-5374.jpg"
  },
  {
    title: "SCULPT Brand Identity",
    category: "Brand Identity",
    imageUrl: "https://i.ibb.co/TDcP760j/SCULPT-Brand-Identity-FULL-PROJECT-ON-BEHANCE-Made-by-lazer-dsgn-For-commercial-works-and-p.jpg"
  },
  {
    title: "Green Grove Gardens — vol. 1",
    category: "Brand Identity",
    imageUrl: "https://i.ibb.co/xS76h0hd/Green-Grove-Gardens-Brand-Identity-For-commercial-work-visit-my-websitehttps-lazergraphics-odo-1.jpg"
  },
  {
    title: "Verve Brand Identity",
    category: "Brand Identity",
    imageUrl: "https://i.ibb.co/gbCcC2C9/Verve-Brand-Identity-Verve-is-a-tech-startup-specializing-in-virtual-reality-experiences-Our.jpg"
  },
  {
    title: "Horizon Quest Brand Identity",
    category: "Brand Identity",
    imageUrl: "https://i.ibb.co/BbS4kHM/Horizon-Quest-Brand-Identity-Horizon-Quest-is-an-outdoor-adventure-brand-that-encourages-explora.jpg"
  },
  {
    title: "Givenchy — reimagined by AI",
    category: "AI Campaign",
    imageUrl: "https://i.ibb.co/p64y3FHJ/Givenchy-reimagined-by-AI-a-surreal-tale-of-couture-light-and-fantasy-woven-into-every-pixel.jpg"
  },
  {
    title: "PUMA — UVU collection AI campaign",
    category: "AI Campaign",
    imageUrl: "https://i.ibb.co/sJ3T2yDQ/PUMA-AI-CAMPAIGN-UVU-COLLECTION-lazerdsgn.jpg"
  }
];

const PortfolioPage: React.FC = () => {
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
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-primary">Our Work</h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-secondary">
            We transform ideas into visually stunning realities. Explore a selection of our favorite projects.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <a href="https://www.instagram.com/umardesigns_" target="_blank" rel="noopener noreferrer" key={index} className="group relative block w-full aspect-[4/3] rounded-lg bg-muted overflow-hidden shadow-lg transform transition-transform duration-300 hover:scale-105">
              <img src={project.imageUrl} alt={project.title} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-75" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-6">
                <h3 className="text-xl font-bold text-white">{project.title}</h3>
                <p className="text-sm text-gray-300">{project.category}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortfolioPage;