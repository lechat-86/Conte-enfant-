// Délégation d'événements : les vues déclarent des attributs data-action / data-input /
// data-change / data-form ; les gestionnaires sont enregistrés ici.
const reg = { click: {}, input: {}, change: {}, submit: {} };

export const onClick = (map) => Object.assign(reg.click, map);
export const onInput = (map) => Object.assign(reg.input, map);
export const onChange = (map) => Object.assign(reg.change, map);
export const onSubmit = (map) => Object.assign(reg.submit, map);

export function installDelegation() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    reg.click[el.dataset.action]?.(el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el) reg.input[el.dataset.input]?.(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el) reg.change[el.dataset.change]?.(el, e);
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    reg.submit[form.dataset.form]?.(form, e);
  });
}
