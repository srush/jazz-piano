/** Resolve public assets and routes for both localhost and GitHub project Pages. */
export const siteBase = import.meta.env?.BASE_URL ?? '/';
export const sitePath = (path: string) => `${siteBase}${path.replace(/^\//, '')}`;
