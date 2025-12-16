import { useState, useEffect } from 'react';

const useDarkMode = () => {
  const [darkMode, setDarkMode] = useState<boolean>(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const handleDarkModeChange = () => {
      setDarkMode(document.documentElement.classList.contains('dark'));
    };

    window.addEventListener('storage', handleDarkModeChange);

    return () => {
      window.removeEventListener('storage', handleDarkModeChange);
    };
  }, []);

  return darkMode;
};

export default useDarkMode;