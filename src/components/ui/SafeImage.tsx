import React, { useState } from "react";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  alt: string;
}

const defaultFallback = "/assets/image-placeholder.png";

const SafeImage: React.FC<SafeImageProps> = ({ src, fallbackSrc = defaultFallback, alt, ...props }) => {
  const [imgSrc, setImgSrc] = useState(src);
  const handleError = () => setImgSrc(fallbackSrc);
  return <img src={imgSrc} alt={alt} onError={handleError} {...props} />;
};

export default SafeImage;
