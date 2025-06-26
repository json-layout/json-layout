const origin = typeof window === 'undefined' ? 'http://test.com' : window.location.origin

export const pathURL = (/** @type {string} */url, /** @type {string} */baseURL) => {
  if (url.startsWith('http://') || url.startsWith('https://')) return new URL(url)
  if (url.startsWith('/')) return new URL(origin + url)
  return new URL(origin + baseURL + url)
}
