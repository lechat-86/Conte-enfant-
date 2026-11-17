let renderer = () => {}; let storeRef;
export const setRenderer = (f) => (renderer = f);
export const rerender = () => renderer();
export const navigate = (path) => { const t = `#${path}`; if (location.hash === t) renderer(); else location.hash = t; };
export const setStore = (s) => (storeRef = s);
export const getStore = () => storeRef;
