import fs from 'fs';

const CHUNK = 64 * 1024;

/**
 * Last lines of a text file, read from its end: the cost depends on the lines asked for,
 * not on the size of the file.
 * @param {string} file
 * @param {number} count - Lines wanted.
 * @returns {Promise<string[]>} Non-empty lines, oldest first ([] when the file is missing).
 */
export const readLastLines = async (file, count) => {
  let handle;
  try {
    handle = await fs.promises.open(file, 'r');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  try {
    const { size } = await handle.stat();
    let position = size;
    let text = '';
    // One line more than asked: the first one read may be cut
    while (position > 0 && text.split('\n').filter(Boolean).length <= count) {
      const length = Math.min(CHUNK, position);
      position -= length;
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, position);
      text = buffer.toString('utf8') + text;
    }
    const lines = text.split('\n').filter((line) => line.trim());
    // Not at the start of the file: the first line is partial
    if (position > 0) lines.shift();
    return lines.slice(-count);
  } finally {
    await handle.close();
  }
};
