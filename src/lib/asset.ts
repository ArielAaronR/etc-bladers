// A file in public/, prefixed with the site's base path (/ locally, /<repo>/ on GitHub Pages).
export const asset = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
