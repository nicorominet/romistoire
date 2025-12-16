import React from 'react';

interface SpinnerProps {
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ className }) => {
  return (
    <div className={`animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-900 ${className || ''}`}></div>
  );
};

export default Spinner;