// ============================================================
// Сумісність зі старішими iPhone / Safari (ES5, без сучасного синтаксису).
// Додає лише те, чого бракує браузеру; у нових браузерах нічого не змінює.
// ============================================================
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : window;
  if (typeof globalThis === 'undefined') g.globalThis = g;
  function def(obj, name, fn) {
    if (!obj[name]) Object.defineProperty(obj, name, { value: fn, configurable: true, writable: true });
  }
  // Object.fromEntries (Safari 12.1)
  def(Object, 'fromEntries', function (it) {
    var o = {}; Array.from(it).forEach(function (p) { o[p[0]] = p[1]; }); return o;
  });
  def(Object, 'hasOwn', function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); });
  // Array.flat / flatMap (Safari 12)
  def(Array.prototype, 'flat', function (depth) {
    var d = depth === undefined ? 1 : Number(depth) || 0;
    return d < 1 ? Array.prototype.slice.call(this) : Array.prototype.reduce.call(this, function (acc, v) {
      return acc.concat(Array.isArray(v) ? v.flat(d - 1) : v);
    }, []);
  });
  def(Array.prototype, 'flatMap', function (fn, thisArg) { return Array.prototype.map.call(this, fn, thisArg).flat(1); });
  def(Array.prototype, 'at', function (i) { var n = Math.trunc(i) || 0; if (n < 0) n += this.length; return n < 0 || n >= this.length ? undefined : this[n]; });
  def(String.prototype, 'at', function (i) { var n = Math.trunc(i) || 0; if (n < 0) n += this.length; return n < 0 || n >= this.length ? undefined : this.charAt(n); });
  // String.replaceAll (Safari 13.1)
  def(String.prototype, 'replaceAll', function (search, rep) {
    if (search instanceof RegExp) return this.replace(search, rep);
    return this.split(String(search)).join(typeof rep === 'function' ? rep(String(search)) : rep);
  });
  // String.matchAll (Safari 13)
  def(String.prototype, 'matchAll', function (re) {
    var r = new RegExp(re.source, re.flags.indexOf('g') < 0 ? re.flags + 'g' : re.flags), s = String(this), out = [], m;
    while ((m = r.exec(s)) !== null) { out.push(m); if (m[0] === '') r.lastIndex++; }
    return out[Symbol.iterator]();
  });
  // Promise.allSettled (Safari 13)
  if (typeof Promise !== 'undefined') def(Promise, 'allSettled', function (ps) {
    return Promise.all(Array.from(ps).map(function (p) {
      return Promise.resolve(p).then(function (value) { return { status: 'fulfilled', value: value }; },
        function (reason) { return { status: 'rejected', reason: reason }; });
    }));
  });
  if (typeof queueMicrotask === 'undefined') g.queueMicrotask = function (f) { Promise.resolve().then(f); };
  // Blob.arrayBuffer / text (Safari 14)
  if (typeof Blob !== 'undefined') {
    def(Blob.prototype, 'arrayBuffer', function () {
      var b = this; return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.readAsArrayBuffer(b); });
    });
    def(Blob.prototype, 'text', function () {
      var b = this; return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.readAsText(b); });
    });
  }
  // form.requestSubmit (Safari 16) — автоподання коду 2FA та інші форми
  if (typeof HTMLFormElement !== 'undefined') def(HTMLFormElement.prototype, 'requestSubmit', function (submitter) {
    if (submitter) { submitter.click(); return; }
    var b = document.createElement('button'); b.type = 'submit'; b.hidden = true; this.appendChild(b); b.click(); this.removeChild(b);
  });
  // matchMedia().addEventListener (Safari 14)
  if (g.MediaQueryList && !MediaQueryList.prototype.addEventListener) {
    MediaQueryList.prototype.addEventListener = function (t, f) { this.addListener(f); };
    MediaQueryList.prototype.removeEventListener = function (t, f) { this.removeListener(f); };
  }
  // Element.replaceChildren / toggleAttribute
  if (typeof Element !== 'undefined') {
    def(Element.prototype, 'replaceChildren', function () { while (this.firstChild) this.removeChild(this.firstChild); this.append.apply(this, arguments); });
    def(Element.prototype, 'toggleAttribute', function (n, force) {
      var on = force === undefined ? !this.hasAttribute(n) : !!force; if (on) this.setAttribute(n, ''); else this.removeAttribute(n); return on;
    });
  }
  // crypto.randomUUID (Safari 15.4)
  if (g.crypto && g.crypto.getRandomValues && !g.crypto.randomUUID) {
    g.crypto.randomUUID = function () {
      var b = g.crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
      var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    };
  }
  // AbortSignal.timeout (Safari 16)
  if (typeof AbortController !== 'undefined' && typeof AbortSignal !== 'undefined' && !AbortSignal.timeout) {
    AbortSignal.timeout = function (ms) { var c = new AbortController(); setTimeout(function () { c.abort(); }, ms); return c.signal; };
  }
})();
