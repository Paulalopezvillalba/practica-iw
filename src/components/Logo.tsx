import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'gold' | 'black';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', variant = 'gold' }) => {
  const sizes = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
    xl: 'h-24',
  };

  const textColor = variant === 'gold' ? 'text-gold' : 'text-black';

  return (
    <div className={`inline-flex items-center justify-center ${sizes[size]} ${className}`}>
      <div className="relative h-full aspect-[1.2/1] flex items-center justify-center">
        {/* The 3D-effect 4-pointed star */}
        <svg
          viewBox="0 0 100 100"
          className="absolute top-0 left-[42%] -translate-x-1/2 w-[35%] h-[35%] z-10 drop-shadow-md"
        >
          <defs>
            <linearGradient id="star-gold-main" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F9E29C" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#9B7E23" />
            </linearGradient>
            <filter id="star-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          {/* Main star shape with 3D facets */}
          <path
            d="M50 0 L58 42 L100 50 L58 58 L50 100 L42 58 L0 50 L42 42 Z"
            fill="url(#star-gold-main)"
            filter="url(#star-glow)"
          />
          
          {/* Highlight facet */}
          <path
            d="M50 0 L58 42 L50 50 Z"
            fill="white"
            fillOpacity="0.5"
          />
          <path
            d="M50 0 L42 42 L50 50 Z"
            fill="white"
            fillOpacity="0.3"
          />
          
          {/* Shadow facet */}
          <path
            d="M50 100 L58 58 L50 50 Z"
            fill="black"
            fillOpacity="0.2"
          />
          <path
            d="M50 100 L42 58 L50 50 Z"
            fill="black"
            fillOpacity="0.4"
          />
        </svg>
        
        {/* The "og" text - using font-serif with specific styling to match the image */}
        <span className={`font-serif text-[1.8em] font-bold leading-none select-none ${textColor} tracking-[-0.08em] flex items-baseline`}>
          <span className="relative">o</span>
          <span className="relative -ml-[0.05em]">g</span>
        </span>
      </div>
    </div>
  );
};
