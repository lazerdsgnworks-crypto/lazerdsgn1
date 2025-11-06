import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ShimmeringText from "./ui/ShimmeringText.tsx";

const phrases = [
  "Agent is thinking...",
  "Processing your request...",
  "Analyzing the data...",
  "Generating response...",
  "Almost there...",
];

const AnalyzingIndicator: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % phrases.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center py-2 h-10">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <ShimmeringText text={phrases[currentIndex]} className="text-base font-medium" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AnalyzingIndicator;
