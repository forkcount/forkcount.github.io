import React from 'react';

interface ForkCountLogoProps {
  className?: string;
}

export const ForkCountLogo: React.FC<ForkCountLogoProps> = ({ className = 'size-7 shrink-0' }) => (
  <svg
    viewBox="0 0 512 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={`rounded-[22%] ring-1 ring-teal-500/30 ${className}`}
  >
    <rect width="512" height="512" rx="112" fill="#09090b" />
    <circle cx="256" cy="256" r="150" stroke="#27272a" strokeWidth="36" fill="none" />
    <circle
      cx="256"
      cy="256"
      r="150"
      stroke="#14b8a6"
      strokeWidth="36"
      strokeDasharray="720 942"
      strokeLinecap="round"
      transform="rotate(-90 256 256)"
      fill="none"
    />
    <path d="M256 176v160M196 256h120" stroke="#f4f4f5" strokeWidth="28" strokeLinecap="round" />
  </svg>
);
