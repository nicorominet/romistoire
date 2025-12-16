/**
 * Generates a default filename for the exported PDF.
 * @returns {string} The default filename in the format "StoryExport_YYYYMMDD_HHMMSS.pdf"
 */
export function getDefaultFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `StoryExport_${year}${month}${day}_${hours}${minutes}${seconds}.pdf`;
}
