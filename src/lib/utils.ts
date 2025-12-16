import { twMerge } from 'tailwind-merge';
import clsx, { ClassValue } from 'clsx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getAgeGroupColor(ageGroup: string): string {
  switch (ageGroup) {
    case "2-3":
      return "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100 dark:hover:bg-green-800";
    case "4-6":
      return "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800";
    case "7-9":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100 dark:hover:bg-yellow-800";
    case "10-12":
      return "bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900 dark:text-pink-100 dark:hover:bg-pink-800";
    case "13-15":
      return "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100 dark:hover:bg-purple-800";
    case "16-18":
      return "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-100 dark:hover:bg-orange-800";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700";
  }
}

function stripHtmlTags(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  let text = tmp.textContent || tmp.innerText || "";
  return text.trim(); // Trim leading/trailing spaces
}

async function optimizeImage(imageData: string, maxSizeKB = 500): Promise<string> {
  if (!imageData.startsWith('data:image')) {
    return imageData;
  }

  const getImageSize = (data: string): number => {
    const base64Length = data.split(',')[1].length;
    return (base64Length * 3) / 4;
  };

  const currentSize = getImageSize(imageData) / 1024; // Convert to KB
  if (currentSize <= maxSizeKB) {
    return imageData;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Réduire progressivement la taille jusqu'à atteindre la taille cible
      const scale = Math.sqrt(maxSizeKB / currentSize);
      width *= scale;
      height *= scale;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageData);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = imageData;
  });
}


function formatDate(dateString: string | Date, locale: string = 'fr'): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export { cn, getAgeGroupColor, stripHtmlTags, optimizeImage, formatDate, truncateText };