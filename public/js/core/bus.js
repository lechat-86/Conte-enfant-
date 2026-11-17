// Petit bus : permet aux gestionnaires d'événements de demander un nouveau rendu / une navigation.
let renderer = () => {};
export const setRenderer = (fn) => (renderer = fn);
export const rerender = () => renderer();
export const navigate = (path) => {
  const target = `#${path}`;
  if (location.hash === target) renderer();
  else location.hash = target;
};
let storeRef;
export const setStore = (s) => (storeRef = s);
export const getStore = () => storeRef;
