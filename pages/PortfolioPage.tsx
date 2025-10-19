import React, { useEffect, useRef } from 'react';

const projects = [
  {
    title: "Aura Health",
    category: "Branding & Identity",
    imageUrl: "https://images.unsplash.com/photo-1558655146-364adaf1fcc9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
  {
    title: "QuantumLeap",
    category: "UI/UX Design",
    imageUrl: "https://images.unsplash.com/photo-1541462608143-67571c6738dd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
  {
    title: "CodeFlow IDE",
    category: "Web Development",
    imageUrl: "https://images.unsplash.com/photo-1605379399642-870262d3d051?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
  {
    title: "Nomad Coffee",
    category: "Packaging Design",
    imageUrl: "https://images.unsplash.com/photo-1586154955353-6284149b9173?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
  {
    title: "Fintech Solutions",
    category: "Digital Marketing",
    imageUrl: "https://images.unsplash.com/photo-1554224155-1696413565d3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
  {
    title: "Stellar eCommerce",
    category: "Brand Strategy",
    imageUrl: "https://images.unsplash.com/photo-1556740738-b6a63e2775d2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
  {
    title: "Creative Hub",
    category: "Web App Design",
    imageUrl: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=800",
  },
  {
    title: "UrbanWear",
    category: "Fashion Branding",
    imageUrl: "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?q=80&w=800",
  },
  {
    title: "DataViz Pro",
    category: "UI/UX Design",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800",
  },
  {
    title: "Helios",
    category: "Mobile App Design",
    imageUrl: "https://images.unsplash.com/photo-1620336234430-573516503c1b?q=80&w=800",
  },
  {
    title: "Momentum",
    category: "Fitness App Branding",
    imageUrl: "https://images.unsplash.com/photo-1549476464-37392f717546?q=80&w=800",
  },
  {
    title: "Echo",
    category: "Podcast Platform",
    imageUrl: "https://images.unsplash.com/photo-1590602842205-e6a175a7a13c?q=80&w=800",
  },
  {
    title: "Rhythm",
    category: "Music Streaming Service",
    imageUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=800",
  },
  {
    title: "Voyage",
    category: "Travel App",
    imageUrl: "https://images.unsplash.com/photo-1522199755839-a2bacb67c546?q=80&w=800",
  },
  {
    title: "Evergreen",
    category: "Sustainable Products",
    imageUrl: "https://images.unsplash.com/photo-1604147706283-d7119b5b822c?q=80&w=800",
  },
  {
    title: "Mindscape",
    category: "AI Wellness App",
    imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=800"
  },
  {
    title: "Terra",
    category: "Eco-friendly Marketplace",
    imageUrl: "https://images.unsplash.com/photo-1623126742387-4d436113c18b?q=80&w=800"
  },
  {
    title: "Volt",
    category: "EV Charging Network",
    imageUrl: "https://images.unsplash.com/photo-1614026480209-58b420c85311?q=80&w=800"
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