// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/extend-expect';

// Mock matchmedia
window.matchMedia = window.matchMedia || function() {
  return {
      matches: false,
      media: '',
      onchange: null,
      addListener: function() {},
      removeListener: function() {},
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return false; }
  };
};

const requestAnimationFrameFallback = (callback: FrameRequestCallback) =>
  window.setTimeout(() => callback(Date.now()), 16);

const cancelAnimationFrameFallback = (handle: number) => window.clearTimeout(handle);

window.requestAnimationFrame = window.requestAnimationFrame || requestAnimationFrameFallback;
window.cancelAnimationFrame = window.cancelAnimationFrame || cancelAnimationFrameFallback;
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || window.cancelAnimationFrame.bind(window);
