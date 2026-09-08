const origin = typeof window === 'undefined' ? 'http://test.com' : window.location.origin

export const pathURL = (/** @type {string} */url, /** @type {string} */baseURL) => {
  if (url.startsWith('http://') || url.startsWith('https://')) return new URL(url)
  if (url.startsWith('/')) return new URL(origin + url)
  // an absolute base (a Node process pointed at a remote API) must not be glued onto the origin
  if (baseURL.startsWith('http://') || baseURL.startsWith('https://')) return new URL(baseURL + url)
  return new URL(origin + baseURL + url)
}
