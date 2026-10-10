import React, { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  alt: string;
}

/**
 * Image that degrades to a neutral placeholder (same size) when the file cannot be loaded.
 * The failure is remembered per source: a new `src` (other story, filter, navigation) is loaded again.
 */
const SafeImage: React.FC<SafeImageProps> = ({ src, alt, className, onError, ...props }) => {
  const [failedSrc, setFailedSrc] = useState<string | undefined>();

  if (!src || failedSrc === src) {
    return (
      <span role="img" aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageOff aria-hidden="true" className="h-5 w-5 opacity-60" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(event) => { setFailedSrc(src); onError?.(event); }}
      {...props}
    />
  );
};

export default SafeImage;
