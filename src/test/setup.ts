// Shared vitest setup for the BizPilot domain/business-logic tests.
//
// jest-dom adds custom jest matchers for asserting on DOM nodes, e.g.
//   expect(element).toHaveTextContent(/react/i)
window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      media: '',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    };
  };

const requestAnimationFrameFallback = (callback: FrameRequestCallback) =>
  window.setTimeout(() => callback(Date.now()), 16);

const cancelAnimationFrameFallback = (handle: number) => window.clearTimeout(handle);

window.requestAnimationFrame = window.requestAnimationFrame || requestAnimationFrameFallback;
window.cancelAnimationFrame = window.cancelAnimationFrame || cancelAnimationFrameFallback;
globalThis.requestAnimationFrame =
  globalThis.requestAnimationFrame || window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame =
  globalThis.cancelAnimationFrame || window.cancelAnimationFrame.bind(window);

import '@testing-library/jest-dom/extend-expect';
