import React from 'react';

// Using a simple object for class names for this one-off component.
const shimmerClasses = {
  container: "inline-flex items-center justify-center",
  text: "animate-shimmer bg-clip-text text-transparent bg-[linear-gradient(110deg,var(--text-muted),45%,var(--text-primary),55%,var(--text-muted))] bg-[length:250%_100%]"
};

interface ShimmeringTextProps {
  text: string;
  className?: string;
}

const ShimmeringText: React.FC<ShimmeringTextProps> = ({ text, className }) => {
  return (
    <p className={`${shimmerClasses.container} ${className || ''}`}>
      <span className={shimmerClasses.text}>{text}</span>
    </p>
  );
};

export default ShimmeringText;
