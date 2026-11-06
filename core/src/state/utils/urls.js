const origin = typeof window === 'undefined' ? 'http://test.com' : window.location.origin

/**
 * Standard URL resolution: the base is resolved against the page origin (a placeholder outside
 * a browser), then the url against the base. An absolute url ignores the base, a root path
 * ("/x") keeps only its host, a relative path is resolved under it (end the base with "/").
 * @param {string} url
 * @param {string} [baseURL]
 * @returns {URL}
 */
export const pathURL = (url, baseURL) => new URL(url, new URL(baseURL ?? '', origin))
