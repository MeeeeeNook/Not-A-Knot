import React from 'react';

interface LockIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Pure SVG Lock component.
 * Replaces lucide-react's Lock to prevent conflicts with the browser's native Web Locks API (window.Lock)
 * which throws "TypeError: Illegal constructor" when instantiated or evaluated in sandboxed environments.
 */
export const LockIcon: React.FC<LockIconProps> = ({ className = 'w-4 h-4', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const Lock = LockIcon;
export default LockIcon;
