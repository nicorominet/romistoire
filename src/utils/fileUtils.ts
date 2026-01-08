/**
 * Triggers a browser download for a Blob object.
 * 
 * @param {Blob} blob - The blob data to download.
 * @param {string} filename - The filename to save as.
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
};

/**
 * Generates a filename with current date suffix.
 * 
 * @param {string} prefix - The prefix for the filename (e.g. "export").
 * @param {string} extension - The file extension (e.g. "json").
 * @returns {string} The formatted filename.
 */
export const generateDateFilename = (prefix: string, extension: string): string => {
    const dateStr = new Date().toISOString().slice(0, 10);
    return `${prefix}-${dateStr}.${extension}`;
};
