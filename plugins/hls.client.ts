// HLS.js is loaded on-demand in the VideoPlayer component
// This plugin just ensures it's available as a client-side module
export default defineNuxtPlugin(() => {
  // HLS.js will be imported dynamically where needed:
  // const Hls = (await import('hls.js')).default
})
