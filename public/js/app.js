(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Menu mobile
  var btn = $('#menuBtn'), nav = $('#mainNav');
  if (btn && nav) btn.addEventListener('click', function () {
    var open = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Sélecteurs de quantité
  $$('.qty').forEach(function (q) {
    var input = $('input', q), max = parseInt(q.getAttribute('data-max'), 10) || 99;
    $$('button', q).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = (parseInt(input.value, 10) || 1) + parseInt(b.getAttribute('data-d'), 10);
        input.value = Math.max(1, Math.min(max, v));
      });
    });
    input.addEventListener('change', function () { input.value = Math.max(1, Math.min(max, parseInt(input.value, 10) || 1)); });
  });

  // Galerie produit
  var main = $('#galleryMain');
  $$('.thumb').forEach(function (t) {
    t.addEventListener('click', function () {
      var img = $('img', main); if (!img) { img = document.createElement('img'); main.innerHTML = ''; main.appendChild(img); }
      img.src = t.getAttribute('data-src'); $$('.thumb').forEach(function (x) { x.classList.remove('on'); }); t.classList.add('on');
    });
  });

  // Tri automatique
  $$('[data-autosubmit]').forEach(function (s) { s.addEventListener('change', function () { s.form.submit(); }); });

  // Messages qui disparaissent
  var fl = $('.flash-ok'); if (fl) setTimeout(function () { fl.style.display = 'none'; }, 6000);
})();
