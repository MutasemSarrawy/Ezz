'use strict';

(function () {
  // Ask before destructive actions.
  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });
  // Save a select change immediately (e.g. enrollment status).
  document.querySelectorAll('form[data-autosubmit] select').forEach((select) => {
    select.addEventListener('change', () => select.form.submit());
  });
})();
