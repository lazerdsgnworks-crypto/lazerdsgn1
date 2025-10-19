import React, { useEffect, useRef } from 'react';

const projects = [
  {
    title: "Project Alpha",
    category: "Branding & Identity",
    imageUrl: "https://images.unsplash.com/photo-1558655146-364adaf1fcc9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
  {
    title: "Project Beta",
    category: "UI/UX Design",
    imageUrl: "https://images.unsplash.com/photo-1541462608143-67571c6738dd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
  {
    title: "Project Gamma",
    category: "Web Development",
    imageUrl: "https://images.unsplash.com/photo-1605379399642-870262d3d051?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
  {
    title: "Project Delta",
    category: "Packaging Design",
    imageUrl: "https://images.unsplash.com/photo-1586154955353-6284149b9173?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
    {
    title: "Project Epsilon",
    category: "Digital Marketing",
    imageUrl: "https://images.unsplash.com/photo-1554224155-1696413565d3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
  },
  {
    title: "Project Zeta",
    category: "Brand Strategy",
    imageUrl: "https://images.unsplash.com/photo-1556740738-b6a63e2775d2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
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
    <div ref={pageRef} className="page-transition bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-black">Our Work</h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-600">
            We transform ideas into visually stunning realities. Explore a selection of our favorite projects.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <div key={index} className="group relative block w-full aspect-w-4 aspect-h-3 rounded-lg bg-gray-100 overflow-hidden shadow-lg transform transition-transform duration-300 hover:scale-105">
              <img src={project.imageUrl} alt={project.title} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-75" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-6">
                <h3 className="text-xl font-bold text-white">{project.title}</h3>
                <p className="text-sm text-gray-300">{project.category}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortfolioPage;