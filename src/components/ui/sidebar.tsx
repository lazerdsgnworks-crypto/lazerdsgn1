import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  LayoutDashboard,
  Settings,
  UserCircle,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Palette,
  Users,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", icon: LayoutDashboard, href: "#" },
  { label: "Portfolio", icon: Palette, href: "#" },
  { label: "Community", icon: Users, href: "#" },
  { label: "Chat", icon: MessageSquare, href: "#" },
  { label: "About", icon: Info, href: "#" },
];

const Sidebar: React.FC<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}> = ({ isOpen, setIsOpen }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const sidebarVariants = {
    collapsed: { width: "4.5rem" },
    expanded: { width: "16rem" },
  };

  const mobileSidebarVariants = {
    closed: { x: "-100%" },
    open: { x: "0%" },
  };
  
  const navLinkVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.div
        variants={sidebarVariants}
        initial="collapsed"
        animate={isExpanded ? "expanded" : "collapsed"}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className="hidden md:flex flex-col justify-between h-screen sticky top-0 bg-bg-secondary border-r border-border-primary py-4"
      >
        <div>
          <div className="flex items-center gap-2 px-4 mb-8">
            <motion.div animate={{ rotate: isExpanded ? 360 : 0 }} transition={{ duration: 0.5 }}>
              <div className="w-8 h-8 bg-bg-primary-accent rounded-lg"></div>
            </motion.div>
            <AnimatePresence>
            {isExpanded && (
                <motion.span 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                  className="font-bold text-lg text-primary overflow-hidden whitespace-nowrap">umardsgn_</motion.span>
            )}
            </AnimatePresence>
          </div>
          <nav className="flex flex-col gap-2 px-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-4 text-secondary hover:text-primary hover:bg-bg-hover p-3 rounded-lg transition-colors"
              >
                <link.icon className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                {isExpanded && (
                   <motion.span variants={navLinkVariants} initial="hidden" animate="visible" exit="hidden" transition={{ duration: 0.2, delay: 0.2 }} className="overflow-hidden whitespace-nowrap">{link.label}</motion.span>
                )}
                </AnimatePresence>
              </a>
            ))}
          </nav>
        </div>
        <div className="px-3">
            <div className="border-t border-border-primary mb-2"></div>
             <a href="#" className="flex items-center gap-4 text-secondary hover:text-primary hover:bg-bg-hover p-3 rounded-lg transition-colors">
                <Settings className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                {isExpanded && (
                   <motion.span variants={navLinkVariants} initial="hidden" animate="visible" exit="hidden" transition={{ duration: 0.2, delay: 0.2 }} className="overflow-hidden whitespace-nowrap">Settings</motion.span>
                )}
                </AnimatePresence>
              </a>
             <a href="#" className="flex items-center gap-4 text-secondary hover:text-primary hover:bg-bg-hover p-3 rounded-lg transition-colors">
                <LogOut className="w-5 h-5 flex-shrink-0" />
                 <AnimatePresence>
                {isExpanded && (
                   <motion.span variants={navLinkVariants} initial="hidden" animate="visible" exit="hidden" transition={{ duration: 0.2, delay: 0.2 }} className="overflow-hidden whitespace-nowrap">Logout</motion.span>
                )}
                </AnimatePresence>
              </a>
        </div>
      </motion.div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              variants={mobileSidebarVariants}
              initial="closed"
              animate="open"
              exit="closed"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed top-0 left-0 h-full w-64 bg-bg-secondary border-r border-border-primary z-50 flex flex-col justify-between py-4"
            >
             <div>
                <div className="flex items-center justify-between px-4 mb-8">
                    <span className="font-bold text-lg text-primary">umardsgn_</span>
                    <button onClick={() => setIsOpen(false)} className="p-1 rounded-md text-secondary hover:text-primary hover:bg-bg-hover">
                        <X size={20} />
                    </button>
                </div>
                 <nav className="flex flex-col gap-2 px-3">
                    {navLinks.map((link) => (
                      <a key={link.label} href={link.href} className="flex items-center gap-4 text-secondary hover:text-primary hover:bg-bg-hover p-3 rounded-lg transition-colors">
                        <link.icon className="w-5 h-5" />
                        <span>{link.label}</span>
                      </a>
                    ))}
                 </nav>
              </div>
               <div className="px-3">
                    <div className="border-t border-border-primary mb-2"></div>
                    <a href="#" className="flex items-center gap-4 text-secondary hover:text-primary hover:bg-bg-hover p-3 rounded-lg transition-colors">
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                    </a>
                    <a href="#" className="flex items-center gap-4 text-secondary hover:text-primary hover:bg-bg-hover p-3 rounded-lg transition-colors">
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </a>
                </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
