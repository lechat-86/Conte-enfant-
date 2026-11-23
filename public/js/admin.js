(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var csrf = ($('meta[name=csrf]') || {}).content;

  // Confirmations (suppression, remboursement…)
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute('data-confirm') || (e.submitter && e.submitter.getAttribute('data-confirm'));
    if (msg && !confirm(msg)) e.preventDefault();
  });

  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-print]')) window.print(); });

  // Lecture + réduction d'une image dans le navigateur
  function fileToData(file, opts) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = reject;
      r.onload = function () {
        if (file.type === 'image/svg+xml') return resolve(r.result);
        var img = new Image();
        img.onerror = function () { reject(new Error('Image illisible')); };
        img.onload = function () {
          var scale = Math.min(1, opts.max / Math.max(img.width, img.height));
          var c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          var ctx = c.getContext('2d');
          if (opts.type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL(opts.type, 0.86));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  function upload(data, kind) {
    return fetch('/admin/upload', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ data: data, kind: kind }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Échec de l’envoi'); return j.url; }); });
  }

  // Photos produit
  var field = $('#imagesField'), box = $('#imgManager'), pick = $('#imgFile');
  if (field && box) {
    var imgs = []; try { imgs = JSON.parse(field.value || '[]'); } catch (e) {}
    var render = function () {
      field.value = JSON.stringify(imgs); box.innerHTML = '';
      imgs.forEach(function (src, i) {
        var d = document.createElement('div'); d.className = 'img-item';
        var im = document.createElement('img'); im.src = src; im.alt = ''; d.appendChild(im);
        var bar = document.createElement('div');
        var mk = function (label, fn) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; bar.appendChild(b); };
        if (i > 0) mk('★ Principale', function () { imgs.unshift(imgs.splice(i, 1)[0]); render(); });
        mk('Retirer', function () { imgs.splice(i, 1); render(); });
        d.appendChild(bar); box.appendChild(d);
      });
    };
    render();
    pick.addEventListener('change', function () {
      var files = Array.prototype.slice.call(pick.files); pick.value = '';
      files.reduce(function (p, f) {
        return p.then(function () {
          if (imgs.length >= 6) return;
          return fileToData(f, { max: 1400, type: 'image/jpeg' }).then(function (d) { return upload(d, 'product'); }).then(function (u) { imgs.push(u); render(); });
        }).catch(function (err) { alert(err.message); });
      }, Promise.resolve());
    });
  }

  // Logo
  var lf = $('#logoFile'), lfield = $('#logoField'), prev = $('#logoPreview');
  if (lf) {
    lf.addEventListener('change', function () {
      var f = lf.files[0]; if (!f) return;
      fileToData(f, { max: 900, type: 'image/png' }).then(function (d) { return upload(d, 'logo'); }).then(function (u) {
        lfield.value = u; prev.innerHTML = ''; var im = document.createElement('img'); im.src = u; im.height = 60; im.alt = 'Logo'; prev.appendChild(im);
      }).catch(function (err) { alert(err.message); });
    });
    $('#logoClear').addEventListener('click', function () { lfield.value = ''; prev.textContent = 'Aucun logo (enregistrez pour appliquer).'; });
  }
})();
