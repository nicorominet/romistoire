/**
 * Images accepted as illustrations, shared by the client (file pickers, checks before upload)
 * and the server (upload filter). Type -> extension written on disk: the extension never comes
 * from the client file name, so an "image" can't be served as HTML.
 */
export const IMAGE_EXTENSIONS = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
});

export const ACCEPTED_IMAGE_TYPES = Object.freeze(Object.keys(IMAGE_EXTENSIONS));

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
