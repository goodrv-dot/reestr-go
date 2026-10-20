// АВТОМАТИЧНО з vendor/supabase-2.117.3.js (tools/build-legacy.mjs) — не редагувати вручну
var supabase = (function(e) {
  var _a, _b, _c;
  function t(e2, t2) {
    var n2 = {};
    for (var r2 in e2) Object.prototype.hasOwnProperty.call(e2, r2) && t2.indexOf(r2) < 0 && (n2[r2] = e2[r2]);
    if (e2 != null && typeof Object.getOwnPropertySymbols == `function`) for (var i2 = 0, r2 = Object.getOwnPropertySymbols(e2); i2 < r2.length; i2++) t2.indexOf(r2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(e2, r2[i2]) && (n2[r2[i2]] = e2[r2[i2]]);
    return n2;
  }
  function n(e2, t2, n2, r2) {
    function i2(e3) {
      return e3 instanceof n2 ? e3 : new n2(function(t3) {
        t3(e3);
      });
    }
    return new (n2 || (n2 = Promise))(function(n3, a2) {
      function o2(e3) {
        try {
          c2(r2.next(e3));
        } catch (e4) {
          a2(e4);
        }
      }
      function s2(e3) {
        try {
          c2(r2.throw(e3));
        } catch (e4) {
          a2(e4);
        }
      }
      function c2(e3) {
        e3.done ? n3(e3.value) : i2(e3.value).then(o2, s2);
      }
      c2((r2 = r2.apply(e2, t2 || [])).next());
    });
  }
  let r = (e2) => e2 ? (...t2) => e2(...t2) : (...e3) => fetch(...e3);
  var i = class extends Error {
    constructor(e2, t2 = `FunctionsError`, n2) {
      super(e2), this.name = t2, this.context = n2;
    }
    toJSON() {
      return { name: this.name, message: this.message, context: this.context };
    }
  }, a = class extends i {
    constructor(e2) {
      super(`Failed to send a request to the Edge Function`, `FunctionsFetchError`, e2);
    }
  }, o = class extends i {
    constructor(e2) {
      super(`Relay Error invoking the Edge Function`, `FunctionsRelayError`, e2);
    }
  }, s = class extends i {
    constructor(e2) {
      super(`Edge Function returned a non-2xx status code`, `FunctionsHttpError`, e2);
    }
  }, c;
  (function(e2) {
    e2.Any = `any`, e2.ApNortheast1 = `ap-northeast-1`, e2.ApNortheast2 = `ap-northeast-2`, e2.ApSouth1 = `ap-south-1`, e2.ApSoutheast1 = `ap-southeast-1`, e2.ApSoutheast2 = `ap-southeast-2`, e2.CaCentral1 = `ca-central-1`, e2.EuCentral1 = `eu-central-1`, e2.EuWest1 = `eu-west-1`, e2.EuWest2 = `eu-west-2`, e2.EuWest3 = `eu-west-3`, e2.SaEast1 = `sa-east-1`, e2.UsEast1 = `us-east-1`, e2.UsWest1 = `us-west-1`, e2.UsWest2 = `us-west-2`;
  })(c || (c = {}));
  var l = class {
    constructor(e2, { headers: t2 = {}, customFetch: n2, region: i2 = c.Any } = {}) {
      this.url = e2, this.headers = t2, this.region = i2, this.fetch = r(n2);
    }
    setAuth(e2) {
      this.headers.Authorization = `Bearer ${e2}`;
    }
    invoke(e2) {
      return n(this, arguments, void 0, function* (e3, t2 = {}) {
        var _a2;
        var n2;
        let r2, i2, c2;
        try {
          let { headers: n3, method: l2, body: u2, signal: d2, timeout: f2 } = t2, p2 = {}, { region: m2 } = t2;
          m2 || (m2 = this.region);
          let h2 = new URL(`${this.url}/${e3}`);
          m2 && m2 !== `any` && (p2[`x-region`] = m2, h2.searchParams.set(`forceFunctionRegion`, m2));
          let g2, ee2 = !!n3 && Object.keys(n3).some((e4) => e4.toLowerCase() === `content-type`);
          u2 && !ee2 ? typeof Blob < `u` && u2 instanceof Blob || u2 instanceof ArrayBuffer ? (p2[`Content-Type`] = u2.type || `application/octet-stream`, g2 = u2) : typeof u2 == `string` ? (p2[`Content-Type`] = `text/plain`, g2 = u2) : typeof FormData < `u` && u2 instanceof FormData ? g2 = u2 : (p2[`Content-Type`] = `application/json`, g2 = JSON.stringify(u2)) : g2 = u2 && typeof u2 != `string` && !(typeof Blob < `u` && u2 instanceof Blob) && !(u2 instanceof ArrayBuffer) && !(typeof FormData < `u` && u2 instanceof FormData) ? JSON.stringify(u2) : u2;
          let te2 = d2;
          f2 && (i2 = new AbortController(), r2 = setTimeout(() => i2.abort(), f2), d2 ? (te2 = i2.signal, c2 = () => i2.abort(), d2.addEventListener(`abort`, c2)) : te2 = i2.signal);
          let _2 = yield this.fetch(h2.toString(), { method: l2 || `POST`, headers: Object.assign(Object.assign(Object.assign({}, p2), this.headers), n3), body: g2, signal: te2 }).catch((e4) => {
            throw new a(e4);
          }), ne2 = _2.headers.get(`x-relay-error`);
          if (ne2 && ne2 === `true`) throw new o(_2);
          if (!_2.ok) throw new s(_2);
          let re2 = ((_a2 = _2.headers.get(`Content-Type`)) != null ? _a2 : `text/plain`).split(`;`)[0].trim().toLowerCase(), ie2;
          return ie2 = re2 === `application/json` ? yield _2.json() : re2 === `application/octet-stream` || re2 === `application/pdf` ? yield _2.blob() : re2 === `text/event-stream` ? _2 : re2 === `multipart/form-data` ? yield _2.formData() : yield _2.text(), { data: ie2, error: null, response: _2 };
        } catch (e4) {
          return { data: null, error: e4, response: e4 instanceof s || e4 instanceof o ? e4.context : void 0 };
        } finally {
          r2 && clearTimeout(r2), c2 && ((n2 = t2.signal) == null || n2.removeEventListener(`abort`, c2));
        }
      });
    }
  }, u = class extends Error {
    constructor(e2) {
      super(e2.message), this.name = `PostgrestError`, this.details = e2.details, this.hint = e2.hint, this.code = e2.code;
    }
    toJSON() {
      return { name: this.name, message: this.message, details: this.details, hint: this.hint, code: this.code };
    }
  };
  let d = (e2) => Math.min(1e3 * 2 ** e2, 3e4), f = [520, 503], p = [`GET`, `HEAD`, `OPTIONS`];
  function m(e2) {
    "@babel/helpers - typeof";
    return m = typeof Symbol == `function` && typeof Symbol.iterator == `symbol` ? function(e3) {
      return typeof e3;
    } : function(e3) {
      return e3 && typeof Symbol == `function` && e3.constructor === Symbol && e3 !== Symbol.prototype ? `symbol` : typeof e3;
    }, m(e2);
  }
  function h(e2, t2) {
    if (m(e2) != `object` || !e2) return e2;
    var n2 = e2[Symbol.toPrimitive];
    if (n2 !== void 0) {
      var r2 = n2.call(e2, t2 || `default`);
      if (m(r2) != `object`) return r2;
      throw TypeError(`@@toPrimitive must return a primitive value.`);
    }
    return (t2 === `string` ? String : Number)(e2);
  }
  function g(e2) {
    var t2 = h(e2, `string`);
    return m(t2) == `symbol` ? t2 : t2 + ``;
  }
  function ee(e2, t2, n2) {
    return (t2 = g(t2)) in e2 ? Object.defineProperty(e2, t2, { value: n2, enumerable: true, configurable: true, writable: true }) : e2[t2] = n2, e2;
  }
  function te(e2, t2) {
    var n2 = Object.keys(e2);
    if (Object.getOwnPropertySymbols) {
      var r2 = Object.getOwnPropertySymbols(e2);
      t2 && (r2 = r2.filter(function(t3) {
        return Object.getOwnPropertyDescriptor(e2, t3).enumerable;
      })), n2.push.apply(n2, r2);
    }
    return n2;
  }
  function _(e2) {
    for (var t2 = 1; t2 < arguments.length; t2++) {
      var n2 = arguments[t2] == null ? {} : arguments[t2];
      t2 % 2 ? te(Object(n2), true).forEach(function(t3) {
        ee(e2, t3, n2[t3]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e2, Object.getOwnPropertyDescriptors(n2)) : te(Object(n2)).forEach(function(t3) {
        Object.defineProperty(e2, t3, Object.getOwnPropertyDescriptor(n2, t3));
      });
    }
    return e2;
  }
  function ne(e2, t2) {
    return new Promise((n2) => {
      if (t2 == null ? void 0 : t2.aborted) {
        n2();
        return;
      }
      let r2 = setTimeout(() => {
        t2 == null ? void 0 : t2.removeEventListener(`abort`, i2), n2();
      }, e2);
      function i2() {
        clearTimeout(r2), n2();
      }
      t2 == null ? void 0 : t2.addEventListener(`abort`, i2);
    });
  }
  function re(e2, t2, n2, r2) {
    return !(!r2 || n2 >= 3 || !p.includes(e2) || !f.includes(t2));
  }
  async function ie(e2, t2, n2, r2) {
    var _a2, _b2, _c2;
    let i2 = 0;
    for (; ; ) {
      let a2 = _({}, n2.headers);
      i2 > 0 && (a2[`X-Retry-Count`] = String(i2));
      let o2;
      try {
        o2 = await e2(t2, { method: n2.method, headers: a2, body: n2.body, signal: n2.signal });
      } catch (e3) {
        if ((e3 == null ? void 0 : e3.name) === `AbortError` || (e3 == null ? void 0 : e3.code) === `ABORT_ERR` || (e3 == null ? void 0 : e3.name) === `TimeoutError` && ((_a2 = n2.signal) == null ? void 0 : _a2.aborted) || !p.includes(n2.method)) throw e3;
        if (r2 && i2 < 3) {
          let e4 = d(i2);
          i2++, await ne(e4, n2.signal);
          continue;
        }
        throw e3;
      }
      if (re(n2.method, o2.status, i2, r2)) {
        let e3 = (_c2 = (_b2 = o2.headers) == null ? void 0 : _b2.get(`Retry-After`)) != null ? _c2 : null, t3 = e3 === null ? d(i2) : Math.max(0, parseInt(e3, 10) || 0) * 1e3;
        await o2.text(), i2++, await ne(t3, n2.signal);
        continue;
      }
      return o2;
    }
  }
  var ae = class {
    constructor(e2) {
      var _a2, _b2, _c2, _d, _e2;
      this.shouldThrowOnError = false, this.retryEnabled = true, this.method = e2.method, this.url = e2.url, this.headers = new Headers(e2.headers), this.schema = e2.schema, this.body = e2.body, this.shouldThrowOnError = (_a2 = e2.shouldThrowOnError) != null ? _a2 : false, this.signal = e2.signal, this.isMaybeSingle = (_b2 = e2.isMaybeSingle) != null ? _b2 : false, this.shouldStripNulls = (_c2 = e2.shouldStripNulls) != null ? _c2 : false, this.urlLengthLimit = (_d = e2.urlLengthLimit) != null ? _d : 8e3, this.retryEnabled = (_e2 = e2.retry) != null ? _e2 : true, e2.fetch ? this.fetch = e2.fetch : this.fetch = fetch;
    }
    throwOnError() {
      return this.shouldThrowOnError = true, this;
    }
    stripNulls() {
      if (this.headers.get(`Accept`) === `text/csv`) throw Error(`stripNulls() cannot be used with csv()`);
      return this.shouldStripNulls = true, this;
    }
    setHeader(e2, t2) {
      return this.headers = new Headers(this.headers), this.headers.set(e2, t2), this;
    }
    retry(e2) {
      return this.retryEnabled = e2, this;
    }
    then(e2, t2) {
      var n2 = this;
      if (this.schema === void 0 || ([`GET`, `HEAD`].includes(this.method) ? this.headers.set(`Accept-Profile`, this.schema) : this.headers.set(`Content-Profile`, this.schema)), this.method !== `GET` && this.method !== `HEAD` && this.headers.set(`Content-Type`, `application/json`), this.shouldStripNulls) {
        let e3 = this.headers.get(`Accept`);
        e3 === `application/vnd.pgrst.object+json` ? this.headers.set(`Accept`, `application/vnd.pgrst.object+json;nulls=stripped`) : (!e3 || e3 === `application/json`) && this.headers.set(`Accept`, `application/vnd.pgrst.array+json;nulls=stripped`);
      }
      let r2 = this.fetch, i2 = (async () => {
        let e3 = {};
        n2.headers.forEach((t4, n3) => {
          e3[n3] = t4;
        });
        let t3 = await ie(r2, n2.url.toString(), { method: n2.method, headers: e3, body: JSON.stringify(n2.body, (e4, t4) => typeof t4 == `bigint` ? t4.toString() : t4), signal: n2.signal }, n2.retryEnabled);
        return await n2.processResponse(t3);
      })();
      return this.shouldThrowOnError || (i2 = i2.catch((e3) => {
        var _a2, _b2, _c2, _d, _e2, _f;
        let t3 = ``, n3 = ``, r3 = ``, i3 = e3 == null ? void 0 : e3.cause;
        if (i3) {
          let n4 = (_a2 = i3 == null ? void 0 : i3.message) != null ? _a2 : ``, r4 = (_b2 = i3 == null ? void 0 : i3.code) != null ? _b2 : ``;
          t3 = `${(_c2 = e3 == null ? void 0 : e3.name) != null ? _c2 : `FetchError`}: ${e3 == null ? void 0 : e3.message}`, t3 += `

Caused by: ${(_d = i3 == null ? void 0 : i3.name) != null ? _d : `Error`}: ${n4}`, r4 && (t3 += ` (${r4})`), (i3 == null ? void 0 : i3.stack) && (t3 += `
${i3.stack}`);
        } else t3 = (_e2 = e3 == null ? void 0 : e3.stack) != null ? _e2 : ``;
        let a2 = this.url.toString().length;
        return (e3 == null ? void 0 : e3.name) === `AbortError` || (e3 == null ? void 0 : e3.code) === `ABORT_ERR` ? (r3 = ``, n3 = `Request was aborted (timeout or manual cancellation)`, a2 > this.urlLengthLimit && (n3 += `. Note: Your request URL is ${a2} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`)) : ((i3 == null ? void 0 : i3.name) === `HeadersOverflowError` || (i3 == null ? void 0 : i3.code) === `UND_ERR_HEADERS_OVERFLOW`) && (r3 = ``, n3 = `HTTP headers exceeded server limits (typically 16KB)`, a2 > this.urlLengthLimit && (n3 += `. Your request URL is ${a2} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`)), { success: false, error: { message: `${(_f = e3 == null ? void 0 : e3.name) != null ? _f : `FetchError`}: ${e3 == null ? void 0 : e3.message}`, details: t3, hint: n3, code: r3 }, data: null, count: null, status: 0, statusText: `` };
      })), i2.then(e2, t2);
    }
    async processResponse(e2) {
      var _a2, _b2, _c2, _d;
      var t2 = this;
      let n2 = null, r2 = null, i2 = null, a2 = e2.status, o2 = e2.statusText;
      if (e2.ok) {
        if (t2.method !== `HEAD`) {
          let i3 = await e2.text();
          if (i3 !== ``) if (t2.headers.get(`Accept`) === `text/csv`) r2 = i3;
          else if (t2.headers.get(`Accept`) && ((_a2 = t2.headers.get(`Accept`)) == null ? void 0 : _a2.includes(`application/vnd.pgrst.plan+text`))) r2 = i3;
          else try {
            r2 = JSON.parse(i3);
          } catch (e3) {
            if (n2 = { message: i3 }, r2 = null, t2.shouldThrowOnError) throw new u({ message: i3, details: ``, hint: ``, code: `` });
          }
        }
        let s2 = (_b2 = t2.headers.get(`Prefer`)) == null ? void 0 : _b2.match(/count=(exact|planned|estimated)/), c2 = (_c2 = e2.headers.get(`content-range`)) == null ? void 0 : _c2.split(`/`);
        if (s2 && c2 && c2.length > 1 && (i2 = parseInt(c2[1])), t2.isMaybeSingle && Array.isArray(r2)) if (r2.length > 1) {
          if (n2 = { code: `PGRST116`, details: `Results contain ${r2.length} rows, application/vnd.pgrst.object+json requires 1 row`, hint: null, message: `JSON object requested, multiple (or no) rows returned` }, r2 = null, i2 = null, a2 = 406, o2 = `Not Acceptable`, t2.shouldThrowOnError) throw new u(_(_({}, n2), {}, { hint: (_d = n2.hint) != null ? _d : `` }));
        } else r2 = r2.length === 1 ? r2[0] : null;
      } else {
        let i3 = await e2.text();
        try {
          n2 = JSON.parse(i3), Array.isArray(n2) && e2.status === 404 && (r2 = [], n2 = null, a2 = 200, o2 = `OK`);
        } catch (e3) {
          e2.status === 404 && i3 === `` ? (a2 = 204, o2 = `No Content`) : n2 = { message: i3 };
        }
        if (n2 && t2.shouldThrowOnError) throw new u(n2);
      }
      return { success: n2 === null, error: n2, data: r2, count: i2, status: a2, statusText: o2 };
    }
    returns() {
      return this;
    }
    overrideTypes() {
      return this;
    }
  }, oe = class extends ae {
    throwOnError() {
      return super.throwOnError();
    }
    select(e2) {
      let t2 = false, n2 = (e2 != null ? e2 : `*`).split(``).map((e3) => /\s/.test(e3) && !t2 ? `` : (e3 === `"` && (t2 = !t2), e3)).join(``);
      return this.url.searchParams.set(`select`, n2), this.headers.append(`Prefer`, `return=representation`), this;
    }
    order(e2, { ascending: t2 = true, nullsFirst: n2, foreignTable: r2, referencedTable: i2 = r2 } = {}) {
      let a2 = i2 ? `${i2}.order` : `order`, o2 = this.url.searchParams.get(a2);
      return this.url.searchParams.set(a2, `${o2 ? `${o2},` : ``}${e2}.${t2 ? `asc` : `desc`}${n2 === void 0 ? `` : n2 ? `.nullsfirst` : `.nullslast`}`), this;
    }
    limit(e2, { foreignTable: t2, referencedTable: n2 = t2 } = {}) {
      let r2 = n2 === void 0 ? `limit` : `${n2}.limit`;
      return this.url.searchParams.set(r2, `${e2}`), this;
    }
    range(e2, t2, { foreignTable: n2, referencedTable: r2 = n2 } = {}) {
      let i2 = r2 === void 0 ? `offset` : `${r2}.offset`, a2 = r2 === void 0 ? `limit` : `${r2}.limit`;
      return this.url.searchParams.set(i2, `${e2}`), this.url.searchParams.set(a2, `${t2 - e2 + 1}`), this;
    }
    abortSignal(e2) {
      return this.signal = e2, this;
    }
    single() {
      return this.headers.set(`Accept`, `application/vnd.pgrst.object+json`), this;
    }
    maybeSingle() {
      return this.isMaybeSingle = true, this;
    }
    csv() {
      return this.headers.set(`Accept`, `text/csv`), this;
    }
    geojson() {
      return this.headers.set(`Accept`, `application/geo+json`), this;
    }
    explain({ analyze: e2 = false, verbose: t2 = false, settings: n2 = false, buffers: r2 = false, wal: i2 = false, format: a2 = `text` } = {}) {
      var _a2;
      let o2 = [e2 ? `analyze` : null, t2 ? `verbose` : null, n2 ? `settings` : null, r2 ? `buffers` : null, i2 ? `wal` : null].filter(Boolean).join(`|`), s2 = (_a2 = this.headers.get(`Accept`)) != null ? _a2 : `application/json`;
      return this.headers.set(`Accept`, `application/vnd.pgrst.plan+${a2}; for="${s2}"; options=${o2};`), this;
    }
    rollback() {
      return this.headers.append(`Prefer`, `tx=rollback`), this;
    }
    returns() {
      return this;
    }
    maxAffected(e2) {
      return this.headers.append(`Prefer`, `handling=strict`), this.headers.append(`Prefer`, `max-affected=${e2}`), this;
    }
  };
  let se = RegExp(`[,()]`);
  var ce = class extends oe {
    throwOnError() {
      return super.throwOnError();
    }
    eq(e2, t2) {
      return this.url.searchParams.append(e2, `eq.${t2}`), this;
    }
    neq(e2, t2) {
      return this.url.searchParams.append(e2, `neq.${t2}`), this;
    }
    gt(e2, t2) {
      return this.url.searchParams.append(e2, `gt.${t2}`), this;
    }
    gte(e2, t2) {
      return this.url.searchParams.append(e2, `gte.${t2}`), this;
    }
    lt(e2, t2) {
      return this.url.searchParams.append(e2, `lt.${t2}`), this;
    }
    lte(e2, t2) {
      return this.url.searchParams.append(e2, `lte.${t2}`), this;
    }
    like(e2, t2) {
      return this.url.searchParams.append(e2, `like.${t2}`), this;
    }
    likeAllOf(e2, t2) {
      return this.url.searchParams.append(e2, `like(all).{${t2.join(`,`)}}`), this;
    }
    likeAnyOf(e2, t2) {
      return this.url.searchParams.append(e2, `like(any).{${t2.join(`,`)}}`), this;
    }
    ilike(e2, t2) {
      return this.url.searchParams.append(e2, `ilike.${t2}`), this;
    }
    ilikeAllOf(e2, t2) {
      return this.url.searchParams.append(e2, `ilike(all).{${t2.join(`,`)}}`), this;
    }
    ilikeAnyOf(e2, t2) {
      return this.url.searchParams.append(e2, `ilike(any).{${t2.join(`,`)}}`), this;
    }
    regexMatch(e2, t2) {
      return this.url.searchParams.append(e2, `match.${t2}`), this;
    }
    regexIMatch(e2, t2) {
      return this.url.searchParams.append(e2, `imatch.${t2}`), this;
    }
    is(e2, t2) {
      return this.url.searchParams.append(e2, `is.${t2}`), this;
    }
    isDistinct(e2, t2) {
      return this.url.searchParams.append(e2, `isdistinct.${t2}`), this;
    }
    in(e2, t2) {
      let n2 = Array.from(new Set(t2)).map((e3) => typeof e3 == `string` && se.test(e3) ? `"${e3}"` : `${e3}`).join(`,`);
      return this.url.searchParams.append(e2, `in.(${n2})`), this;
    }
    notIn(e2, t2) {
      let n2 = Array.from(new Set(t2)).map((e3) => typeof e3 == `string` && se.test(e3) ? `"${e3}"` : `${e3}`).join(`,`);
      return this.url.searchParams.append(e2, `not.in.(${n2})`), this;
    }
    contains(e2, t2) {
      return typeof t2 == `string` ? this.url.searchParams.append(e2, `cs.${t2}`) : Array.isArray(t2) ? this.url.searchParams.append(e2, `cs.{${t2.join(`,`)}}`) : this.url.searchParams.append(e2, `cs.${JSON.stringify(t2)}`), this;
    }
    containedBy(e2, t2) {
      return typeof t2 == `string` ? this.url.searchParams.append(e2, `cd.${t2}`) : Array.isArray(t2) ? this.url.searchParams.append(e2, `cd.{${t2.join(`,`)}}`) : this.url.searchParams.append(e2, `cd.${JSON.stringify(t2)}`), this;
    }
    rangeGt(e2, t2) {
      return this.url.searchParams.append(e2, `sr.${t2}`), this;
    }
    rangeGte(e2, t2) {
      return this.url.searchParams.append(e2, `nxl.${t2}`), this;
    }
    rangeLt(e2, t2) {
      return this.url.searchParams.append(e2, `sl.${t2}`), this;
    }
    rangeLte(e2, t2) {
      return this.url.searchParams.append(e2, `nxr.${t2}`), this;
    }
    rangeAdjacent(e2, t2) {
      return this.url.searchParams.append(e2, `adj.${t2}`), this;
    }
    overlaps(e2, t2) {
      return typeof t2 == `string` ? this.url.searchParams.append(e2, `ov.${t2}`) : this.url.searchParams.append(e2, `ov.{${t2.join(`,`)}}`), this;
    }
    textSearch(e2, t2, { config: n2, type: r2 } = {}) {
      let i2 = ``;
      r2 === `plain` ? i2 = `pl` : r2 === `phrase` ? i2 = `ph` : r2 === `websearch` && (i2 = `w`);
      let a2 = n2 === void 0 ? `` : `(${n2})`;
      return this.url.searchParams.append(e2, `${i2}fts${a2}.${t2}`), this;
    }
    match(e2) {
      return Object.entries(e2).filter(([e3, t2]) => t2 !== void 0).forEach(([e3, t2]) => {
        this.url.searchParams.append(e3, `eq.${t2}`);
      }), this;
    }
    not(e2, t2, n2) {
      return this.url.searchParams.append(e2, `not.${t2}.${n2}`), this;
    }
    or(e2, { foreignTable: t2, referencedTable: n2 = t2 } = {}) {
      let r2 = n2 ? `${n2}.or` : `or`;
      return this.url.searchParams.append(r2, `(${e2})`), this;
    }
    filter(e2, t2, n2) {
      return this.url.searchParams.append(e2, `${t2}.${n2}`), this;
    }
  }, le = class {
    constructor(e2, { headers: t2 = {}, schema: n2, fetch: r2, urlLengthLimit: i2 = 8e3, retry: a2 }) {
      this.url = e2, this.headers = new Headers(t2), this.schema = n2, this.fetch = r2, this.urlLengthLimit = i2, this.retry = a2;
    }
    cloneRequestState() {
      return { url: new URL(this.url.toString()), headers: new Headers(this.headers) };
    }
    select(e2, t2) {
      let { head: n2 = false, count: r2 } = t2 != null ? t2 : {}, i2 = n2 ? `HEAD` : `GET`, a2 = false, o2 = (e2 != null ? e2 : `*`).split(``).map((e3) => /\s/.test(e3) && !a2 ? `` : (e3 === `"` && (a2 = !a2), e3)).join(``), { url: s2, headers: c2 } = this.cloneRequestState();
      return s2.searchParams.set(`select`, o2), r2 && c2.append(`Prefer`, `count=${r2}`), new ce({ method: i2, url: s2, headers: c2, schema: this.schema, fetch: this.fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
    }
    insert(e2, { count: t2, defaultToNull: n2 = true } = {}) {
      var _a2;
      let { url: r2, headers: i2 } = this.cloneRequestState();
      if (t2 && i2.append(`Prefer`, `count=${t2}`), n2 || i2.append(`Prefer`, `missing=default`), Array.isArray(e2)) {
        let t3 = e2.reduce((e3, t4) => e3.concat(Object.keys(t4)), []);
        if (t3.length > 0) {
          let e3 = [...new Set(t3)].map((e4) => `"${e4}"`);
          r2.searchParams.set(`columns`, e3.join(`,`));
        }
      }
      return new ce({ method: `POST`, url: r2, headers: i2, schema: this.schema, body: e2, fetch: (_a2 = this.fetch) != null ? _a2 : fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
    }
    upsert(e2, { onConflict: t2, ignoreDuplicates: n2 = false, count: r2, defaultToNull: i2 = true } = {}) {
      var _a2;
      let { url: a2, headers: o2 } = this.cloneRequestState();
      if (o2.append(`Prefer`, `resolution=${n2 ? `ignore` : `merge`}-duplicates`), t2 !== void 0 && a2.searchParams.set(`on_conflict`, t2), r2 && o2.append(`Prefer`, `count=${r2}`), i2 || o2.append(`Prefer`, `missing=default`), Array.isArray(e2)) {
        let t3 = e2.reduce((e3, t4) => e3.concat(Object.keys(t4)), []);
        if (t3.length > 0) {
          let e3 = [...new Set(t3)].map((e4) => `"${e4}"`);
          a2.searchParams.set(`columns`, e3.join(`,`));
        }
      }
      return new ce({ method: `POST`, url: a2, headers: o2, schema: this.schema, body: e2, fetch: (_a2 = this.fetch) != null ? _a2 : fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
    }
    update(e2, { count: t2 } = {}) {
      var _a2;
      let { url: n2, headers: r2 } = this.cloneRequestState();
      return t2 && r2.append(`Prefer`, `count=${t2}`), new ce({ method: `PATCH`, url: n2, headers: r2, schema: this.schema, body: e2, fetch: (_a2 = this.fetch) != null ? _a2 : fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
    }
    delete({ count: e2 } = {}) {
      var _a2;
      let { url: t2, headers: n2 } = this.cloneRequestState();
      return e2 && n2.append(`Prefer`, `count=${e2}`), new ce({ method: `DELETE`, url: t2, headers: n2, schema: this.schema, fetch: (_a2 = this.fetch) != null ? _a2 : fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
    }
  };
  function ue(e2, t2) {
    var _a2, _b2, _c2, _d;
    try {
      let t3 = JSON.parse(e2);
      if (t3 && typeof t3 == `object` && !Array.isArray(t3)) return new u({ message: String((_a2 = t3.message) != null ? _a2 : e2), details: (_b2 = t3.details) != null ? _b2 : ``, hint: (_c2 = t3.hint) != null ? _c2 : ``, code: (_d = t3.code) != null ? _d : `` });
    } catch (e3) {
    }
    return new u({ message: e2 || t2, details: ``, hint: ``, code: `` });
  }
  function de(e2, t2, n2) {
    var _a2;
    let r2 = e2;
    return { success: false, error: new u({ message: `${(_a2 = r2 == null ? void 0 : r2.name) != null ? _a2 : `FetchError`}: ${r2 == null ? void 0 : r2.message}`, details: ``, hint: ``, code: `` }), data: null, count: null, status: t2, statusText: n2 };
  }
  var fe = class e2 {
    constructor(e3, { headers: t2 = {}, schema: n2, fetch: r2, timeout: i2, urlLengthLimit: a2 = 8e3, retry: o2 } = {}) {
      this.url = e3, this.headers = new Headers(t2), this.schemaName = n2, this.urlLengthLimit = a2;
      let s2 = r2 != null ? r2 : globalThis.fetch;
      i2 !== void 0 && i2 > 0 ? this.fetch = (e4, t3) => {
        let n3 = new AbortController(), r3 = setTimeout(() => n3.abort(), i2), a3 = t3 == null ? void 0 : t3.signal;
        if (a3) {
          if (a3.aborted) return clearTimeout(r3), s2(e4, t3);
          let i3 = () => {
            clearTimeout(r3), n3.abort();
          };
          return a3.addEventListener(`abort`, i3, { once: true }), s2(e4, _(_({}, t3), {}, { signal: n3.signal })).finally(() => {
            clearTimeout(r3), a3.removeEventListener(`abort`, i3);
          });
        }
        return s2(e4, _(_({}, t3), {}, { signal: n3.signal })).finally(() => clearTimeout(r3));
      } : this.fetch = s2, this.retry = o2;
    }
    from(e3) {
      if (!e3 || typeof e3 != `string` || e3.trim() === ``) throw Error(`Invalid relation name: relation must be a non-empty string.`);
      return new le(new URL(`${this.url}/${e3}`), { headers: new Headers(this.headers), schema: this.schemaName, fetch: this.fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
    }
    schema(t2) {
      return new e2(this.url, { headers: this.headers, schema: t2, fetch: this.fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
    }
    async getOpenApiSpec() {
      var _a2, _b2;
      var e3 = this;
      let t2 = new Headers(e3.headers);
      t2.set(`Accept`, `application/openapi+json`), e3.schemaName && t2.set(`Accept-Profile`, e3.schemaName);
      let n2 = {};
      t2.forEach((e4, t3) => {
        n2[t3] = e4;
      });
      let r2 = (_a2 = e3.fetch) != null ? _a2 : globalThis.fetch, i2;
      try {
        i2 = await ie(r2, `${e3.url}/`, { method: `GET`, headers: n2 }, (_b2 = e3.retry) != null ? _b2 : true);
      } catch (e4) {
        return de(e4, 0, ``);
      }
      let a2;
      try {
        a2 = await i2.text();
      } catch (e4) {
        return de(e4, i2.status, i2.statusText);
      }
      if (i2.ok) try {
        return { success: true, error: null, data: JSON.parse(a2), count: null, status: i2.status, statusText: i2.statusText };
      } catch (e4) {
      }
      return { success: false, error: ue(a2, i2.statusText), data: null, count: null, status: i2.status, statusText: i2.statusText };
    }
    rpc(e3, t2 = {}, { head: n2 = false, get: r2 = false, count: i2 } = {}) {
      var _a2;
      let a2, o2 = new URL(`${this.url}/rpc/${e3}`), s2, c2 = (e4) => typeof e4 == `object` && !!e4 && (!Array.isArray(e4) || e4.some(c2)), l2 = n2 && Object.values(t2).some(c2);
      l2 ? (a2 = `POST`, s2 = t2) : n2 || r2 ? (a2 = n2 ? `HEAD` : `GET`, Object.entries(t2).filter(([e4, t3]) => t3 !== void 0).map(([e4, t3]) => [e4, Array.isArray(t3) ? `{${t3.join(`,`)}}` : `${t3}`]).forEach(([e4, t3]) => {
        o2.searchParams.append(e4, t3);
      })) : (a2 = `POST`, s2 = t2);
      let u2 = new Headers(this.headers);
      return l2 ? u2.set(`Prefer`, i2 ? `count=${i2},return=minimal` : `return=minimal`) : i2 && u2.set(`Prefer`, `count=${i2}`), new ce({ method: a2, url: o2, headers: u2, schema: this.schemaName, body: s2, fetch: (_a2 = this.fetch) != null ? _a2 : fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
    }
  }, pe = class {
    constructor() {
    }
    static detectEnvironment() {
      var _a2;
      if (typeof WebSocket < `u`) return { type: `native`, wsConstructor: WebSocket };
      let e2 = globalThis;
      if (typeof globalThis < `u` && e2.WebSocket !== void 0) return { type: `native`, wsConstructor: e2.WebSocket };
      let t2 = typeof global < `u` ? global : void 0;
      if (t2 && t2.WebSocket !== void 0) return { type: `native`, wsConstructor: t2.WebSocket };
      if (typeof globalThis < `u` && e2.WebSocketPair !== void 0 && globalThis.WebSocket === void 0) return { type: `cloudflare`, error: `Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.`, workaround: `Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime.` };
      if (typeof globalThis < `u` && e2.EdgeRuntime || typeof navigator < `u` && ((_a2 = navigator.userAgent) == null ? void 0 : _a2.includes(`Vercel-Edge`))) return { type: `unsupported`, error: `Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.`, workaround: `Use serverless functions or a different deployment target for WebSocket functionality.` };
      let n2 = globalThis.process;
      if (n2) {
        let e3 = n2.versions;
        if (e3 && e3.node) return { type: `unsupported`, error: `Node.js detected but native WebSocket not found.`, workaround: `Ensure you are running Node.js 22+ or provide a WebSocket implementation via the transport option.` };
      }
      return { type: `unsupported`, error: `Unknown JavaScript runtime without WebSocket support.`, workaround: `Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation.` };
    }
    static getWebSocketConstructor() {
      let e2 = this.detectEnvironment();
      if (e2.wsConstructor) return e2.wsConstructor;
      let t2 = e2.error || `WebSocket not supported in this environment.`;
      throw e2.workaround && (t2 += `

Suggested solution: ${e2.workaround}`), Error(t2);
    }
    static isWebSocketSupported() {
      try {
        return this.detectEnvironment().type === `native`;
      } catch (e2) {
        return false;
      }
    }
  };
  let v = { closed: `closed`, errored: `errored`, joined: `joined`, joining: `joining`, leaving: `leaving` }, me = { close: `phx_close`, error: `phx_error`, join: `phx_join`, reply: `phx_reply`, leave: `phx_leave`, access_token: `access_token` }, he = { connecting: `connecting`, open: `open`, closing: `closing`, closed: `closed` };
  var ge = class {
    constructor(e2) {
      this.HEADER_LENGTH = 1, this.USER_BROADCAST_PUSH_META_LENGTH = 6, this.KINDS = { userBroadcastPush: 3, userBroadcast: 4 }, this.BINARY_ENCODING = 0, this.JSON_ENCODING = 1, this.BROADCAST_EVENT = `broadcast`, this.allowedMetadataKeys = [], this.allowedMetadataKeys = e2 != null ? e2 : [];
    }
    encode(e2, t2) {
      if (e2.event === this.BROADCAST_EVENT && !(e2.payload instanceof ArrayBuffer) && typeof e2.payload.event == `string`) return t2(this._binaryEncodeUserBroadcastPush(e2));
      let n2 = [e2.join_ref, e2.ref, e2.topic, e2.event, e2.payload];
      return t2(JSON.stringify(n2));
    }
    _binaryEncodeUserBroadcastPush(e2) {
      var _a2;
      return this._isArrayBuffer((_a2 = e2.payload) == null ? void 0 : _a2.payload) ? this._encodeBinaryUserBroadcastPush(e2) : this._encodeJsonUserBroadcastPush(e2);
    }
    _encodeBinaryUserBroadcastPush(e2) {
      var _a2, _b2;
      let t2 = (_b2 = (_a2 = e2.payload) == null ? void 0 : _a2.payload) != null ? _b2 : new ArrayBuffer(0);
      return this._encodeUserBroadcastPush(e2, this.BINARY_ENCODING, t2);
    }
    _encodeJsonUserBroadcastPush(e2) {
      var _a2, _b2;
      let t2 = (_b2 = (_a2 = e2.payload) == null ? void 0 : _a2.payload) != null ? _b2 : {}, n2 = new TextEncoder().encode(JSON.stringify(t2)).buffer;
      return this._encodeUserBroadcastPush(e2, this.JSON_ENCODING, n2);
    }
    _encodeUserBroadcastPush(e2, t2, n2) {
      var _a2, _b2;
      let r2 = new TextEncoder(), i2 = r2.encode(e2.topic), a2 = r2.encode((_a2 = e2.ref) != null ? _a2 : ``), o2 = r2.encode((_b2 = e2.join_ref) != null ? _b2 : ``), s2 = r2.encode(e2.payload.event), c2 = this.allowedMetadataKeys ? this._pick(e2.payload, this.allowedMetadataKeys) : {}, l2 = r2.encode(Object.keys(c2).length === 0 ? `` : JSON.stringify(c2));
      if (o2.length > 255) throw Error(`joinRef length ${o2.length} exceeds maximum of 255`);
      if (a2.length > 255) throw Error(`ref length ${a2.length} exceeds maximum of 255`);
      if (i2.length > 255) throw Error(`topic length ${i2.length} exceeds maximum of 255`);
      if (s2.length > 255) throw Error(`userEvent length ${s2.length} exceeds maximum of 255`);
      if (l2.length > 255) throw Error(`metadata length ${l2.length} exceeds maximum of 255`);
      let u2 = this.USER_BROADCAST_PUSH_META_LENGTH + o2.length + a2.length + i2.length + s2.length + l2.length, d2 = new ArrayBuffer(this.HEADER_LENGTH + u2), f2 = new DataView(d2), p2 = new Uint8Array(d2), m2 = 0;
      f2.setUint8(m2++, this.KINDS.userBroadcastPush), f2.setUint8(m2++, o2.length), f2.setUint8(m2++, a2.length), f2.setUint8(m2++, i2.length), f2.setUint8(m2++, s2.length), f2.setUint8(m2++, l2.length), f2.setUint8(m2++, t2), p2.set(o2, m2), m2 += o2.length, p2.set(a2, m2), m2 += a2.length, p2.set(i2, m2), m2 += i2.length, p2.set(s2, m2), m2 += s2.length, p2.set(l2, m2), m2 += l2.length;
      var h2 = new Uint8Array(d2.byteLength + n2.byteLength);
      return h2.set(new Uint8Array(d2), 0), h2.set(new Uint8Array(n2), d2.byteLength), h2.buffer;
    }
    decode(e2, t2) {
      if (this._isArrayBuffer(e2)) return t2(this._binaryDecode(e2));
      if (typeof e2 == `string`) {
        let [n2, r2, i2, a2, o2] = JSON.parse(e2);
        return t2({ join_ref: n2, ref: r2, topic: i2, event: a2, payload: o2 });
      }
      return t2({});
    }
    _binaryDecode(e2) {
      let t2 = new DataView(e2), n2 = t2.getUint8(0), r2 = new TextDecoder();
      switch (n2) {
        case this.KINDS.userBroadcast:
          return this._decodeUserBroadcast(e2, t2, r2);
      }
    }
    _decodeUserBroadcast(e2, t2, n2) {
      let r2 = t2.getUint8(1), i2 = t2.getUint8(2), a2 = t2.getUint8(3), o2 = t2.getUint8(4), s2 = this.HEADER_LENGTH + 4, c2 = n2.decode(e2.slice(s2, s2 + r2));
      s2 += r2;
      let l2 = n2.decode(e2.slice(s2, s2 + i2));
      s2 += i2;
      let u2 = n2.decode(e2.slice(s2, s2 + a2));
      s2 += a2;
      let d2 = e2.slice(s2, e2.byteLength), f2 = o2 === this.JSON_ENCODING ? JSON.parse(n2.decode(d2)) : d2, p2 = { type: this.BROADCAST_EVENT, event: l2, payload: f2 };
      return a2 > 0 && (p2.meta = JSON.parse(u2)), { join_ref: null, ref: null, topic: c2, event: this.BROADCAST_EVENT, payload: p2 };
    }
    _isArrayBuffer(e2) {
      var _a2;
      return e2 instanceof ArrayBuffer || ((_a2 = e2 == null ? void 0 : e2.constructor) == null ? void 0 : _a2.name) === `ArrayBuffer`;
    }
    _pick(e2, t2) {
      return !e2 || typeof e2 != `object` ? {} : Object.fromEntries(Object.entries(e2).filter(([e3]) => t2.includes(e3)));
    }
  }, y;
  (function(e2) {
    e2.abstime = `abstime`, e2.bool = `bool`, e2.date = `date`, e2.daterange = `daterange`, e2.float4 = `float4`, e2.float8 = `float8`, e2.int2 = `int2`, e2.int4 = `int4`, e2.int4range = `int4range`, e2.int8 = `int8`, e2.int8range = `int8range`, e2.json = `json`, e2.jsonb = `jsonb`, e2.money = `money`, e2.numeric = `numeric`, e2.oid = `oid`, e2.reltime = `reltime`, e2.text = `text`, e2.time = `time`, e2.timestamp = `timestamp`, e2.timestamptz = `timestamptz`, e2.timetz = `timetz`, e2.tsrange = `tsrange`, e2.tstzrange = `tstzrange`;
  })(y || (y = {}));
  let _e = (e2, t2, n2 = {}) => {
    var _a2;
    let r2 = (_a2 = n2.skipTypes) != null ? _a2 : [];
    return t2 ? Object.keys(t2).reduce((n3, i2) => (n3[i2] = ve(i2, e2, t2, r2), n3), {}) : {};
  }, ve = (e2, t2, n2, r2) => {
    var _a2;
    let i2 = (_a2 = t2.find((t3) => t3.name === e2)) == null ? void 0 : _a2.type, a2 = n2[e2];
    return i2 && !r2.includes(i2) ? ye(i2, a2) : be(a2);
  }, ye = (e2, t2) => {
    if (e2.charAt(0) === `_`) return we(t2, e2.slice(1, e2.length));
    switch (e2) {
      case y.bool:
        return xe(t2);
      case y.float4:
      case y.float8:
      case y.int2:
      case y.int4:
      case y.int8:
      case y.numeric:
      case y.oid:
        return Se(t2);
      case y.json:
      case y.jsonb:
        return Ce(t2);
      case y.timestamp:
        return Te(t2);
      case y.abstime:
      case y.date:
      case y.daterange:
      case y.int4range:
      case y.int8range:
      case y.money:
      case y.reltime:
      case y.text:
      case y.time:
      case y.timestamptz:
      case y.timetz:
      case y.tsrange:
      case y.tstzrange:
        return be(t2);
      default:
        return be(t2);
    }
  }, be = (e2) => e2, xe = (e2) => {
    switch (e2) {
      case `t`:
        return true;
      case `f`:
        return false;
      default:
        return e2;
    }
  }, Se = (e2) => {
    if (typeof e2 == `string`) {
      let t2 = parseFloat(e2);
      if (!Number.isNaN(t2)) return t2;
    }
    return e2;
  }, Ce = (e2) => {
    if (typeof e2 == `string`) try {
      return JSON.parse(e2);
    } catch (e3) {
      return e2;
    }
    return e2;
  }, we = (e2, t2) => {
    if (typeof e2 != `string`) return e2;
    let n2 = e2.length - 1, r2 = e2[n2];
    if (e2[0] === `{` && r2 === `}`) {
      let r3, i2 = e2.slice(1, n2);
      try {
        r3 = JSON.parse(`[` + i2 + `]`);
      } catch (e3) {
        r3 = i2 ? i2.split(`,`) : [];
      }
      return r3.map((e3) => ye(t2, e3));
    }
    return e2;
  }, Te = (e2) => typeof e2 == `string` ? e2.replace(` `, `T`) : e2, Ee = (e2) => {
    let t2 = new URL(e2);
    return t2.protocol = t2.protocol.replace(/^ws/i, `http`), t2.pathname = t2.pathname.replace(/\/+$/, ``).replace(/\/socket\/websocket$/i, ``).replace(/\/socket$/i, ``).replace(/\/websocket$/i, ``), t2.pathname === `` || t2.pathname === `/` ? t2.pathname = `/api/broadcast` : t2.pathname += `/api/broadcast`, t2.href;
  };
  var b = (e2) => typeof e2 == `function` ? e2 : function() {
    return e2;
  }, De = typeof self < `u` ? self : null, Oe = typeof window < `u` ? window : null, x = De || Oe || globalThis, ke = `2.0.0`, Ae = 1e4, je = 1e3, Me = 100, S = { connecting: 0, open: 1, closing: 2, closed: 3 }, C = { closed: `closed`, errored: `errored`, joined: `joined`, joining: `joining`, leaving: `leaving` }, w = { close: `phx_close`, error: `phx_error`, join: `phx_join`, reply: `phx_reply`, leave: `phx_leave` }, Ne = { longpoll: `longpoll`, websocket: `websocket` }, Pe = { complete: 4 }, Fe = `base64url.bearer.phx.`, Ie = class {
    constructor(e2, t2, n2, r2) {
      this.channel = e2, this.event = t2, this.payload = n2 || function() {
        return {};
      }, this.receivedResp = null, this.timeout = r2, this.timeoutTimer = null, this.recHooks = [], this.sent = false, this.ref = void 0;
    }
    resend(e2) {
      this.timeout = e2, this.reset(), this.send();
    }
    send() {
      this.hasReceived(`timeout`) || (this.startTimeout(), this.sent = true, this.channel.socket.push({ topic: this.channel.topic, event: this.event, payload: this.payload(), ref: this.ref, join_ref: this.channel.joinRef() }));
    }
    receive(e2, t2) {
      return this.hasReceived(e2) && t2(this.receivedResp.response), this.recHooks.push({ status: e2, callback: t2 }), this;
    }
    reset() {
      this.cancelRefEvent(), this.ref = null, this.refEvent = null, this.receivedResp = null, this.sent = false;
    }
    destroy() {
      this.cancelRefEvent(), this.cancelTimeout();
    }
    matchReceive({ status: e2, response: t2, _ref: n2 }) {
      this.recHooks.filter((t3) => t3.status === e2).forEach((e3) => e3.callback(t2));
    }
    cancelRefEvent() {
      this.refEvent && this.channel.off(this.refEvent);
    }
    cancelTimeout() {
      clearTimeout(this.timeoutTimer), this.timeoutTimer = null;
    }
    startTimeout() {
      this.timeoutTimer && this.cancelTimeout(), this.ref = this.channel.socket.makeRef(), this.refEvent = this.channel.replyEventName(this.ref), this.channel.on(this.refEvent, (e2) => {
        this.cancelRefEvent(), this.cancelTimeout(), this.receivedResp = e2, this.matchReceive(e2);
      }), this.timeoutTimer = setTimeout(() => {
        this.trigger(`timeout`, {});
      }, this.timeout);
    }
    hasReceived(e2) {
      return this.receivedResp && this.receivedResp.status === e2;
    }
    trigger(e2, t2) {
      this.channel.trigger(this.refEvent, { status: e2, response: t2 });
    }
  }, Le = class {
    constructor(e2, t2) {
      this.callback = e2, this.timerCalc = t2, this.timer = void 0, this.tries = 0;
    }
    reset() {
      this.tries = 0, clearTimeout(this.timer);
    }
    scheduleTimeout() {
      clearTimeout(this.timer), this.timer = setTimeout(() => {
        this.tries += 1, this.callback();
      }, this.timerCalc(this.tries + 1));
    }
  }, Re = class {
    constructor(e2, t2, n2) {
      this.state = C.closed, this.topic = e2, this.params = b(t2 || {}), this.socket = n2, this.bindings = [], this.bindingRef = 0, this.timeout = this.socket.timeout, this.joinedOnce = false, this.joinPush = new Ie(this, w.join, this.params, this.timeout), this.pushBuffer = [], this.stateChangeRefs = [], this.rejoinTimer = new Le(() => {
        this.socket.isConnected() && this.rejoin();
      }, this.socket.rejoinAfterMs), this.stateChangeRefs.push(this.socket.onError(() => this.rejoinTimer.reset())), this.stateChangeRefs.push(this.socket.onOpen(() => {
        this.rejoinTimer.reset(), this.isErrored() && this.rejoin();
      })), this.joinPush.receive(`ok`, () => {
        this.state = C.joined, this.rejoinTimer.reset(), this.pushBuffer.forEach((e3) => e3.send()), this.pushBuffer = [];
      }), this.joinPush.receive(`error`, (e3) => {
        this.state = C.errored, this.socket.hasLogger() && this.socket.log(`channel`, `error ${this.topic}`, e3), this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
      }), this.onClose(() => {
        this.rejoinTimer.reset(), this.socket.hasLogger() && this.socket.log(`channel`, `close ${this.topic}`), this.state = C.closed, this.socket.remove(this);
      }), this.onError((e3) => {
        this.socket.hasLogger() && this.socket.log(`channel`, `error ${this.topic}`, e3), this.isJoining() && this.joinPush.reset(), this.state = C.errored, this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
      }), this.joinPush.receive(`timeout`, () => {
        this.socket.hasLogger() && this.socket.log(`channel`, `timeout ${this.topic}`, this.joinPush.timeout), new Ie(this, w.leave, b({}), this.timeout).send(), this.state = C.errored, this.joinPush.reset(), this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
      }), this.on(w.reply, (e3, t3) => {
        this.trigger(this.replyEventName(t3), e3);
      });
    }
    join(e2 = this.timeout) {
      if (this.joinedOnce) throw Error(`tried to join multiple times. 'join' can only be called a single time per channel instance`);
      return this.timeout = e2, this.joinedOnce = true, this.rejoin(), this.joinPush;
    }
    teardown() {
      this.pushBuffer.forEach((e2) => e2.destroy()), this.pushBuffer = [], this.rejoinTimer.reset(), this.joinPush.destroy(), this.state = C.closed, this.bindings = [];
    }
    onClose(e2) {
      this.on(w.close, e2);
    }
    onError(e2) {
      return this.on(w.error, (t2) => e2(t2));
    }
    on(e2, t2) {
      let n2 = this.bindingRef++;
      return this.bindings.push({ event: e2, ref: n2, callback: t2 }), n2;
    }
    off(e2, t2) {
      this.bindings = this.bindings.filter((n2) => !(n2.event === e2 && (t2 === void 0 || t2 === n2.ref)));
    }
    canPush() {
      return this.socket.isConnected() && this.isJoined();
    }
    push(e2, t2, n2 = this.timeout) {
      if (t2 || (t2 = {}), !this.joinedOnce) throw Error(`tried to push '${e2}' to '${this.topic}' before joining. Use channel.join() before pushing events`);
      let r2 = new Ie(this, e2, function() {
        return t2;
      }, n2);
      return this.canPush() ? r2.send() : (r2.startTimeout(), this.pushBuffer.push(r2)), r2;
    }
    leave(e2 = this.timeout) {
      this.rejoinTimer.reset(), this.joinPush.cancelTimeout(), this.state = C.leaving;
      let t2 = () => {
        this.socket.hasLogger() && this.socket.log(`channel`, `leave ${this.topic}`), this.trigger(w.close, `leave`);
      }, n2 = new Ie(this, w.leave, b({}), e2);
      return n2.receive(`ok`, () => t2()).receive(`timeout`, () => t2()), n2.send(), this.canPush() || n2.trigger(`ok`, {}), n2;
    }
    onMessage(e2, t2, n2) {
      return t2;
    }
    filterBindings(e2, t2, n2) {
      return true;
    }
    isMember(e2, t2, n2, r2) {
      return this.topic === e2 ? r2 && r2 !== this.joinRef() ? (this.socket.hasLogger() && this.socket.log(`channel`, `dropping outdated message`, { topic: e2, event: t2, payload: n2, joinRef: r2 }), false) : true : false;
    }
    joinRef() {
      return this.joinPush.ref;
    }
    rejoin(e2 = this.timeout) {
      this.isLeaving() || (this.socket.leaveOpenTopic(this.topic), this.state = C.joining, this.joinPush.resend(e2));
    }
    trigger(e2, t2, n2, r2) {
      let i2 = this.onMessage(e2, t2, n2, r2);
      if (t2 && !i2) throw Error(`channel onMessage callbacks must return the payload, modified or unmodified`);
      let a2 = this.bindings.filter((r3) => r3.event === e2 && this.filterBindings(r3, t2, n2));
      for (let e3 = 0; e3 < a2.length; e3++) a2[e3].callback(i2, n2, r2 || this.joinRef());
    }
    replyEventName(e2) {
      return `chan_reply_${e2}`;
    }
    isClosed() {
      return this.state === C.closed;
    }
    isErrored() {
      return this.state === C.errored;
    }
    isJoined() {
      return this.state === C.joined;
    }
    isJoining() {
      return this.state === C.joining;
    }
    isLeaving() {
      return this.state === C.leaving;
    }
  }, ze = class {
    static request(e2, t2, n2, r2, i2, a2, o2) {
      if (x.XDomainRequest) {
        let n3 = new x.XDomainRequest();
        return this.xdomainRequest(n3, e2, t2, r2, i2, a2, o2);
      } else if (x.XMLHttpRequest) {
        let s2 = new x.XMLHttpRequest();
        return this.xhrRequest(s2, e2, t2, n2, r2, i2, a2, o2);
      } else if (x.fetch && x.AbortController) return this.fetchRequest(e2, t2, n2, r2, i2, a2, o2);
      else throw Error(`No suitable XMLHttpRequest implementation found`);
    }
    static fetchRequest(e2, t2, n2, r2, i2, a2, o2) {
      let s2 = { method: e2, headers: n2, body: r2 }, c2 = null;
      return i2 && (c2 = new AbortController(), setTimeout(() => c2.abort(), i2), s2.signal = c2.signal), x.fetch(t2, s2).then((e3) => e3.text()).then((e3) => this.parseJSON(e3)).then((e3) => o2 && o2(e3)).catch((e3) => {
        e3.name === `AbortError` && a2 ? a2() : o2 && o2(null);
      }), c2;
    }
    static xdomainRequest(e2, t2, n2, r2, i2, a2, o2) {
      return e2.timeout = i2, e2.open(t2, n2), e2.onload = () => {
        let t3 = this.parseJSON(e2.responseText);
        o2 && o2(t3);
      }, a2 && (e2.ontimeout = a2), e2.onprogress = () => {
      }, e2.send(r2), e2;
    }
    static xhrRequest(e2, t2, n2, r2, i2, a2, o2, s2) {
      e2.open(t2, n2, true), e2.timeout = a2;
      for (let [t3, n3] of Object.entries(r2)) e2.setRequestHeader(t3, n3);
      return e2.onerror = () => s2 && s2(null), e2.onreadystatechange = () => {
        e2.readyState === Pe.complete && s2 && s2(this.parseJSON(e2.responseText));
      }, o2 && (e2.ontimeout = o2), e2.send(i2), e2;
    }
    static parseJSON(e2) {
      if (!e2 || e2 === ``) return null;
      try {
        return JSON.parse(e2);
      } catch (e3) {
        return console && console.log(`failed to parse JSON response`, e2), null;
      }
    }
    static serialize(e2, t2) {
      let n2 = [];
      for (var r2 in e2) {
        if (!Object.prototype.hasOwnProperty.call(e2, r2)) continue;
        let i2 = t2 ? `${t2}[${r2}]` : r2, a2 = e2[r2];
        typeof a2 == `object` ? n2.push(this.serialize(a2, i2)) : n2.push(encodeURIComponent(i2) + `=` + encodeURIComponent(a2));
      }
      return n2.join(`&`);
    }
    static appendParams(e2, t2) {
      return Object.keys(t2).length === 0 ? e2 : `${e2}${e2.match(/\?/) ? `&` : `?`}${this.serialize(t2)}`;
    }
  }, Be = (e2) => {
    let t2 = ``, n2 = new Uint8Array(e2), r2 = n2.byteLength;
    for (let e3 = 0; e3 < r2; e3++) t2 += String.fromCharCode(n2[e3]);
    return btoa(t2);
  }, Ve = class {
    constructor(e2, t2) {
      t2 && t2.length === 2 && t2[1].startsWith(Fe) && (this.authToken = atob(t2[1].slice(Fe.length))), this.endPoint = null, this.token = null, this.skipHeartbeat = true, this.reqs = /* @__PURE__ */ new Set(), this.awaitingBatchAck = false, this.currentBatch = null, this.currentBatchTimer = null, this.batchBuffer = [], this.onopen = function() {
      }, this.onerror = function() {
      }, this.onmessage = function() {
      }, this.onclose = function() {
      }, this.pollEndpoint = this.normalizeEndpoint(e2), this.readyState = S.connecting, setTimeout(() => this.poll(), 0);
    }
    normalizeEndpoint(e2) {
      return e2.replace(`ws://`, `http://`).replace(`wss://`, `https://`).replace(RegExp(`(.*)/` + Ne.websocket), `$1/` + Ne.longpoll);
    }
    endpointURL() {
      return ze.appendParams(this.pollEndpoint, { token: this.token });
    }
    closeAndRetry(e2, t2, n2) {
      this.close(e2, t2, n2), this.readyState = S.connecting;
    }
    ontimeout() {
      this.onerror(`timeout`), this.closeAndRetry(1005, `timeout`, false);
    }
    isActive() {
      return this.readyState === S.open || this.readyState === S.connecting;
    }
    poll() {
      let e2 = { Accept: `application/json` };
      this.authToken && (e2[`X-Phoenix-AuthToken`] = this.authToken), this.ajax(`GET`, e2, null, () => this.ontimeout(), (e3) => {
        if (e3) {
          var { status: t2, token: n2, messages: r2 } = e3;
          if (t2 === 410 && this.token !== null) {
            this.onerror(410), this.closeAndRetry(3410, `session_gone`, false);
            return;
          }
          this.token = n2;
        } else t2 = 0;
        switch (t2) {
          case 200:
            r2.forEach((e4) => {
              setTimeout(() => this.onmessage({ data: e4 }), 0);
            }), this.poll();
            break;
          case 204:
            this.poll();
            break;
          case 410:
            this.readyState = S.open, this.onopen({}), this.poll();
            break;
          case 403:
            this.onerror(403), this.close(1008, `forbidden`, false);
            break;
          case 0:
          case 500:
            this.onerror(500), this.closeAndRetry(1011, `internal server error`, 500);
            break;
          default:
            throw Error(`unhandled poll status ${t2}`);
        }
      });
    }
    send(e2) {
      typeof e2 != `string` && (e2 = Be(e2)), this.currentBatch ? this.currentBatch.push(e2) : this.awaitingBatchAck ? this.batchBuffer.push(e2) : (this.currentBatch = [e2], this.currentBatchTimer = setTimeout(() => {
        this.batchSend(this.currentBatch), this.currentBatch = null;
      }, 0));
    }
    batchSend(e2, t2 = 0) {
      this.awaitingBatchAck = true;
      let n2 = t2 + Me, r2 = e2.slice(t2, n2);
      this.ajax(`POST`, { "Content-Type": `application/x-ndjson` }, r2.join(`
`), () => this.onerror(`timeout`), (t3) => {
        !t3 || t3.status !== 200 ? (this.awaitingBatchAck = false, this.onerror(t3 && t3.status), this.closeAndRetry(1011, `internal server error`, false)) : n2 < e2.length ? this.batchSend(e2, n2) : this.batchBuffer.length > 0 ? (this.batchSend(this.batchBuffer), this.batchBuffer = []) : this.awaitingBatchAck = false;
      });
    }
    close(e2, t2, n2) {
      for (let e3 of this.reqs) e3.abort();
      this.readyState = S.closed;
      let r2 = Object.assign({ code: 1e3, reason: void 0, wasClean: true }, { code: e2, reason: t2, wasClean: n2 });
      this.batchBuffer = [], clearTimeout(this.currentBatchTimer), this.currentBatchTimer = null, typeof CloseEvent < `u` ? this.onclose(new CloseEvent(`close`, r2)) : this.onclose(r2);
    }
    ajax(e2, t2, n2, r2, i2) {
      let a2;
      a2 = ze.request(e2, this.endpointURL(), t2, n2, this.timeout, () => {
        this.reqs.delete(a2), r2();
      }, (e3) => {
        this.reqs.delete(a2), this.isActive() && i2(e3);
      }), this.reqs.add(a2);
    }
  }, He = class e2 {
    constructor(t2, n2 = {}) {
      let r2 = n2.events || { state: `presence_state`, diff: `presence_diff` };
      this.state = /* @__PURE__ */ Object.create(null), this.pendingDiffs = [], this.channel = t2, this.joinRef = null, this.caller = { onJoin: function() {
      }, onLeave: function() {
      }, onSync: function() {
      } }, this.channel.on(r2.state, (t3) => {
        let { onJoin: n3, onLeave: r3, onSync: i2 } = this.caller;
        this.joinRef = this.channel.joinRef(), this.state = e2.syncState(this.state, t3, n3, r3), this.pendingDiffs.forEach((t4) => {
          this.state = e2.syncDiff(this.state, t4, n3, r3);
        }), this.pendingDiffs = [], i2();
      }), this.channel.on(r2.diff, (t3) => {
        let { onJoin: n3, onLeave: r3, onSync: i2 } = this.caller;
        this.inPendingSyncState() ? this.pendingDiffs.push(t3) : (this.state = e2.syncDiff(this.state, t3, n3, r3), i2());
      });
    }
    onJoin(e3) {
      this.caller.onJoin = e3;
    }
    onLeave(e3) {
      this.caller.onLeave = e3;
    }
    onSync(e3) {
      this.caller.onSync = e3;
    }
    list(t2) {
      return e2.list(this.state, t2);
    }
    inPendingSyncState() {
      return !this.joinRef || this.joinRef !== this.channel.joinRef();
    }
    static syncState(e3, t2, n2, r2) {
      let i2 = this.toNullProtoObj(this.clone(e3));
      t2 = this.toNullProtoObj(t2);
      let a2 = /* @__PURE__ */ Object.create(null), o2 = /* @__PURE__ */ Object.create(null);
      return this.map(i2, (e4, n3) => {
        t2[e4] || (o2[e4] = n3);
      }), this.map(t2, (e4, t3) => {
        let n3 = i2[e4];
        if (n3) {
          let r3 = t3.metas.map((e5) => e5.phx_ref), i3 = n3.metas.map((e5) => e5.phx_ref), s2 = t3.metas.filter((e5) => i3.indexOf(e5.phx_ref) < 0), c2 = n3.metas.filter((e5) => r3.indexOf(e5.phx_ref) < 0);
          s2.length > 0 && (a2[e4] = t3, a2[e4].metas = s2), c2.length > 0 && (o2[e4] = this.clone(n3), o2[e4].metas = c2);
        } else a2[e4] = t3;
      }), this.syncDiff(i2, { joins: a2, leaves: o2 }, n2, r2);
    }
    static syncDiff(e3, t2, n2, r2) {
      e3 = this.toNullProtoObj(e3);
      let { joins: i2, leaves: a2 } = this.clone(t2);
      return n2 || (n2 = function() {
      }), r2 || (r2 = function() {
      }), this.map(i2, (t3, r3) => {
        let i3 = e3[t3];
        if (e3[t3] = this.clone(r3), i3) {
          let n3 = e3[t3].metas.map((e4) => e4.phx_ref), r4 = i3.metas.filter((e4) => n3.indexOf(e4.phx_ref) < 0);
          e3[t3].metas.unshift(...r4);
        }
        n2(t3, i3, r3);
      }), this.map(a2, (t3, n3) => {
        let i3 = e3[t3];
        if (!i3) return;
        let a3 = n3.metas.map((e4) => e4.phx_ref);
        i3.metas = i3.metas.filter((e4) => a3.indexOf(e4.phx_ref) < 0), r2(t3, i3, n3), i3.metas.length === 0 && delete e3[t3];
      }), e3;
    }
    static list(e3, t2) {
      return t2 || (t2 = function(e4, t3) {
        return t3;
      }), this.map(e3, (e4, n2) => t2(e4, n2));
    }
    static map(e3, t2) {
      return Object.getOwnPropertyNames(e3).map((n2) => t2(n2, e3[n2]));
    }
    static toNullProtoObj(e3) {
      if (Object.getPrototypeOf(e3) === null) return e3;
      let t2 = /* @__PURE__ */ Object.create(null);
      return Object.getOwnPropertyNames(e3).forEach((n2) => {
        t2[n2] = e3[n2];
      }), t2;
    }
    static clone(e3) {
      return JSON.parse(JSON.stringify(e3));
    }
  }, Ue = { HEADER_LENGTH: 1, META_LENGTH: 4, KINDS: { push: 0, reply: 1, broadcast: 2 }, encode(e2, t2) {
    if (e2.payload.constructor === ArrayBuffer) return t2(this.binaryEncode(e2));
    {
      let n2 = [e2.join_ref, e2.ref, e2.topic, e2.event, e2.payload];
      return t2(JSON.stringify(n2));
    }
  }, decode(e2, t2) {
    if (e2.constructor === ArrayBuffer) return t2(this.binaryDecode(e2));
    {
      let [n2, r2, i2, a2, o2] = JSON.parse(e2);
      return t2({ join_ref: n2, ref: r2, topic: i2, event: a2, payload: o2 });
    }
  }, binaryEncode(e2) {
    let { join_ref: t2, ref: n2, event: r2, topic: i2, payload: a2 } = e2, o2 = new TextEncoder(), s2 = o2.encode(t2), c2 = o2.encode(n2), l2 = o2.encode(i2), u2 = o2.encode(r2);
    this.assertFieldSize(s2.byteLength, `join_ref`), this.assertFieldSize(c2.byteLength, `ref`), this.assertFieldSize(l2.byteLength, `topic`), this.assertFieldSize(u2.byteLength, `event`);
    let d2 = this.META_LENGTH + s2.byteLength + c2.byteLength + l2.byteLength + u2.byteLength, f2 = new ArrayBuffer(this.HEADER_LENGTH + d2), p2 = new Uint8Array(f2), m2 = new DataView(f2), h2 = 0;
    m2.setUint8(h2++, this.KINDS.push), m2.setUint8(h2++, s2.byteLength), m2.setUint8(h2++, c2.byteLength), m2.setUint8(h2++, l2.byteLength), m2.setUint8(h2++, u2.byteLength), p2.set(s2, h2), h2 += s2.byteLength, p2.set(c2, h2), h2 += c2.byteLength, p2.set(l2, h2), h2 += l2.byteLength, p2.set(u2, h2), h2 += u2.byteLength;
    var g2 = new Uint8Array(f2.byteLength + a2.byteLength);
    return g2.set(p2, 0), g2.set(new Uint8Array(a2), f2.byteLength), g2.buffer;
  }, assertFieldSize(e2, t2) {
    if (e2 > 255) throw Error(`unable to convert ${t2} to binary: must be less than or equal to 255 bytes, but is ${e2} bytes`);
  }, binaryDecode(e2) {
    let t2 = new DataView(e2), n2 = t2.getUint8(0), r2 = new TextDecoder();
    switch (n2) {
      case this.KINDS.push:
        return this.decodePush(e2, t2, r2);
      case this.KINDS.reply:
        return this.decodeReply(e2, t2, r2);
      case this.KINDS.broadcast:
        return this.decodeBroadcast(e2, t2, r2);
    }
  }, decodePush(e2, t2, n2) {
    let r2 = t2.getUint8(1), i2 = t2.getUint8(2), a2 = t2.getUint8(3), o2 = this.HEADER_LENGTH + this.META_LENGTH - 1, s2 = n2.decode(e2.slice(o2, o2 + r2));
    o2 += r2;
    let c2 = n2.decode(e2.slice(o2, o2 + i2));
    o2 += i2;
    let l2 = n2.decode(e2.slice(o2, o2 + a2));
    return o2 += a2, { join_ref: s2, ref: null, topic: c2, event: l2, payload: e2.slice(o2, e2.byteLength) };
  }, decodeReply(e2, t2, n2) {
    let r2 = t2.getUint8(1), i2 = t2.getUint8(2), a2 = t2.getUint8(3), o2 = t2.getUint8(4), s2 = this.HEADER_LENGTH + this.META_LENGTH, c2 = n2.decode(e2.slice(s2, s2 + r2));
    s2 += r2;
    let l2 = n2.decode(e2.slice(s2, s2 + i2));
    s2 += i2;
    let u2 = n2.decode(e2.slice(s2, s2 + a2));
    s2 += a2;
    let d2 = n2.decode(e2.slice(s2, s2 + o2));
    s2 += o2;
    let f2 = { status: d2, response: e2.slice(s2, e2.byteLength) };
    return { join_ref: c2, ref: l2, topic: u2, event: w.reply, payload: f2 };
  }, decodeBroadcast(e2, t2, n2) {
    let r2 = t2.getUint8(1), i2 = t2.getUint8(2), a2 = this.HEADER_LENGTH + 2, o2 = n2.decode(e2.slice(a2, a2 + r2));
    a2 += r2;
    let s2 = n2.decode(e2.slice(a2, a2 + i2));
    return a2 += i2, { join_ref: null, ref: null, topic: o2, event: s2, payload: e2.slice(a2, e2.byteLength) };
  } }, We = class {
    constructor(e2, t2 = {}) {
      var _a2, _b2;
      this.stateChangeCallbacks = { open: [], close: [], error: [], message: [] }, this.channels = [], this.sendBuffer = [], this.ref = 0, this.fallbackRef = null, this.timeout = t2.timeout || Ae, this.transport = t2.transport || x.WebSocket || Ve, this.conn = void 0, this.primaryPassedHealthCheck = false, this.longPollFallbackMs = t2.longPollFallbackMs, this.fallbackTimer = null;
      let n2 = null;
      try {
        n2 = x && x.sessionStorage;
      } catch (e3) {
      }
      this.sessionStore = t2.sessionStorage || n2, this.establishedConnections = 0, this.defaultEncoder = Ue.encode.bind(Ue), this.defaultDecoder = Ue.decode.bind(Ue), this.closeWasClean = true, this.disconnecting = false, this.binaryType = t2.binaryType || `arraybuffer`, this.connectClock = 1, this.pageHidden = false, this.encode = void 0, this.decode = void 0, this.transport === Ve ? (this.encode = this.defaultEncoder, this.decode = this.defaultDecoder) : (this.encode = t2.encode || this.defaultEncoder, this.decode = t2.decode || this.defaultDecoder);
      let r2 = null;
      Oe && Oe.addEventListener && (Oe.addEventListener(`pagehide`, (e3) => {
        this.conn && (this.disconnect(), r2 = this.connectClock);
      }), Oe.addEventListener(`pageshow`, (e3) => {
        r2 === this.connectClock && (r2 = null, this.connect());
      }), Oe.addEventListener(`visibilitychange`, () => {
        document.visibilityState === `hidden` ? this.pageHidden = true : (this.pageHidden = false, !this.isConnected() && !this.closeWasClean && this.teardown(() => this.connect()));
      })), this.heartbeatIntervalMs = t2.heartbeatIntervalMs || 3e4, this.autoSendHeartbeat = (_a2 = t2.autoSendHeartbeat) != null ? _a2 : true, this.heartbeatCallback = (_b2 = t2.heartbeatCallback) != null ? _b2 : (() => {
      }), this.rejoinAfterMs = (e3) => t2.rejoinAfterMs ? t2.rejoinAfterMs(e3) : [1e3, 2e3, 5e3][e3 - 1] || 1e4, this.reconnectAfterMs = (e3) => t2.reconnectAfterMs ? t2.reconnectAfterMs(e3) : [10, 50, 100, 150, 200, 250, 500, 1e3, 2e3][e3 - 1] || 5e3, this.logger = t2.logger || null, !this.logger && t2.debug && (this.logger = (e3, t3, n3) => {
        console.log(`${e3}: ${t3}`, n3);
      }), this.longpollerTimeout = t2.longpollerTimeout || 2e4, this.params = b(t2.params || {}), this.endPoint = `${e2}/${Ne.websocket}`, this.vsn = t2.vsn || ke, this.heartbeatTimeoutTimer = null, this.heartbeatTimer = null, this.heartbeatSentAt = null, this.pendingHeartbeatRef = null, this.reconnectTimer = new Le(() => {
        if (this.pageHidden) {
          this.log(`Not reconnecting as page is hidden!`), this.teardown();
          return;
        }
        this.teardown(async () => {
          t2.beforeReconnect && await t2.beforeReconnect(), this.connect();
        });
      }, this.reconnectAfterMs), this.authToken = t2.authToken && b(t2.authToken);
    }
    getLongPollTransport() {
      return Ve;
    }
    replaceTransport(e2) {
      this.connectClock++, this.closeWasClean = true, clearTimeout(this.fallbackTimer), this.reconnectTimer.reset(), this.conn && (this.conn = (this.conn.close(), null)), this.transport = e2;
    }
    protocol() {
      return location.protocol.match(/^https/) ? `wss` : `ws`;
    }
    endPointURL() {
      let e2 = ze.appendParams(ze.appendParams(this.endPoint, this.params()), { vsn: this.vsn });
      return e2.charAt(0) === `/` ? e2.charAt(1) === `/` ? `${this.protocol()}:${e2}` : `${this.protocol()}://${location.host}${e2}` : e2;
    }
    disconnect(e2, t2, n2) {
      this.connectClock++, this.disconnecting = true, this.closeWasClean = true, clearTimeout(this.fallbackTimer), this.reconnectTimer.reset(), this.teardown(() => {
        this.disconnecting = false, e2 && e2();
      }, t2, n2);
    }
    connect(e2) {
      e2 && (console && console.log(`passing params to connect is deprecated. Instead pass :params to the Socket constructor`), this.params = b(e2)), !(this.conn && !this.disconnecting) && (this.longPollFallbackMs && this.transport !== Ve ? this.connectWithFallback(Ve, this.longPollFallbackMs) : this.transportConnect());
    }
    log(e2, t2, n2) {
      this.logger && this.logger(e2, t2, n2);
    }
    hasLogger() {
      return this.logger !== null;
    }
    onOpen(e2) {
      let t2 = this.makeRef();
      return this.stateChangeCallbacks.open.push([t2, e2]), t2;
    }
    onClose(e2) {
      let t2 = this.makeRef();
      return this.stateChangeCallbacks.close.push([t2, e2]), t2;
    }
    onError(e2) {
      let t2 = this.makeRef();
      return this.stateChangeCallbacks.error.push([t2, e2]), t2;
    }
    onMessage(e2) {
      let t2 = this.makeRef();
      return this.stateChangeCallbacks.message.push([t2, e2]), t2;
    }
    onHeartbeat(e2) {
      this.heartbeatCallback = e2;
    }
    ping(e2) {
      if (!this.isConnected()) return false;
      let t2 = this.makeRef(), n2 = Date.now();
      this.push({ topic: `phoenix`, event: `heartbeat`, payload: {}, ref: t2 });
      let r2 = this.onMessage((i2) => {
        i2.ref === t2 && (this.off([r2]), e2(Date.now() - n2));
      });
      return true;
    }
    transportName(e2) {
      switch (e2) {
        case Ve:
          return `LongPoll`;
        default:
          return e2.name;
      }
    }
    transportConnect() {
      this.connectClock++, this.closeWasClean = false;
      let e2;
      this.authToken && (e2 = [`phoenix`, `${Fe}${btoa(this.authToken()).replace(/=/g, ``)}`]), this.conn = new this.transport(this.endPointURL(), e2), this.conn.binaryType = this.binaryType, this.conn.timeout = this.longpollerTimeout, this.conn.onopen = () => this.onConnOpen(), this.conn.onerror = (e3) => this.onConnError(e3), this.conn.onmessage = (e3) => this.onConnMessage(e3), this.conn.onclose = (e3) => this.onConnClose(e3);
    }
    getSession(e2) {
      return this.sessionStore && this.sessionStore.getItem(e2);
    }
    storeSession(e2, t2) {
      this.sessionStore && this.sessionStore.setItem(e2, t2);
    }
    connectWithFallback(e2, t2 = 2500) {
      clearTimeout(this.fallbackTimer);
      let n2 = false, r2 = true, i2, a2 = this.transportName(e2), o2 = (t3) => {
        this.log(`transport`, `falling back to ${a2}...`, t3), this.off([void 0, i2]), r2 = false, this.replaceTransport(e2), this.transportConnect();
      };
      if (this.getSession(`phx:fallback:${a2}`)) return o2(`memorized`);
      this.fallbackTimer = setTimeout(o2, t2), i2 = this.onError((e3) => {
        this.log(`transport`, `error`, e3), r2 && !n2 && (clearTimeout(this.fallbackTimer), o2(e3));
      }), this.fallbackRef && this.off([this.fallbackRef]), this.fallbackRef = this.onOpen(() => {
        if (n2 = true, !r2) {
          let t3 = this.transportName(e2);
          return this.primaryPassedHealthCheck || this.storeSession(`phx:fallback:${t3}`, `true`), this.log(`transport`, `established ${t3} fallback`);
        }
        clearTimeout(this.fallbackTimer), this.fallbackTimer = setTimeout(o2, t2), this.ping((e3) => {
          this.log(`transport`, `connected to primary after`, e3), this.primaryPassedHealthCheck = true, clearTimeout(this.fallbackTimer);
        });
      }), this.transportConnect();
    }
    clearHeartbeats() {
      clearTimeout(this.heartbeatTimer), clearTimeout(this.heartbeatTimeoutTimer);
    }
    onConnOpen() {
      this.hasLogger() && this.log(`transport`, `connected to ${this.endPointURL()}`), this.closeWasClean = false, this.disconnecting = false, this.establishedConnections++, this.flushSendBuffer(), this.reconnectTimer.reset(), this.autoSendHeartbeat && this.resetHeartbeat(), this.triggerStateCallbacks(`open`);
    }
    heartbeatTimeout() {
      if (this.pendingHeartbeatRef) {
        this.pendingHeartbeatRef = null, this.heartbeatSentAt = null, this.hasLogger() && this.log(`transport`, `heartbeat timeout. Attempting to re-establish connection`);
        try {
          this.heartbeatCallback(`timeout`);
        } catch (e2) {
          this.log(`error`, `error in heartbeat callback`, e2);
        }
        this.triggerChanError(Error(`heartbeat timeout`)), this.closeWasClean = false, this.teardown(() => this.reconnectTimer.scheduleTimeout(), je, `heartbeat timeout`);
      }
    }
    resetHeartbeat() {
      this.conn && this.conn.skipHeartbeat || (this.pendingHeartbeatRef = null, this.clearHeartbeats(), this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), this.heartbeatIntervalMs));
    }
    teardown(e2, t2, n2) {
      if (!this.conn) return e2 && e2();
      let r2 = this.conn;
      this.waitForBufferDone(r2, () => {
        t2 ? r2.close(t2, n2 || ``) : r2.close(), this.waitForSocketClosed(r2, () => {
          this.conn === r2 && (this.conn.onopen = function() {
          }, this.conn.onerror = function() {
          }, this.conn.onmessage = function() {
          }, this.conn.onclose = function() {
          }, this.conn = null), e2 && e2();
        });
      });
    }
    waitForBufferDone(e2, t2, n2 = 1) {
      if (n2 === 5 || !e2.bufferedAmount) {
        t2();
        return;
      }
      setTimeout(() => {
        this.waitForBufferDone(e2, t2, n2 + 1);
      }, 150 * n2);
    }
    waitForSocketClosed(e2, t2, n2 = 1) {
      if (n2 === 5 || e2.readyState === S.closed) {
        t2();
        return;
      }
      setTimeout(() => {
        this.waitForSocketClosed(e2, t2, n2 + 1);
      }, 150 * n2);
    }
    onConnClose(e2) {
      this.conn && (this.conn.onclose = () => {
      }), this.hasLogger() && this.log(`transport`, `close`, e2), this.triggerChanError(e2), this.clearHeartbeats(), this.closeWasClean || this.reconnectTimer.scheduleTimeout(), this.triggerStateCallbacks(`close`, e2);
    }
    onConnError(e2) {
      this.hasLogger() && this.log(`transport`, `error`, e2);
      let t2 = this.transport, n2 = this.establishedConnections;
      this.triggerStateCallbacks(`error`, e2, t2, n2), (t2 === this.transport || n2 > 0) && this.triggerChanError(e2);
    }
    triggerChanError(e2) {
      this.channels.forEach((t2) => {
        t2.isErrored() || t2.isLeaving() || t2.isClosed() || t2.trigger(w.error, e2);
      });
    }
    connectionState() {
      switch (this.conn && this.conn.readyState) {
        case S.connecting:
          return `connecting`;
        case S.open:
          return `open`;
        case S.closing:
          return `closing`;
        default:
          return `closed`;
      }
    }
    isConnected() {
      return this.connectionState() === `open`;
    }
    remove(e2) {
      this.off(e2.stateChangeRefs), this.channels = this.channels.filter((t2) => t2 !== e2);
    }
    off(e2) {
      for (let t2 in this.stateChangeCallbacks) this.stateChangeCallbacks[t2] = this.stateChangeCallbacks[t2].filter(([t3]) => e2.indexOf(t3) === -1);
    }
    channel(e2, t2 = {}) {
      let n2 = new Re(e2, t2, this);
      return this.channels.push(n2), n2;
    }
    push(e2) {
      if (this.hasLogger()) {
        let { topic: t2, event: n2, payload: r2, ref: i2, join_ref: a2 } = e2;
        this.log(`push`, `${t2} ${n2} (${a2}, ${i2})`, r2);
      }
      this.isConnected() ? this.encode(e2, (e3) => this.conn.send(e3)) : this.sendBuffer.push(() => this.encode(e2, (e3) => this.conn.send(e3)));
    }
    makeRef() {
      let e2 = this.ref + 1;
      return e2 === this.ref ? this.ref = 0 : this.ref = e2, this.ref.toString();
    }
    sendHeartbeat() {
      if (!this.isConnected()) {
        try {
          this.heartbeatCallback(`disconnected`);
        } catch (e2) {
          this.log(`error`, `error in heartbeat callback`, e2);
        }
        return;
      }
      if (this.pendingHeartbeatRef) {
        this.heartbeatTimeout();
        return;
      }
      this.pendingHeartbeatRef = this.makeRef(), this.heartbeatSentAt = Date.now(), this.push({ topic: `phoenix`, event: `heartbeat`, payload: {}, ref: this.pendingHeartbeatRef });
      try {
        this.heartbeatCallback(`sent`);
      } catch (e2) {
        this.log(`error`, `error in heartbeat callback`, e2);
      }
      this.heartbeatTimeoutTimer = setTimeout(() => this.heartbeatTimeout(), this.heartbeatIntervalMs);
    }
    flushSendBuffer() {
      this.isConnected() && this.sendBuffer.length > 0 && (this.sendBuffer.forEach((e2) => e2()), this.sendBuffer = []);
    }
    onConnMessage(e2) {
      this.decode(e2.data, (e3) => {
        let { topic: t2, event: n2, payload: r2, ref: i2, join_ref: a2 } = e3;
        if (i2 && i2 === this.pendingHeartbeatRef) {
          let e4 = this.heartbeatSentAt ? Date.now() - this.heartbeatSentAt : void 0;
          this.clearHeartbeats();
          try {
            this.heartbeatCallback(r2.status === `ok` ? `ok` : `error`, e4);
          } catch (e5) {
            this.log(`error`, `error in heartbeat callback`, e5);
          }
          this.pendingHeartbeatRef = null, this.heartbeatSentAt = null, this.autoSendHeartbeat && (this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), this.heartbeatIntervalMs));
        }
        this.hasLogger() && this.log(`receive`, `${r2.status || ``} ${t2} ${n2} ${i2 && `(` + i2 + `)` || ``}`.trim(), r2);
        for (let e4 = 0; e4 < this.channels.length; e4++) {
          let o2 = this.channels[e4];
          o2.isMember(t2, n2, r2, a2) && o2.trigger(n2, r2, i2, a2);
        }
        this.triggerStateCallbacks(`message`, e3);
      });
    }
    triggerStateCallbacks(e2, ...t2) {
      try {
        this.stateChangeCallbacks[e2].forEach(([n2, r2]) => {
          try {
            r2(...t2);
          } catch (t3) {
            this.log(`error`, `error in ${e2} callback`, t3);
          }
        });
      } catch (t3) {
        this.log(`error`, `error triggering ${e2} callbacks`, t3);
      }
    }
    leaveOpenTopic(e2) {
      let t2 = this.channels.find((t3) => t3.topic === e2 && (t3.isJoined() || t3.isJoining()));
      t2 && (this.hasLogger() && this.log(`transport`, `leaving duplicate topic "${e2}"`), t2.leave());
    }
  }, Ge = class e2 {
    constructor(t2, n2) {
      let r2 = Je(n2);
      this.presence = new He(t2.getChannel(), r2), this.presence.onJoin((n3, r3, i2) => {
        let a2 = e2.onJoinPayload(n3, r3, i2);
        t2.getChannel().trigger(`presence`, a2);
      }), this.presence.onLeave((n3, r3, i2) => {
        let a2 = e2.onLeavePayload(n3, r3, i2);
        t2.getChannel().trigger(`presence`, a2);
      }), this.presence.onSync(() => {
        t2.getChannel().trigger(`presence`, { event: `sync` });
      });
    }
    get state() {
      return e2.transformState(this.presence.state);
    }
    static transformState(e3) {
      return e3 = qe(e3), Object.getOwnPropertyNames(e3).reduce((t2, n2) => {
        let r2 = e3[n2];
        return t2[n2] = Ke(r2), t2;
      }, {});
    }
    static onJoinPayload(e3, t2, n2) {
      return { event: `join`, key: e3, currentPresences: Ye(t2), newPresences: Ke(n2) };
    }
    static onLeavePayload(e3, t2, n2) {
      return { event: `leave`, key: e3, currentPresences: Ye(t2), leftPresences: Ke(n2) };
    }
  };
  function Ke(e2) {
    return e2.metas.map((e3) => {
      let t2 = Object.getOwnPropertyDescriptors(e3), n2 = Object.defineProperties({}, t2);
      return n2.presence_ref = n2.phx_ref, delete n2.phx_ref, delete n2.phx_ref_prev, n2;
    });
  }
  function qe(e2) {
    return JSON.parse(JSON.stringify(e2));
  }
  function Je(e2) {
    return (e2 == null ? void 0 : e2.events) && { events: e2.events };
  }
  function Ye(e2) {
    return (e2 == null ? void 0 : e2.metas) ? Ke(e2) : [];
  }
  var Xe;
  (function(e2) {
    e2.SYNC = `sync`, e2.JOIN = `join`, e2.LEAVE = `leave`;
  })(Xe || (Xe = {}));
  var Ze = class {
    get state() {
      return this.presenceAdapter.state;
    }
    constructor(e2, t2) {
      this.channel = e2, this.presenceAdapter = new Ge(this.channel.channelAdapter, t2);
    }
  };
  function Qe(e2) {
    if (e2 instanceof Error) return e2;
    if (typeof e2 == `string`) return Error(e2);
    if (e2 && typeof e2 == `object`) {
      let t2 = e2;
      if (typeof t2.code == `number`) {
        let n2 = typeof t2.reason == `string` && t2.reason ? ` (${t2.reason})` : ``;
        return Error(`socket closed: ${t2.code}${n2}`, { cause: e2 });
      }
      return Error(`channel error: transport failure`, { cause: e2 });
    }
    return Error(`channel error: connection lost`);
  }
  var $e = class {
    constructor(e2, t2, n2) {
      let r2 = et(n2);
      this.channel = e2.getSocket().channel(t2, r2), this.socket = e2;
    }
    get state() {
      return this.channel.state;
    }
    set state(e2) {
      this.channel.state = e2;
    }
    get joinedOnce() {
      return this.channel.joinedOnce;
    }
    get joinPush() {
      return this.channel.joinPush;
    }
    get rejoinTimer() {
      return this.channel.rejoinTimer;
    }
    on(e2, t2) {
      return this.channel.on(e2, t2);
    }
    off(e2, t2) {
      this.channel.off(e2, t2);
    }
    subscribe(e2) {
      return this.channel.join(e2);
    }
    unsubscribe(e2) {
      return this.channel.leave(e2);
    }
    teardown() {
      this.channel.teardown();
    }
    onClose(e2) {
      this.channel.onClose(e2);
    }
    onError(e2) {
      return this.channel.onError(e2);
    }
    push(e2, t2, n2) {
      let r2;
      try {
        r2 = this.channel.push(e2, t2, n2);
      } catch (e3) {
        throw Error(`tried to push '${e2}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`);
      }
      if (this.channel.pushBuffer.length > 100) {
        let e3 = this.channel.pushBuffer.shift();
        e3.cancelTimeout(), this.socket.log(`channel`, `discarded push due to buffer overflow: ${e3.event}`, e3.payload());
      }
      return r2;
    }
    updateJoinPayload(e2) {
      let t2 = this.channel.joinPush.payload();
      this.channel.joinPush.payload = () => Object.assign(Object.assign({}, t2), e2);
    }
    canPush() {
      return this.socket.isConnected() && this.state === v.joined;
    }
    isJoined() {
      return this.state === v.joined;
    }
    isJoining() {
      return this.state === v.joining;
    }
    isClosed() {
      return this.state === v.closed;
    }
    isLeaving() {
      return this.state === v.leaving;
    }
    updateFilterBindings(e2) {
      this.channel.filterBindings = e2;
    }
    updatePayloadTransform(e2) {
      this.channel.onMessage = e2;
    }
    getChannel() {
      return this.channel;
    }
  };
  function et(e2) {
    return { config: Object.assign({ broadcast: { ack: false, self: false }, presence: { key: ``, enabled: false }, private: false }, e2.config) };
  }
  let tt = /[,()"\\]/, nt = (e2) => tt.test(e2) || e2 !== e2.trim(), rt = (e2) => `"${e2.replace(/\\/g, `\\\\`).replace(/"/g, `\\"`)}"`, it = (e2) => {
    let t2 = e2 === null ? `null` : String(e2);
    return nt(t2) ? rt(t2) : t2;
  }, at = (e2) => e2 === null ? `null` : String(e2), ot = (e2, t2) => {
    if (e2 === `in`) {
      let e3 = Array.isArray(t2) ? t2 : [t2];
      if (e3.length === 0) throw Error("Realtime `in` filter requires at least one value.");
      return `in.(${Array.from(new Set(e3)).map((e4) => it(e4)).join(`,`)})`;
    }
    return e2 === `is` ? `is.${at(t2)}` : `${e2}.${it(t2)}`;
  };
  var st = class {
    constructor() {
      this.filters = [];
    }
    add(e2, t2, n2, r2 = false) {
      let i2 = r2 ? `not.` : ``;
      return this.filters.push(`${e2}=${i2}${ot(t2, n2)}`), this;
    }
    eq(e2, t2) {
      return this.add(e2, `eq`, t2);
    }
    neq(e2, t2) {
      return this.add(e2, `neq`, t2);
    }
    gt(e2, t2) {
      return this.add(e2, `gt`, t2);
    }
    gte(e2, t2) {
      return this.add(e2, `gte`, t2);
    }
    lt(e2, t2) {
      return this.add(e2, `lt`, t2);
    }
    lte(e2, t2) {
      return this.add(e2, `lte`, t2);
    }
    in(e2, t2) {
      return this.add(e2, `in`, t2);
    }
    like(e2, t2) {
      return this.add(e2, `like`, t2);
    }
    ilike(e2, t2) {
      return this.add(e2, `ilike`, t2);
    }
    match(e2, t2) {
      return this.add(e2, `match`, t2);
    }
    imatch(e2, t2) {
      return this.add(e2, `imatch`, t2);
    }
    is(e2, t2) {
      return this.add(e2, `is`, t2);
    }
    isDistinct(e2, t2) {
      return this.add(e2, `isdistinct`, t2);
    }
    not(e2, t2, n2) {
      return this.add(e2, t2, n2, true);
    }
    build() {
      return this.filters.join(`,`);
    }
    toString() {
      return this.build();
    }
  };
  let ct = () => new st();
  var lt;
  (function(e2) {
    e2.ALL = `*`, e2.INSERT = `INSERT`, e2.UPDATE = `UPDATE`, e2.DELETE = `DELETE`;
  })(lt || (lt = {}));
  var T;
  (function(e2) {
    e2.BROADCAST = `broadcast`, e2.PRESENCE = `presence`, e2.POSTGRES_CHANGES = `postgres_changes`, e2.SYSTEM = `system`;
  })(T || (T = {}));
  var E;
  (function(e2) {
    e2.SUBSCRIBED = `SUBSCRIBED`, e2.TIMED_OUT = `TIMED_OUT`, e2.CLOSED = `CLOSED`, e2.CHANNEL_ERROR = `CHANNEL_ERROR`;
  })(E || (E = {}));
  let ut = v;
  var dt = class e2 {
    get state() {
      return this.channelAdapter.state;
    }
    set state(e3) {
      this.channelAdapter.state = e3;
    }
    get joinedOnce() {
      return this.channelAdapter.joinedOnce;
    }
    get timeout() {
      return this.socket.timeout;
    }
    get joinPush() {
      return this.channelAdapter.joinPush;
    }
    get rejoinTimer() {
      return this.channelAdapter.rejoinTimer;
    }
    constructor(e3, t2 = { config: {} }, n2) {
      var _a2, _b2;
      if (this.topic = e3, this.params = t2, this.socket = n2, this.bindings = {}, this.subTopic = e3.replace(/^realtime:/i, ``), this.params.config = Object.assign({ broadcast: { ack: false, self: false }, presence: { key: ``, enabled: false }, private: false }, t2.config), this.channelAdapter = new $e(this.socket.socketAdapter, e3, this.params), this.presence = new Ze(this), this._onClose(() => {
        this.socket._remove(this);
      }), this._updateFilterTransform(), this.broadcastEndpointURL = Ee(this.socket.socketAdapter.endPointURL()), this.private = this.params.config.private || false, !this.private && ((_b2 = (_a2 = this.params.config) == null ? void 0 : _a2.broadcast) == null ? void 0 : _b2.replay)) throw Error(`tried to use replay on public channel '${this.topic}'. It must be a private channel.`);
    }
    subscribe(e3, t2 = this.timeout) {
      var _a2, _b2, _c2, _d;
      if (this.socket.isConnected() || this.socket.connect(), this.channelAdapter.isClosed()) {
        let { config: { broadcast: n2, presence: r2, private: i2, postgres_changes_options: a2 } } = this.params, o2 = (_b2 = (_a2 = this.bindings.postgres_changes) == null ? void 0 : _a2.map((e4) => e4.filter)) != null ? _b2 : [], s2 = !!this.bindings[T.PRESENCE] && this.bindings[T.PRESENCE].length > 0 || ((_c2 = this.params.config.presence) == null ? void 0 : _c2.enabled) === true, c2 = {}, l2 = Object.assign({ broadcast: n2, presence: Object.assign(Object.assign({}, r2), { enabled: s2 }), postgres_changes: o2, private: i2 }, a2 ? { postgres_changes_options: a2 } : {});
        this.socket.accessTokenValue && (c2.access_token = this.socket.accessTokenValue), this._onError((t3) => {
          e3 == null ? void 0 : e3(E.CHANNEL_ERROR, Qe(t3));
        }), this._onClose(() => e3 == null ? void 0 : e3(E.CLOSED)), this.updateJoinPayload(Object.assign({ config: l2 }, c2)), this._updateFilterMessage();
        let u2 = (a2 == null ? void 0 : a2.wait) && o2.length > 0 ? Math.max(t2, ((_d = a2.timeout) != null ? _d : 15e3) + 1e4) : t2;
        this.channelAdapter.subscribe(u2).receive(`ok`, async ({ postgres_changes: t3 }) => {
          if (this.socket._isManualToken() || this.socket.setAuth(), t3 === void 0) {
            e3 == null ? void 0 : e3(E.SUBSCRIBED);
            return;
          }
          this._updatePostgresBindings(t3, e3);
        }).receive(`error`, (t3) => {
          this.state = v.errored;
          let n3 = Object.values(t3).join(`, `) || `error`;
          e3 == null ? void 0 : e3(E.CHANNEL_ERROR, Error(n3, { cause: t3 }));
        }).receive(`timeout`, () => {
          e3 == null ? void 0 : e3(E.TIMED_OUT);
        });
      }
      return this;
    }
    _updatePostgresBindings(t2, n2) {
      var _a2;
      let r2 = this.bindings.postgres_changes, i2 = (_a2 = r2 == null ? void 0 : r2.length) != null ? _a2 : 0, a2 = [];
      for (let o2 = 0; o2 < i2; o2++) {
        let i3 = r2[o2], { filter: { event: s2, schema: c2, table: l2, filter: u2 } } = i3, d2 = t2 && t2[o2];
        if (d2 && d2.event === s2 && e2.isFilterValueEqual(d2.schema, c2) && e2.isFilterValueEqual(d2.table, l2) && e2.isFilterValueEqual(d2.filter, u2)) a2.push(Object.assign(Object.assign({}, i3), { id: d2.id }));
        else {
          this.unsubscribe(), this.state = v.errored, n2 == null ? void 0 : n2(E.CHANNEL_ERROR, Error(`mismatch between server and client bindings for postgres changes`));
          return;
        }
      }
      this.bindings.postgres_changes = a2, this.state != v.errored && n2 && n2(E.SUBSCRIBED);
    }
    presenceState() {
      return this.presence.state;
    }
    async track(e3, t2 = {}) {
      return await this.send({ type: `presence`, event: `track`, payload: e3 }, t2);
    }
    async untrack(e3 = {}) {
      return await this.send({ type: `presence`, event: `untrack` }, e3);
    }
    on(e3, t2, n2) {
      let r2 = this.channelAdapter.isJoined() || this.channelAdapter.isJoining(), i2 = e3 === T.PRESENCE || e3 === T.POSTGRES_CHANGES;
      if (r2 && i2) throw this.socket.log(`channel`, `cannot add \`${e3}\` callbacks for ${this.topic} after \`subscribe()\`.`), Error(`cannot add \`${e3}\` callbacks for ${this.topic} after \`subscribe()\`.`);
      return this._on(e3, t2, n2);
    }
    async httpSend(e3, t2, n2 = {}) {
      var _a2;
      if (t2 == null) return Promise.reject(Error(`Payload is required for httpSend()`));
      let r2 = t2 instanceof ArrayBuffer || ArrayBuffer.isView(t2), i2 = { apikey: this.socket.apiKey ? this.socket.apiKey : ``, "Content-Type": r2 ? `application/octet-stream` : `application/json` };
      this.socket.accessTokenValue && (i2.Authorization = `Bearer ${this.socket.accessTokenValue}`);
      let a2 = new URL(this.broadcastEndpointURL);
      a2.pathname += `/${encodeURIComponent(this.subTopic)}/events/${encodeURIComponent(e3)}`, this.private && a2.searchParams.set(`private`, `true`);
      let o2 = { method: `POST`, headers: i2, body: r2 ? t2 : JSON.stringify(t2) }, s2 = await this._fetchWithTimeout(a2.toString(), o2, (_a2 = n2.timeout) != null ? _a2 : this.timeout);
      if (s2.status === 202) return { success: true };
      if (s2.status === 404) return Promise.reject(Error(`httpSend() requires Realtime server v2.97.0 or newer; the endpoint returned 404. Update your Supabase CLI to a recent version, or upgrade the Realtime server in your self-hosted setup. See https://github.com/supabase/supabase-js/blob/master/packages/core/realtime-js/migrations/httpsend-server-version.md`));
      let c2 = s2.statusText;
      try {
        let e4 = await s2.json();
        c2 = e4.error || e4.message || c2;
      } catch (e4) {
      }
      return Promise.reject(Error(c2));
    }
    async send(e3, t2 = {}) {
      var _a2, _b2;
      if (!this.channelAdapter.canPush() && e3.type === `broadcast`) {
        let n2 = `Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.`;
        this.socket.hasLogger() ? this.socket.log(`channel`, n2) : console.warn(n2);
        let { event: r2, payload: i2 } = e3, a2 = { apikey: this.socket.apiKey ? this.socket.apiKey : ``, "Content-Type": `application/json` };
        this.socket.accessTokenValue && (a2.Authorization = `Bearer ${this.socket.accessTokenValue}`);
        let o2 = { method: `POST`, headers: a2, body: JSON.stringify({ messages: [{ topic: this.subTopic, event: r2, payload: i2, private: this.private }] }) };
        try {
          let e4 = await this._fetchWithTimeout(this.broadcastEndpointURL, o2, (_a2 = t2.timeout) != null ? _a2 : this.timeout);
          return await ((_b2 = e4.body) == null ? void 0 : _b2.cancel()), e4.ok ? `ok` : `error`;
        } catch (e4) {
          return e4 instanceof Error && e4.name === `AbortError` ? `timed out` : `error`;
        }
      } else return new Promise((n2) => {
        var _a3, _b3, _c2;
        let r2 = this.channelAdapter.push(e3.type, e3, t2.timeout || this.timeout);
        e3.type === `broadcast` && !((_c2 = (_b3 = (_a3 = this.params) == null ? void 0 : _a3.config) == null ? void 0 : _b3.broadcast) == null ? void 0 : _c2.ack) && n2(`ok`), r2.receive(`ok`, () => n2(`ok`)), r2.receive(`error`, () => n2(`error`)), r2.receive(`timeout`, () => n2(`timed out`));
      });
    }
    updateJoinPayload(e3) {
      this.channelAdapter.updateJoinPayload(e3);
    }
    async unsubscribe(e3 = this.timeout) {
      return new Promise((t2) => {
        this.channelAdapter.unsubscribe(e3).receive(`ok`, () => t2(`ok`)).receive(`timeout`, () => t2(`timed out`)).receive(`error`, () => t2(`error`));
      });
    }
    teardown() {
      this.channelAdapter.teardown();
    }
    async _fetchWithTimeout(e3, t2, n2) {
      let r2 = new AbortController(), i2 = setTimeout(() => r2.abort(), n2), a2 = await this.socket.fetch(e3, Object.assign(Object.assign({}, t2), { signal: r2.signal }));
      return clearTimeout(i2), a2;
    }
    _on(t2, n2, r2) {
      var _a2;
      let i2 = t2.toLocaleLowerCase(), a2 = n2 == null ? void 0 : n2.filter;
      if ((a2 instanceof st || typeof a2 == `object` && a2 && typeof a2.build == `function`) && (n2 = Object.assign(Object.assign({}, n2), { filter: a2.build() })), i2 === T.POSTGRES_CHANGES && ((_a2 = this.bindings[i2]) == null ? void 0 : _a2.find((t3) => e2.isSamePostgresFilter(t3.filter, n2)))) return this.socket.log(`error`, `duplicate \`postgres_changes\` binding for ${this.topic} ignored`, n2), this;
      let o2 = this.channelAdapter.on(t2, r2), s2 = { type: i2, filter: n2, callback: r2, ref: o2 };
      return this.bindings[i2] ? this.bindings[i2].push(s2) : this.bindings[i2] = [s2], this._updateFilterMessage(), this;
    }
    _onClose(e3) {
      this.channelAdapter.onClose(e3);
    }
    _onError(e3) {
      this.channelAdapter.onError(e3);
    }
    _updateFilterMessage() {
      this.channelAdapter.updateFilterBindings((e3, t2, n2) => {
        var _a2, _b2, _c2, _d, _e2, _f, _g;
        let r2 = e3.event.toLocaleLowerCase();
        if (this._notThisChannelEvent(r2, n2)) return false;
        let i2 = (_a2 = this.bindings[r2]) == null ? void 0 : _a2.find((t3) => t3.ref === e3.ref);
        if (!i2) return true;
        if ([`broadcast`, `presence`, `postgres_changes`].includes(r2)) if (`id` in i2) {
          let e4 = i2.id, n3 = (_b2 = i2.filter) == null ? void 0 : _b2.event;
          return e4 && ((_c2 = t2.ids) == null ? void 0 : _c2.includes(e4)) && (n3 === `*` || (n3 == null ? void 0 : n3.toLocaleLowerCase()) === ((_d = t2.data) == null ? void 0 : _d.type.toLocaleLowerCase()));
        } else {
          let e4 = (_f = (_e2 = i2 == null ? void 0 : i2.filter) == null ? void 0 : _e2.event) == null ? void 0 : _f.toLocaleLowerCase();
          return e4 === `*` || e4 === ((_g = t2 == null ? void 0 : t2.event) == null ? void 0 : _g.toLocaleLowerCase());
        }
        else return i2.type.toLocaleLowerCase() === r2;
      });
    }
    _notThisChannelEvent(e3, t2) {
      let { close: n2, error: r2, leave: i2, join: a2 } = me;
      return t2 && [n2, r2, i2, a2].includes(e3) && t2 !== this.joinPush.ref;
    }
    _updateFilterTransform() {
      this.channelAdapter.updatePayloadTransform((e3, t2, n2) => {
        if (typeof t2 == `object` && `ids` in t2) {
          let e4 = t2.data, { schema: n3, table: r2, commit_timestamp: i2, type: a2, errors: o2 } = e4, s2 = { schema: n3, table: r2, commit_timestamp: i2, eventType: a2, new: {}, old: {}, errors: o2 };
          return Object.assign(Object.assign({}, s2), this._getPayloadRecords(e4));
        }
        return t2;
      });
    }
    copyBindings(e3) {
      if (this.joinedOnce) throw Error(`cannot copy bindings into joined channel`);
      for (let t2 in e3.bindings) for (let n2 of e3.bindings[t2]) this._on(n2.type, n2.filter, n2.callback);
    }
    static isFilterValueEqual(e3, t2) {
      return (e3 != null ? e3 : void 0) === (t2 != null ? t2 : void 0);
    }
    static isSamePostgresFilter(t2, n2) {
      var _a2, _b2, _c2, _d;
      let r2 = (_b2 = (_a2 = t2 == null ? void 0 : t2.select) == null ? void 0 : _a2.join()) != null ? _b2 : void 0, i2 = (_d = (_c2 = n2 == null ? void 0 : n2.select) == null ? void 0 : _c2.join()) != null ? _d : void 0;
      return (t2 == null ? void 0 : t2.event) === (n2 == null ? void 0 : n2.event) && e2.isFilterValueEqual(t2 == null ? void 0 : t2.schema, n2 == null ? void 0 : n2.schema) && e2.isFilterValueEqual(t2 == null ? void 0 : t2.table, n2 == null ? void 0 : n2.table) && e2.isFilterValueEqual(t2 == null ? void 0 : t2.filter, n2 == null ? void 0 : n2.filter) && r2 === i2;
    }
    _getPayloadRecords(e3) {
      let t2 = { new: {}, old: {} };
      return (e3.type === `INSERT` || e3.type === `UPDATE`) && (t2.new = _e(e3.columns, e3.record)), (e3.type === `UPDATE` || e3.type === `DELETE`) && (t2.old = _e(e3.columns, e3.old_record)), t2;
    }
  }, ft = class {
    constructor(e2, t2) {
      this.socket = new We(e2, t2);
    }
    get timeout() {
      return this.socket.timeout;
    }
    get endPoint() {
      return this.socket.endPoint;
    }
    get transport() {
      return this.socket.transport;
    }
    get heartbeatIntervalMs() {
      return this.socket.heartbeatIntervalMs;
    }
    get heartbeatCallback() {
      return this.socket.heartbeatCallback;
    }
    set heartbeatCallback(e2) {
      this.socket.heartbeatCallback = e2;
    }
    get heartbeatTimer() {
      return this.socket.heartbeatTimer;
    }
    get pendingHeartbeatRef() {
      return this.socket.pendingHeartbeatRef;
    }
    get reconnectTimer() {
      return this.socket.reconnectTimer;
    }
    get vsn() {
      return this.socket.vsn;
    }
    get encode() {
      return this.socket.encode;
    }
    get decode() {
      return this.socket.decode;
    }
    get reconnectAfterMs() {
      return this.socket.reconnectAfterMs;
    }
    get sendBuffer() {
      return this.socket.sendBuffer;
    }
    get stateChangeCallbacks() {
      return this.socket.stateChangeCallbacks;
    }
    connect() {
      this.socket.connect();
    }
    disconnect(e2, t2, n2, r2 = 1e4) {
      return new Promise((i2) => {
        setTimeout(() => i2(`timeout`), r2), this.socket.disconnect(() => {
          e2(), i2(`ok`);
        }, t2, n2);
      });
    }
    push(e2) {
      this.socket.push(e2);
    }
    log(e2, t2, n2) {
      this.socket.log(e2, t2, n2);
    }
    hasLogger() {
      return this.socket.hasLogger();
    }
    makeRef() {
      return this.socket.makeRef();
    }
    onOpen(e2) {
      this.socket.onOpen(e2);
    }
    onClose(e2) {
      this.socket.onClose(e2);
    }
    onError(e2) {
      this.socket.onError(e2);
    }
    onMessage(e2) {
      this.socket.onMessage(e2);
    }
    isConnected() {
      return this.socket.isConnected();
    }
    isConnecting() {
      return this.socket.connectionState() == he.connecting;
    }
    isDisconnecting() {
      return this.socket.connectionState() == he.closing;
    }
    connectionState() {
      return this.socket.connectionState();
    }
    endPointURL() {
      return this.socket.endPointURL();
    }
    sendHeartbeat() {
      this.socket.sendHeartbeat();
    }
    getSocket() {
      return this.socket;
    }
  };
  let pt = { HEARTBEAT_INTERVAL: 25e3, RECONNECT_DELAY: 10, HEARTBEAT_TIMEOUT_FALLBACK: 100 }, mt = [1e3, 2e3, 5e3, 1e4];
  function ht() {
    let e2 = /* @__PURE__ */ new Map();
    return { get length() {
      return e2.size;
    }, clear() {
      e2.clear();
    }, getItem(t2) {
      return e2.has(t2) ? e2.get(t2) : null;
    }, key(t2) {
      var _a2;
      return (_a2 = Array.from(e2.keys())[t2]) != null ? _a2 : null;
    }, removeItem(t2) {
      e2.delete(t2);
    }, setItem(t2, n2) {
      e2.set(t2, String(n2));
    } };
  }
  function gt() {
    try {
      if (typeof globalThis < `u` && globalThis.sessionStorage) return globalThis.sessionStorage;
    } catch (e2) {
    }
    return ht();
  }
  var _t = class {
    get endPoint() {
      return this.socketAdapter.endPoint;
    }
    get timeout() {
      return this.socketAdapter.timeout;
    }
    get transport() {
      return this.socketAdapter.transport;
    }
    get heartbeatCallback() {
      return this.socketAdapter.heartbeatCallback;
    }
    get heartbeatIntervalMs() {
      return this.socketAdapter.heartbeatIntervalMs;
    }
    get heartbeatTimer() {
      return this.worker ? this._workerHeartbeatTimer : this.socketAdapter.heartbeatTimer;
    }
    get pendingHeartbeatRef() {
      return this.worker ? this._pendingWorkerHeartbeatRef : this.socketAdapter.pendingHeartbeatRef;
    }
    get reconnectTimer() {
      return this.socketAdapter.reconnectTimer;
    }
    get vsn() {
      return this.socketAdapter.vsn;
    }
    get encode() {
      return this.socketAdapter.encode;
    }
    get decode() {
      return this.socketAdapter.decode;
    }
    get reconnectAfterMs() {
      return this.socketAdapter.reconnectAfterMs;
    }
    get sendBuffer() {
      return this.socketAdapter.sendBuffer;
    }
    get stateChangeCallbacks() {
      return this.socketAdapter.stateChangeCallbacks;
    }
    constructor(e2, t2) {
      var _a2;
      if (this.channels = [], this.accessTokenValue = null, this.accessToken = null, this.apiKey = null, this.httpEndpoint = ``, this.headers = {}, this.params = {}, this.ref = 0, this.serializer = new ge(), this._manuallySetToken = false, this._authPromise = null, this._authGeneration = 0, this._workerHeartbeatTimer = void 0, this._pendingWorkerHeartbeatRef = null, this._pendingDisconnectTimer = null, this._disconnectOnEmptyChannelsAfterMs = 0, this._resolveFetch = (e3) => e3 ? (...t3) => e3(...t3) : (...e4) => fetch(...e4), !((_a2 = t2 == null ? void 0 : t2.params) == null ? void 0 : _a2.apikey)) throw Error(`API key is required to connect to Realtime`);
      this.apiKey = t2.params.apikey, this.socketAdapter = new ft(e2, this._initializeOptions(t2)), this.httpEndpoint = Ee(e2), this.fetch = this._resolveFetch(t2 == null ? void 0 : t2.fetch);
    }
    connect() {
      if (!(this.isConnecting() || this.isDisconnecting() || this.isConnected())) {
        this.accessToken && !this._authPromise && this._setAuthSafely(`connect`), this._setupConnectionHandlers();
        try {
          this.socketAdapter.connect();
        } catch (e2) {
          let t2 = e2.message;
          throw Error(`WebSocket not available: ${t2}`);
        }
        this._handleNodeJsRaceCondition();
      }
    }
    endpointURL() {
      return this.socketAdapter.endPointURL();
    }
    async disconnect(e2, t2) {
      return this._cancelPendingDisconnect(), this.isDisconnecting() ? `ok` : await this.socketAdapter.disconnect(() => {
        clearInterval(this._workerHeartbeatTimer), this._terminateWorker();
      }, e2, t2);
    }
    getChannels() {
      return this.channels;
    }
    async removeChannel(e2) {
      let t2 = await e2.unsubscribe();
      return t2 === `ok` && e2.teardown(), t2;
    }
    async removeAllChannels() {
      let e2 = this.channels.map(async (e3) => {
        let t3 = await e3.unsubscribe();
        return e3.teardown(), t3;
      }), t2 = await Promise.all(e2);
      return await this.disconnect(), t2;
    }
    log(e2, t2, n2) {
      this.socketAdapter.log(e2, t2, n2);
    }
    hasLogger() {
      return this.socketAdapter.hasLogger();
    }
    connectionState() {
      return this.socketAdapter.connectionState() || he.closed;
    }
    isConnected() {
      return this.socketAdapter.isConnected();
    }
    isConnecting() {
      return this.socketAdapter.isConnecting();
    }
    isDisconnecting() {
      return this.socketAdapter.isDisconnecting();
    }
    channel(e2, t2 = { config: {} }) {
      let n2 = `realtime:${e2}`, r2 = this.getChannels().find((e3) => e3.topic === n2);
      if (r2) return r2;
      {
        let n3 = new dt(`realtime:${e2}`, t2, this);
        return this._cancelPendingDisconnect(), this.channels.push(n3), n3;
      }
    }
    push(e2) {
      this.socketAdapter.push(e2);
    }
    async setAuth(e2 = null) {
      let t2 = ++this._authGeneration, n2 = this._performAuth(e2, t2);
      t2 === this._authGeneration && (this._authPromise = n2);
      try {
        await n2;
      } finally {
        this._authPromise === n2 && (this._authPromise = null);
      }
    }
    _isManualToken() {
      return this._manuallySetToken;
    }
    async sendHeartbeat() {
      this.socketAdapter.sendHeartbeat();
    }
    onHeartbeat(e2) {
      this.socketAdapter.heartbeatCallback = this._wrapHeartbeatCallback(e2);
    }
    _makeRef() {
      return this.socketAdapter.makeRef();
    }
    _remove(e2) {
      this.channels = this.channels.filter((t2) => t2.topic !== e2.topic), this.channels.length === 0 && (this.log(`transport`, `no channels remaining, scheduling disconnect`), this._schedulePendingDisconnect());
    }
    _schedulePendingDisconnect() {
      if (this._cancelPendingDisconnect(), this._disconnectOnEmptyChannelsAfterMs === 0) {
        this.log(`transport`, `disconnecting immediately - no channels`), this.disconnect();
        return;
      }
      this._pendingDisconnectTimer = setTimeout(() => {
        this._pendingDisconnectTimer = null, this.channels.length === 0 && (this.log(`transport`, `deferred disconnect fired - no channels, disconnecting`), this.disconnect());
      }, this._disconnectOnEmptyChannelsAfterMs), this.log(`transport`, `deferred disconnect scheduled in ${this._disconnectOnEmptyChannelsAfterMs}ms`);
    }
    _cancelPendingDisconnect() {
      this._pendingDisconnectTimer !== null && (this.log(`transport`, `pending disconnect cancelled - channel activity detected`), clearTimeout(this._pendingDisconnectTimer), this._pendingDisconnectTimer = null);
    }
    async _performAuth(e2, t2) {
      let n2, r2 = false;
      if (e2) n2 = e2, r2 = true;
      else if (this.accessToken) try {
        n2 = await this.accessToken();
      } catch (e3) {
        this.log(`error`, `Error fetching access token from callback`, e3), n2 = this.accessTokenValue;
      }
      else n2 = this.accessTokenValue;
      t2 === this._authGeneration && (this.accessToken ? this._manuallySetToken = false : r2 && (this._manuallySetToken = true), this.accessTokenValue != n2 && (this.accessTokenValue = n2, this.channels.forEach((e3) => {
        let t3 = { access_token: n2, version: `realtime-js/2.117.3` };
        e3.updateJoinPayload(t3), e3.joinedOnce && e3.channelAdapter.isJoined() && e3.channelAdapter.push(me.access_token, { access_token: n2 });
      })));
    }
    async _waitForAuthIfNeeded() {
      this._authPromise && await this._authPromise;
    }
    _setAuthSafely(e2 = `general`) {
      this._isManualToken() || this.setAuth().catch((t2) => {
        this.log(`error`, `Error setting auth in ${e2}`, t2);
      });
    }
    _setupConnectionHandlers() {
      this.socketAdapter.onOpen(() => {
        (this._authPromise || (this.accessToken && !this.accessTokenValue ? this.setAuth() : Promise.resolve())).catch((e2) => {
          this.log(`error`, `error waiting for auth on connect`, e2);
        }), this.worker && !this.workerRef && this._startWorkerHeartbeat();
      }), this.socketAdapter.onClose(() => {
        this.worker && this.workerRef && this._terminateWorker();
      }), this.socketAdapter.onMessage((e2) => {
        e2.ref && e2.ref === this._pendingWorkerHeartbeatRef && (this._pendingWorkerHeartbeatRef = null);
      });
    }
    _handleNodeJsRaceCondition() {
      this.socketAdapter.isConnected() && this.socketAdapter.getSocket().onConnOpen();
    }
    _wrapHeartbeatCallback(e2) {
      return (t2, n2) => {
        t2 !== `disconnected` && (t2 == `sent` && this._setAuthSafely(), e2 && e2(t2, n2));
      };
    }
    _startWorkerHeartbeat() {
      this.workerUrl ? this.log(`worker`, `starting worker for from ${this.workerUrl}`) : this.log(`worker`, `starting default worker`);
      let e2 = this._workerObjectUrl(this.workerUrl);
      this.workerRef = new Worker(e2), this.workerRef.onerror = (e3) => {
        this.log(`worker`, `worker error`, e3.message), this._terminateWorker(), this.disconnect();
      }, this.workerRef.onmessage = (e3) => {
        e3.data.event === `keepAlive` && this.sendHeartbeat();
      }, this.workerRef.postMessage({ event: `start`, interval: this.heartbeatIntervalMs });
    }
    _terminateWorker() {
      this.workerRef && (this.workerRef = (this.log(`worker`, `terminating worker`), this.workerRef.terminate(), void 0));
    }
    _workerObjectUrl(e2) {
      let t2;
      if (e2) t2 = e2;
      else {
        let e3 = new Blob([`
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`], { type: `application/javascript` });
        t2 = URL.createObjectURL(e3);
      }
      return t2;
    }
    _initializeOptions(e2) {
      var _a2, _b2, _c2, _d, _e2, _f, _g, _h, _i2, _j, _k, _l;
      this.worker = (_a2 = e2 == null ? void 0 : e2.worker) != null ? _a2 : false, this.accessToken = (_b2 = e2 == null ? void 0 : e2.accessToken) != null ? _b2 : null;
      let t2 = {};
      t2.timeout = (_c2 = e2 == null ? void 0 : e2.timeout) != null ? _c2 : 1e4, t2.heartbeatIntervalMs = (_d = e2 == null ? void 0 : e2.heartbeatIntervalMs) != null ? _d : pt.HEARTBEAT_INTERVAL, this._disconnectOnEmptyChannelsAfterMs = (_f = e2 == null ? void 0 : e2.disconnectOnEmptyChannelsAfterMs) != null ? _f : 2 * ((_e2 = e2 == null ? void 0 : e2.heartbeatIntervalMs) != null ? _e2 : pt.HEARTBEAT_INTERVAL), t2.transport = (_g = e2 == null ? void 0 : e2.transport) != null ? _g : pe.getWebSocketConstructor(), t2.params = e2 == null ? void 0 : e2.params, t2.logger = e2 == null ? void 0 : e2.logger, t2.heartbeatCallback = this._wrapHeartbeatCallback(e2 == null ? void 0 : e2.heartbeatCallback), t2.sessionStorage = (_h = e2 == null ? void 0 : e2.sessionStorage) != null ? _h : gt(), t2.reconnectAfterMs = (_i2 = e2 == null ? void 0 : e2.reconnectAfterMs) != null ? _i2 : ((e3) => mt[e3 - 1] || 1e4);
      let n2, r2, i2 = (_j = e2 == null ? void 0 : e2.vsn) != null ? _j : `2.0.0`;
      switch (i2) {
        case `1.0.0`:
          n2 = (e3, t3) => t3(JSON.stringify(e3)), r2 = (e3, t3) => t3(JSON.parse(e3));
          break;
        case `2.0.0`:
          n2 = this.serializer.encode.bind(this.serializer), r2 = this.serializer.decode.bind(this.serializer);
          break;
        default:
          throw Error(`Unsupported serializer version: ${t2.vsn}`);
      }
      if (t2.vsn = i2, t2.encode = (_k = e2 == null ? void 0 : e2.encode) != null ? _k : n2, t2.decode = (_l = e2 == null ? void 0 : e2.decode) != null ? _l : r2, t2.beforeReconnect = this._reconnectAuth.bind(this), ((e2 == null ? void 0 : e2.logLevel) || (e2 == null ? void 0 : e2.log_level)) && (this.logLevel = e2.logLevel || e2.log_level, t2.params = Object.assign(Object.assign({}, t2.params), { log_level: this.logLevel })), this.worker) {
        if (typeof window < `u` && !window.Worker) throw Error(`Web Worker is not supported`);
        this.workerUrl = e2 == null ? void 0 : e2.workerUrl, t2.autoSendHeartbeat = !this.worker;
      }
      return t2;
    }
    async _reconnectAuth() {
      await this._waitForAuthIfNeeded(), this.isConnected() || this.connect();
    }
  }, vt = class extends Error {
    constructor(e2, t2) {
      var _a2;
      super(e2), this.name = `IcebergError`, this.status = t2.status, this.icebergType = t2.icebergType, this.icebergCode = t2.icebergCode, this.details = t2.details, this.isCommitStateUnknown = t2.icebergType === `CommitStateUnknownException` || [500, 502, 504].includes(t2.status) && ((_a2 = t2.icebergType) == null ? void 0 : _a2.includes(`CommitState`)) === true;
    }
    isNotFound() {
      return this.status === 404;
    }
    isConflict() {
      return this.status === 409;
    }
    isAuthenticationTimeout() {
      return this.status === 419;
    }
  };
  function yt(e2, t2, n2) {
    let r2 = new URL(t2, e2);
    if (n2) for (let [e3, t3] of Object.entries(n2)) t3 !== void 0 && r2.searchParams.set(e3, t3);
    return r2.toString();
  }
  async function bt(e2) {
    return !e2 || e2.type === `none` ? {} : e2.type === `bearer` ? { Authorization: `Bearer ${e2.token}` } : e2.type === `header` ? { [e2.name]: e2.value } : e2.type === `custom` ? await e2.getHeaders() : {};
  }
  function xt(e2) {
    var _a2;
    let t2 = (_a2 = e2.fetchImpl) != null ? _a2 : globalThis.fetch;
    return { async request({ method: n2, path: r2, query: i2, body: a2, headers: o2 }) {
      var _a3;
      let s2 = yt(e2.baseUrl, r2, i2), c2 = await bt(e2.auth), l2 = await t2(s2, { method: n2, headers: { ...a2 ? { "Content-Type": `application/json` } : {}, ...c2, ...o2 }, body: a2 ? JSON.stringify(a2) : void 0 }), u2 = await l2.text(), d2 = (l2.headers.get(`content-type`) || ``).includes(`application/json`), f2 = d2 && u2 ? JSON.parse(u2) : u2;
      if (!l2.ok) {
        let e3 = d2 ? f2 : void 0, t3 = e3 == null ? void 0 : e3.error;
        throw new vt((_a3 = t3 == null ? void 0 : t3.message) != null ? _a3 : `Request failed with status ${l2.status}`, { status: l2.status, icebergType: t3 == null ? void 0 : t3.type, icebergCode: t3 == null ? void 0 : t3.code, details: e3 });
      }
      return { status: l2.status, headers: l2.headers, data: f2 };
    } };
  }
  function St(e2) {
    return e2.join(``);
  }
  var Ct = class {
    constructor(e2, t2 = ``) {
      this.client = e2, this.prefix = t2;
    }
    async listNamespaces(e2) {
      let t2 = e2 ? { parent: St(e2.namespace) } : void 0;
      return (await this.client.request({ method: `GET`, path: `${this.prefix}/namespaces`, query: t2 })).data.namespaces.map((e3) => ({ namespace: e3 }));
    }
    async createNamespace(e2, t2) {
      let n2 = { namespace: e2.namespace, properties: t2 == null ? void 0 : t2.properties };
      return (await this.client.request({ method: `POST`, path: `${this.prefix}/namespaces`, body: n2 })).data;
    }
    async dropNamespace(e2) {
      await this.client.request({ method: `DELETE`, path: `${this.prefix}/namespaces/${St(e2.namespace)}` });
    }
    async loadNamespaceMetadata(e2) {
      return { properties: (await this.client.request({ method: `GET`, path: `${this.prefix}/namespaces/${St(e2.namespace)}` })).data.properties };
    }
    async namespaceExists(e2) {
      try {
        return await this.client.request({ method: `HEAD`, path: `${this.prefix}/namespaces/${St(e2.namespace)}` }), true;
      } catch (e3) {
        if (e3 instanceof vt && e3.status === 404) return false;
        throw e3;
      }
    }
    async createNamespaceIfNotExists(e2, t2) {
      try {
        return await this.createNamespace(e2, t2);
      } catch (e3) {
        if (e3 instanceof vt && e3.status === 409) return;
        throw e3;
      }
    }
  };
  function wt(e2) {
    return e2.join(``);
  }
  var Tt = class {
    constructor(e2, t2 = ``, n2) {
      this.client = e2, this.prefix = t2, this.accessDelegation = n2;
    }
    async listTables(e2) {
      return (await this.client.request({ method: `GET`, path: `${this.prefix}/namespaces/${wt(e2.namespace)}/tables` })).data.identifiers;
    }
    async createTable(e2, t2) {
      let n2 = {};
      return this.accessDelegation && (n2[`X-Iceberg-Access-Delegation`] = this.accessDelegation), (await this.client.request({ method: `POST`, path: `${this.prefix}/namespaces/${wt(e2.namespace)}/tables`, body: t2, headers: n2 })).data.metadata;
    }
    async updateTable(e2, t2) {
      let n2 = await this.client.request({ method: `POST`, path: `${this.prefix}/namespaces/${wt(e2.namespace)}/tables/${e2.name}`, body: t2 });
      return { "metadata-location": n2.data[`metadata-location`], metadata: n2.data.metadata };
    }
    async dropTable(e2, t2) {
      var _a2;
      await this.client.request({ method: `DELETE`, path: `${this.prefix}/namespaces/${wt(e2.namespace)}/tables/${e2.name}`, query: { purgeRequested: String((_a2 = t2 == null ? void 0 : t2.purge) != null ? _a2 : false) } });
    }
    async loadTable(e2) {
      let t2 = {};
      return this.accessDelegation && (t2[`X-Iceberg-Access-Delegation`] = this.accessDelegation), (await this.client.request({ method: `GET`, path: `${this.prefix}/namespaces/${wt(e2.namespace)}/tables/${e2.name}`, headers: t2 })).data.metadata;
    }
    async tableExists(e2) {
      let t2 = {};
      this.accessDelegation && (t2[`X-Iceberg-Access-Delegation`] = this.accessDelegation);
      try {
        return await this.client.request({ method: `HEAD`, path: `${this.prefix}/namespaces/${wt(e2.namespace)}/tables/${e2.name}`, headers: t2 }), true;
      } catch (e3) {
        if (e3 instanceof vt && e3.status === 404) return false;
        throw e3;
      }
    }
    async createTableIfNotExists(e2, t2) {
      try {
        return await this.createTable(e2, t2);
      } catch (n2) {
        if (n2 instanceof vt && n2.status === 409) return await this.loadTable({ namespace: e2.namespace, name: t2.name });
        throw n2;
      }
    }
  }, Et = class {
    constructor(e2) {
      var _a2;
      let t2 = `v1`;
      e2.catalogName && (t2 += `/${e2.catalogName}`), this.client = xt({ baseUrl: e2.baseUrl.endsWith(`/`) ? e2.baseUrl : `${e2.baseUrl}/`, auth: e2.auth, fetchImpl: e2.fetch }), this.accessDelegation = (_a2 = e2.accessDelegation) == null ? void 0 : _a2.join(`,`), this.namespaceOps = new Ct(this.client, t2), this.tableOps = new Tt(this.client, t2, this.accessDelegation);
    }
    async listNamespaces(e2) {
      return this.namespaceOps.listNamespaces(e2);
    }
    async createNamespace(e2, t2) {
      return this.namespaceOps.createNamespace(e2, t2);
    }
    async dropNamespace(e2) {
      await this.namespaceOps.dropNamespace(e2);
    }
    async loadNamespaceMetadata(e2) {
      return this.namespaceOps.loadNamespaceMetadata(e2);
    }
    async listTables(e2) {
      return this.tableOps.listTables(e2);
    }
    async createTable(e2, t2) {
      return this.tableOps.createTable(e2, t2);
    }
    async updateTable(e2, t2) {
      return this.tableOps.updateTable(e2, t2);
    }
    async dropTable(e2, t2) {
      await this.tableOps.dropTable(e2, t2);
    }
    async loadTable(e2) {
      return this.tableOps.loadTable(e2);
    }
    async namespaceExists(e2) {
      return this.namespaceOps.namespaceExists(e2);
    }
    async tableExists(e2) {
      return this.tableOps.tableExists(e2);
    }
    async createNamespaceIfNotExists(e2, t2) {
      return this.namespaceOps.createNamespaceIfNotExists(e2, t2);
    }
    async createTableIfNotExists(e2, t2) {
      return this.tableOps.createTableIfNotExists(e2, t2);
    }
  };
  function Dt(e2) {
    "@babel/helpers - typeof";
    return Dt = typeof Symbol == `function` && typeof Symbol.iterator == `symbol` ? function(e3) {
      return typeof e3;
    } : function(e3) {
      return e3 && typeof Symbol == `function` && e3.constructor === Symbol && e3 !== Symbol.prototype ? `symbol` : typeof e3;
    }, Dt(e2);
  }
  function Ot(e2, t2) {
    if (Dt(e2) != `object` || !e2) return e2;
    var n2 = e2[Symbol.toPrimitive];
    if (n2 !== void 0) {
      var r2 = n2.call(e2, t2 || `default`);
      if (Dt(r2) != `object`) return r2;
      throw TypeError(`@@toPrimitive must return a primitive value.`);
    }
    return (t2 === `string` ? String : Number)(e2);
  }
  function kt(e2) {
    var t2 = Ot(e2, `string`);
    return Dt(t2) == `symbol` ? t2 : t2 + ``;
  }
  function At(e2, t2, n2) {
    return (t2 = kt(t2)) in e2 ? Object.defineProperty(e2, t2, { value: n2, enumerable: true, configurable: true, writable: true }) : e2[t2] = n2, e2;
  }
  function jt(e2, t2) {
    var n2 = Object.keys(e2);
    if (Object.getOwnPropertySymbols) {
      var r2 = Object.getOwnPropertySymbols(e2);
      t2 && (r2 = r2.filter(function(t3) {
        return Object.getOwnPropertyDescriptor(e2, t3).enumerable;
      })), n2.push.apply(n2, r2);
    }
    return n2;
  }
  function D(e2) {
    for (var t2 = 1; t2 < arguments.length; t2++) {
      var n2 = arguments[t2] == null ? {} : arguments[t2];
      t2 % 2 ? jt(Object(n2), true).forEach(function(t3) {
        At(e2, t3, n2[t3]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e2, Object.getOwnPropertyDescriptors(n2)) : jt(Object(n2)).forEach(function(t3) {
        Object.defineProperty(e2, t3, Object.getOwnPropertyDescriptor(n2, t3));
      });
    }
    return e2;
  }
  var Mt = class extends Error {
    constructor(e2, t2 = `storage`, n2, r2) {
      super(e2), this.__isStorageError = true, this.namespace = t2, this.name = t2 === `vectors` ? `StorageVectorsError` : `StorageError`, this.status = n2, this.statusCode = r2;
    }
    toJSON() {
      return { name: this.name, message: this.message, status: this.status, statusCode: this.statusCode };
    }
  };
  function Nt(e2) {
    return typeof e2 == `object` && !!e2 && `__isStorageError` in e2;
  }
  var Pt = class extends Mt {
    constructor(e2, t2, n2, r2 = `storage`, i2) {
      super(e2, r2, t2, n2), this.name = r2 === `vectors` ? `StorageVectorsApiError` : `StorageApiError`, this.status = t2, this.statusCode = n2, this.code = i2;
    }
    toJSON() {
      return D(D({}, super.toJSON()), {}, { code: this.code });
    }
  }, Ft = class extends Mt {
    constructor(e2, t2, n2 = `storage`) {
      super(e2, n2), this.name = n2 === `vectors` ? `StorageVectorsUnknownError` : `StorageUnknownError`, this.originalError = t2;
    }
  };
  function It(e2, t2, n2) {
    let r2 = D({}, e2), i2 = t2.toLowerCase();
    for (let e3 of Object.keys(r2)) e3.toLowerCase() === i2 && delete r2[e3];
    return r2[i2] = n2, r2;
  }
  function Lt(e2) {
    let t2 = {};
    for (let [n2, r2] of Object.entries(e2)) t2[n2.toLowerCase()] = r2;
    return t2;
  }
  let Rt = (e2) => e2 ? (...t2) => e2(...t2) : (...e3) => fetch(...e3), zt = (e2) => {
    if (typeof e2 != `object` || !e2) return false;
    let t2 = Object.getPrototypeOf(e2);
    return (t2 === null || t2 === Object.prototype || Object.getPrototypeOf(t2) === null) && !(Symbol.toStringTag in e2) && !(Symbol.iterator in e2);
  }, Bt = (e2) => {
    if (Array.isArray(e2)) return e2.map((e3) => Bt(e3));
    if (typeof e2 == `function` || e2 !== Object(e2)) return e2;
    let t2 = {};
    return Object.entries(e2).forEach(([e3, n2]) => {
      let r2 = e3.replace(/([-_][a-z])/gi, (e4) => e4.toUpperCase().replace(/[-_]/g, ``));
      t2[r2] = Bt(n2);
    }), t2;
  }, Vt = (e2) => !e2 || typeof e2 != `string` || e2.length === 0 || e2.length > 100 || e2.trim() !== e2 || e2.includes(`/`) || e2.includes(`\\`) ? false : /^[\w!.\*'() &$@=;:+,?-]+$/.test(e2), Ht = (e2) => e2.split(`/`).map(encodeURIComponent).join(`/`), Ut = (e2) => {
    if (typeof e2 == `object` && e2) {
      let t2 = e2;
      if (typeof t2.msg == `string`) return t2.msg;
      if (typeof t2.message == `string`) return t2.message;
      if (typeof t2.error_description == `string`) return t2.error_description;
      if (typeof t2.error == `string`) return t2.error;
      if (typeof t2.error == `object` && t2.error !== null) {
        let e3 = t2.error;
        if (typeof e3.message == `string`) return e3.message;
      }
    }
    return JSON.stringify(e2);
  }, Wt = async (e2, t2, n2, r2) => {
    if (typeof e2 == `object` && e2 && `json` in e2 && typeof e2.json == `function`) {
      let n3 = e2, i2 = parseInt(String(n3.status), 10);
      Number.isFinite(i2) || (i2 = 500), n3.json().then((e3) => {
        let n4 = (e3 == null ? void 0 : e3.statusCode) || (e3 == null ? void 0 : e3.code) || i2 + ``;
        t2(new Pt(Ut(e3), i2, n4, r2, e3 == null ? void 0 : e3.code));
      }).catch(() => {
        let e3 = i2 + ``;
        t2(new Pt(n3.statusText || `HTTP ${i2} error`, i2, e3, r2));
      });
    } else t2(new Ft(Ut(e2), e2, r2));
  }, Gt = (e2, t2, n2, r2) => {
    let i2 = { method: e2, headers: (t2 == null ? void 0 : t2.headers) || {} };
    if (e2 === `GET` || e2 === `HEAD` || !r2) return D(D({}, i2), n2);
    if (zt(r2)) {
      let e3 = (t2 == null ? void 0 : t2.headers) || {}, n3;
      for (let [t3, r3] of Object.entries(e3)) t3.toLowerCase() === `content-type` && (n3 = r3);
      i2.headers = It(e3, `Content-Type`, n3 != null ? n3 : `application/json`), i2.body = JSON.stringify(r2);
    } else i2.body = r2;
    return (t2 == null ? void 0 : t2.duplex) && (i2.duplex = t2.duplex), D(D({}, i2), n2);
  };
  async function Kt(e2, t2, n2, r2, i2, a2, o2) {
    return new Promise((s2, c2) => {
      e2(n2, Gt(t2, r2, i2, a2)).then((e3) => {
        if (!e3.ok) throw e3;
        if (r2 == null ? void 0 : r2.noResolveJson) return e3;
        if (o2 === `vectors`) {
          let t3 = e3.headers.get(`content-type`);
          if (e3.headers.get(`content-length`) === `0` || e3.status === 204 || !t3 || !t3.includes(`application/json`)) return {};
        }
        return e3.json();
      }).then((e3) => s2(e3)).catch((e3) => Wt(e3, c2, r2, o2));
    });
  }
  function qt(e2 = `storage`) {
    return { get: async (t2, n2, r2, i2) => Kt(t2, `GET`, n2, r2, i2, void 0, e2), post: async (t2, n2, r2, i2, a2) => Kt(t2, `POST`, n2, i2, a2, r2, e2), put: async (t2, n2, r2, i2, a2) => Kt(t2, `PUT`, n2, i2, a2, r2, e2), head: async (t2, n2, r2, i2) => Kt(t2, `HEAD`, n2, D(D({}, r2), {}, { noResolveJson: true }), i2, void 0, e2), remove: async (t2, n2, r2, i2, a2) => Kt(t2, `DELETE`, n2, i2, a2, r2, e2) };
  }
  let { get: O, post: k, put: Jt, head: Yt, remove: A } = qt(`storage`), j = qt(`vectors`);
  var Xt = class {
    constructor(e2, t2 = {}, n2, r2 = `storage`) {
      this.shouldThrowOnError = false, this.url = e2, this.headers = Lt(t2), this.fetch = Rt(n2), this.namespace = r2;
    }
    throwOnError() {
      return this.shouldThrowOnError = true, this;
    }
    setHeader(e2, t2) {
      return this.headers = It(this.headers, e2, t2), this;
    }
    async handleOperation(e2) {
      var t2 = this;
      try {
        return { data: await e2(), error: null };
      } catch (e3) {
        if (t2.shouldThrowOnError) throw e3;
        if (Nt(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
  };
  let Zt;
  Zt = Symbol.toStringTag;
  var Qt = class {
    constructor(e2, t2) {
      this.downloadFn = e2, this.shouldThrowOnError = t2, this[Zt] = `StreamDownloadBuilder`, this.promise = null;
    }
    then(e2, t2) {
      return this.getPromise().then(e2, t2);
    }
    catch(e2) {
      return this.getPromise().catch(e2);
    }
    finally(e2) {
      return this.getPromise().finally(e2);
    }
    getPromise() {
      return this.promise || (this.promise = this.execute()), this.promise;
    }
    async execute() {
      var e2 = this;
      try {
        return { data: (await e2.downloadFn()).body, error: null };
      } catch (t2) {
        if (e2.shouldThrowOnError) throw t2;
        if (Nt(t2)) return { data: null, error: t2 };
        throw t2;
      }
    }
  };
  let $t;
  $t = Symbol.toStringTag;
  var en = class {
    constructor(e2, t2) {
      this.downloadFn = e2, this.shouldThrowOnError = t2, this[$t] = `BlobDownloadBuilder`, this.promise = null;
    }
    asStream() {
      return new Qt(this.downloadFn, this.shouldThrowOnError);
    }
    then(e2, t2) {
      return this.getPromise().then(e2, t2);
    }
    catch(e2) {
      return this.getPromise().catch(e2);
    }
    finally(e2) {
      return this.getPromise().finally(e2);
    }
    getPromise() {
      return this.promise || (this.promise = this.execute()), this.promise;
    }
    async execute() {
      var e2 = this;
      try {
        return { data: await (await e2.downloadFn()).blob(), error: null };
      } catch (t2) {
        if (e2.shouldThrowOnError) throw t2;
        if (Nt(t2)) return { data: null, error: t2 };
        throw t2;
      }
    }
  };
  let tn = { limit: 100, offset: 0, sortBy: { column: `name`, order: `asc` } }, nn = { cacheControl: `3600`, contentType: `text/plain;charset=UTF-8`, upsert: false };
  var rn = class extends Xt {
    constructor(e2, t2 = {}, n2, r2) {
      super(e2, t2, r2, `storage`), this.bucketId = n2;
    }
    async uploadOrUpdate(e2, t2, n2, r2) {
      var i2 = this;
      return i2.handleOperation(async () => {
        let a2, o2 = D(D({}, nn), r2), s2 = D(D({}, i2.headers), e2 === `POST` && { "x-upsert": String(o2.upsert) }), c2 = o2.metadata;
        if (typeof Blob < `u` && n2 instanceof Blob || typeof FormData < `u` && n2 instanceof FormData ? a2 = i2.prepareUploadFormData(n2, o2) : (a2 = n2, s2[`cache-control`] = `max-age=${o2.cacheControl}`, s2[`content-type`] = o2.contentType, c2 && (s2[`x-metadata`] = i2.toBase64(i2.encodeMetadata(c2))), (typeof ReadableStream < `u` && a2 instanceof ReadableStream || a2 && typeof a2 == `object` && `pipe` in a2 && typeof a2.pipe == `function`) && !o2.duplex && (o2.duplex = `half`)), r2 == null ? void 0 : r2.headers) for (let [e3, t3] of Object.entries(r2.headers)) s2 = It(s2, e3, t3);
        let l2 = i2._removeEmptyFolders(t2), u2 = i2._getFinalPath(l2), d2 = await (e2 == `PUT` ? Jt : k)(i2.fetch, `${i2.url}/object/${u2}`, a2, D({ headers: s2 }, (o2 == null ? void 0 : o2.duplex) ? { duplex: o2.duplex } : {}));
        return { path: l2, id: d2.Id, fullPath: d2.Key };
      });
    }
    async upload(e2, t2, n2) {
      return this.uploadOrUpdate(`POST`, e2, t2, n2);
    }
    async uploadToSignedUrl(e2, t2, n2, r2) {
      var i2 = this;
      let a2 = i2._removeEmptyFolders(e2), o2 = i2._getFinalPath(a2), s2 = new URL(i2.url + `/object/upload/sign/${o2}`);
      return s2.searchParams.set(`token`, t2), i2.handleOperation(async () => {
        let e3, t3 = D(D({}, nn), r2), o3 = D(D({}, i2.headers), { "x-upsert": String(t3.upsert) }), c2 = t3.metadata;
        if (typeof Blob < `u` && n2 instanceof Blob || typeof FormData < `u` && n2 instanceof FormData ? e3 = i2.prepareUploadFormData(n2, t3) : (e3 = n2, o3[`cache-control`] = `max-age=${t3.cacheControl}`, o3[`content-type`] = t3.contentType, c2 && (o3[`x-metadata`] = i2.toBase64(i2.encodeMetadata(c2))), (typeof ReadableStream < `u` && e3 instanceof ReadableStream || e3 && typeof e3 == `object` && `pipe` in e3 && typeof e3.pipe == `function`) && !t3.duplex && (t3.duplex = `half`)), r2 == null ? void 0 : r2.headers) for (let [e4, t4] of Object.entries(r2.headers)) o3 = It(o3, e4, t4);
        return { path: a2, fullPath: (await Jt(i2.fetch, s2.toString(), e3, D({ headers: o3 }, (t3 == null ? void 0 : t3.duplex) ? { duplex: t3.duplex } : {}))).Key };
      });
    }
    async createSignedUploadUrl(e2, t2) {
      var n2 = this;
      return n2.handleOperation(async () => {
        let r2 = n2._getFinalPath(e2), i2 = D({}, n2.headers);
        (t2 == null ? void 0 : t2.upsert) && (i2[`x-upsert`] = `true`);
        let a2 = await k(n2.fetch, `${n2.url}/object/upload/sign/${r2}`, {}, { headers: i2 }), o2 = new URL(n2.url + a2.url), s2 = o2.searchParams.get(`token`);
        if (!s2) throw new Mt(`No token returned by API`);
        return { signedUrl: o2.toString(), path: e2, token: s2 };
      });
    }
    async update(e2, t2, n2) {
      return this.uploadOrUpdate(`PUT`, e2, t2, n2);
    }
    async move(e2, t2, n2) {
      var r2 = this;
      return r2.handleOperation(async () => await k(r2.fetch, `${r2.url}/object/move`, { bucketId: r2.bucketId, sourceKey: e2, destinationKey: t2, destinationBucket: n2 == null ? void 0 : n2.destinationBucket, sourceVersionId: n2 == null ? void 0 : n2.sourceVersionId }, { headers: r2.headers }));
    }
    async copy(e2, t2, n2) {
      var r2 = this;
      return r2.handleOperation(async () => ({ path: (await k(r2.fetch, `${r2.url}/object/copy`, { bucketId: r2.bucketId, sourceKey: e2, destinationKey: t2, destinationBucket: n2 == null ? void 0 : n2.destinationBucket, sourceVersionId: n2 == null ? void 0 : n2.sourceVersionId }, { headers: r2.headers })).Key }));
    }
    async createSignedUrl(e2, t2, n2) {
      var r2 = this;
      return r2.handleOperation(async () => {
        let i2 = r2._getFinalPath(e2), a2 = typeof (n2 == null ? void 0 : n2.transform) == `object` && n2.transform !== null && Object.keys(n2.transform).length > 0, o2 = await k(r2.fetch, `${r2.url}/object/sign/${i2}`, D(D({ expiresIn: t2 }, a2 ? { transform: n2.transform } : {}), (n2 == null ? void 0 : n2.versionId) == null ? {} : { versionId: n2.versionId }), { headers: r2.headers }), s2 = new URLSearchParams();
        (n2 == null ? void 0 : n2.download) && s2.set(`download`, n2.download === true ? `` : n2.download), (n2 == null ? void 0 : n2.cacheNonce) != null && s2.set(`cacheNonce`, String(n2.cacheNonce));
        let c2 = s2.toString();
        return { signedUrl: encodeURI(`${r2.url}${o2.signedURL}${c2 ? `&${c2}` : ``}`) };
      });
    }
    async createSignedUrls(e2, t2, n2) {
      var r2 = this;
      return r2.handleOperation(async () => {
        let i2 = await k(r2.fetch, `${r2.url}/object/sign/${r2.bucketId}`, { expiresIn: t2, paths: e2 }, { headers: r2.headers }), a2 = new URLSearchParams();
        (n2 == null ? void 0 : n2.download) && a2.set(`download`, n2.download === true ? `` : n2.download), (n2 == null ? void 0 : n2.cacheNonce) != null && a2.set(`cacheNonce`, String(n2.cacheNonce));
        let o2 = a2.toString();
        return i2.map((e3) => D(D({}, e3), {}, { signedUrl: e3.signedURL ? encodeURI(`${r2.url}${e3.signedURL}${o2 ? `&${o2}` : ``}`) : null }));
      });
    }
    download(e2, t2, n2) {
      let r2 = typeof (t2 == null ? void 0 : t2.transform) == `object` && t2.transform !== null && Object.keys(t2.transform).length > 0 ? `render/image/authenticated` : `object`, i2 = new URLSearchParams();
      (t2 == null ? void 0 : t2.transform) && this.applyTransformOptsToQuery(i2, t2.transform), (t2 == null ? void 0 : t2.cacheNonce) != null && i2.set(`cacheNonce`, String(t2.cacheNonce)), (t2 == null ? void 0 : t2.versionId) != null && i2.set(`versionId`, String(t2.versionId));
      let a2 = i2.toString(), o2 = this._getFinalPath(e2);
      return new en(() => O(this.fetch, `${this.url}/${r2}/${o2}${a2 ? `?${a2}` : ``}`, { headers: this.headers, noResolveJson: true }, n2), this.shouldThrowOnError);
    }
    async info(e2, t2) {
      var n2 = this;
      let r2 = n2._getFinalPath(e2), i2 = new URLSearchParams();
      (t2 == null ? void 0 : t2.versionId) != null && i2.set(`versionId`, String(t2.versionId));
      let a2 = i2.toString();
      return n2.handleOperation(async () => Bt(await O(n2.fetch, `${n2.url}/object/info/${r2}${a2 ? `?${a2}` : ``}`, { headers: n2.headers })));
    }
    async exists(e2) {
      var _a2;
      var t2 = this;
      let n2 = t2._getFinalPath(e2);
      try {
        return await Yt(t2.fetch, `${t2.url}/object/${n2}`, { headers: t2.headers }), { data: true, error: null };
      } catch (e3) {
        if (t2.shouldThrowOnError) throw e3;
        if (Nt(e3)) {
          let t3 = e3 instanceof Pt ? e3.status : e3 instanceof Ft ? (_a2 = e3.originalError) == null ? void 0 : _a2.status : void 0;
          if (t3 !== void 0 && [400, 404].includes(t3)) return { data: false, error: e3 };
        }
        throw e3;
      }
    }
    getPublicUrl(e2, t2) {
      let n2 = this._getFinalPath(e2), r2 = new URLSearchParams();
      (t2 == null ? void 0 : t2.download) && r2.set(`download`, t2.download === true ? `` : t2.download), (t2 == null ? void 0 : t2.transform) && this.applyTransformOptsToQuery(r2, t2.transform), (t2 == null ? void 0 : t2.cacheNonce) != null && r2.set(`cacheNonce`, String(t2.cacheNonce)), (t2 == null ? void 0 : t2.versionId) != null && r2.set(`versionId`, String(t2.versionId));
      let i2 = r2.toString(), a2 = typeof (t2 == null ? void 0 : t2.transform) == `object` && t2.transform !== null && Object.keys(t2.transform).length > 0 ? `render/image` : `object`;
      return { data: { publicUrl: encodeURI(`${this.url}/${a2}/public/${n2}`) + (i2 ? `?${i2}` : ``) } };
    }
    async remove(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await A(t2.fetch, `${t2.url}/object/${t2.bucketId}`, { prefixes: e2 }, { headers: t2.headers }));
    }
    async purgeCache(e2, t2, n2) {
      var r2 = this;
      return r2.handleOperation(async () => {
        let i2 = Ht(r2._getFinalPath(e2)), a2 = new URLSearchParams();
        (t2 == null ? void 0 : t2.transformations) && a2.set(`transformations`, `true`);
        let o2 = a2.toString();
        return await A(r2.fetch, `${r2.url}/cdn/${i2}${o2 ? `?${o2}` : ``}`, {}, { headers: r2.headers }, n2);
      });
    }
    async list(e2, t2, n2) {
      var r2 = this;
      return r2.handleOperation(async () => {
        let i2 = (t2 == null ? void 0 : t2.sortBy) ? D(D({}, tn.sortBy), t2.sortBy) : tn.sortBy, a2 = D(D(D({}, tn), t2), {}, { sortBy: i2, prefix: e2 || `` });
        return await k(r2.fetch, `${r2.url}/object/list/${r2.bucketId}`, a2, { headers: r2.headers }, n2);
      });
    }
    async listV2(e2, t2) {
      var n2 = this;
      return n2.handleOperation(async () => {
        let r2 = D({}, e2);
        return await k(n2.fetch, `${n2.url}/object/list-v2/${n2.bucketId}`, r2, { headers: n2.headers }, t2);
      });
    }
    prepareUploadFormData(e2, t2) {
      let n2 = new FormData(), r2 = [];
      e2 instanceof FormData ? e2.forEach((e3, t3) => {
        typeof e3 == `string` ? n2.append(t3, e3) : r2.push([t3, e3]);
      }) : r2.push([``, e2]), n2.has(`cacheControl`) || n2.append(`cacheControl`, t2.cacheControl), t2.metadata && !n2.has(`metadata`) && n2.append(`metadata`, this.encodeMetadata(t2.metadata));
      for (let [e3, t3] of r2) n2.append(e3, t3);
      return n2;
    }
    encodeMetadata(e2) {
      return JSON.stringify(e2);
    }
    toBase64(e2) {
      return typeof Buffer < `u` ? Buffer.from(e2).toString(`base64`) : btoa(e2);
    }
    _getFinalPath(e2) {
      return `${this.bucketId}/${e2.replace(/^\/+/, ``)}`;
    }
    _removeEmptyFolders(e2) {
      return e2.replace(/^\/|\/$/g, ``).replace(/\/+/g, `/`);
    }
    applyTransformOptsToQuery(e2, t2) {
      return t2.width && e2.set(`width`, t2.width.toString()), t2.height && e2.set(`height`, t2.height.toString()), t2.resize && e2.set(`resize`, t2.resize), t2.format && e2.set(`format`, t2.format), t2.quality && e2.set(`quality`, t2.quality.toString()), e2;
    }
  };
  let an = { "X-Client-Info": `storage-js/2.117.3` };
  var on = class extends Xt {
    constructor(e2, t2 = {}, n2, r2) {
      let i2 = new URL(e2);
      (r2 == null ? void 0 : r2.useNewHostname) && /supabase\.(co|in|red)$/.test(i2.hostname) && !i2.hostname.includes(`storage.supabase.`) && (i2.hostname = i2.hostname.replace(`supabase.`, `storage.supabase.`));
      let a2 = i2.href.replace(/\/$/, ``), o2 = D(D({}, an), t2);
      super(a2, o2, n2, `storage`);
    }
    async listBuckets(e2) {
      var t2 = this;
      return t2.handleOperation(async () => {
        let n2 = t2.listBucketOptionsToQueryString(e2);
        return await O(t2.fetch, `${t2.url}/bucket${n2}`, { headers: t2.headers });
      });
    }
    async getBucket(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await O(t2.fetch, `${t2.url}/bucket/${e2}`, { headers: t2.headers }));
    }
    async createBucket(e2, t2 = { public: false }) {
      var n2 = this;
      return n2.handleOperation(async () => await k(n2.fetch, `${n2.url}/bucket`, { id: e2, name: e2, type: t2.type, public: t2.public, file_size_limit: t2.fileSizeLimit, allowed_mime_types: t2.allowedMimeTypes, versioning_status: t2.versioningStatus }, { headers: n2.headers }));
    }
    async updateBucket(e2, t2) {
      var n2 = this;
      return n2.handleOperation(async () => await Jt(n2.fetch, `${n2.url}/bucket/${e2}`, { id: e2, name: e2, public: t2.public, file_size_limit: t2.fileSizeLimit, allowed_mime_types: t2.allowedMimeTypes, versioning_status: t2.versioningStatus }, { headers: n2.headers }));
    }
    async emptyBucket(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await k(t2.fetch, `${t2.url}/bucket/${e2}/empty`, {}, { headers: t2.headers }));
    }
    async deleteBucket(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await A(t2.fetch, `${t2.url}/bucket/${e2}`, {}, { headers: t2.headers }));
    }
    async getBucketLifecycle(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await O(t2.fetch, t2.bucketLifecycleUrl(e2), { headers: t2.headers }));
    }
    async updateBucketLifecycle(e2, t2) {
      var n2 = this;
      return n2.handleOperation(async () => await Jt(n2.fetch, n2.bucketLifecycleUrl(e2), t2, { headers: n2.headers }));
    }
    async deleteBucketLifecycle(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await A(t2.fetch, t2.bucketLifecycleUrl(e2), {}, { headers: t2.headers }));
    }
    async purgeBucketCache(e2, t2, n2) {
      var r2 = this;
      return r2.handleOperation(async () => {
        let i2 = new URLSearchParams();
        (t2 == null ? void 0 : t2.transformations) && i2.set(`transformations`, `true`);
        let a2 = i2.toString();
        return await A(r2.fetch, `${r2.url}/cdn/${Ht(e2)}${a2 ? `?${a2}` : ``}`, {}, { headers: r2.headers }, n2);
      });
    }
    bucketLifecycleUrl(e2) {
      return `${this.url}/bucket/${Ht(e2)}/lifecycle`;
    }
    listBucketOptionsToQueryString(e2) {
      let t2 = {};
      return e2 && (`limit` in e2 && (t2.limit = String(e2.limit)), `offset` in e2 && (t2.offset = String(e2.offset)), e2.search && (t2.search = e2.search), e2.sortColumn && (t2.sortColumn = e2.sortColumn), e2.sortOrder && (t2.sortOrder = e2.sortOrder)), Object.keys(t2).length > 0 ? `?` + new URLSearchParams(t2).toString() : ``;
    }
  }, sn = class extends Xt {
    constructor(e2, t2 = {}, n2) {
      let r2 = e2.replace(/\/$/, ``), i2 = D(D({}, an), t2);
      super(r2, i2, n2, `storage`);
    }
    async createBucket(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await k(t2.fetch, `${t2.url}/bucket`, { name: e2 }, { headers: t2.headers }));
    }
    async listBuckets(e2) {
      var t2 = this;
      return t2.handleOperation(async () => {
        let n2 = new URLSearchParams();
        (e2 == null ? void 0 : e2.limit) !== void 0 && n2.set(`limit`, e2.limit.toString()), (e2 == null ? void 0 : e2.offset) !== void 0 && n2.set(`offset`, e2.offset.toString()), (e2 == null ? void 0 : e2.sortColumn) && n2.set(`sortColumn`, e2.sortColumn), (e2 == null ? void 0 : e2.sortOrder) && n2.set(`sortOrder`, e2.sortOrder), (e2 == null ? void 0 : e2.search) && n2.set(`search`, e2.search);
        let r2 = n2.toString(), i2 = r2 ? `${t2.url}/bucket?${r2}` : `${t2.url}/bucket`;
        return await O(t2.fetch, i2, { headers: t2.headers });
      });
    }
    async deleteBucket(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await A(t2.fetch, `${t2.url}/bucket/${e2}`, {}, { headers: t2.headers }));
    }
    from(e2) {
      var t2 = this;
      if (!Vt(e2)) throw new Mt(`Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.`);
      let n2 = new Et({ baseUrl: this.url, catalogName: e2, auth: { type: `custom`, getHeaders: async () => t2.headers }, fetch: this.fetch }), r2 = this.shouldThrowOnError;
      return new Proxy(n2, { get(e3, t3) {
        let n3 = e3[t3];
        return typeof n3 == `function` ? async (...t4) => {
          try {
            return { data: await n3.apply(e3, t4), error: null };
          } catch (e4) {
            if (r2) throw e4;
            return { data: null, error: e4 };
          }
        } : n3;
      } });
    }
  }, cn = class extends Xt {
    constructor(e2, t2 = {}, n2) {
      let r2 = e2.replace(/\/$/, ``), i2 = D(D({}, an), {}, { "Content-Type": `application/json` }, t2);
      super(r2, i2, n2, `vectors`);
    }
    async createIndex(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/CreateIndex`, e2, { headers: t2.headers }) || {});
    }
    async getIndex(e2, t2) {
      var n2 = this;
      return n2.handleOperation(async () => await j.post(n2.fetch, `${n2.url}/GetIndex`, { vectorBucketName: e2, indexName: t2 }, { headers: n2.headers }));
    }
    async listIndexes(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/ListIndexes`, e2, { headers: t2.headers }));
    }
    async deleteIndex(e2, t2) {
      var n2 = this;
      return n2.handleOperation(async () => await j.post(n2.fetch, `${n2.url}/DeleteIndex`, { vectorBucketName: e2, indexName: t2 }, { headers: n2.headers }) || {});
    }
  }, ln = class extends Xt {
    constructor(e2, t2 = {}, n2) {
      let r2 = e2.replace(/\/$/, ``), i2 = D(D({}, an), {}, { "Content-Type": `application/json` }, t2);
      super(r2, i2, n2, `vectors`);
    }
    async putVectors(e2) {
      var t2 = this;
      if (e2.vectors.length < 1 || e2.vectors.length > 500) throw Error(`Vector batch size must be between 1 and 500 items`);
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/PutVectors`, e2, { headers: t2.headers }) || {});
    }
    async getVectors(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/GetVectors`, e2, { headers: t2.headers }));
    }
    async listVectors(e2) {
      var t2 = this;
      if (e2.segmentCount !== void 0) {
        if (e2.segmentCount < 1 || e2.segmentCount > 16) throw Error(`segmentCount must be between 1 and 16`);
        if (e2.segmentIndex !== void 0 && (e2.segmentIndex < 0 || e2.segmentIndex >= e2.segmentCount)) throw Error(`segmentIndex must be between 0 and ${e2.segmentCount - 1}`);
      }
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/ListVectors`, e2, { headers: t2.headers }));
    }
    async queryVectors(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/QueryVectors`, e2, { headers: t2.headers }));
    }
    async deleteVectors(e2) {
      var t2 = this;
      if (e2.keys.length < 1 || e2.keys.length > 500) throw Error(`Keys batch size must be between 1 and 500 items`);
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/DeleteVectors`, e2, { headers: t2.headers }) || {});
    }
  }, un = class extends Xt {
    constructor(e2, t2 = {}, n2) {
      let r2 = e2.replace(/\/$/, ``), i2 = D(D({}, an), {}, { "Content-Type": `application/json` }, t2);
      super(r2, i2, n2, `vectors`);
    }
    async createBucket(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/CreateVectorBucket`, { vectorBucketName: e2 }, { headers: t2.headers }) || {});
    }
    async getBucket(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/GetVectorBucket`, { vectorBucketName: e2 }, { headers: t2.headers }));
    }
    async listBuckets(e2 = {}) {
      var t2 = this;
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/ListVectorBuckets`, e2, { headers: t2.headers }));
    }
    async deleteBucket(e2) {
      var t2 = this;
      return t2.handleOperation(async () => await j.post(t2.fetch, `${t2.url}/DeleteVectorBucket`, { vectorBucketName: e2 }, { headers: t2.headers }) || {});
    }
  }, dn = class extends un {
    constructor(e2, t2 = {}) {
      super(e2, t2.headers || {}, t2.fetch);
    }
    from(e2) {
      return new fn(this.url, this.headers, e2, this.fetch);
    }
    async createBucket(e2) {
      var t2 = () => super.createBucket, n2 = this;
      return t2().call(n2, e2);
    }
    async getBucket(e2) {
      var t2 = () => super.getBucket, n2 = this;
      return t2().call(n2, e2);
    }
    async listBuckets(e2 = {}) {
      var t2 = () => super.listBuckets, n2 = this;
      return t2().call(n2, e2);
    }
    async deleteBucket(e2) {
      var t2 = () => super.deleteBucket, n2 = this;
      return t2().call(n2, e2);
    }
  }, fn = class extends cn {
    constructor(e2, t2, n2, r2) {
      super(e2, t2, r2), this.vectorBucketName = n2;
    }
    async createIndex(e2) {
      var t2 = () => super.createIndex, n2 = this;
      return t2().call(n2, D(D({}, e2), {}, { vectorBucketName: n2.vectorBucketName }));
    }
    async listIndexes(e2 = {}) {
      var t2 = () => super.listIndexes, n2 = this;
      return t2().call(n2, D(D({}, e2), {}, { vectorBucketName: n2.vectorBucketName }));
    }
    async getIndex(e2) {
      var t2 = () => super.getIndex, n2 = this;
      return t2().call(n2, n2.vectorBucketName, e2);
    }
    async deleteIndex(e2) {
      var t2 = () => super.deleteIndex, n2 = this;
      return t2().call(n2, n2.vectorBucketName, e2);
    }
    index(e2) {
      return new pn(this.url, this.headers, this.vectorBucketName, e2, this.fetch);
    }
  }, pn = class extends ln {
    constructor(e2, t2, n2, r2, i2) {
      super(e2, t2, i2), this.vectorBucketName = n2, this.indexName = r2;
    }
    async putVectors(e2) {
      var t2 = () => super.putVectors, n2 = this;
      return t2().call(n2, D(D({}, e2), {}, { vectorBucketName: n2.vectorBucketName, indexName: n2.indexName }));
    }
    async getVectors(e2) {
      var t2 = () => super.getVectors, n2 = this;
      return t2().call(n2, D(D({}, e2), {}, { vectorBucketName: n2.vectorBucketName, indexName: n2.indexName }));
    }
    async listVectors(e2 = {}) {
      var t2 = () => super.listVectors, n2 = this;
      return t2().call(n2, D(D({}, e2), {}, { vectorBucketName: n2.vectorBucketName, indexName: n2.indexName }));
    }
    async queryVectors(e2) {
      var t2 = () => super.queryVectors, n2 = this;
      return t2().call(n2, D(D({}, e2), {}, { vectorBucketName: n2.vectorBucketName, indexName: n2.indexName }));
    }
    async deleteVectors(e2) {
      var t2 = () => super.deleteVectors, n2 = this;
      return t2().call(n2, D(D({}, e2), {}, { vectorBucketName: n2.vectorBucketName, indexName: n2.indexName }));
    }
  }, mn = class extends on {
    constructor(e2, t2 = {}, n2, r2) {
      super(e2, t2, n2, r2);
    }
    from(e2) {
      return new rn(this.url, this.headers, e2, this.fetch);
    }
    get vectors() {
      return new dn(this.url + `/vector`, { headers: this.headers, fetch: this.fetch });
    }
    get analytics() {
      return new sn(this.url + `/iceberg`, this.headers, this.fetch);
    }
  };
  let hn = ``, gn;
  typeof Deno < `u` ? (hn = `deno`, gn = (_a = Deno.version) == null ? void 0 : _a.deno) : typeof document < `u` ? hn = `web` : typeof navigator < `u` && navigator.product === `ReactNative` ? hn = `react-native` : (hn = `node`, gn = (_c = (_b = globalThis.process) == null ? void 0 : _b.version) == null ? void 0 : _c.replace(/^v/, ``));
  let _n = [`runtime=${hn}`];
  gn && _n.push(`runtime-version=${gn}`);
  let vn = { headers: { "X-Client-Info": `supabase-js/2.117.3; ${_n.join(`; `)}` } }, yn = { schema: `public` }, bn = { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: `implicit` }, xn = {}, Sn = { enabled: false, respectSamplingDecision: true };
  function Cn(e2) {
    if (!e2 || typeof e2 != `string`) return null;
    let t2 = e2.split(`-`);
    if (t2.length !== 4) return null;
    let [n2, r2, i2, a2] = t2;
    if (n2.length !== 2 || r2.length !== 32 || i2.length !== 16 || a2.length !== 2) return null;
    let o2 = /^[0-9a-f]+$/i;
    return !o2.test(n2) || !o2.test(r2) || !o2.test(i2) || !o2.test(a2) || r2 === `00000000000000000000000000000000` || i2 === `0000000000000000` ? null : { version: n2, traceId: r2, parentId: i2, traceFlags: a2, isSampled: (parseInt(a2, 16) & 1) == 1 };
  }
  function wn(e2, t2) {
    if (!e2 || !t2 || t2.length === 0) return false;
    let n2;
    if (e2 instanceof URL) n2 = e2;
    else try {
      n2 = new URL(e2);
    } catch (e3) {
      return false;
    }
    for (let e3 of t2) try {
      if (typeof e3 == `string`) {
        if (Tn(n2.hostname, e3)) return true;
      } else if (e3 instanceof RegExp) {
        if (e3.test(n2.hostname)) return true;
      } else if (typeof e3 == `function` && e3(n2)) return true;
    } catch (e4) {
      continue;
    }
    return false;
  }
  function Tn(e2, t2) {
    if (t2 === e2) return true;
    if (t2.startsWith(`*.`)) {
      let n2 = t2.slice(2);
      if (e2.endsWith(n2) && (e2 === n2 || e2.endsWith(`.` + n2))) return true;
    }
    return false;
  }
  function En(e2) {
    let t2 = [];
    try {
      let n2 = new URL(e2);
      t2.push(n2.hostname);
    } catch (e3) {
    }
    return t2.push(`*.supabase.co`, `*.supabase.in`), t2.push(`localhost`, `127.0.0.1`, `[::1]`), t2;
  }
  let Dn = /* @__PURE__ */ Symbol.for(`@supabase/supabase-js.traceContextExtractor`);
  function On() {
    return globalThis[Dn];
  }
  let kn = (e2) => e2 ? (...t2) => e2(...t2) : (...e3) => fetch(...e3), An = () => Headers, jn = (e2) => e2.startsWith(`sb_publishable_`) || e2.startsWith(`sb_secret_`), Mn = /* @__PURE__ */ new Set(), Nn = (e2) => {
    var _a2, _b2;
    if (!e2.startsWith(`sb_`) || jn(e2) || e2.startsWith(`sb_temp_`)) return;
    let t2 = (_b2 = (_a2 = e2.match(/^sb_[a-zA-Z0-9]+_/)) == null ? void 0 : _a2[0]) != null ? _b2 : `unknown`;
    Mn.has(t2) || (Mn.add(t2), console.warn(`@supabase/supabase-js: Unrecognized Supabase API key format. The client will proceed and send this key as-is; if you see authentication errors you may need to upgrade @supabase/supabase-js to a version that recognizes this key type.`));
  }, Pn = (e2, t2, n2, r2, i2, a2) => {
    let o2 = kn(r2), s2 = An(), c2 = (i2 == null ? void 0 : i2.enabled) === true, l2 = (i2 == null ? void 0 : i2.respectSamplingDecision) !== false, u2 = c2 ? En(t2) : null, d2 = !((a2 == null ? void 0 : a2.omitApiKeyAsBearer) && jn(e2));
    return async (t3, r3) => {
      let i3 = await n2(), a3 = new s2(r3 == null ? void 0 : r3.headers);
      if (a3.has(`apikey`) || a3.set(`apikey`, e2), !a3.has(`Authorization`)) {
        let t4 = i3 != null ? i3 : d2 ? e2 : null;
        t4 && a3.set(`Authorization`, `Bearer ${t4}`);
      }
      if (u2) {
        let e3 = Ln(t3, u2, l2);
        e3 && (e3.traceparent && !a3.has(`traceparent`) && a3.set(`traceparent`, e3.traceparent), e3.tracestate && !a3.has(`tracestate`) && a3.set(`tracestate`, e3.tracestate), e3.baggage && !a3.has(`baggage`) && a3.set(`baggage`, e3.baggage));
      }
      return o2(t3, { ...r3, headers: a3 });
    };
  }, Fn = false, In = false;
  function Ln(e2, t2, n2) {
    var _a2;
    let r2 = On();
    if (!r2) return Fn || (Fn = true, console.warn("@supabase/supabase-js: tracePropagation is enabled but the tracing runtime is not loaded, so trace headers will not be attached. Add `import '@supabase/supabase-js/tracing'` at your application entry point (requires the OpenTelemetry API package to be installed). The CDN/UMD build does not support trace propagation.")), null;
    if (!wn(typeof e2 == `string` || e2 instanceof URL ? e2 : e2.url, t2)) return null;
    let i2 = r2();
    if (!i2 || !i2.traceparent) {
      if (((_a2 = i2 == null ? void 0 : i2.carrierKeys) == null ? void 0 : _a2.length) && !In) {
        In = true;
        let e3 = i2.carrierKeys.includes(`sentry-trace`) ? " Sentry detected: set `propagateTraceparent: true` in Sentry.init() to emit it." : ` Configure your tracing SDK to emit W3C trace context on outgoing requests.`;
        console.warn(`@supabase/supabase-js: tracePropagation is enabled and a tracing SDK is active, but its propagator wrote [${i2.carrierKeys.join(`, `)}] and no W3C traceparent header, so trace headers will not be attached.` + e3);
      }
      return null;
    }
    if (n2) {
      let e3 = Cn(i2.traceparent);
      if (e3 && !e3.isSampled) return { traceparent: i2.traceparent };
    }
    return i2;
  }
  function Rn(e2) {
    return typeof e2 == `boolean` ? { enabled: e2 } : e2;
  }
  function zn(e2) {
    return e2.endsWith(`/`) ? e2 : e2 + `/`;
  }
  let Bn = false;
  function Vn(e2) {
    Bn || typeof e2 != `object` || !e2 || !(`schema` in e2) || e2.schema === void 0 || (Bn = true, console.warn(`@supabase/supabase-js: The "schema" option must be nested under "db", e.g. createClient(url, key, { db: { schema: 'myschema' } }). A top-level "schema" is ignored and queries go to the default schema.`));
  }
  function Hn(e2, t2) {
    var _a2, _b2, _c2, _d, _e2, _f;
    let { db: n2, auth: r2, realtime: i2, global: a2 } = e2, { db: o2, auth: s2, realtime: c2, global: l2 } = t2, u2 = Rn(e2.tracePropagation), d2 = Rn(t2.tracePropagation), f2 = { db: { ...o2, ...n2 }, auth: { ...s2, ...r2 }, realtime: { ...c2, ...i2 }, storage: {}, global: { ...l2, ...a2, headers: { ...(_a2 = l2 == null ? void 0 : l2.headers) != null ? _a2 : {}, ...(_b2 = a2 == null ? void 0 : a2.headers) != null ? _b2 : {} } }, tracePropagation: { enabled: (_d = (_c2 = u2 == null ? void 0 : u2.enabled) != null ? _c2 : d2 == null ? void 0 : d2.enabled) != null ? _d : false, respectSamplingDecision: (_f = (_e2 = u2 == null ? void 0 : u2.respectSamplingDecision) != null ? _e2 : d2 == null ? void 0 : d2.respectSamplingDecision) != null ? _f : true }, accessToken: async () => `` };
    return e2.accessToken ? f2.accessToken = e2.accessToken : delete f2.accessToken, f2;
  }
  function Un(e2) {
    let t2 = e2 == null ? void 0 : e2.trim();
    if (!t2) throw Error(`supabaseUrl is required.`);
    if (!t2.match(/^https?:\/\//i)) throw Error(`Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.`);
    try {
      return new URL(zn(t2));
    } catch (e3) {
      throw Error(`Invalid supabaseUrl: Provided URL is malformed.`);
    }
  }
  let Wn = `2.117.3`, M = 30 * 1e3, Gn = 3 * M;
  2 * M;
  let Kn = { "X-Client-Info": `gotrue-js/${Wn}` }, qn = `X-Supabase-Api-Version`, Jn = { "2024-01-01": { timestamp: Date.parse(`2024-01-01T00:00:00.0Z`), name: `2024-01-01` } }, Yn = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i, N = `sb_flow_id`;
  var Xn = class extends Error {
    constructor(e2, t2, n2) {
      super(e2), this.__isAuthError = true, this.name = `AuthError`, this.status = t2, this.code = n2;
    }
    toJSON() {
      return { name: this.name, message: this.message, status: this.status, code: this.code };
    }
  };
  function P(e2) {
    return typeof e2 == `object` && !!e2 && `__isAuthError` in e2;
  }
  var Zn = class extends Xn {
    constructor(e2, t2, n2) {
      super(e2, t2, n2), this.name = `AuthApiError`, this.status = t2, this.code = n2;
    }
  };
  function Qn(e2) {
    return P(e2) && e2.name === `AuthApiError`;
  }
  var F = class extends Xn {
    constructor(e2, t2) {
      super(e2), this.name = `AuthUnknownError`, this.originalError = t2;
    }
  }, I = class extends Xn {
    constructor(e2, t2, n2, r2) {
      super(e2, n2, r2), this.name = t2, this.status = n2;
    }
  }, L = class extends I {
    constructor() {
      super(`Auth session missing!`, `AuthSessionMissingError`, 400, void 0);
    }
  };
  function $n(e2) {
    return P(e2) && e2.name === `AuthSessionMissingError`;
  }
  var R = class extends I {
    constructor() {
      super(`Auth session or user missing`, `AuthInvalidTokenResponseError`, 500, void 0);
    }
  }, er = class extends I {
    constructor(e2) {
      super(e2, `AuthInvalidCredentialsError`, 400, void 0);
    }
  }, tr = class extends I {
    constructor(e2, t2 = null) {
      super(e2, `AuthImplicitGrantRedirectError`, 500, void 0), this.details = null, this.details = t2;
    }
    toJSON() {
      return Object.assign(Object.assign({}, super.toJSON()), { details: this.details });
    }
  };
  function nr(e2) {
    return P(e2) && e2.name === `AuthImplicitGrantRedirectError`;
  }
  var rr = class extends I {
    constructor(e2, t2 = null) {
      super(e2, `AuthPKCEGrantCodeExchangeError`, 500, void 0), this.details = null, this.details = t2;
    }
    toJSON() {
      return Object.assign(Object.assign({}, super.toJSON()), { details: this.details });
    }
  }, ir = class extends I {
    constructor() {
      super(`PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.`, `AuthPKCECodeVerifierMissingError`, 400, `pkce_code_verifier_not_found`);
    }
  };
  function ar(e2) {
    return P(e2) && e2.name === `AuthPKCECodeVerifierMissingError`;
  }
  var or = class extends I {
    constructor(e2, t2) {
      super(e2, `AuthRetryableFetchError`, t2, void 0);
    }
  };
  function sr(e2) {
    return P(e2) && e2.name === `AuthRetryableFetchError`;
  }
  var cr = class extends I {
    constructor(e2 = `Refresh result discarded: session state changed mid-flight (e.g., concurrent signOut)`) {
      super(e2, `AuthRefreshDiscardedError`, 409, void 0);
    }
  };
  function lr(e2) {
    return P(e2) && e2.name === `AuthRefreshDiscardedError`;
  }
  var ur = class extends I {
    constructor(e2, t2, n2) {
      super(e2, `AuthWeakPasswordError`, t2, `weak_password`), this.reasons = n2;
    }
    toJSON() {
      return Object.assign(Object.assign({}, super.toJSON()), { reasons: this.reasons });
    }
  };
  function dr(e2) {
    return P(e2) && e2.name === `AuthWeakPasswordError`;
  }
  var fr = class extends I {
    constructor(e2) {
      super(e2, `AuthInvalidJwtError`, 400, `invalid_jwt`);
    }
  };
  let pr = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`.split(``), mr = ` 	
\r=`.split(``), hr = (() => {
    let e2 = Array(128);
    for (let t2 = 0; t2 < e2.length; t2 += 1) e2[t2] = -1;
    for (let t2 = 0; t2 < mr.length; t2 += 1) e2[mr[t2].charCodeAt(0)] = -2;
    for (let t2 = 0; t2 < pr.length; t2 += 1) e2[pr[t2].charCodeAt(0)] = t2;
    return e2;
  })();
  function gr(e2, t2, n2) {
    if (e2 !== null) for (t2.queue = t2.queue << 8 | e2, t2.queuedBits += 8; t2.queuedBits >= 6; ) n2(pr[t2.queue >> t2.queuedBits - 6 & 63]), t2.queuedBits -= 6;
    else if (t2.queuedBits > 0) for (t2.queue <<= 6 - t2.queuedBits, t2.queuedBits = 6; t2.queuedBits >= 6; ) n2(pr[t2.queue >> t2.queuedBits - 6 & 63]), t2.queuedBits -= 6;
  }
  function _r(e2, t2, n2) {
    let r2 = hr[e2];
    if (r2 > -1) for (t2.queue = t2.queue << 6 | r2, t2.queuedBits += 6; t2.queuedBits >= 8; ) n2(t2.queue >> t2.queuedBits - 8 & 255), t2.queuedBits -= 8;
    else if (r2 === -2) return;
    else throw Error(`Invalid Base64-URL character "${String.fromCharCode(e2)}"`);
  }
  function vr(e2) {
    let t2 = [], n2 = (e3) => {
      t2.push(String.fromCodePoint(e3));
    }, r2 = { utf8seq: 0, codepoint: 0 }, i2 = { queue: 0, queuedBits: 0 }, a2 = (e3) => {
      xr(e3, r2, n2);
    };
    for (let t3 = 0; t3 < e2.length; t3 += 1) _r(e2.charCodeAt(t3), i2, a2);
    return t2.join(``);
  }
  function yr(e2, t2) {
    if (e2 <= 127) {
      t2(e2);
      return;
    } else if (e2 <= 2047) {
      t2(192 | e2 >> 6), t2(128 | e2 & 63);
      return;
    } else if (e2 <= 65535) {
      t2(224 | e2 >> 12), t2(128 | e2 >> 6 & 63), t2(128 | e2 & 63);
      return;
    } else if (e2 <= 1114111) {
      t2(240 | e2 >> 18), t2(128 | e2 >> 12 & 63), t2(128 | e2 >> 6 & 63), t2(128 | e2 & 63);
      return;
    }
    throw Error(`Unrecognized Unicode codepoint: ${e2.toString(16)}`);
  }
  function br(e2, t2) {
    for (let n2 = 0; n2 < e2.length; n2 += 1) {
      let r2 = e2.charCodeAt(n2);
      if (r2 > 55295 && r2 <= 56319) {
        let t3 = (r2 - 55296) * 1024 & 65535;
        r2 = (e2.charCodeAt(n2 + 1) - 56320 & 65535 | t3) + 65536, n2 += 1;
      }
      yr(r2, t2);
    }
  }
  function xr(e2, t2, n2) {
    if (t2.utf8seq === 0) {
      if (e2 <= 127) {
        n2(e2);
        return;
      }
      for (let n3 = 1; n3 < 6; n3 += 1) if (!(e2 >> 7 - n3 & 1)) {
        t2.utf8seq = n3;
        break;
      }
      if (t2.utf8seq === 2) t2.codepoint = e2 & 31;
      else if (t2.utf8seq === 3) t2.codepoint = e2 & 15;
      else if (t2.utf8seq === 4) t2.codepoint = e2 & 7;
      else throw Error(`Invalid UTF-8 sequence`);
      --t2.utf8seq;
    } else if (t2.utf8seq > 0) {
      if (e2 <= 127) throw Error(`Invalid UTF-8 sequence`);
      t2.codepoint = t2.codepoint << 6 | e2 & 63, --t2.utf8seq, t2.utf8seq === 0 && n2(t2.codepoint);
    }
  }
  function Sr(e2) {
    let t2 = [], n2 = { queue: 0, queuedBits: 0 }, r2 = (e3) => {
      t2.push(e3);
    };
    for (let t3 = 0; t3 < e2.length; t3 += 1) _r(e2.charCodeAt(t3), n2, r2);
    return new Uint8Array(t2);
  }
  function Cr(e2) {
    let t2 = [];
    return br(e2, (e3) => t2.push(e3)), new Uint8Array(t2);
  }
  function z(e2) {
    let t2 = [], n2 = { queue: 0, queuedBits: 0 }, r2 = (e3) => {
      t2.push(e3);
    };
    return e2.forEach((e3) => gr(e3, n2, r2)), gr(null, n2, r2), t2.join(``);
  }
  function wr(e2) {
    return Math.round(Date.now() / 1e3) + e2;
  }
  function Tr() {
    return /* @__PURE__ */ Symbol(`auth-callback`);
  }
  let B = () => typeof window < `u` && typeof document < `u`, V = { tested: false, writable: false }, Er = () => {
    if (!B()) return false;
    try {
      if (typeof globalThis.localStorage != `object`) return false;
    } catch (e3) {
      return false;
    }
    if (V.tested) return V.writable;
    let e2 = `lswt-${Math.random()}${Math.random()}`;
    try {
      globalThis.localStorage.setItem(e2, e2), globalThis.localStorage.removeItem(e2), V.tested = true, V.writable = true;
    } catch (e3) {
      V.tested = true, V.writable = false;
    }
    return V.writable;
  };
  function Dr(e2) {
    let t2 = {}, n2 = new URL(e2);
    if (n2.hash && n2.hash[0] === `#`) try {
      new URLSearchParams(n2.hash.substring(1)).forEach((e3, n3) => {
        t2[n3] = e3;
      });
    } catch (e3) {
    }
    return n2.searchParams.forEach((e3, n3) => {
      t2[n3] = e3;
    }), t2;
  }
  let Or = (e2) => e2 ? (...t2) => e2(...t2) : (...e3) => fetch(...e3), kr = (e2) => typeof e2 == `object` && !!e2 && `status` in e2 && `ok` in e2 && `json` in e2 && typeof e2.json == `function`, H = async (e2, t2, n2) => {
    await e2.setItem(t2, JSON.stringify(n2));
  }, U = async (e2, t2) => {
    let n2 = await e2.getItem(t2);
    if (!n2) return null;
    try {
      return JSON.parse(n2);
    } catch (e3) {
      return null;
    }
  }, W = async (e2, t2) => {
    await e2.removeItem(t2);
  };
  var Ar = class e2 {
    constructor() {
      this.promise = new e2.promiseConstructor((e3, t2) => {
        this.resolve = e3, this.reject = t2;
      });
    }
  };
  Ar.promiseConstructor = Promise;
  function jr(e2) {
    let t2 = e2.split(`.`);
    if (t2.length !== 3) throw new fr(`Invalid JWT structure`);
    for (let e3 = 0; e3 < t2.length; e3++) if (!Yn.test(t2[e3])) throw new fr(`JWT not in base64url format`);
    return { header: JSON.parse(vr(t2[0])), payload: JSON.parse(vr(t2[1])), signature: Sr(t2[2]), raw: { header: t2[0], payload: t2[1] } };
  }
  async function Mr(e2) {
    return await new Promise((t2) => {
      setTimeout(() => t2(null), e2);
    });
  }
  function Nr(e2, t2) {
    return new Promise((n2, r2) => {
      (async () => {
        for (let i2 = 0; i2 < 1 / 0; i2++) try {
          let r3 = await e2(i2);
          if (!t2(i2, null, r3)) {
            n2(r3);
            return;
          }
        } catch (e3) {
          if (!t2(i2, e3)) {
            r2(e3);
            return;
          }
        }
      })();
    });
  }
  function Pr(e2) {
    return (`0` + e2.toString(16)).substr(-2);
  }
  function Fr() {
    let e2 = new Uint32Array(56);
    if (typeof crypto > `u`) {
      let e3 = ``;
      for (let t2 = 0; t2 < 56; t2++) e3 += `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~`.charAt(Math.floor(Math.random() * 66));
      return e3;
    }
    return crypto.getRandomValues(e2), Array.from(e2, Pr).join(``);
  }
  async function Ir(e2) {
    let t2 = new TextEncoder().encode(e2), n2 = await crypto.subtle.digest(`SHA-256`, t2), r2 = new Uint8Array(n2);
    return Array.from(r2).map((e3) => String.fromCharCode(e3)).join(``);
  }
  async function Lr(e2) {
    if (!(typeof crypto < `u` && crypto.subtle !== void 0 && typeof TextEncoder < `u`)) return console.warn(`WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.`), e2;
    let t2 = await Ir(e2);
    return btoa(t2).replace(/\+/g, `-`).replace(/\//g, `_`).replace(/=+$/, ``);
  }
  let Rr = /^[a-zA-Z0-9_-]{8,64}$/;
  function zr(e2) {
    return typeof e2 == `string` && Rr.test(e2) ? e2 : null;
  }
  function Br() {
    if (typeof crypto < `u` && typeof crypto.getRandomValues == `function`) {
      let e3 = new Uint8Array(16);
      return crypto.getRandomValues(e3), Array.from(e3, Pr).join(``);
    }
    let e2 = ``;
    for (let t2 = 0; t2 < 32; t2++) e2 += Math.floor(Math.random() * 16).toString(16);
    return e2;
  }
  let Vr = (e2, t2) => `${e2}-flow-${t2}-code-verifier`, Hr = (e2) => `${e2}-flows-code-verifier`;
  async function Ur(e2, t2) {
    let n2 = await U(e2, Hr(t2));
    return Array.isArray(n2) ? n2.filter((e3) => zr(e3) !== null) : [];
  }
  async function Wr(e2, t2, n2, r2, i2) {
    await H(e2, Vr(t2, n2), r2);
    let a2 = (await Ur(e2, t2)).filter((e3) => e3 !== n2);
    for (a2.push(n2); a2.length > 5; ) {
      let n3 = a2.shift();
      await W(e2, Vr(t2, n3)), i2 == null ? void 0 : i2(n3);
    }
    await H(e2, Hr(t2), a2), await H(e2, `${t2}-code-verifier`, r2);
  }
  async function Gr(e2, t2, n2) {
    if (n2) {
      let r3 = await U(e2, Vr(t2, n2));
      return { verifier: typeof r3 == `string` ? r3 : null, flowId: n2 };
    }
    let r2 = await U(e2, `${t2}-code-verifier`);
    return { verifier: typeof r2 == `string` ? r2 : null, flowId: null };
  }
  async function G(e2, t2, n2) {
    let r2 = `${t2}-code-verifier`;
    if (!n2) {
      await W(e2, r2);
      return;
    }
    let i2 = Vr(t2, n2), a2 = await U(e2, i2);
    await W(e2, i2);
    let o2 = await Ur(e2, t2), s2 = o2.filter((e3) => e3 !== n2);
    s2.length !== o2.length && (s2.length > 0 ? await H(e2, Hr(t2), s2) : await W(e2, Hr(t2))), a2 != null && a2 === await U(e2, r2) && await W(e2, r2);
  }
  async function Kr(e2, t2) {
    let n2 = await Ur(e2, t2);
    for (let r2 of n2) await W(e2, Vr(t2, r2));
    await W(e2, Hr(t2)), await W(e2, `${t2}-code-verifier`);
  }
  function qr(e2, t2) {
    let n2 = e2.indexOf(`#`), r2 = n2 === -1 ? e2 : e2.slice(0, n2), i2 = n2 === -1 ? `` : e2.slice(n2), a2 = r2.indexOf(`?`);
    if (a2 !== -1) {
      let e3 = r2.slice(0, a2), t3 = r2.slice(a2 + 1).split(`&`).filter((e4) => e4 !== `` && e4 !== N && !e4.startsWith(`${N}=`));
      r2 = t3.length > 0 ? `${e3}?${t3.join(`&`)}` : e3;
    }
    let o2 = r2.includes(`?`) ? `&` : `?`;
    return `${r2}${o2}${N}=${encodeURIComponent(t2)}${i2}`;
  }
  async function Jr(e2, t2, n2 = false, r2) {
    let i2 = Fr(), a2 = i2;
    n2 && (a2 += `/recovery`);
    let o2 = Br();
    await Wr(e2, t2, o2, a2, r2);
    let s2 = await Lr(i2);
    return [s2, i2 === s2 ? `plain` : `s256`, o2];
  }
  let Yr = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;
  function Xr(e2) {
    let t2 = e2.headers.get(qn);
    if (!t2 || !t2.match(Yr)) return null;
    try {
      return /* @__PURE__ */ new Date(`${t2}T00:00:00.0Z`);
    } catch (e3) {
      return null;
    }
  }
  function Zr(e2) {
    if (!e2) throw Error(`Missing exp claim`);
    if (e2 <= Math.floor(Date.now() / 1e3)) throw Error(`JWT has expired`);
  }
  function Qr(e2) {
    switch (e2) {
      case `RS256`:
        return { name: `RSASSA-PKCS1-v1_5`, hash: { name: `SHA-256` } };
      case `ES256`:
        return { name: `ECDSA`, namedCurve: `P-256`, hash: { name: `SHA-256` } };
      default:
        throw Error(`Invalid alg claim`);
    }
  }
  let $r = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function K(e2) {
    if (!$r.test(e2)) throw Error(`@supabase/auth-js: Expected parameter to be UUID but is not`);
  }
  function ei(e2) {
    if (!e2.recoveryCodes) throw Error("@supabase/auth-js: the MFA recovery codes API is experimental and disabled by default. Enable it by passing `auth: { experimental: { recoveryCodes: true } }` to createClient (or to the GoTrueClient constructor).");
  }
  function ti() {
    return new Proxy({}, { get: (e2, t2) => {
      if (t2 === `__isUserNotAvailableProxy`) return true;
      if (typeof t2 == `symbol`) {
        let e3 = t2.toString();
        if (e3 === `Symbol(Symbol.toPrimitive)` || e3 === `Symbol(Symbol.toStringTag)` || e3 === `Symbol(util.inspect.custom)`) return;
      }
      throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${t2}" property of the session object is not supported. Please use getUser() instead.`);
    }, set: (e2, t2) => {
      throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${t2}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
    }, deleteProperty: (e2, t2) => {
      throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${t2}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
    } });
  }
  function ni(e2, t2) {
    return new Proxy(e2, { get: (e3, n2, r2) => {
      if (n2 === `__isInsecureUserWarningProxy`) return true;
      if (typeof n2 == `symbol`) {
        let t3 = n2.toString();
        if (t3 === `Symbol(Symbol.toPrimitive)` || t3 === `Symbol(Symbol.toStringTag)` || t3 === `Symbol(util.inspect.custom)` || t3 === `Symbol(nodejs.util.inspect.custom)`) return Reflect.get(e3, n2, r2);
      }
      return !t2.value && typeof n2 == `string` && (console.warn(`Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server.`), t2.value = true), Reflect.get(e3, n2, r2);
    } });
  }
  function ri(e2) {
    return JSON.parse(JSON.stringify(e2));
  }
  let q = (e2) => {
    if (typeof e2 == `object` && e2) {
      let t2 = e2;
      if (typeof t2.msg == `string`) return t2.msg;
      if (typeof t2.message == `string`) return t2.message;
      if (typeof t2.error_description == `string`) return t2.error_description;
      if (typeof t2.error == `string`) return t2.error;
    }
    return JSON.stringify(e2);
  }, ii = [500, 501, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530];
  async function ai(e2) {
    var _a2;
    if (!kr(e2)) throw new or(q(e2), 0);
    let t2;
    try {
      t2 = await e2.json();
    } catch (t3) {
      throw ii.includes(e2.status) ? new or(e2.statusText || `HTTP ${e2.status}`, e2.status) : new F(q(t3), t3);
    }
    if (ii.includes(e2.status)) throw new or(q(t2), e2.status);
    let n2, r2 = Xr(e2);
    if (r2 && r2.getTime() >= Jn[`2024-01-01`].timestamp && typeof t2 == `object` && t2 && typeof t2.code == `string` ? n2 = t2.code : typeof t2 == `object` && t2 && typeof t2.error_code == `string` && (n2 = t2.error_code), n2) {
      if (n2 === `weak_password`) throw new ur(q(t2), e2.status, ((_a2 = t2.weak_password) == null ? void 0 : _a2.reasons) || []);
      if (n2 === `session_not_found`) throw new L();
    } else if (typeof t2 == `object` && t2 && typeof t2.weak_password == `object` && t2.weak_password && Array.isArray(t2.weak_password.reasons) && t2.weak_password.reasons.length && t2.weak_password.reasons.reduce((e3, t3) => e3 && typeof t3 == `string`, true)) throw new ur(q(t2), e2.status, t2.weak_password.reasons);
    throw new Zn(q(t2), e2.status || 500, n2);
  }
  let oi = (e2, t2, n2, r2) => {
    let i2 = { method: e2, headers: (t2 == null ? void 0 : t2.headers) || {} };
    return e2 === `GET` ? i2 : (i2.headers = Object.assign({ "Content-Type": `application/json;charset=UTF-8` }, t2 == null ? void 0 : t2.headers), i2.body = JSON.stringify(r2), Object.assign(Object.assign({}, i2), n2));
  };
  async function J(e2, t2, n2, r2) {
    var _a2;
    let i2 = Object.assign({}, r2 == null ? void 0 : r2.headers);
    i2[qn] || (i2[qn] = Jn[`2024-01-01`].name), (r2 == null ? void 0 : r2.jwt) && (i2.Authorization = `Bearer ${r2.jwt}`);
    let a2 = (_a2 = r2 == null ? void 0 : r2.query) != null ? _a2 : {};
    (r2 == null ? void 0 : r2.redirectTo) && (a2.redirect_to = r2.redirectTo);
    let o2 = await si(e2, t2, n2 + (Object.keys(a2).length ? `?` + new URLSearchParams(a2).toString() : ``), { headers: i2, noResolveJson: r2 == null ? void 0 : r2.noResolveJson }, {}, r2 == null ? void 0 : r2.body);
    return (r2 == null ? void 0 : r2.xform) ? r2 == null ? void 0 : r2.xform(o2) : { data: Object.assign({}, o2), error: null };
  }
  async function si(e2, t2, n2, r2, i2, a2) {
    let o2 = oi(t2, r2, i2, a2), s2;
    try {
      s2 = await e2(n2, Object.assign({}, o2));
    } catch (e3) {
      throw new or(q(e3), 0);
    }
    if (s2.ok || await ai(s2), r2 == null ? void 0 : r2.noResolveJson) return s2;
    try {
      return await s2.json();
    } catch (e3) {
      await ai(e3);
    }
  }
  function Y(e2) {
    var _a2;
    let t2 = null;
    fi(e2) && (t2 = Object.assign({}, e2), e2.expires_at || (t2.expires_at = wr(e2.expires_in)));
    let n2 = (_a2 = e2.user) != null ? _a2 : typeof (e2 == null ? void 0 : e2.id) == `string` ? e2 : null;
    return { data: { session: t2, user: n2 }, error: null };
  }
  function ci(e2) {
    let t2 = Y(e2);
    return !t2.error && e2.weak_password && typeof e2.weak_password == `object` && Array.isArray(e2.weak_password.reasons) && e2.weak_password.reasons.length && e2.weak_password.message && typeof e2.weak_password.message == `string` && e2.weak_password.reasons.reduce((e3, t3) => e3 && typeof t3 == `string`, true) && (t2.data.weak_password = e2.weak_password), t2;
  }
  function X(e2) {
    var _a2;
    return { data: { user: (_a2 = e2.user) != null ? _a2 : e2 }, error: null };
  }
  function li(e2) {
    return { data: e2, error: null };
  }
  function ui(e2) {
    let { action_link: n2, email_otp: r2, hashed_token: i2, redirect_to: a2, verification_type: o2 } = e2, s2 = t(e2, [`action_link`, `email_otp`, `hashed_token`, `redirect_to`, `verification_type`]);
    return { data: { properties: { action_link: n2, email_otp: r2, hashed_token: i2, redirect_to: a2, verification_type: o2 }, user: Object.assign({}, s2) }, error: null };
  }
  function di(e2) {
    return e2;
  }
  function fi(e2) {
    return !!e2.access_token && !!e2.refresh_token && !!e2.expires_in;
  }
  let pi = [`global`, `local`, `others`];
  var mi = class {
    constructor({ url: e2 = ``, headers: t2 = {}, fetch: n2, experimental: r2 }) {
      this.url = e2, this.headers = t2, this.fetch = Or(n2), this.experimental = r2 != null ? r2 : {}, this.mfa = { listFactors: this._listFactors.bind(this), deleteFactor: this._deleteFactor.bind(this) }, this.oauth = { listClients: this._listOAuthClients.bind(this), createClient: this._createOAuthClient.bind(this), getClient: this._getOAuthClient.bind(this), updateClient: this._updateOAuthClient.bind(this), deleteClient: this._deleteOAuthClient.bind(this), regenerateClientSecret: this._regenerateOAuthClientSecret.bind(this) }, this.customProviders = { listProviders: this._listCustomProviders.bind(this), createProvider: this._createCustomProvider.bind(this), getProvider: this._getCustomProvider.bind(this), updateProvider: this._updateCustomProvider.bind(this), deleteProvider: this._deleteCustomProvider.bind(this) }, this.passkey = { listPasskeys: this._adminListPasskeys.bind(this), deletePasskey: this._adminDeletePasskey.bind(this) };
    }
    async signOut(e2, t2 = pi[0]) {
      if (pi.indexOf(t2) < 0) throw Error(`@supabase/auth-js: Parameter scope must be one of ${pi.join(`, `)}`);
      try {
        return await J(this.fetch, `POST`, `${this.url}/logout?scope=${t2}`, { headers: this.headers, jwt: e2, noResolveJson: true }), { data: null, error: null };
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async inviteUserByEmail(e2, t2 = {}) {
      try {
        return await J(this.fetch, `POST`, `${this.url}/invite`, { body: { email: e2, data: t2.data }, headers: this.headers, redirectTo: t2.redirectTo, xform: X });
      } catch (e3) {
        if (P(e3)) return { data: { user: null }, error: e3 };
        throw e3;
      }
    }
    async generateLink(e2) {
      try {
        let { options: n2 } = e2, r2 = t(e2, [`options`]), i2 = Object.assign(Object.assign({}, r2), n2);
        return `newEmail` in r2 && (i2.new_email = r2 == null ? void 0 : r2.newEmail, delete i2.newEmail), await J(this.fetch, `POST`, `${this.url}/admin/generate_link`, { body: i2, headers: this.headers, xform: ui, redirectTo: n2 == null ? void 0 : n2.redirectTo });
      } catch (e3) {
        if (P(e3)) return { data: { properties: null, user: null }, error: e3 };
        throw e3;
      }
    }
    async createUser(e2) {
      try {
        return await J(this.fetch, `POST`, `${this.url}/admin/users`, { body: e2, headers: this.headers, xform: X });
      } catch (e3) {
        if (P(e3)) return { data: { user: null }, error: e3 };
        throw e3;
      }
    }
    async listUsers(e2) {
      var _a2, _b2, _c2, _d, _e2, _f, _g;
      try {
        let t2 = { nextPage: null, lastPage: 0, total: 0 }, n2 = await J(this.fetch, `GET`, `${this.url}/admin/users`, { headers: this.headers, noResolveJson: true, query: { page: (_b2 = (_a2 = e2 == null ? void 0 : e2.page) == null ? void 0 : _a2.toString()) != null ? _b2 : ``, per_page: (_d = (_c2 = e2 == null ? void 0 : e2.perPage) == null ? void 0 : _c2.toString()) != null ? _d : `` }, xform: di });
        if (n2.error) throw n2.error;
        let r2 = await n2.json(), i2 = (_e2 = n2.headers.get(`x-total-count`)) != null ? _e2 : 0, a2 = (_g = (_f = n2.headers.get(`link`)) == null ? void 0 : _f.split(`,`)) != null ? _g : [];
        return a2.length > 0 && (a2.forEach((e3) => {
          let n3 = parseInt(e3.split(`;`)[0].split(`=`)[1].substring(0, 1)), r3 = JSON.parse(e3.split(`;`)[1].split(`=`)[1]);
          t2[`${r3}Page`] = n3;
        }), t2.total = parseInt(i2)), { data: Object.assign(Object.assign({}, r2), t2), error: null };
      } catch (e3) {
        if (P(e3)) return { data: { users: [] }, error: e3 };
        throw e3;
      }
    }
    async getUserById(e2) {
      K(e2);
      try {
        return await J(this.fetch, `GET`, `${this.url}/admin/users/${e2}`, { headers: this.headers, xform: X });
      } catch (e3) {
        if (P(e3)) return { data: { user: null }, error: e3 };
        throw e3;
      }
    }
    async updateUserById(e2, t2) {
      K(e2);
      try {
        return await J(this.fetch, `PUT`, `${this.url}/admin/users/${e2}`, { body: t2, headers: this.headers, xform: X });
      } catch (e3) {
        if (P(e3)) return { data: { user: null }, error: e3 };
        throw e3;
      }
    }
    async deleteUser(e2, t2 = false) {
      K(e2);
      try {
        return await J(this.fetch, `DELETE`, `${this.url}/admin/users/${e2}`, { headers: this.headers, body: { should_soft_delete: t2 }, xform: X });
      } catch (e3) {
        if (P(e3)) return { data: { user: null }, error: e3 };
        throw e3;
      }
    }
    async _listFactors(e2) {
      K(e2.userId);
      try {
        let { data: t2, error: n2 } = await J(this.fetch, `GET`, `${this.url}/admin/users/${e2.userId}/factors`, { headers: this.headers, xform: (e3) => ({ data: { factors: e3 }, error: null }) });
        return { data: t2, error: n2 };
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _deleteFactor(e2) {
      K(e2.userId), K(e2.id);
      try {
        return { data: await J(this.fetch, `DELETE`, `${this.url}/admin/users/${e2.userId}/factors/${e2.id}`, { headers: this.headers }), error: null };
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _listOAuthClients(e2) {
      var _a2, _b2, _c2, _d, _e2, _f, _g;
      try {
        let t2 = { nextPage: null, lastPage: 0, total: 0 }, n2 = await J(this.fetch, `GET`, `${this.url}/admin/oauth/clients`, { headers: this.headers, noResolveJson: true, query: { page: (_b2 = (_a2 = e2 == null ? void 0 : e2.page) == null ? void 0 : _a2.toString()) != null ? _b2 : ``, per_page: (_d = (_c2 = e2 == null ? void 0 : e2.perPage) == null ? void 0 : _c2.toString()) != null ? _d : `` }, xform: di });
        if (n2.error) throw n2.error;
        let r2 = await n2.json(), i2 = (_e2 = n2.headers.get(`x-total-count`)) != null ? _e2 : 0, a2 = (_g = (_f = n2.headers.get(`link`)) == null ? void 0 : _f.split(`,`)) != null ? _g : [];
        return a2.length > 0 && (a2.forEach((e3) => {
          let n3 = parseInt(e3.split(`;`)[0].split(`=`)[1].substring(0, 1)), r3 = JSON.parse(e3.split(`;`)[1].split(`=`)[1]);
          t2[`${r3}Page`] = n3;
        }), t2.total = parseInt(i2)), { data: Object.assign(Object.assign({}, r2), t2), error: null };
      } catch (e3) {
        if (P(e3)) return { data: { clients: [] }, error: e3 };
        throw e3;
      }
    }
    async _createOAuthClient(e2) {
      try {
        return await J(this.fetch, `POST`, `${this.url}/admin/oauth/clients`, { body: e2, headers: this.headers, xform: (e3) => ({ data: e3, error: null }) });
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _getOAuthClient(e2) {
      try {
        return await J(this.fetch, `GET`, `${this.url}/admin/oauth/clients/${e2}`, { headers: this.headers, xform: (e3) => ({ data: e3, error: null }) });
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _updateOAuthClient(e2, t2) {
      try {
        return await J(this.fetch, `PUT`, `${this.url}/admin/oauth/clients/${e2}`, { body: t2, headers: this.headers, xform: (e3) => ({ data: e3, error: null }) });
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _deleteOAuthClient(e2) {
      try {
        return await J(this.fetch, `DELETE`, `${this.url}/admin/oauth/clients/${e2}`, { headers: this.headers, noResolveJson: true }), { data: null, error: null };
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _regenerateOAuthClientSecret(e2) {
      try {
        return await J(this.fetch, `POST`, `${this.url}/admin/oauth/clients/${e2}/regenerate_secret`, { headers: this.headers, xform: (e3) => ({ data: e3, error: null }) });
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _listCustomProviders(e2) {
      try {
        let t2 = {};
        return (e2 == null ? void 0 : e2.type) && (t2.type = e2.type), await J(this.fetch, `GET`, `${this.url}/admin/custom-providers`, { headers: this.headers, query: t2, xform: (e3) => {
          var _a2;
          return { data: { providers: (_a2 = e3 == null ? void 0 : e3.providers) != null ? _a2 : [] }, error: null };
        } });
      } catch (e3) {
        if (P(e3)) return { data: { providers: [] }, error: e3 };
        throw e3;
      }
    }
    async _createCustomProvider(e2) {
      try {
        return await J(this.fetch, `POST`, `${this.url}/admin/custom-providers`, { body: e2, headers: this.headers, xform: (e3) => ({ data: e3, error: null }) });
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _getCustomProvider(e2) {
      try {
        return await J(this.fetch, `GET`, `${this.url}/admin/custom-providers/${e2}`, { headers: this.headers, xform: (e3) => ({ data: e3, error: null }) });
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _updateCustomProvider(e2, t2) {
      try {
        return await J(this.fetch, `PUT`, `${this.url}/admin/custom-providers/${e2}`, { body: t2, headers: this.headers, xform: (e3) => ({ data: e3, error: null }) });
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _deleteCustomProvider(e2) {
      try {
        return await J(this.fetch, `DELETE`, `${this.url}/admin/custom-providers/${e2}`, { headers: this.headers, noResolveJson: true }), { data: null, error: null };
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _adminListPasskeys(e2) {
      K(e2.userId);
      try {
        return await J(this.fetch, `GET`, `${this.url}/admin/users/${e2.userId}/passkeys`, { headers: this.headers, xform: (e3) => ({ data: e3, error: null }) });
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
    async _adminDeletePasskey(e2) {
      K(e2.userId), K(e2.passkeyId);
      try {
        return await J(this.fetch, `DELETE`, `${this.url}/admin/users/${e2.userId}/passkeys/${e2.passkeyId}`, { headers: this.headers, noResolveJson: true }), { data: null, error: null };
      } catch (e3) {
        if (P(e3)) return { data: null, error: e3 };
        throw e3;
      }
    }
  };
  function hi(e2 = {}) {
    return { getItem: (t2) => e2[t2] || null, setItem: (t2, n2) => {
      e2[t2] = n2;
    }, removeItem: (t2) => {
      delete e2[t2];
    } };
  }
  let Z = { debug: !!(globalThis && Er() && globalThis.localStorage && globalThis.localStorage.getItem(`supabase.gotrue-js.locks.debug`) === `true`) };
  var gi = class extends Error {
    constructor(e2) {
      super(e2), this.isAcquireTimeout = true;
    }
  }, _i = class extends gi {
  }, vi = class extends gi {
  };
  async function yi(e2, t2, n2) {
    Z.debug && console.log(`@supabase/gotrue-js: navigatorLock: acquire lock`, e2, t2);
    let r2 = new globalThis.AbortController(), i2;
    t2 > 0 && (i2 = setTimeout(() => {
      r2.abort(), Z.debug && console.log(`@supabase/gotrue-js: navigatorLock acquire timed out`, e2);
    }, t2)), await Promise.resolve();
    try {
      return await globalThis.navigator.locks.request(e2, t2 === 0 ? { mode: `exclusive`, ifAvailable: true } : { mode: `exclusive`, signal: r2.signal }, async (r3) => {
        if (r3) {
          clearTimeout(i2), Z.debug && console.log(`@supabase/gotrue-js: navigatorLock: acquired`, e2, r3.name);
          try {
            return await n2();
          } finally {
            Z.debug && console.log(`@supabase/gotrue-js: navigatorLock: released`, e2, r3.name);
          }
        } else if (t2 === 0) throw Z.debug && console.log(`@supabase/gotrue-js: navigatorLock: not immediately available`, e2), new _i(`Acquiring an exclusive Navigator LockManager lock "${e2}" immediately failed`);
        else {
          if (Z.debug) try {
            let e3 = await globalThis.navigator.locks.query();
            console.log(`@supabase/gotrue-js: Navigator LockManager state`, JSON.stringify(e3, null, `  `));
          } catch (e3) {
            console.warn(`@supabase/gotrue-js: Error when querying Navigator LockManager state`, e3);
          }
          return console.warn(`@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request`), clearTimeout(i2), await n2();
        }
      });
    } catch (a2) {
      if (clearTimeout(i2), typeof a2 == `object` && a2 && `name` in a2 && a2.name === `AbortError`) {
        if (r2.signal.aborted) return Z.debug && console.log(`@supabase/gotrue-js: navigatorLock: acquire timeout, recovering by stealing lock`, e2), console.warn(`@supabase/gotrue-js: Lock "${e2}" was not released within ${t2}ms. This may indicate an orphaned lock from a component unmount (e.g., React Strict Mode). Forcefully acquiring the lock to recover.`), await Promise.resolve().then(() => globalThis.navigator.locks.request(e2, { mode: `exclusive`, steal: true }, async (t3) => {
          if (t3) {
            Z.debug && console.log(`@supabase/gotrue-js: navigatorLock: recovered (stolen)`, e2, t3.name);
            try {
              return await n2();
            } finally {
              Z.debug && console.log(`@supabase/gotrue-js: navigatorLock: released (stolen)`, e2, t3.name);
            }
          } else return console.warn(`@supabase/gotrue-js: Navigator LockManager returned null lock even with steal: true`), await n2();
        }));
        throw Z.debug && console.log(`@supabase/gotrue-js: navigatorLock: lock was stolen by another request`, e2), new _i(`Lock "${e2}" was released because another request stole it`);
      }
      throw a2;
    }
  }
  let bi = {};
  async function xi(e2, t2, n2) {
    var _a2;
    let r2 = (_a2 = bi[e2]) != null ? _a2 : Promise.resolve(), i2 = (async () => {
      try {
        return await r2, null;
      } catch (e3) {
        return null;
      }
    })(), a2 = (async () => {
      let r3 = null;
      try {
        let n3 = t2 >= 0 ? new Promise((n4, i3) => {
          r3 = setTimeout(() => {
            console.warn(`@supabase/gotrue-js: Lock "${e2}" acquisition timed out after ${t2}ms. This may be caused by another operation holding the lock. Consider increasing lockAcquireTimeout or checking for stuck operations.`), i3(new vi(`Acquiring process lock with name "${e2}" timed out`));
          }, t2);
        }) : null;
        await Promise.race([i2, n3].filter((e3) => e3)), r3 !== null && clearTimeout(r3);
      } catch (e3) {
        if (r3 !== null && clearTimeout(r3), e3 instanceof gi) throw e3;
      }
      return await n2();
    })();
    return bi[e2] = (async () => {
      try {
        return await a2;
      } catch (e3) {
        if (e3 instanceof gi) {
          try {
            await r2;
          } catch (e4) {
          }
          return null;
        }
        throw e3;
      }
    })(), await a2;
  }
  function Si() {
    if (typeof globalThis != `object`) try {
      Object.defineProperty(Object.prototype, `__magic__`, { get: function() {
        return this;
      }, configurable: true }), __magic__.globalThis = __magic__, delete Object.prototype.__magic__;
    } catch (e2) {
      typeof self < `u` && (self.globalThis = self);
    }
  }
  function Ci(e2) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(e2)) throw Error(`@supabase/auth-js: Address "${e2}" is invalid.`);
    return e2.toLowerCase();
  }
  function wi(e2) {
    return parseInt(e2, 16);
  }
  function Ti(e2) {
    let t2 = new TextEncoder().encode(e2);
    return `0x` + Array.from(t2, (e3) => e3.toString(16).padStart(2, `0`)).join(``);
  }
  function Ei(e2) {
    var _a2;
    let { chainId: t2, domain: n2, expirationTime: r2, issuedAt: i2 = /* @__PURE__ */ new Date(), nonce: a2, notBefore: o2, requestId: s2, resources: c2, scheme: l2, uri: u2, version: d2 } = e2;
    if (!Number.isInteger(t2)) throw Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${t2}`);
    if (!n2) throw Error(`@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.`);
    if (a2 && a2.length < 8) throw Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${a2}`);
    if (!u2) throw Error(`@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.`);
    if (d2 !== `1`) throw Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${d2}`);
    if ((_a2 = e2.statement) == null ? void 0 : _a2.includes(`
`)) throw Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${e2.statement}`);
    let f2 = Ci(e2.address), p2 = `${l2 ? `${l2}://${n2}` : n2} wants you to sign in with your Ethereum account:
${f2}

${e2.statement ? `${e2.statement}
` : ``}`, m2 = `URI: ${u2}
Version: ${d2}
Chain ID: ${t2}${a2 ? `
Nonce: ${a2}` : ``}
Issued At: ${i2.toISOString()}`;
    if (r2 && (m2 += `
Expiration Time: ${r2.toISOString()}`), o2 && (m2 += `
Not Before: ${o2.toISOString()}`), s2 && (m2 += `
Request ID: ${s2}`), c2) {
      let e3 = `
Resources:`;
      for (let t3 of c2) {
        if (!t3 || typeof t3 != `string`) throw Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${t3}`);
        e3 += `
- ${t3}`;
      }
      m2 += e3;
    }
    return `${p2}
${m2}`;
  }
  var Q = class extends Error {
    constructor({ message: e2, code: t2, cause: n2, name: r2 }) {
      var _a2;
      super(e2, { cause: n2 }), this.__isWebAuthnError = true, this.name = (_a2 = r2 != null ? r2 : n2 instanceof Error ? n2.name : void 0) != null ? _a2 : `Unknown Error`, this.code = t2;
    }
    toJSON() {
      return { name: this.name, message: this.message, code: this.code };
    }
  }, Di = class extends Q {
    constructor(e2, t2) {
      super({ code: `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`, cause: t2, message: e2 }), this.name = `WebAuthnUnknownError`, this.originalError = t2;
    }
  };
  function Oi({ error: e2, options: t2 }) {
    var _a2, _b2, _c2;
    let { publicKey: n2 } = t2;
    if (!n2) throw Error(`options was missing required publicKey property`);
    if (e2.name === `AbortError`) {
      if (t2.signal instanceof AbortSignal) return new Q({ message: `Registration ceremony was sent an abort signal`, code: `ERROR_CEREMONY_ABORTED`, cause: e2 });
    } else if (e2.name === `ConstraintError`) {
      if (((_a2 = n2.authenticatorSelection) == null ? void 0 : _a2.requireResidentKey) === true) return new Q({ message: `Discoverable credentials were required but no available authenticator supported it`, code: `ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT`, cause: e2 });
      if (t2.mediation === `conditional` && ((_b2 = n2.authenticatorSelection) == null ? void 0 : _b2.userVerification) === `required`) return new Q({ message: `User verification was required during automatic registration but it could not be performed`, code: `ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE`, cause: e2 });
      if (((_c2 = n2.authenticatorSelection) == null ? void 0 : _c2.userVerification) === `required`) return new Q({ message: `User verification was required but no available authenticator supported it`, code: `ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT`, cause: e2 });
    } else if (e2.name === `InvalidStateError`) return new Q({ message: `The authenticator was previously registered`, code: `ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED`, cause: e2 });
    else if (e2.name === `NotAllowedError`) return new Q({ message: e2.message, code: `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`, cause: e2 });
    else if (e2.name === `NotSupportedError`) return n2.pubKeyCredParams.filter((e3) => e3.type === `public-key`).length === 0 ? new Q({ message: `No entry in pubKeyCredParams was of type "public-key"`, code: `ERROR_MALFORMED_PUBKEYCREDPARAMS`, cause: e2 }) : new Q({ message: `No available authenticator supported any of the specified pubKeyCredParams algorithms`, code: `ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG`, cause: e2 });
    else if (e2.name === `SecurityError`) {
      let t3 = window.location.hostname;
      if (Fi(t3)) {
        if (n2.rp.id !== t3) return new Q({ message: `The RP ID "${n2.rp.id}" is invalid for this domain`, code: `ERROR_INVALID_RP_ID`, cause: e2 });
      } else return new Q({ message: `${window.location.hostname} is an invalid domain`, code: `ERROR_INVALID_DOMAIN`, cause: e2 });
    } else if (e2.name === `TypeError`) {
      if (n2.user.id.byteLength < 1 || n2.user.id.byteLength > 64) return new Q({ message: `User ID was not between 1 and 64 characters`, code: `ERROR_INVALID_USER_ID_LENGTH`, cause: e2 });
    } else if (e2.name === `UnknownError`) return new Q({ message: `The authenticator was unable to process the specified options, or could not create a new credential`, code: `ERROR_AUTHENTICATOR_GENERAL_ERROR`, cause: e2 });
    return new Q({ message: `a Non-Webauthn related error has occurred`, code: `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`, cause: e2 });
  }
  function ki({ error: e2, options: t2 }) {
    let { publicKey: n2 } = t2;
    if (!n2) throw Error(`options was missing required publicKey property`);
    if (e2.name === `AbortError`) {
      if (t2.signal instanceof AbortSignal) return new Q({ message: `Authentication ceremony was sent an abort signal`, code: `ERROR_CEREMONY_ABORTED`, cause: e2 });
    } else if (e2.name === `NotAllowedError`) return new Q({ message: e2.message, code: `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`, cause: e2 });
    else if (e2.name === `SecurityError`) {
      let t3 = window.location.hostname;
      if (Fi(t3)) {
        if (n2.rpId !== t3) return new Q({ message: `The RP ID "${n2.rpId}" is invalid for this domain`, code: `ERROR_INVALID_RP_ID`, cause: e2 });
      } else return new Q({ message: `${window.location.hostname} is an invalid domain`, code: `ERROR_INVALID_DOMAIN`, cause: e2 });
    } else if (e2.name === `UnknownError`) return new Q({ message: `The authenticator was unable to process the specified options, or could not create a new assertion signature`, code: `ERROR_AUTHENTICATOR_GENERAL_ERROR`, cause: e2 });
    return new Q({ message: `a Non-Webauthn related error has occurred`, code: `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`, cause: e2 });
  }
  let Ai = new class {
    createNewAbortSignal() {
      if (this.controller) {
        let e3 = Error(`Cancelling existing WebAuthn API call for new one`);
        e3.name = `AbortError`, this.controller.abort(e3);
      }
      let e2 = new AbortController();
      return this.controller = e2, e2.signal;
    }
    cancelCeremony() {
      if (this.controller) {
        let e2 = Error(`Manually cancelling existing WebAuthn API call`);
        e2.name = `AbortError`, this.controller.abort(e2), this.controller = void 0;
      }
    }
  }();
  function ji(e2) {
    if (!e2) throw Error(`Credential creation options are required`);
    if (typeof PublicKeyCredential < `u` && `parseCreationOptionsFromJSON` in PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON == `function`) return PublicKeyCredential.parseCreationOptionsFromJSON(e2);
    let { challenge: n2, user: r2, excludeCredentials: i2 } = e2, a2 = t(e2, [`challenge`, `user`, `excludeCredentials`]), o2 = Sr(n2).buffer, s2 = Object.assign(Object.assign({}, r2), { id: Sr(r2.id).buffer }), c2 = Object.assign(Object.assign({}, a2), { challenge: o2, user: s2 });
    if (i2 && i2.length > 0) {
      c2.excludeCredentials = Array(i2.length);
      for (let e3 = 0; e3 < i2.length; e3++) {
        let t2 = i2[e3];
        c2.excludeCredentials[e3] = Object.assign(Object.assign({}, t2), { id: Sr(t2.id).buffer, type: t2.type || `public-key`, transports: t2.transports });
      }
    }
    return c2;
  }
  function Mi(e2) {
    if (!e2) throw Error(`Credential request options are required`);
    if (typeof PublicKeyCredential < `u` && `parseRequestOptionsFromJSON` in PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON == `function`) return PublicKeyCredential.parseRequestOptionsFromJSON(e2);
    let { challenge: n2, allowCredentials: r2 } = e2, i2 = t(e2, [`challenge`, `allowCredentials`]), a2 = Sr(n2).buffer, o2 = Object.assign(Object.assign({}, i2), { challenge: a2 });
    if (r2 && r2.length > 0) {
      o2.allowCredentials = Array(r2.length);
      for (let e3 = 0; e3 < r2.length; e3++) {
        let t2 = r2[e3];
        o2.allowCredentials[e3] = Object.assign(Object.assign({}, t2), { id: Sr(t2.id).buffer, type: t2.type || `public-key`, transports: t2.transports });
      }
    }
    return o2;
  }
  function Ni(e2) {
    var _a2;
    if (`toJSON` in e2 && typeof e2.toJSON == `function`) return e2.toJSON();
    let t2 = e2;
    return { id: e2.id, rawId: e2.id, response: { attestationObject: z(new Uint8Array(e2.response.attestationObject)), clientDataJSON: z(new Uint8Array(e2.response.clientDataJSON)) }, type: `public-key`, clientExtensionResults: e2.getClientExtensionResults(), authenticatorAttachment: (_a2 = t2.authenticatorAttachment) != null ? _a2 : void 0 };
  }
  function Pi(e2) {
    var _a2;
    if (`toJSON` in e2 && typeof e2.toJSON == `function`) return e2.toJSON();
    let t2 = e2, n2 = e2.getClientExtensionResults(), r2 = e2.response;
    return { id: e2.id, rawId: e2.id, response: { authenticatorData: z(new Uint8Array(r2.authenticatorData)), clientDataJSON: z(new Uint8Array(r2.clientDataJSON)), signature: z(new Uint8Array(r2.signature)), userHandle: r2.userHandle ? z(new Uint8Array(r2.userHandle)) : void 0 }, type: `public-key`, clientExtensionResults: n2, authenticatorAttachment: (_a2 = t2.authenticatorAttachment) != null ? _a2 : void 0 };
  }
  function Fi(e2) {
    return e2 === `localhost` || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(e2);
  }
  function Ii() {
    var _a2, _b2;
    return !!(B() && `PublicKeyCredential` in window && window.PublicKeyCredential && `credentials` in navigator && typeof ((_a2 = navigator == null ? void 0 : navigator.credentials) == null ? void 0 : _a2.create) == `function` && typeof ((_b2 = navigator == null ? void 0 : navigator.credentials) == null ? void 0 : _b2.get) == `function`);
  }
  async function Li(e2) {
    try {
      let t2 = await navigator.credentials.create(e2);
      return t2 ? t2 instanceof PublicKeyCredential ? { data: t2, error: null } : { data: null, error: new Di(`Browser returned unexpected credential type`, t2) } : { data: null, error: new Di(`Empty credential response`, t2) };
    } catch (t2) {
      return { data: null, error: Oi({ error: t2, options: e2 }) };
    }
  }
  async function Ri(e2) {
    try {
      let t2 = await navigator.credentials.get(e2);
      return t2 ? t2 instanceof PublicKeyCredential ? { data: t2, error: null } : { data: null, error: new Di(`Browser returned unexpected credential type`, t2) } : { data: null, error: new Di(`Empty credential response`, t2) };
    } catch (t2) {
      return { data: null, error: ki({ error: t2, options: e2 }) };
    }
  }
  let zi = { hints: [`security-key`], authenticatorSelection: { authenticatorAttachment: `cross-platform`, requireResidentKey: false, userVerification: `preferred`, residentKey: `discouraged` }, attestation: `direct` }, Bi = { userVerification: `preferred`, hints: [`security-key`], attestation: `direct` };
  function Vi(...e2) {
    let t2 = (e3) => typeof e3 == `object` && !!e3 && !Array.isArray(e3), n2 = (e3) => e3 instanceof ArrayBuffer || ArrayBuffer.isView(e3), r2 = {};
    for (let i2 of e2) if (i2) for (let e3 in i2) {
      let a2 = i2[e3];
      if (a2 !== void 0) if (Array.isArray(a2)) r2[e3] = a2;
      else if (n2(a2)) r2[e3] = a2;
      else if (t2(a2)) {
        let n3 = r2[e3];
        t2(n3) ? r2[e3] = Vi(n3, a2) : r2[e3] = Vi(a2);
      } else r2[e3] = a2;
    }
    return r2;
  }
  function Hi(e2, t2) {
    return Vi(zi, e2, t2 || {});
  }
  function Ui(e2, t2) {
    return Vi(Bi, e2, t2 || {});
  }
  var Wi = class {
    constructor(e2) {
      this.client = e2, this.enroll = this._enroll.bind(this), this.challenge = this._challenge.bind(this), this.verify = this._verify.bind(this), this.authenticate = this._authenticate.bind(this), this.register = this._register.bind(this);
    }
    async _enroll(e2) {
      return this.client.mfa.enroll(Object.assign(Object.assign({}, e2), { factorType: `webauthn` }));
    }
    async _challenge({ factorId: e2, webauthn: t2, friendlyName: n2, signal: r2 }, i2) {
      var _a2;
      try {
        let { data: a2, error: o2 } = await this.client.mfa.challenge({ factorId: e2, webauthn: t2 });
        if (!a2) return { data: null, error: o2 };
        let s2 = r2 != null ? r2 : Ai.createNewAbortSignal();
        if (a2.webauthn.type === `create`) {
          let { user: e3 } = a2.webauthn.credential_options.publicKey;
          if (!e3.name) {
            let t3 = n2;
            if (t3) e3.name = `${e3.id}:${t3}`;
            else {
              let t4 = (await this.client.getUser()).data.user, n3 = ((_a2 = t4 == null ? void 0 : t4.user_metadata) == null ? void 0 : _a2.name) || (t4 == null ? void 0 : t4.email) || (t4 == null ? void 0 : t4.id) || `User`;
              e3.name = `${e3.id}:${n3}`;
            }
          }
          e3.displayName || (e3.displayName = e3.name);
        }
        switch (a2.webauthn.type) {
          case `create`: {
            let { data: t3, error: n3 } = await Li({ publicKey: Hi(a2.webauthn.credential_options.publicKey, i2 == null ? void 0 : i2.create), signal: s2 });
            return t3 ? { data: { factorId: e2, challengeId: a2.id, webauthn: { type: a2.webauthn.type, credential_response: t3 } }, error: null } : { data: null, error: n3 };
          }
          case `request`: {
            let t3 = Ui(a2.webauthn.credential_options.publicKey, i2 == null ? void 0 : i2.request), { data: n3, error: r3 } = await Ri(Object.assign(Object.assign({}, a2.webauthn.credential_options), { publicKey: t3, signal: s2 }));
            return n3 ? { data: { factorId: e2, challengeId: a2.id, webauthn: { type: a2.webauthn.type, credential_response: n3 } }, error: null } : { data: null, error: r3 };
          }
        }
      } catch (e3) {
        return P(e3) ? { data: null, error: e3 } : { data: null, error: new F(`Unexpected error in challenge`, e3) };
      }
    }
    async _verify({ challengeId: e2, factorId: t2, webauthn: n2 }) {
      return this.client.mfa.verify({ factorId: t2, challengeId: e2, webauthn: n2 });
    }
    async _authenticate({ factorId: e2, webauthn: { rpId: t2 = typeof window < `u` ? window.location.hostname : void 0, rpOrigins: n2 = typeof window < `u` ? [window.location.origin] : void 0, signal: r2 } = {} }, i2) {
      if (!t2) return { data: null, error: new Xn(`rpId is required for WebAuthn authentication`) };
      try {
        if (!Ii()) return { data: null, error: new F(`Browser does not support WebAuthn`, null) };
        let { data: a2, error: o2 } = await this.challenge({ factorId: e2, webauthn: { rpId: t2, rpOrigins: n2 }, signal: r2 }, { request: i2 });
        if (!a2) return { data: null, error: o2 };
        let { webauthn: s2 } = a2;
        return this._verify({ factorId: e2, challengeId: a2.challengeId, webauthn: { type: s2.type, rpId: t2, rpOrigins: n2, credential_response: s2.credential_response } });
      } catch (e3) {
        return P(e3) ? { data: null, error: e3 } : { data: null, error: new F(`Unexpected error in authenticate`, e3) };
      }
    }
    async _register({ friendlyName: e2, webauthn: { rpId: t2 = typeof window < `u` ? window.location.hostname : void 0, rpOrigins: n2 = typeof window < `u` ? [window.location.origin] : void 0, signal: r2 } = {} }, i2) {
      if (!t2) return { data: null, error: new Xn(`rpId is required for WebAuthn registration`) };
      try {
        if (!Ii()) return { data: null, error: new F(`Browser does not support WebAuthn`, null) };
        let { data: a2, error: o2 } = await this._enroll({ friendlyName: e2 });
        if (!a2) return await this.client.mfa.listFactors().then((t3) => {
          var _a2;
          return (_a2 = t3.data) == null ? void 0 : _a2.all.find((t4) => t4.factor_type === `webauthn` && t4.friendly_name === e2 && t4.status === `unverified`);
        }).then((e3) => e3 ? this.client.mfa.unenroll({ factorId: e3 == null ? void 0 : e3.id }) : void 0), { data: null, error: o2 };
        let { data: s2, error: c2 } = await this._challenge({ factorId: a2.id, friendlyName: a2.friendly_name, webauthn: { rpId: t2, rpOrigins: n2 }, signal: r2 }, { create: i2 });
        return s2 ? this._verify({ factorId: a2.id, challengeId: s2.challengeId, webauthn: { rpId: t2, rpOrigins: n2, type: s2.webauthn.type, credential_response: s2.webauthn.credential_response } }) : { data: null, error: c2 };
      } catch (e3) {
        return P(e3) ? { data: null, error: e3 } : { data: null, error: new F(`Unexpected error in register`, e3) };
      }
    }
  };
  Si();
  let Gi = { url: `http://localhost:9999`, storageKey: `supabase.auth.token`, autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, headers: Kn, flowType: `implicit`, debug: false, hasCustomAuthorizationHeader: false, throwOnError: false, lockAcquireTimeout: 5e3, skipAutoInitialize: false, experimental: {} }, $ = {}, Ki = false;
  var qi = class e2 {
    get jwks() {
      var _a2, _b2;
      return (_b2 = (_a2 = $[this.storageKey]) == null ? void 0 : _a2.jwks) != null ? _b2 : { keys: [] };
    }
    set jwks(e3) {
      $[this.storageKey] = Object.assign(Object.assign({}, $[this.storageKey]), { jwks: e3 });
    }
    get jwks_cached_at() {
      var _a2, _b2;
      return (_b2 = (_a2 = $[this.storageKey]) == null ? void 0 : _a2.cachedAt) != null ? _b2 : -(2 ** 53 - 1);
    }
    set jwks_cached_at(e3) {
      $[this.storageKey] = Object.assign(Object.assign({}, $[this.storageKey]), { cachedAt: e3 });
    }
    constructor(t2) {
      var _a2, _b2;
      var n2;
      this.userStorage = null, this.memoryStorage = null, this.stateChangeEmitters = /* @__PURE__ */ new Map(), this.autoRefreshTicker = null, this.autoRefreshTickTimeout = null, this.visibilityChangedCallback = null, this.refreshingDeferred = null, this.lastRefreshFailure = null, this._sessionRemovalEpoch = 0, this.initializePromise = null, this._pendingInitNotifications = null, this.detectSessionInUrl = true, this.hasCustomAuthorizationHeader = false, this.suppressGetSessionWarning = false, this.lock = null, this.lockAcquired = false, this.pendingInLock = [], this.broadcastChannel = null, this.logger = console.log;
      let r2 = Object.assign(Object.assign({}, Gi), t2);
      if (this.storageKey = r2.storageKey, this.instanceID = (_a2 = e2.nextInstanceID[this.storageKey]) != null ? _a2 : 0, e2.nextInstanceID[this.storageKey] = this.instanceID + 1, this.logDebugMessages = !!r2.debug, typeof r2.debug == `function` && (this.logger = r2.debug), this.instanceID > 0 && B()) {
        let e3 = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;
        console.warn(e3), this.logDebugMessages && console.trace(e3);
      }
      if (this.persistSession = r2.persistSession, this.autoRefreshToken = r2.autoRefreshToken, this.experimental = (_b2 = r2.experimental) != null ? _b2 : {}, this.admin = new mi({ url: r2.url, headers: r2.headers, fetch: r2.fetch, experimental: this.experimental }), this.url = r2.url, this.headers = r2.headers, this.fetch = Or(r2.fetch), this.detectSessionInUrl = r2.detectSessionInUrl, this.flowType = r2.flowType, this.hasCustomAuthorizationHeader = r2.hasCustomAuthorizationHeader, this.throwOnError = r2.throwOnError, this.lockAcquireTimeout = r2.lockAcquireTimeout, r2.lock != null && (this.lock = r2.lock, Ki || (Ki = true, console.warn(`${this._logPrefix()} The "lock" option is deprecated and will be removed in v3. The client now coordinates session refreshes without a lock, so most apps can drop the option. See https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/migrations/lockless-coordination.md`))), this.jwks || (this.jwks = { keys: [] }, this.jwks_cached_at = -(2 ** 53 - 1)), this.mfa = { verify: this._verify.bind(this), enroll: this._enroll.bind(this), unenroll: this._unenroll.bind(this), challenge: this._challenge.bind(this), listFactors: this._listFactors.bind(this), challengeAndVerify: this._challengeAndVerify.bind(this), getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this), webauthn: new Wi(this), recoveryCodes: { getStatus: this._getRecoveryCodesStatus.bind(this), generate: this._generateRecoveryCodes.bind(this), verify: this._verifyRecoveryCode.bind(this), regenerate: this._regenerateRecoveryCodes.bind(this), unenroll: this._unenrollRecoveryCodes.bind(this) } }, this.oauth = { getAuthorizationDetails: this._getAuthorizationDetails.bind(this), approveAuthorization: this._approveAuthorization.bind(this), denyAuthorization: this._denyAuthorization.bind(this), listGrants: this._listOAuthGrants.bind(this), revokeGrant: this._revokeOAuthGrant.bind(this) }, this.passkey = { startRegistration: this._startPasskeyRegistration.bind(this), verifyRegistration: this._verifyPasskeyRegistration.bind(this), startAuthentication: this._startPasskeyAuthentication.bind(this), verifyAuthentication: this._verifyPasskeyAuthentication.bind(this), list: this._listPasskeys.bind(this), update: this._updatePasskey.bind(this), delete: this._deletePasskey.bind(this) }, this.persistSession ? (r2.storage ? this.storage = r2.storage : Er() ? this.storage = globalThis.localStorage : (this.memoryStorage = {}, this.storage = hi(this.memoryStorage)), r2.userStorage && (this.userStorage = r2.userStorage)) : (this.memoryStorage = {}, this.storage = hi(this.memoryStorage)), B() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
        try {
          this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
        } catch (e3) {
          console.error(`Failed to create a new BroadcastChannel, multi-tab state changes will not be available`, e3);
        }
        (n2 = this.broadcastChannel) == null || n2.addEventListener(`message`, async (e3) => {
          this._debug(`received broadcast notification from other tab or client`, e3), (e3.data.event === `TOKEN_REFRESHED` || e3.data.event === `SIGNED_IN`) && (this.lastRefreshFailure = null);
          try {
            await this._notifyAllSubscribers(e3.data.event, e3.data.session, false);
          } catch (e4) {
            this._debug(`#broadcastChannel`, `error`, e4);
          }
        });
      }
      r2.skipAutoInitialize || this.initialize().catch((e3) => {
        this._debug(`#initialize()`, `error`, e3);
      });
    }
    isThrowOnErrorEnabled() {
      return this.throwOnError;
    }
    _returnResult(e3) {
      if (this.throwOnError && e3 && e3.error) throw e3.error;
      return e3;
    }
    _logPrefix() {
      return `GoTrueClient@${this.storageKey}:${this.instanceID} (${Wn}) ${(/* @__PURE__ */ new Date()).toISOString()}`;
    }
    _debug(...e3) {
      return this.logDebugMessages && this.logger(this._logPrefix(), ...e3), this;
    }
    async initialize() {
      var _a2;
      if (this.initializePromise) return await this.initializePromise;
      this._pendingInitNotifications = [], this.initializePromise = (async () => this.lock == null ? await this._initialize() : await this._acquireLock(this.lockAcquireTimeout, async () => await this._initialize()))();
      let e3 = await this.initializePromise, t2 = (_a2 = this._pendingInitNotifications) != null ? _a2 : [];
      this._pendingInitNotifications = null;
      for (let e4 of t2) await this._notifyAllSubscribers(e4.event, e4.session, e4.broadcast);
      return e3;
    }
    async _initialize() {
      var _a2;
      try {
        let e3 = {}, t2 = `none`;
        if (B() && (e3 = Dr(window.location.href), this._isImplicitGrantCallback(e3) ? t2 = `implicit` : await this._isPKCECallback(e3) && (t2 = `pkce`)), B() && this.detectSessionInUrl && t2 !== `none`) {
          let { data: n2, error: r2 } = await this._getSessionFromURL(e3, t2);
          if (r2) {
            if (this._debug(`#_initialize()`, `error detecting session from URL`, r2), nr(r2)) {
              let e4 = (_a2 = r2.details) == null ? void 0 : _a2.code;
              if (e4 === `identity_already_exists` || e4 === `identity_not_found` || e4 === `single_identity_not_deletable`) return { error: r2 };
            }
            return { error: r2 };
          }
          let { session: i2, redirectType: a2 } = n2;
          return this._debug(`#_initialize()`, `detected session in URL`, i2, `redirect type`, a2), await this._saveSession(i2), setTimeout(async () => {
            a2 === `recovery` ? await this._notifyAllSubscribers(`PASSWORD_RECOVERY`, i2) : await this._notifyAllSubscribers(`SIGNED_IN`, i2);
          }, 0), { error: null };
        }
        return await this._recoverAndRefresh(), { error: null };
      } catch (e3) {
        return P(e3) ? this._returnResult({ error: e3 }) : this._returnResult({ error: new F(`Unexpected error during initialization`, e3) });
      } finally {
        await this._handleVisibilityChange(), this._debug(`#_initialize()`, `end`);
      }
    }
    async signInAnonymously(e3) {
      var _a2, _b2, _c2;
      try {
        let { data: t2, error: n2 } = await J(this.fetch, `POST`, `${this.url}/signup`, { headers: this.headers, body: { data: (_b2 = (_a2 = e3 == null ? void 0 : e3.options) == null ? void 0 : _a2.data) != null ? _b2 : {}, gotrue_meta_security: { captcha_token: (_c2 = e3 == null ? void 0 : e3.options) == null ? void 0 : _c2.captchaToken } }, xform: Y });
        if (n2 || !t2) return this._returnResult({ data: { user: null, session: null }, error: n2 });
        let r2 = t2.session, i2 = t2.user;
        return t2.session && (await this._saveSession(t2.session), await this._notifyAllSubscribers(`SIGNED_IN`, r2)), this._returnResult({ data: { user: i2, session: r2 }, error: null });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
        throw e4;
      }
    }
    async signUp(e3) {
      var _a2, _b2, _c2;
      let t2 = null;
      try {
        let n2;
        if (`email` in e3) {
          let { email: r3, password: i3, options: a3 } = e3, o3 = null, s2 = null;
          this.flowType === `pkce` && ([o3, s2, t2] = await this._getCodeChallengeAndMethod()), n2 = await J(this.fetch, `POST`, `${this.url}/signup`, { headers: this.headers, redirectTo: this._maybeAppendFlowIdToRedirect(a3 == null ? void 0 : a3.emailRedirectTo, t2), body: { email: r3, password: i3, data: (_a2 = a3 == null ? void 0 : a3.data) != null ? _a2 : {}, gotrue_meta_security: { captcha_token: a3 == null ? void 0 : a3.captchaToken }, code_challenge: o3, code_challenge_method: s2 }, xform: Y });
        } else if (`phone` in e3) {
          let { phone: t3, password: r3, options: i3 } = e3;
          n2 = await J(this.fetch, `POST`, `${this.url}/signup`, { headers: this.headers, body: { phone: t3, password: r3, data: (_b2 = i3 == null ? void 0 : i3.data) != null ? _b2 : {}, channel: (_c2 = i3 == null ? void 0 : i3.channel) != null ? _c2 : `sms`, gotrue_meta_security: { captcha_token: i3 == null ? void 0 : i3.captchaToken } }, xform: Y });
        } else throw new er(`You must provide either an email or phone number and a password`);
        let { data: r2, error: i2 } = n2;
        if (i2 || !r2) return await G(this.storage, this.storageKey, t2), this._returnResult({ data: { user: null, session: null }, error: i2 });
        let a2 = r2.session, o2 = r2.user;
        return r2.session && (await this._saveSession(r2.session), await this._notifyAllSubscribers(`SIGNED_IN`, a2)), this._returnResult({ data: { user: o2, session: a2 }, error: null });
      } catch (e4) {
        if (await G(this.storage, this.storageKey, t2), P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
        throw e4;
      }
    }
    async signInWithPassword(e3) {
      try {
        let t2;
        if (`email` in e3) {
          let { email: n3, password: r3, options: i2 } = e3;
          t2 = await J(this.fetch, `POST`, `${this.url}/token?grant_type=password`, { headers: this.headers, body: { email: n3, password: r3, gotrue_meta_security: { captcha_token: i2 == null ? void 0 : i2.captchaToken } }, xform: ci });
        } else if (`phone` in e3) {
          let { phone: n3, password: r3, options: i2 } = e3;
          t2 = await J(this.fetch, `POST`, `${this.url}/token?grant_type=password`, { headers: this.headers, body: { phone: n3, password: r3, gotrue_meta_security: { captcha_token: i2 == null ? void 0 : i2.captchaToken } }, xform: ci });
        } else throw new er(`You must provide either an email or phone number and a password`);
        let { data: n2, error: r2 } = t2;
        if (r2) return this._returnResult({ data: { user: null, session: null }, error: r2 });
        if (!n2 || !n2.session || !n2.user) {
          let e4 = new R();
          return this._returnResult({ data: { user: null, session: null }, error: e4 });
        }
        return n2.session && (await this._saveSession(n2.session), await this._notifyAllSubscribers(`SIGNED_IN`, n2.session)), this._returnResult({ data: Object.assign({ user: n2.user, session: n2.session }, n2.weak_password ? { weakPassword: n2.weak_password } : null), error: r2 });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
        throw e4;
      }
    }
    async signInWithOAuth(e3) {
      var _a2, _b2, _c2, _d;
      return await this._handleProviderSignIn(e3.provider, { redirectTo: (_a2 = e3.options) == null ? void 0 : _a2.redirectTo, scopes: (_b2 = e3.options) == null ? void 0 : _b2.scopes, queryParams: (_c2 = e3.options) == null ? void 0 : _c2.queryParams, skipBrowserRedirect: (_d = e3.options) == null ? void 0 : _d.skipBrowserRedirect });
    }
    async exchangeCodeForSession(e3, t2) {
      return await this.initializePromise, this.lock == null ? this._exchangeCodeForSession(e3, t2) : this._acquireLock(this.lockAcquireTimeout, async () => this._exchangeCodeForSession(e3, t2));
    }
    async signInWithWeb3(e3) {
      let { chain: t2 } = e3;
      switch (t2) {
        case `ethereum`:
          return await this.signInWithEthereum(e3);
        case `solana`:
          return await this.signInWithSolana(e3);
        default:
          throw Error(`@supabase/auth-js: Unsupported chain "${t2}"`);
      }
    }
    async signInWithEthereum(e3) {
      var _a2, _b2, _c2, _d, _e2, _f, _g, _h, _i2, _j, _k;
      let t2, n2;
      if (`message` in e3) t2 = e3.message, n2 = e3.signature;
      else {
        let { chain: r2, wallet: i2, statement: a2, options: o2 } = e3, s2;
        if (B()) if (typeof i2 == `object`) s2 = i2;
        else {
          let e4 = window;
          if (`ethereum` in e4 && typeof e4.ethereum == `object` && `request` in e4.ethereum && typeof e4.ethereum.request == `function`) s2 = e4.ethereum;
          else throw Error(`@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.`);
        }
        else {
          if (typeof i2 != `object` || !(o2 == null ? void 0 : o2.url)) throw Error(`@supabase/auth-js: Both wallet and url must be specified in non-browser environments.`);
          s2 = i2;
        }
        let c2 = new URL((_a2 = o2 == null ? void 0 : o2.url) != null ? _a2 : window.location.href), l2 = await s2.request({ method: `eth_requestAccounts` }).then((e4) => e4).catch(() => {
          throw Error(`@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid`);
        });
        if (!l2 || l2.length === 0) throw Error(`@supabase/auth-js: No accounts available. Please ensure the wallet is connected.`);
        let u2 = Ci(l2[0]), d2 = (_b2 = o2 == null ? void 0 : o2.signInWithEthereum) == null ? void 0 : _b2.chainId;
        d2 || (d2 = wi(await s2.request({ method: `eth_chainId` }))), t2 = Ei({ domain: c2.host, address: u2, statement: a2, uri: c2.href, version: `1`, chainId: d2, nonce: (_c2 = o2 == null ? void 0 : o2.signInWithEthereum) == null ? void 0 : _c2.nonce, issuedAt: (_e2 = (_d = o2 == null ? void 0 : o2.signInWithEthereum) == null ? void 0 : _d.issuedAt) != null ? _e2 : /* @__PURE__ */ new Date(), expirationTime: (_f = o2 == null ? void 0 : o2.signInWithEthereum) == null ? void 0 : _f.expirationTime, notBefore: (_g = o2 == null ? void 0 : o2.signInWithEthereum) == null ? void 0 : _g.notBefore, requestId: (_h = o2 == null ? void 0 : o2.signInWithEthereum) == null ? void 0 : _h.requestId, resources: (_i2 = o2 == null ? void 0 : o2.signInWithEthereum) == null ? void 0 : _i2.resources }), n2 = await s2.request({ method: `personal_sign`, params: [Ti(t2), u2] });
      }
      try {
        let { data: r2, error: i2 } = await J(this.fetch, `POST`, `${this.url}/token?grant_type=web3`, { headers: this.headers, body: Object.assign({ chain: `ethereum`, message: t2, signature: n2 }, ((_j = e3.options) == null ? void 0 : _j.captchaToken) ? { gotrue_meta_security: { captcha_token: (_k = e3.options) == null ? void 0 : _k.captchaToken } } : null), xform: Y });
        if (i2) throw i2;
        if (!r2 || !r2.session || !r2.user) {
          let e4 = new R();
          return this._returnResult({ data: { user: null, session: null }, error: e4 });
        }
        return r2.session && (await this._saveSession(r2.session), await this._notifyAllSubscribers(`SIGNED_IN`, r2.session)), this._returnResult({ data: Object.assign({}, r2), error: i2 });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
        throw e4;
      }
    }
    async signInWithSolana(e3) {
      var _a2, _b2, _c2, _d, _e2, _f, _g, _h, _i2, _j, _k, _l;
      let t2, n2;
      if (`message` in e3) t2 = e3.message, n2 = e3.signature;
      else {
        let { chain: r2, wallet: i2, statement: a2, options: o2 } = e3, s2;
        if (B()) if (typeof i2 == `object`) s2 = i2;
        else {
          let e4 = window;
          if (`solana` in e4 && typeof e4.solana == `object` && (`signIn` in e4.solana && typeof e4.solana.signIn == `function` || `signMessage` in e4.solana && typeof e4.solana.signMessage == `function`)) s2 = e4.solana;
          else throw Error(`@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.`);
        }
        else {
          if (typeof i2 != `object` || !(o2 == null ? void 0 : o2.url)) throw Error(`@supabase/auth-js: Both wallet and url must be specified in non-browser environments.`);
          s2 = i2;
        }
        let c2 = new URL((_a2 = o2 == null ? void 0 : o2.url) != null ? _a2 : window.location.href);
        if (`signIn` in s2 && s2.signIn) {
          let e4 = await s2.signIn(Object.assign(Object.assign(Object.assign({ issuedAt: (/* @__PURE__ */ new Date()).toISOString() }, o2 == null ? void 0 : o2.signInWithSolana), { version: `1`, domain: c2.host, uri: c2.href }), a2 ? { statement: a2 } : null)), r3;
          if (Array.isArray(e4) && e4[0] && typeof e4[0] == `object`) r3 = e4[0];
          else if (e4 && typeof e4 == `object` && `signedMessage` in e4 && `signature` in e4) r3 = e4;
          else throw Error(`@supabase/auth-js: Wallet method signIn() returned unrecognized value`);
          if (`signedMessage` in r3 && `signature` in r3 && (typeof r3.signedMessage == `string` || r3.signedMessage instanceof Uint8Array) && r3.signature instanceof Uint8Array) t2 = typeof r3.signedMessage == `string` ? r3.signedMessage : new TextDecoder().decode(r3.signedMessage), n2 = r3.signature;
          else throw Error(`@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields`);
        } else {
          if (!(`signMessage` in s2) || typeof s2.signMessage != `function` || !(`publicKey` in s2) || typeof s2 != `object` || !s2.publicKey || !(`toBase58` in s2.publicKey) || typeof s2.publicKey.toBase58 != `function`) throw Error(`@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API`);
          t2 = [`${c2.host} wants you to sign in with your Solana account:`, s2.publicKey.toBase58(), ...a2 ? [``, a2, ``] : [``], `Version: 1`, `URI: ${c2.href}`, `Issued At: ${(_c2 = (_b2 = o2 == null ? void 0 : o2.signInWithSolana) == null ? void 0 : _b2.issuedAt) != null ? _c2 : (/* @__PURE__ */ new Date()).toISOString()}`, ...((_d = o2 == null ? void 0 : o2.signInWithSolana) == null ? void 0 : _d.notBefore) ? [`Not Before: ${o2.signInWithSolana.notBefore}`] : [], ...((_e2 = o2 == null ? void 0 : o2.signInWithSolana) == null ? void 0 : _e2.expirationTime) ? [`Expiration Time: ${o2.signInWithSolana.expirationTime}`] : [], ...((_f = o2 == null ? void 0 : o2.signInWithSolana) == null ? void 0 : _f.chainId) ? [`Chain ID: ${o2.signInWithSolana.chainId}`] : [], ...((_g = o2 == null ? void 0 : o2.signInWithSolana) == null ? void 0 : _g.nonce) ? [`Nonce: ${o2.signInWithSolana.nonce}`] : [], ...((_h = o2 == null ? void 0 : o2.signInWithSolana) == null ? void 0 : _h.requestId) ? [`Request ID: ${o2.signInWithSolana.requestId}`] : [], ...((_j = (_i2 = o2 == null ? void 0 : o2.signInWithSolana) == null ? void 0 : _i2.resources) == null ? void 0 : _j.length) ? [`Resources`, ...o2.signInWithSolana.resources.map((e5) => `- ${e5}`)] : []].join(`
`);
          let e4 = await s2.signMessage(new TextEncoder().encode(t2), `utf8`);
          if (!e4 || !(e4 instanceof Uint8Array)) throw Error(`@supabase/auth-js: Wallet signMessage() API returned an recognized value`);
          n2 = e4;
        }
      }
      try {
        let { data: r2, error: i2 } = await J(this.fetch, `POST`, `${this.url}/token?grant_type=web3`, { headers: this.headers, body: Object.assign({ chain: `solana`, message: t2, signature: z(n2) }, ((_k = e3.options) == null ? void 0 : _k.captchaToken) ? { gotrue_meta_security: { captcha_token: (_l = e3.options) == null ? void 0 : _l.captchaToken } } : null), xform: Y });
        if (i2) throw i2;
        if (!r2 || !r2.session || !r2.user) {
          let e4 = new R();
          return this._returnResult({ data: { user: null, session: null }, error: e4 });
        }
        return r2.session && (await this._saveSession(r2.session), await this._notifyAllSubscribers(`SIGNED_IN`, r2.session)), this._returnResult({ data: Object.assign({}, r2), error: i2 });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
        throw e4;
      }
    }
    async _exchangeCodeForSession(e3, t2) {
      let n2 = (t2 == null ? void 0 : t2.flowId) != null, r2 = n2 ? zr(t2 == null ? void 0 : t2.flowId) : B() ? zr(Dr(window.location.href)[N]) : null;
      n2 && !r2 && this._debug(`#_exchangeCodeForSession()`, `provided flowId is not a valid flow id`, t2 == null ? void 0 : t2.flowId);
      let { verifier: i2, flowId: a2 } = n2 && !r2 ? { verifier: null, flowId: null } : await Gr(this.storage, this.storageKey, r2), [o2, s2] = (i2 != null ? i2 : ``).split(`/`);
      try {
        if (!o2 && this.flowType === `pkce`) throw new ir();
        let { data: t3, error: n3 } = await J(this.fetch, `POST`, `${this.url}/token?grant_type=pkce`, { headers: this.headers, body: { auth_code: e3, code_verifier: o2 }, xform: Y });
        if (await G(this.storage, this.storageKey, a2), n3) throw n3;
        if (!t3 || !t3.session || !t3.user) {
          let e4 = new R();
          return this._returnResult({ data: { user: null, session: null, redirectType: null }, error: e4 });
        }
        return t3.session && (await this._saveSession(t3.session), await this._notifyAllSubscribers(s2 === `recovery` ? `PASSWORD_RECOVERY` : `SIGNED_IN`, t3.session)), this._returnResult({ data: Object.assign(Object.assign({}, t3), { redirectType: s2 != null ? s2 : null }), error: n3 });
      } catch (e4) {
        if (await G(this.storage, this.storageKey, a2), P(e4)) return this._returnResult({ data: { user: null, session: null, redirectType: null }, error: e4 });
        throw e4;
      }
    }
    async signInWithIdToken(e3) {
      try {
        let { options: t2, provider: n2, token: r2, access_token: i2, nonce: a2 } = e3, { data: o2, error: s2 } = await J(this.fetch, `POST`, `${this.url}/token?grant_type=id_token`, { headers: this.headers, body: { provider: n2, id_token: r2, access_token: i2, nonce: a2, gotrue_meta_security: { captcha_token: t2 == null ? void 0 : t2.captchaToken } }, xform: Y });
        if (s2) return this._returnResult({ data: { user: null, session: null }, error: s2 });
        if (!o2 || !o2.session || !o2.user) {
          let e4 = new R();
          return this._returnResult({ data: { user: null, session: null }, error: e4 });
        }
        return o2.session && (await this._saveSession(o2.session), await this._notifyAllSubscribers(`SIGNED_IN`, o2.session)), this._returnResult({ data: o2, error: s2 });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
        throw e4;
      }
    }
    async signInWithOtp(e3) {
      var _a2, _b2, _c2, _d, _e2;
      let t2 = null;
      try {
        if (`email` in e3) {
          let { email: n2, options: r2 } = e3, i2 = null, a2 = null;
          this.flowType === `pkce` && ([i2, a2, t2] = await this._getCodeChallengeAndMethod());
          let { error: o2 } = await J(this.fetch, `POST`, `${this.url}/otp`, { headers: this.headers, body: { email: n2, data: (_a2 = r2 == null ? void 0 : r2.data) != null ? _a2 : {}, create_user: (_b2 = r2 == null ? void 0 : r2.shouldCreateUser) != null ? _b2 : true, gotrue_meta_security: { captcha_token: r2 == null ? void 0 : r2.captchaToken }, code_challenge: i2, code_challenge_method: a2 }, redirectTo: this._maybeAppendFlowIdToRedirect(r2 == null ? void 0 : r2.emailRedirectTo, t2) });
          return this._returnResult({ data: { user: null, session: null }, error: o2 });
        }
        if (`phone` in e3) {
          let { phone: t3, options: n2 } = e3, { data: r2, error: i2 } = await J(this.fetch, `POST`, `${this.url}/otp`, { headers: this.headers, body: { phone: t3, data: (_c2 = n2 == null ? void 0 : n2.data) != null ? _c2 : {}, create_user: (_d = n2 == null ? void 0 : n2.shouldCreateUser) != null ? _d : true, gotrue_meta_security: { captcha_token: n2 == null ? void 0 : n2.captchaToken }, channel: (_e2 = n2 == null ? void 0 : n2.channel) != null ? _e2 : `sms` } });
          return this._returnResult({ data: { user: null, session: null, messageId: r2 == null ? void 0 : r2.message_id }, error: i2 });
        }
        throw new er(`You must provide either an email or phone number.`);
      } catch (e4) {
        if (await G(this.storage, this.storageKey, t2), P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
        throw e4;
      }
    }
    async verifyOtp(e3) {
      var _a2, _b2;
      try {
        let t2, n2;
        `options` in e3 && (t2 = (_a2 = e3.options) == null ? void 0 : _a2.redirectTo, n2 = (_b2 = e3.options) == null ? void 0 : _b2.captchaToken);
        let { data: r2, error: i2 } = await J(this.fetch, `POST`, `${this.url}/verify`, { headers: this.headers, body: Object.assign(Object.assign({}, e3), { gotrue_meta_security: { captcha_token: n2 } }), redirectTo: t2, xform: Y });
        if (i2) throw i2;
        if (!r2) throw Error(`An error occurred on token verification.`);
        let a2 = r2.session, o2 = r2.user;
        return (a2 == null ? void 0 : a2.access_token) && (await this._saveSession(a2), await this._notifyAllSubscribers(e3.type == `recovery` ? `PASSWORD_RECOVERY` : `SIGNED_IN`, a2)), this._returnResult({ data: { user: o2, session: a2 }, error: null });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
        throw e4;
      }
    }
    async signInWithSSO(e3) {
      var _a2, _b2, _c2, _d;
      let t2 = null;
      try {
        let n2 = null, r2 = null;
        this.flowType === `pkce` && ([n2, r2, t2] = await this._getCodeChallengeAndMethod());
        let i2 = await J(this.fetch, `POST`, `${this.url}/sso`, { body: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, `providerId` in e3 ? { provider_id: e3.providerId } : null), `domain` in e3 ? { domain: e3.domain } : null), { redirect_to: this._maybeAppendFlowIdToRedirect((_a2 = e3.options) == null ? void 0 : _a2.redirectTo, t2) }), ((_b2 = e3 == null ? void 0 : e3.options) == null ? void 0 : _b2.captchaToken) ? { gotrue_meta_security: { captcha_token: e3.options.captchaToken } } : null), { skip_http_redirect: true, code_challenge: n2, code_challenge_method: r2 }), headers: this.headers, xform: li });
        return ((_c2 = i2.data) == null ? void 0 : _c2.url) && B() && !((_d = e3.options) == null ? void 0 : _d.skipBrowserRedirect) && window.location.assign(i2.data.url), this._returnResult(i2);
      } catch (e4) {
        if (await G(this.storage, this.storageKey, t2), P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async reauthenticate() {
      return await this.initializePromise, this.lock == null ? await this._reauthenticate() : await this._acquireLock(this.lockAcquireTimeout, async () => await this._reauthenticate());
    }
    async _reauthenticate() {
      try {
        return await this._useSession(async (e3) => {
          let { data: { session: t2 }, error: n2 } = e3;
          if (n2) throw n2;
          if (!t2) throw new L();
          let { error: r2 } = await J(this.fetch, `GET`, `${this.url}/reauthenticate`, { headers: this.headers, jwt: t2.access_token });
          return this._returnResult({ data: { user: null, session: null }, error: r2 });
        });
      } catch (e3) {
        if (P(e3)) return this._returnResult({ data: { user: null, session: null }, error: e3 });
        throw e3;
      }
    }
    async resend(e3) {
      let t2 = null;
      try {
        let n2 = `${this.url}/resend`;
        if (`email` in e3) {
          let { email: r2, type: i2, options: a2 } = e3, o2 = null, s2 = null;
          this.flowType === `pkce` && ([o2, s2, t2] = await this._getCodeChallengeAndMethod());
          let { error: c2 } = await J(this.fetch, `POST`, n2, { headers: this.headers, body: { email: r2, type: i2, gotrue_meta_security: { captcha_token: a2 == null ? void 0 : a2.captchaToken }, code_challenge: o2, code_challenge_method: s2 }, redirectTo: this._maybeAppendFlowIdToRedirect(a2 == null ? void 0 : a2.emailRedirectTo, t2) });
          return c2 && await G(this.storage, this.storageKey, t2), this._returnResult({ data: { user: null, session: null }, error: c2 });
        } else if (`phone` in e3) {
          let { phone: t3, type: r2, options: i2 } = e3, { data: a2, error: o2 } = await J(this.fetch, `POST`, n2, { headers: this.headers, body: { phone: t3, type: r2, gotrue_meta_security: { captcha_token: i2 == null ? void 0 : i2.captchaToken } } });
          return this._returnResult({ data: { user: null, session: null, messageId: a2 == null ? void 0 : a2.message_id }, error: o2 });
        }
        throw new er(`You must provide either an email or phone number and a type`);
      } catch (e4) {
        if (await G(this.storage, this.storageKey, t2), P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
        throw e4;
      }
    }
    async getSession() {
      return await this.initializePromise, this.lock == null ? await this._useSession(async (e3) => e3) : await this._acquireLock(this.lockAcquireTimeout, async () => this._useSession(async (e3) => e3));
    }
    async _acquireLock(e3, t2) {
      this._debug(`#_acquireLock`, `begin`, e3);
      try {
        if (this.lockAcquired) {
          let e4 = this.pendingInLock.length ? this.pendingInLock[this.pendingInLock.length - 1] : Promise.resolve(), n2 = (async () => (await e4, await t2()))();
          return this.pendingInLock.push((async () => {
            try {
              await n2;
            } catch (e5) {
            }
          })()), n2;
        }
        return await this.lock(`lock:${this.storageKey}`, e3, async () => {
          this._debug(`#_acquireLock`, `lock acquired for storage key`, this.storageKey);
          try {
            this.lockAcquired = true;
            let e4 = t2();
            for (this.pendingInLock.push((async () => {
              try {
                await e4;
              } catch (e5) {
              }
            })()), await e4; this.pendingInLock.length; ) {
              let e5 = [...this.pendingInLock];
              await Promise.all(e5), this.pendingInLock.splice(0, e5.length);
            }
            return await e4;
          } finally {
            this._debug(`#_acquireLock`, `lock released for storage key`, this.storageKey), this.lockAcquired = false;
          }
        });
      } finally {
        this._debug(`#_acquireLock`, `end`);
      }
    }
    async _useSession(e3) {
      this._debug(`#_useSession`, `begin`);
      try {
        return await e3(await this.__loadSession());
      } finally {
        this._debug(`#_useSession`, `end`);
      }
    }
    async __loadSession() {
      this._debug(`#__loadSession()`, `begin`), this.lock != null && !this.lockAcquired && this._debug(`#__loadSession()`, `used outside of an acquired lock!`, Error().stack);
      try {
        let e3 = null, t2 = await U(this.storage, this.storageKey);
        if (this._debug(`#getSession()`, `session from storage`, t2), t2 !== null && (this._isValidSession(t2) ? e3 = t2 : (this._debug(`#getSession()`, `session from storage is not valid`), await this._removeSession())), !e3) return { data: { session: null }, error: null };
        let n2 = e3.expires_at ? e3.expires_at * 1e3 - Date.now() < Gn : false;
        if (this._debug(`#__loadSession()`, `session has${n2 ? `` : ` not`} expired`, `expires_at`, e3.expires_at), !n2) return { data: { session: await this._hydrateSessionUser(e3) }, error: null };
        let { data: r2, error: i2 } = await this._callRefreshToken(e3.refresh_token);
        if (i2) {
          let e4 = await U(this.storage, this.storageKey);
          return e4 && this._isValidSession(e4) && e4.expires_at && e4.expires_at * 1e3 > Date.now() ? this._returnResult({ data: { session: await this._hydrateSessionUser(e4) }, error: null }) : this._returnResult({ data: { session: null }, error: i2 });
        }
        return this._returnResult({ data: { session: r2 }, error: null });
      } finally {
        this._debug(`#__loadSession()`, `end`);
      }
    }
    async _hydrateSessionUser(e3) {
      if (this.userStorage) {
        let t2 = await U(this.userStorage, this.storageKey + `-user`);
        e3.user = (t2 == null ? void 0 : t2.user) ? t2.user : ti();
      }
      if (this.storage.isServer && e3.user && !e3.user.__isUserNotAvailableProxy) {
        let t2 = { value: this.suppressGetSessionWarning };
        e3.user = ni(e3.user, t2), t2.value && (this.suppressGetSessionWarning = true);
      }
      return e3;
    }
    async getUser(e3) {
      if (e3) return await this._getUser(e3);
      await this.initializePromise;
      let t2;
      return t2 = this.lock == null ? await this._getUser() : await this._acquireLock(this.lockAcquireTimeout, async () => await this._getUser()), t2.data.user && (this.suppressGetSessionWarning = true), t2;
    }
    async _getUser(e3) {
      try {
        return e3 ? await J(this.fetch, `GET`, `${this.url}/user`, { headers: this.headers, jwt: e3, xform: X }) : await this._useSession(async (e4) => {
          var _a2, _b2, _c2;
          let { data: t2, error: n2 } = e4;
          if (n2) throw n2;
          return !((_a2 = t2.session) == null ? void 0 : _a2.access_token) && !this.hasCustomAuthorizationHeader ? { data: { user: null }, error: new L() } : await J(this.fetch, `GET`, `${this.url}/user`, { headers: this.headers, jwt: (_c2 = (_b2 = t2.session) == null ? void 0 : _b2.access_token) != null ? _c2 : void 0, xform: X });
        });
      } catch (e4) {
        if (P(e4)) return $n(e4) && await this._removeSession(), this._returnResult({ data: { user: null }, error: e4 });
        throw e4;
      }
    }
    async updateUser(e3, t2 = {}) {
      return await this.initializePromise, this.lock == null ? await this._updateUser(e3, t2) : await this._acquireLock(this.lockAcquireTimeout, async () => await this._updateUser(e3, t2));
    }
    async _updateUser(e3, t2 = {}) {
      let n2 = null;
      try {
        return await this._useSession(async (r2) => {
          let { data: i2, error: a2 } = r2;
          if (a2) throw a2;
          if (!i2.session) throw new L();
          let o2 = i2.session, s2 = null, c2 = null;
          this.flowType === `pkce` && e3.email != null && ([s2, c2, n2] = await this._getCodeChallengeAndMethod());
          let { data: l2, error: u2 } = await J(this.fetch, `PUT`, `${this.url}/user`, { headers: this.headers, redirectTo: this._maybeAppendFlowIdToRedirect(t2 == null ? void 0 : t2.emailRedirectTo, n2), body: Object.assign(Object.assign({}, e3), { code_challenge: s2, code_challenge_method: c2 }), jwt: o2.access_token, xform: X });
          if (u2) throw u2;
          return o2.user = l2.user, await this._saveSession(o2), await this._notifyAllSubscribers(`USER_UPDATED`, o2), this._returnResult({ data: { user: o2.user }, error: null });
        });
      } catch (e4) {
        if (await G(this.storage, this.storageKey, n2), P(e4)) return this._returnResult({ data: { user: null }, error: e4 });
        throw e4;
      }
    }
    async setSession(e3) {
      return await this.initializePromise, this.lock == null ? await this._setSession(e3) : await this._acquireLock(this.lockAcquireTimeout, async () => await this._setSession(e3));
    }
    async _setSession(e3) {
      try {
        if (!e3.access_token || !e3.refresh_token) throw new L();
        let t2 = Date.now() / 1e3, n2 = t2, r2 = true, i2 = null, { payload: a2 } = jr(e3.access_token);
        if (a2.exp && (n2 = a2.exp, r2 = n2 <= t2), r2) {
          let { data: t3, error: n3 } = await this._callRefreshToken(e3.refresh_token);
          if (n3) return this._returnResult({ data: { user: null, session: null }, error: n3 });
          if (!t3) return { data: { user: null, session: null }, error: null };
          i2 = t3;
        } else {
          let { data: r3, error: a3 } = await this._getUser(e3.access_token);
          if (a3) return this._returnResult({ data: { user: null, session: null }, error: a3 });
          i2 = { access_token: e3.access_token, refresh_token: e3.refresh_token, user: r3.user, token_type: `bearer`, expires_in: n2 - t2, expires_at: n2 }, await this._saveSession(i2), await this._notifyAllSubscribers(`SIGNED_IN`, i2);
        }
        return this._returnResult({ data: { user: i2.user, session: i2 }, error: null });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: { session: null, user: null }, error: e4 });
        throw e4;
      }
    }
    async refreshSession(e3) {
      return await this.initializePromise, this.lock == null ? await this._refreshSession(e3) : await this._acquireLock(this.lockAcquireTimeout, async () => await this._refreshSession(e3));
    }
    async _refreshSession(e3) {
      try {
        return await this._useSession(async (t2) => {
          var _a2;
          if (!e3) {
            let { data: n3, error: r3 } = t2;
            if (r3) throw r3;
            e3 = (_a2 = n3.session) != null ? _a2 : void 0;
          }
          if (!(e3 == null ? void 0 : e3.refresh_token)) throw new L();
          let { data: n2, error: r2 } = await this._callRefreshToken(e3.refresh_token);
          return r2 ? this._returnResult({ data: { user: null, session: null }, error: r2 }) : n2 ? this._returnResult({ data: { user: n2.user, session: n2 }, error: null }) : this._returnResult({ data: { user: null, session: null }, error: null });
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
        throw e4;
      }
    }
    async _getSessionFromURL(e3, t2) {
      var _a2;
      try {
        if (!B()) throw new tr(`No browser detected.`);
        if (e3.error || e3.error_description || e3.error_code) throw new tr(e3.error_description || `Error in URL with unspecified error_description`, { error: e3.error || `unspecified_error`, code: e3.error_code || `unspecified_code` });
        switch (t2) {
          case `implicit`:
            if (this.flowType === `pkce`) throw new rr(`Not a valid PKCE flow url.`);
            break;
          case `pkce`:
            if (this.flowType === `implicit`) throw new tr(`Not a valid implicit grant flow url.`);
            break;
          default:
        }
        if (t2 === `pkce`) {
          if (this._debug(`#_initialize()`, `begin`, `is PKCE flow`, true), !e3.code) throw new rr(`No code detected.`);
          let { data: t3, error: n3 } = await this._exchangeCodeForSession(e3.code, { flowId: e3[N] });
          if (n3) throw n3;
          let r3 = new URL(window.location.href);
          return r3.searchParams.delete(`code`), r3.searchParams.delete(N), window.history.replaceState(window.history.state, ``, r3.toString()), { data: { session: t3.session, redirectType: (_a2 = t3.redirectType) != null ? _a2 : null }, error: null };
        }
        let { provider_token: n2, provider_refresh_token: r2, access_token: i2, refresh_token: a2, expires_in: o2, expires_at: s2, token_type: c2 } = e3;
        if (!i2 || !o2 || !a2 || !c2) throw new tr(`No session defined in URL`);
        let l2 = Math.round(Date.now() / 1e3), u2 = parseInt(o2), d2 = l2 + u2;
        s2 && (d2 = parseInt(s2));
        let f2 = d2 - l2;
        f2 * 1e3 <= M && console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${f2}s, should have been closer to ${u2}s`);
        let p2 = d2 - u2;
        l2 - p2 >= 120 ? console.warn(`@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale`, p2, d2, l2) : l2 - p2 < 0 && console.warn(`@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew`, p2, d2, l2);
        let { data: m2, error: h2 } = await this._getUser(i2);
        if (h2) throw h2;
        let g2 = { provider_token: n2, provider_refresh_token: r2, access_token: i2, expires_in: u2, expires_at: d2, refresh_token: a2, token_type: c2, user: m2.user };
        return window.location.hash = ``, this._debug(`#_getSessionFromURL()`, `clearing window.location.hash`), this._returnResult({ data: { session: g2, redirectType: e3.type }, error: null });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: { session: null, redirectType: null }, error: e4 });
        throw e4;
      }
    }
    _isImplicitGrantCallback(e3) {
      return typeof this.detectSessionInUrl == `function` ? this.detectSessionInUrl(new URL(window.location.href), e3) : !!(e3.access_token || e3.error || e3.error_description || e3.error_code);
    }
    async _isPKCECallback(e3) {
      if (!e3.code) return false;
      let t2 = zr(e3[N]);
      return t2 && await U(this.storage, Vr(this.storageKey, t2)) ? true : !!await U(this.storage, `${this.storageKey}-code-verifier`);
    }
    async signOut(e3 = { scope: `global` }) {
      return await this.initializePromise, this.lock == null ? await this._signOut(e3) : await this._acquireLock(this.lockAcquireTimeout, async () => await this._signOut(e3));
    }
    async _signOut({ scope: e3 } = { scope: `global` }) {
      return await this._useSession(async (t2) => {
        var _a2;
        let n2 = async () => {
          await this._removeSession();
        }, { data: r2, error: i2 } = t2;
        if (i2 && !$n(i2)) return this._returnResult({ error: i2 });
        let a2 = (_a2 = r2.session) == null ? void 0 : _a2.access_token;
        if (a2) {
          let { error: t3 } = await this.admin.signOut(a2, e3);
          if (t3 && !(Qn(t3) && (t3.status === 404 || t3.status === 401 || t3.status === 403) || $n(t3))) return e3 !== `others` && await n2(), this._returnResult({ error: t3 });
        }
        return e3 !== `others` && await n2(), this._returnResult({ error: null });
      });
    }
    onAuthStateChange(e3) {
      let t2 = Tr(), n2 = { id: t2, callback: e3, unsubscribe: () => {
        this._debug(`#unsubscribe()`, `state change callback with id removed`, t2), this.stateChangeEmitters.delete(t2);
      } };
      return this._debug(`#onAuthStateChange()`, `registered callback with id`, t2), this.stateChangeEmitters.set(t2, n2), (async () => {
        await this.initializePromise, this.lock == null ? await this._emitInitialSession(t2) : await this._acquireLock(this.lockAcquireTimeout, async () => {
          this._emitInitialSession(t2);
        });
      })(), { data: { subscription: n2 } };
    }
    async _emitInitialSession(e3) {
      return await this._useSession(async (t2) => {
        var _a2, _b2;
        try {
          let { data: { session: n2 }, error: r2 } = t2;
          if (r2) throw r2;
          await ((_a2 = this.stateChangeEmitters.get(e3)) == null ? void 0 : _a2.callback(`INITIAL_SESSION`, n2)), this._debug(`INITIAL_SESSION`, `callback id`, e3, `session`, n2);
        } catch (t3) {
          if (await ((_b2 = this.stateChangeEmitters.get(e3)) == null ? void 0 : _b2.callback(`INITIAL_SESSION`, null)), this._debug(`INITIAL_SESSION`, `callback id`, e3, `error`, t3), lr(t3)) return;
          $n(t3) || sr(t3) || Qn(t3) && (t3.code === `refresh_token_not_found` || t3.code === `refresh_token_already_used` || t3.code === `session_expired`) ? console.warn(t3) : console.error(t3);
        }
      });
    }
    async resetPasswordForEmail(e3, t2 = {}) {
      let n2 = null, r2 = null, i2 = null;
      this.flowType === `pkce` && ([n2, r2, i2] = await this._getCodeChallengeAndMethod(true));
      try {
        return await J(this.fetch, `POST`, `${this.url}/recover`, { body: { email: e3, code_challenge: n2, code_challenge_method: r2, gotrue_meta_security: { captcha_token: t2.captchaToken } }, headers: this.headers, redirectTo: this._maybeAppendFlowIdToRedirect(t2.redirectTo, i2) });
      } catch (e4) {
        if (await G(this.storage, this.storageKey, i2), P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async getUserIdentities() {
      var _a2;
      try {
        let { data: e3, error: t2 } = await this.getUser();
        if (t2) throw t2;
        return this._returnResult({ data: { identities: (_a2 = e3.user.identities) != null ? _a2 : [] }, error: null });
      } catch (e3) {
        if (P(e3)) return this._returnResult({ data: null, error: e3 });
        throw e3;
      }
    }
    async linkIdentity(e3) {
      return `token` in e3 ? this.linkIdentityIdToken(e3) : this.linkIdentityOAuth(e3);
    }
    async linkIdentityOAuth(e3) {
      var _a2;
      let t2 = null;
      try {
        let { data: n2, error: r2 } = await this._useSession(async (n3) => {
          var _a3, _b2, _c2, _d, _e2;
          let { data: r3, error: i2 } = n3;
          if (i2) throw i2;
          let { url: a2, flowId: o2 } = await this._getUrlForProvider(`${this.url}/user/identities/authorize`, e3.provider, { redirectTo: (_a3 = e3.options) == null ? void 0 : _a3.redirectTo, scopes: (_b2 = e3.options) == null ? void 0 : _b2.scopes, queryParams: (_c2 = e3.options) == null ? void 0 : _c2.queryParams, skipBrowserRedirect: true });
          return t2 = o2, await J(this.fetch, `GET`, a2, { headers: this.headers, jwt: (_e2 = (_d = r3.session) == null ? void 0 : _d.access_token) != null ? _e2 : void 0 });
        });
        if (r2) throw r2;
        return B() && !((_a2 = e3.options) == null ? void 0 : _a2.skipBrowserRedirect) && window.location.assign(n2 == null ? void 0 : n2.url), this._returnResult({ data: { provider: e3.provider, url: n2 == null ? void 0 : n2.url, flowId: t2 }, error: null });
      } catch (n2) {
        if (P(n2)) return this._returnResult({ data: { provider: e3.provider, url: null, flowId: t2 }, error: n2 });
        throw n2;
      }
    }
    async linkIdentityIdToken(e3) {
      return await this._useSession(async (t2) => {
        var _a2;
        try {
          let { error: n2, data: { session: r2 } } = t2;
          if (n2) throw n2;
          let { options: i2, provider: a2, token: o2, access_token: s2, nonce: c2 } = e3, { data: l2, error: u2 } = await J(this.fetch, `POST`, `${this.url}/token?grant_type=id_token`, { headers: this.headers, jwt: (_a2 = r2 == null ? void 0 : r2.access_token) != null ? _a2 : void 0, body: { provider: a2, id_token: o2, access_token: s2, nonce: c2, link_identity: true, gotrue_meta_security: { captcha_token: i2 == null ? void 0 : i2.captchaToken } }, xform: Y });
          return u2 ? this._returnResult({ data: { user: null, session: null }, error: u2 }) : !l2 || !l2.session || !l2.user ? this._returnResult({ data: { user: null, session: null }, error: new R() }) : (l2.session && (await this._saveSession(l2.session), await this._notifyAllSubscribers(`USER_UPDATED`, l2.session)), this._returnResult({ data: l2, error: u2 }));
        } catch (e4) {
          if (await G(this.storage, this.storageKey, null), P(e4)) return this._returnResult({ data: { user: null, session: null }, error: e4 });
          throw e4;
        }
      });
    }
    async unlinkIdentity(e3) {
      try {
        return await this._useSession(async (t2) => {
          var _a2, _b2;
          let { data: n2, error: r2 } = t2;
          if (r2) throw r2;
          return await J(this.fetch, `DELETE`, `${this.url}/user/identities/${e3.identity_id}`, { headers: this.headers, jwt: (_b2 = (_a2 = n2.session) == null ? void 0 : _a2.access_token) != null ? _b2 : void 0 });
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _refreshAccessToken(e3) {
      let t2 = `#_refreshAccessToken()`;
      this._debug(t2, `begin`);
      try {
        let n2 = Date.now();
        return await Nr(async (n3) => (n3 > 0 && await Mr(200 * 2 ** (n3 - 1)), this._debug(t2, `refreshing attempt`, n3), await J(this.fetch, `POST`, `${this.url}/token?grant_type=refresh_token`, { body: { refresh_token: e3 }, headers: this.headers, xform: Y })), (e4, t3) => {
          let r2 = 200 * 2 ** e4;
          return t3 && sr(t3) && Date.now() + r2 - n2 < M;
        });
      } catch (e4) {
        if (this._debug(t2, `error`, e4), P(e4)) return this._returnResult({ data: { session: null, user: null }, error: e4 });
        throw e4;
      } finally {
        this._debug(t2, `end`);
      }
    }
    _isValidSession(e3) {
      return typeof e3 == `object` && !!e3 && `access_token` in e3 && `refresh_token` in e3 && `expires_at` in e3;
    }
    async _handleProviderSignIn(e3, t2) {
      let { url: n2, flowId: r2 } = await this._getUrlForProvider(`${this.url}/authorize`, e3, { redirectTo: t2.redirectTo, scopes: t2.scopes, queryParams: t2.queryParams });
      return this._debug(`#_handleProviderSignIn()`, `provider`, e3, `options`, t2, `url`, n2), B() && !t2.skipBrowserRedirect && window.location.assign(n2), { data: { provider: e3, url: n2, flowId: r2 }, error: null };
    }
    async _recoverAndRefresh() {
      var _a2, _b2;
      let e3 = `#_recoverAndRefresh()`;
      this._debug(e3, `begin`);
      try {
        let t2 = await U(this.storage, this.storageKey);
        if (t2 && this.userStorage) {
          let e4 = await U(this.userStorage, this.storageKey + `-user`);
          !this.storage.isServer && Object.is(this.storage, this.userStorage) && !e4 && (e4 = { user: t2.user }, await H(this.userStorage, this.storageKey + `-user`, e4)), t2.user = (_a2 = e4 == null ? void 0 : e4.user) != null ? _a2 : ti();
        } else if (t2 && !t2.user && !t2.user) {
          let e4 = await U(this.storage, this.storageKey + `-user`);
          e4 && (e4 == null ? void 0 : e4.user) ? (t2.user = e4.user, await W(this.storage, this.storageKey + `-user`), await H(this.storage, this.storageKey, t2)) : t2.user = ti();
        }
        if (this._debug(e3, `session from storage`, t2), !this._isValidSession(t2)) {
          this._debug(e3, `session is not valid`), t2 !== null && await this._removeSession();
          return;
        }
        let n2 = ((_b2 = t2.expires_at) != null ? _b2 : 1 / 0) * 1e3 - Date.now() < Gn;
        if (this._debug(e3, `session has${n2 ? `` : ` not`} expired with margin of ${Gn}s`), n2) {
          if (this.autoRefreshToken && t2.refresh_token) {
            let { error: n3 } = await this._callRefreshToken(t2.refresh_token);
            n3 && (lr(n3) ? this._debug(e3, `refresh discarded by commit guard`, n3) : this._debug(e3, `refresh failed`, n3));
          }
        } else if (t2.user && t2.user.__isUserNotAvailableProxy === true) try {
          let { data: n3, error: r2 } = await this._getUser(t2.access_token);
          !r2 && (n3 == null ? void 0 : n3.user) ? (t2.user = n3.user, await this._saveSession(t2), await this._notifyAllSubscribers(`SIGNED_IN`, t2)) : this._debug(e3, `could not get user data, skipping SIGNED_IN notification`);
        } catch (t3) {
          console.error(`Error getting user data:`, t3), this._debug(e3, `error getting user data, skipping SIGNED_IN notification`, t3);
        }
        else await this._notifyAllSubscribers(`SIGNED_IN`, t2);
      } catch (t2) {
        this._debug(e3, `error`, t2), sr(t2) ? console.warn(t2) : console.error(t2);
        return;
      } finally {
        this._debug(e3, `end`);
      }
    }
    async _callRefreshToken(e3) {
      var t2, n2;
      if (!e3) throw new L();
      if (this.refreshingDeferred) return this.refreshingDeferred.promise;
      if (this.lastRefreshFailure && this.lastRefreshFailure.refreshToken === e3 && Date.now() < this.lastRefreshFailure.expiresAt) return this._debug(`#_callRefreshToken()`, `returning cached failure (cooldown active)`), this.lastRefreshFailure.result;
      let r2 = `#_callRefreshToken()`;
      this._debug(r2, `begin`);
      try {
        this.refreshingDeferred = new Ar(), this.refreshingDeferred.promise.then(void 0, () => {
        });
        let t3 = await U(this.storage, this.storageKey), { data: n3, error: i2 } = await this._refreshAccessToken(e3);
        if (i2) throw i2;
        if (!n3.session) throw new L();
        let a2 = await U(this.storage, this.storageKey);
        if (t3 !== null && (a2 === null || a2.refresh_token !== t3.refresh_token)) {
          this._debug(r2, `commit guard: storage changed since refresh started, discarding rotated tokens`, { startedWith: `present`, nowHolds: a2 ? `replaced` : `cleared` });
          let e4 = { data: null, error: new cr() };
          return this.refreshingDeferred.resolve(e4), e4;
        }
        let o2 = this._sessionRemovalEpoch;
        if (await this._saveSession(n3.session), this._sessionRemovalEpoch !== o2) {
          this._debug(r2, `commit guard (post-save): _removeSession ran during _saveSession, undoing write`), await W(this.storage, this.storageKey), this.userStorage && await W(this.userStorage, this.storageKey + `-user`);
          let e4 = { data: null, error: new cr() };
          return this.refreshingDeferred.resolve(e4), e4;
        }
        await this._notifyAllSubscribers(`TOKEN_REFRESHED`, n3.session);
        let s2 = { data: n3.session, error: null };
        return this.lastRefreshFailure = null, this.refreshingDeferred.resolve(s2), s2;
      } catch (i2) {
        if (this._debug(r2, `error`, i2), P(i2)) {
          let n3 = { data: null, error: i2 };
          if (!sr(i2)) {
            let e4 = await U(this.storage, this.storageKey);
            (e4 == null ? void 0 : e4.expires_at) && e4.expires_at * 1e3 > Date.now() ? this._debug(r2, `proactive refresh failed, access token still valid — preserving session`) : await this._removeSession();
          }
          return this.lastRefreshFailure = { refreshToken: e3, result: n3, expiresAt: Date.now() + 6e4 }, (t2 = this.refreshingDeferred) == null || t2.resolve(n3), n3;
        }
        throw (n2 = this.refreshingDeferred) == null || n2.reject(i2), i2;
      } finally {
        this.refreshingDeferred = null, this._debug(r2, `end`);
      }
    }
    async _notifyAllSubscribers(e3, t2, n2 = true) {
      if (this._pendingInitNotifications !== null && n2) {
        this._pendingInitNotifications.push({ event: e3, session: t2, broadcast: n2 });
        return;
      }
      let r2 = `#_notifyAllSubscribers(${e3})`;
      this._debug(r2, `begin`, t2, `broadcast = ${n2}`);
      try {
        this.broadcastChannel && n2 && this.broadcastChannel.postMessage({ event: e3, session: t2 });
        let r3 = [], i2 = Array.from(this.stateChangeEmitters.values()).map(async (n3) => {
          try {
            await n3.callback(e3, t2);
          } catch (e4) {
            r3.push(e4);
          }
        });
        if (await Promise.all(i2), r3.length > 0) {
          for (let e4 = 0; e4 < r3.length; e4 += 1) console.error(r3[e4]);
          throw r3[0];
        }
      } finally {
        this._debug(r2, `end`);
      }
    }
    async _saveSession(e3) {
      this._debug(`#_saveSession()`, e3), this.suppressGetSessionWarning = true;
      let t2 = Object.assign({}, e3), n2 = t2.user && t2.user.__isUserNotAvailableProxy === true;
      if (this.userStorage) {
        !n2 && t2.user && await H(this.userStorage, this.storageKey + `-user`, { user: t2.user });
        let e4 = Object.assign({}, t2);
        delete e4.user;
        let r2 = ri(e4);
        await H(this.storage, this.storageKey, r2);
      } else {
        let e4 = ri(t2);
        await H(this.storage, this.storageKey, e4);
      }
    }
    async _removeSession() {
      this._sessionRemovalEpoch += 1, this._debug(`#_removeSession()`), this.lastRefreshFailure = null, this.suppressGetSessionWarning = false, await W(this.storage, this.storageKey), await Kr(this.storage, this.storageKey), await W(this.storage, this.storageKey + `-user`), this.userStorage && await W(this.userStorage, this.storageKey + `-user`), await this._notifyAllSubscribers(`SIGNED_OUT`, null);
    }
    _removeVisibilityChangedCallback() {
      this._debug(`#_removeVisibilityChangedCallback()`);
      let e3 = this.visibilityChangedCallback;
      this.visibilityChangedCallback = null;
      try {
        e3 && B() && window != null && window.removeEventListener && window.removeEventListener(`visibilitychange`, e3);
      } catch (e4) {
        console.error(`removing visibilitychange callback failed`, e4);
      }
    }
    async _startAutoRefresh() {
      await this._stopAutoRefresh(), this._debug(`#_startAutoRefresh()`);
      let e3 = setInterval(() => this._autoRefreshTokenTick(), M);
      this.autoRefreshTicker = e3, e3 && typeof e3 == `object` && typeof e3.unref == `function` ? e3.unref() : typeof Deno < `u` && typeof Deno.unrefTimer == `function` && Deno.unrefTimer(e3);
      let t2 = setTimeout(async () => {
        await this.initializePromise, await this._autoRefreshTokenTick();
      }, 0);
      this.autoRefreshTickTimeout = t2, t2 && typeof t2 == `object` && typeof t2.unref == `function` ? t2.unref() : typeof Deno < `u` && typeof Deno.unrefTimer == `function` && Deno.unrefTimer(t2);
    }
    async _stopAutoRefresh() {
      this._debug(`#_stopAutoRefresh()`);
      let e3 = this.autoRefreshTicker;
      this.autoRefreshTicker = null, e3 && clearInterval(e3);
      let t2 = this.autoRefreshTickTimeout;
      this.autoRefreshTickTimeout = null, t2 && clearTimeout(t2);
    }
    async startAutoRefresh() {
      this._removeVisibilityChangedCallback(), await this._startAutoRefresh();
    }
    async stopAutoRefresh() {
      this._removeVisibilityChangedCallback(), await this._stopAutoRefresh();
    }
    async dispose() {
      var e3;
      this._removeVisibilityChangedCallback(), await this._stopAutoRefresh(), (e3 = this.broadcastChannel) == null || e3.close(), this.broadcastChannel = null, this.stateChangeEmitters.clear();
    }
    async _autoRefreshTokenTick() {
      if (this._debug(`#_autoRefreshTokenTick()`, `begin`), this.lock != null) {
        try {
          await this._acquireLock(0, async () => {
            try {
              let e3 = Date.now();
              try {
                return await this._useSession(async (t2) => {
                  let { data: { session: n2 } } = t2;
                  if (!n2 || !n2.refresh_token || !n2.expires_at) {
                    this._debug(`#_autoRefreshTokenTick()`, `no session`);
                    return;
                  }
                  let r2 = Math.floor((n2.expires_at * 1e3 - e3) / M);
                  this._debug(`#_autoRefreshTokenTick()`, `access token expires in ${r2} ticks, a tick lasts ${M}ms, refresh threshold is 3 ticks`), r2 <= 3 && await this._callRefreshToken(n2.refresh_token);
                });
              } catch (e4) {
                console.error(`Auto refresh tick failed with error. This is likely a transient error.`, e4);
              }
            } finally {
              this._debug(`#_autoRefreshTokenTick()`, `end`);
            }
          });
        } catch (e3) {
          if (e3 instanceof gi) this._debug(`auto refresh token tick lock not available`);
          else throw e3;
        }
        return;
      }
      if (this.refreshingDeferred !== null) {
        this._debug(`#_autoRefreshTokenTick()`, `refresh already in flight, skipping`);
        return;
      }
      try {
        let e3 = Date.now();
        try {
          await this._useSession(async (t2) => {
            let { data: { session: n2 } } = t2;
            if (!n2 || !n2.refresh_token || !n2.expires_at) {
              this._debug(`#_autoRefreshTokenTick()`, `no session`);
              return;
            }
            let r2 = Math.floor((n2.expires_at * 1e3 - e3) / M);
            this._debug(`#_autoRefreshTokenTick()`, `access token expires in ${r2} ticks, a tick lasts ${M}ms, refresh threshold is 3 ticks`), r2 <= 3 && await this._callRefreshToken(n2.refresh_token);
          });
        } catch (e4) {
          console.error(`Auto refresh tick failed with error. This is likely a transient error.`, e4);
        }
      } finally {
        this._debug(`#_autoRefreshTokenTick()`, `end`);
      }
    }
    async _handleVisibilityChange() {
      if (this._debug(`#_handleVisibilityChange()`), !B() || !(window != null && window.addEventListener)) return this.autoRefreshToken && this.startAutoRefresh(), false;
      try {
        this.visibilityChangedCallback = async () => {
          try {
            await this._onVisibilityChanged(false);
          } catch (e3) {
            this._debug(`#visibilityChangedCallback`, `error`, e3);
          }
        }, window == null || window.addEventListener(`visibilitychange`, this.visibilityChangedCallback), await this._onVisibilityChanged(true);
      } catch (e3) {
        console.error(`_handleVisibilityChange`, e3);
      }
    }
    async _onVisibilityChanged(e3) {
      let t2 = `#_onVisibilityChanged(${e3})`;
      if (this._debug(t2, `visibilityState`, document.visibilityState), document.visibilityState === `visible`) {
        if (this.autoRefreshToken && this._startAutoRefresh(), !e3) if (await this.initializePromise, this.lock != null) await this._acquireLock(this.lockAcquireTimeout, async () => {
          if (document.visibilityState !== `visible`) {
            this._debug(t2, `acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting`);
            return;
          }
          await this._recoverAndRefresh();
        });
        else {
          if (document.visibilityState !== `visible`) {
            this._debug(t2, `visibilityState is no longer visible, skipping recovery`);
            return;
          }
          await this._recoverAndRefresh();
        }
      } else document.visibilityState === `hidden` && this.autoRefreshToken && this._stopAutoRefresh();
    }
    async _getUrlForProvider(e3, t2, n2) {
      let r2 = n2 == null ? void 0 : n2.redirectTo, i2 = null, a2 = null, o2 = null;
      this.flowType === `pkce` && ([i2, a2, o2] = await this._getCodeChallengeAndMethod(), r2 = this._maybeAppendFlowIdToRedirect(r2, o2));
      let s2 = [`provider=${encodeURIComponent(t2)}`];
      if (r2 && s2.push(`redirect_to=${encodeURIComponent(r2)}`), (n2 == null ? void 0 : n2.scopes) && s2.push(`scopes=${encodeURIComponent(n2.scopes)}`), i2 != null && a2 != null) {
        let e4 = new URLSearchParams({ code_challenge: `${encodeURIComponent(i2)}`, code_challenge_method: `${encodeURIComponent(a2)}` });
        s2.push(e4.toString());
      }
      if (n2 == null ? void 0 : n2.queryParams) {
        let e4 = new URLSearchParams(n2.queryParams);
        s2.push(e4.toString());
      }
      return (n2 == null ? void 0 : n2.skipBrowserRedirect) && s2.push(`skip_http_redirect=${n2.skipBrowserRedirect}`), { url: `${e3}?${s2.join(`&`)}`, flowId: o2 };
    }
    _maybeAppendFlowIdToRedirect(e3, t2) {
      return !e3 || !t2 || !this.experimental.appendPkceFlowIdToRedirects ? e3 != null ? e3 : void 0 : qr(e3, t2);
    }
    async _getCodeChallengeAndMethod(e3 = false) {
      return Jr(this.storage, this.storageKey, e3, (e4) => this._debug(`#_getCodeChallengeAndMethod()`, `evicted oldest pending PKCE verifier slot`, e4));
    }
    async _unenroll(e3) {
      try {
        return await this._useSession(async (t2) => {
          var _a2;
          let { data: n2, error: r2 } = t2;
          return r2 ? this._returnResult({ data: null, error: r2 }) : await J(this.fetch, `DELETE`, `${this.url}/factors/${e3.factorId}`, { headers: this.headers, jwt: (_a2 = n2 == null ? void 0 : n2.session) == null ? void 0 : _a2.access_token });
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _enroll(e3) {
      try {
        return await this._useSession(async (t2) => {
          var _a2, _b2;
          let { data: n2, error: r2 } = t2;
          if (r2) return this._returnResult({ data: null, error: r2 });
          let i2 = Object.assign({ friendly_name: e3.friendlyName, factor_type: e3.factorType }, e3.factorType === `phone` ? { phone: e3.phone } : e3.factorType === `totp` ? { issuer: e3.issuer } : {}), { data: a2, error: o2 } = await J(this.fetch, `POST`, `${this.url}/factors`, { body: i2, headers: this.headers, jwt: (_a2 = n2 == null ? void 0 : n2.session) == null ? void 0 : _a2.access_token });
          return o2 ? this._returnResult({ data: null, error: o2 }) : (e3.factorType === `totp` && a2.type === `totp` && ((_b2 = a2 == null ? void 0 : a2.totp) == null ? void 0 : _b2.qr_code) && (a2.totp.qr_code = `data:image/svg+xml;utf-8,${a2.totp.qr_code}`), this._returnResult({ data: a2, error: null }));
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _verify(e3) {
      let t2 = async () => {
        try {
          return await this._useSession(async (t3) => {
            var _a2;
            let { data: n2, error: r2 } = t3;
            if (r2) return this._returnResult({ data: null, error: r2 });
            let i2 = Object.assign({ challenge_id: e3.challengeId }, `webauthn` in e3 ? { webauthn: Object.assign(Object.assign({}, e3.webauthn), { credential_response: e3.webauthn.type === `create` ? Ni(e3.webauthn.credential_response) : Pi(e3.webauthn.credential_response) }) } : { code: e3.code }), { data: a2, error: o2 } = await J(this.fetch, `POST`, `${this.url}/factors/${e3.factorId}/verify`, { body: i2, headers: this.headers, jwt: (_a2 = n2 == null ? void 0 : n2.session) == null ? void 0 : _a2.access_token });
            return o2 ? this._returnResult({ data: null, error: o2 }) : (await this._saveSession(Object.assign({ expires_at: Math.round(Date.now() / 1e3) + a2.expires_in }, a2)), await this._notifyAllSubscribers(`MFA_CHALLENGE_VERIFIED`, a2), this._returnResult({ data: a2, error: o2 }));
          });
        } catch (e4) {
          if (P(e4)) return this._returnResult({ data: null, error: e4 });
          throw e4;
        }
      };
      return this.lock == null ? t2() : this._acquireLock(this.lockAcquireTimeout, t2);
    }
    async _challenge(e3) {
      let t2 = async () => {
        try {
          return await this._useSession(async (t3) => {
            var _a2;
            let { data: n2, error: r2 } = t3;
            if (r2) return this._returnResult({ data: null, error: r2 });
            let i2 = await J(this.fetch, `POST`, `${this.url}/factors/${e3.factorId}/challenge`, { body: e3, headers: this.headers, jwt: (_a2 = n2 == null ? void 0 : n2.session) == null ? void 0 : _a2.access_token });
            if (i2.error) return i2;
            let { data: a2 } = i2;
            if (a2.type !== `webauthn`) return { data: a2, error: null };
            switch (a2.webauthn.type) {
              case `create`:
                return { data: Object.assign(Object.assign({}, a2), { webauthn: Object.assign(Object.assign({}, a2.webauthn), { credential_options: Object.assign(Object.assign({}, a2.webauthn.credential_options), { publicKey: ji(a2.webauthn.credential_options.publicKey) }) }) }), error: null };
              case `request`:
                return { data: Object.assign(Object.assign({}, a2), { webauthn: Object.assign(Object.assign({}, a2.webauthn), { credential_options: Object.assign(Object.assign({}, a2.webauthn.credential_options), { publicKey: Mi(a2.webauthn.credential_options.publicKey) }) }) }), error: null };
            }
          });
        } catch (e4) {
          if (P(e4)) return this._returnResult({ data: null, error: e4 });
          throw e4;
        }
      };
      return this.lock == null ? t2() : this._acquireLock(this.lockAcquireTimeout, t2);
    }
    async _challengeAndVerify(e3) {
      let { data: t2, error: n2 } = await this._challenge({ factorId: e3.factorId });
      return n2 ? this._returnResult({ data: null, error: n2 }) : await this._verify({ factorId: e3.factorId, challengeId: t2.id, code: e3.code });
    }
    async _listFactors() {
      var _a2;
      let { data: { user: e3 }, error: t2 } = await this.getUser();
      if (t2) return { data: null, error: t2 };
      let n2 = { all: [], phone: [], totp: [], webauthn: [], recovery_code: [] };
      for (let t3 of (_a2 = e3 == null ? void 0 : e3.factors) != null ? _a2 : []) n2.all.push(t3), t3.status === `verified` && t3.factor_type in n2 && Array.isArray(n2[t3.factor_type]) && n2[t3.factor_type].push(t3);
      return { data: n2, error: null };
    }
    async _getAuthenticatorAssuranceLevel(e3) {
      var _a2, _b2, _c2, _d;
      if (e3) try {
        let { payload: t3 } = jr(e3), n3 = null;
        t3.aal && (n3 = t3.aal);
        let r3 = n3, { data: { user: i3 }, error: a3 } = await this.getUser(e3);
        if (a3) return this._returnResult({ data: null, error: a3 });
        ((_b2 = (_a2 = i3 == null ? void 0 : i3.factors) == null ? void 0 : _a2.filter((e4) => e4.status === `verified`)) != null ? _b2 : []).length > 0 && (r3 = `aal2`);
        let o3 = t3.amr || [];
        return { data: { currentLevel: n3, nextLevel: r3, currentAuthenticationMethods: o3 }, error: null };
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
      let { data: { session: t2 }, error: n2 } = await this.getSession();
      if (n2) return this._returnResult({ data: null, error: n2 });
      if (!t2) return { data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] }, error: null };
      let { payload: r2 } = jr(t2.access_token), i2 = null;
      r2.aal && (i2 = r2.aal);
      let a2 = i2;
      ((_d = (_c2 = t2.user.factors) == null ? void 0 : _c2.filter((e4) => e4.status === `verified`)) != null ? _d : []).length > 0 && (a2 = `aal2`);
      let o2 = r2.amr || [];
      return { data: { currentLevel: i2, nextLevel: a2, currentAuthenticationMethods: o2 }, error: null };
    }
    async _getRecoveryCodesStatus() {
      ei(this.experimental);
      try {
        return await this._useSession(async (e3) => {
          var _a2;
          let { data: t2, error: n2 } = e3;
          if (n2) return this._returnResult({ data: null, error: n2 });
          let { data: r2, error: i2 } = await J(this.fetch, `GET`, `${this.url}/factors/recovery-codes`, { headers: this.headers, jwt: (_a2 = t2 == null ? void 0 : t2.session) == null ? void 0 : _a2.access_token });
          return i2 ? this._returnResult({ data: null, error: i2 }) : this._returnResult({ data: r2, error: null });
        });
      } catch (e3) {
        if (P(e3)) return this._returnResult({ data: null, error: e3 });
        throw e3;
      }
    }
    async _generateRecoveryCodes(e3) {
      ei(this.experimental);
      try {
        return await this._useSession(async (t2) => {
          var _a2;
          let { data: n2, error: r2 } = t2;
          if (r2) return this._returnResult({ data: null, error: r2 });
          let { data: i2, error: a2 } = await J(this.fetch, `POST`, `${this.url}/factors/recovery-codes`, { body: (e3 == null ? void 0 : e3.friendlyName) ? { friendly_name: e3.friendlyName } : void 0, headers: this.headers, jwt: (_a2 = n2 == null ? void 0 : n2.session) == null ? void 0 : _a2.access_token });
          return a2 ? this._returnResult({ data: null, error: a2 }) : this._returnResult({ data: i2, error: null });
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _verifyRecoveryCode(e3) {
      ei(this.experimental);
      let t2 = async () => {
        try {
          return await this._useSession(async (t3) => {
            var _a2;
            let { data: n2, error: r2 } = t3;
            if (r2) return this._returnResult({ data: null, error: r2 });
            let { data: i2, error: a2 } = await J(this.fetch, `POST`, `${this.url}/factors/recovery-codes/verify`, { body: { code: e3.code }, headers: this.headers, jwt: (_a2 = n2 == null ? void 0 : n2.session) == null ? void 0 : _a2.access_token });
            if (a2) return this._returnResult({ data: null, error: a2 });
            let o2 = Object.assign({ expires_at: wr(i2.expires_in) }, i2);
            return await this._saveSession(o2), await this._notifyAllSubscribers(`MFA_CHALLENGE_VERIFIED`, o2), this._returnResult({ data: i2, error: null });
          });
        } catch (e4) {
          if (P(e4)) return this._returnResult({ data: null, error: e4 });
          throw e4;
        }
      };
      return this.lock == null ? t2() : this._acquireLock(this.lockAcquireTimeout, t2);
    }
    async _regenerateRecoveryCodes() {
      ei(this.experimental);
      try {
        return await this._useSession(async (e3) => {
          var _a2;
          let { data: t2, error: n2 } = e3;
          if (n2) return this._returnResult({ data: null, error: n2 });
          let { data: r2, error: i2 } = await J(this.fetch, `POST`, `${this.url}/factors/recovery-codes/regenerate`, { headers: this.headers, jwt: (_a2 = t2 == null ? void 0 : t2.session) == null ? void 0 : _a2.access_token });
          return i2 ? this._returnResult({ data: null, error: i2 }) : this._returnResult({ data: r2, error: null });
        });
      } catch (e3) {
        if (P(e3)) return this._returnResult({ data: null, error: e3 });
        throw e3;
      }
    }
    async _unenrollRecoveryCodes() {
      ei(this.experimental);
      try {
        return await this._useSession(async (e3) => {
          var _a2;
          let { data: t2, error: n2 } = e3;
          if (n2) return this._returnResult({ data: null, error: n2 });
          let { data: r2, error: i2 } = await J(this.fetch, `DELETE`, `${this.url}/factors/recovery-codes`, { headers: this.headers, jwt: (_a2 = t2 == null ? void 0 : t2.session) == null ? void 0 : _a2.access_token });
          return i2 ? this._returnResult({ data: null, error: i2 }) : this._returnResult({ data: r2, error: null });
        });
      } catch (e3) {
        if (P(e3)) return this._returnResult({ data: null, error: e3 });
        throw e3;
      }
    }
    async _getAuthorizationDetails(e3) {
      try {
        return await this._useSession(async (t2) => {
          let { data: { session: n2 }, error: r2 } = t2;
          return r2 ? this._returnResult({ data: null, error: r2 }) : n2 ? await J(this.fetch, `GET`, `${this.url}/oauth/authorizations/${e3}`, { headers: this.headers, jwt: n2.access_token, xform: (e4) => ({ data: e4, error: null }) }) : this._returnResult({ data: null, error: new L() });
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _approveAuthorization(e3, t2) {
      try {
        return await this._useSession(async (n2) => {
          let { data: { session: r2 }, error: i2 } = n2;
          if (i2) return this._returnResult({ data: null, error: i2 });
          if (!r2) return this._returnResult({ data: null, error: new L() });
          let a2 = await J(this.fetch, `POST`, `${this.url}/oauth/authorizations/${e3}/consent`, { headers: this.headers, jwt: r2.access_token, body: { action: `approve` }, xform: (e4) => ({ data: e4, error: null }) });
          return a2.data && a2.data.redirect_url && B() && !(t2 == null ? void 0 : t2.skipBrowserRedirect) && window.location.assign(a2.data.redirect_url), a2;
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _denyAuthorization(e3, t2) {
      try {
        return await this._useSession(async (n2) => {
          let { data: { session: r2 }, error: i2 } = n2;
          if (i2) return this._returnResult({ data: null, error: i2 });
          if (!r2) return this._returnResult({ data: null, error: new L() });
          let a2 = await J(this.fetch, `POST`, `${this.url}/oauth/authorizations/${e3}/consent`, { headers: this.headers, jwt: r2.access_token, body: { action: `deny` }, xform: (e4) => ({ data: e4, error: null }) });
          return a2.data && a2.data.redirect_url && B() && !(t2 == null ? void 0 : t2.skipBrowserRedirect) && window.location.assign(a2.data.redirect_url), a2;
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _listOAuthGrants() {
      try {
        return await this._useSession(async (e3) => {
          let { data: { session: t2 }, error: n2 } = e3;
          return n2 ? this._returnResult({ data: null, error: n2 }) : t2 ? await J(this.fetch, `GET`, `${this.url}/user/oauth/grants`, { headers: this.headers, jwt: t2.access_token, xform: (e4) => ({ data: e4, error: null }) }) : this._returnResult({ data: null, error: new L() });
        });
      } catch (e3) {
        if (P(e3)) return this._returnResult({ data: null, error: e3 });
        throw e3;
      }
    }
    async _revokeOAuthGrant(e3) {
      try {
        return await this._useSession(async (t2) => {
          let { data: { session: n2 }, error: r2 } = t2;
          return r2 ? this._returnResult({ data: null, error: r2 }) : n2 ? (await J(this.fetch, `DELETE`, `${this.url}/user/oauth/grants`, { headers: this.headers, jwt: n2.access_token, query: { client_id: e3.clientId }, noResolveJson: true }), { data: {}, error: null }) : this._returnResult({ data: null, error: new L() });
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async fetchJwk(e3, t2 = { keys: [] }) {
      let n2 = t2.keys.find((t3) => t3.kid === e3);
      if (n2) return n2;
      let r2 = Date.now();
      if (n2 = this.jwks.keys.find((t3) => t3.kid === e3), n2 && this.jwks_cached_at + 6e5 > r2) return n2;
      let { data: i2, error: a2 } = await J(this.fetch, `GET`, `${this.url}/.well-known/jwks.json`, { headers: this.headers });
      if (a2) throw a2;
      return !i2.keys || i2.keys.length === 0 || (this.jwks = i2, this.jwks_cached_at = r2, n2 = i2.keys.find((t3) => t3.kid === e3), !n2) ? null : n2;
    }
    async getClaims(e3, t2 = {}) {
      try {
        let n2 = e3;
        if (!n2) {
          let { data: e4, error: t3 } = await this.getSession();
          if (t3 || !e4.session) return this._returnResult({ data: null, error: t3 });
          n2 = e4.session.access_token;
        }
        let { header: r2, payload: i2, signature: a2, raw: { header: o2, payload: s2 } } = jr(n2);
        if (!(t2 == null ? void 0 : t2.allowExpired)) try {
          Zr(i2.exp);
        } catch (e4) {
          throw new fr(e4 instanceof Error ? e4.message : `JWT validation failed`);
        }
        let c2 = !r2.alg || r2.alg.startsWith(`HS`) || !r2.kid || !(`crypto` in globalThis && `subtle` in globalThis.crypto) ? null : await this.fetchJwk(r2.kid, (t2 == null ? void 0 : t2.keys) ? { keys: t2.keys } : t2 == null ? void 0 : t2.jwks);
        if (!c2) {
          let { error: e4 } = await this.getUser(n2);
          if (e4) throw e4;
          return { data: { claims: i2, header: r2, signature: a2 }, error: null };
        }
        let l2 = Qr(r2.alg), u2 = await crypto.subtle.importKey(`jwk`, c2, l2, true, [`verify`]);
        if (!await crypto.subtle.verify(l2, u2, a2, Cr(`${o2}.${s2}`))) throw new fr(`Invalid JWT signature`);
        return { data: { claims: i2, header: r2, signature: a2 }, error: null };
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async signInWithPasskey(e3) {
      var _a2, _b2, _c2, _d;
      try {
        if (!Ii()) return this._returnResult({ data: null, error: new F(`Browser does not support WebAuthn`, null) });
        let { data: t2, error: n2 } = await this._startPasskeyAuthentication({ options: { captchaToken: (_a2 = e3 == null ? void 0 : e3.options) == null ? void 0 : _a2.captchaToken } });
        if (n2 || !t2) return this._returnResult({ data: null, error: n2 });
        let { data: r2, error: i2 } = await Ri({ publicKey: Mi(t2.options), signal: (_c2 = (_b2 = e3 == null ? void 0 : e3.options) == null ? void 0 : _b2.signal) != null ? _c2 : Ai.createNewAbortSignal(), mediation: (_d = e3 == null ? void 0 : e3.options) == null ? void 0 : _d.mediation });
        if (i2 || !r2) return this._returnResult({ data: null, error: i2 != null ? i2 : new F(`WebAuthn ceremony failed`, null) });
        let a2 = Pi(r2);
        return this._verifyPasskeyAuthentication({ challengeId: t2.challenge_id, credential: a2 });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async registerPasskey(e3) {
      var _a2, _b2;
      try {
        if (!Ii()) return this._returnResult({ data: null, error: new F(`Browser does not support WebAuthn`, null) });
        let { data: t2, error: n2 } = await this._startPasskeyRegistration();
        if (n2 || !t2) return this._returnResult({ data: null, error: n2 });
        let { data: r2, error: i2 } = await Li({ publicKey: ji(t2.options), signal: (_b2 = (_a2 = e3 == null ? void 0 : e3.options) == null ? void 0 : _a2.signal) != null ? _b2 : Ai.createNewAbortSignal() });
        if (i2 || !r2) return this._returnResult({ data: null, error: i2 != null ? i2 : new F(`WebAuthn ceremony failed`, null) });
        let a2 = Ni(r2);
        return this._verifyPasskeyRegistration({ challengeId: t2.challenge_id, credential: a2 });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _startPasskeyRegistration() {
      try {
        return await this._useSession(async (e3) => {
          let { data: { session: t2 }, error: n2 } = e3;
          if (n2) return this._returnResult({ data: null, error: n2 });
          if (!t2) return this._returnResult({ data: null, error: new L() });
          let { data: r2, error: i2 } = await J(this.fetch, `POST`, `${this.url}/passkeys/registration/options`, { headers: this.headers, jwt: t2.access_token, body: {} });
          return i2 ? this._returnResult({ data: null, error: i2 }) : this._returnResult({ data: r2, error: null });
        });
      } catch (e3) {
        if (P(e3)) return this._returnResult({ data: null, error: e3 });
        throw e3;
      }
    }
    async _verifyPasskeyRegistration(e3) {
      try {
        return await this._useSession(async (t2) => {
          let { data: { session: n2 }, error: r2 } = t2;
          if (r2) return this._returnResult({ data: null, error: r2 });
          if (!n2) return this._returnResult({ data: null, error: new L() });
          let { data: i2, error: a2 } = await J(this.fetch, `POST`, `${this.url}/passkeys/registration/verify`, { headers: this.headers, jwt: n2.access_token, body: { challenge_id: e3.challengeId, credential: e3.credential } });
          return a2 ? this._returnResult({ data: null, error: a2 }) : this._returnResult({ data: i2, error: null });
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _startPasskeyAuthentication(e3) {
      var _a2;
      try {
        let { data: t2, error: n2 } = await J(this.fetch, `POST`, `${this.url}/passkeys/authentication/options`, { headers: this.headers, body: { gotrue_meta_security: { captcha_token: (_a2 = e3 == null ? void 0 : e3.options) == null ? void 0 : _a2.captchaToken } } });
        return n2 ? this._returnResult({ data: null, error: n2 }) : this._returnResult({ data: t2, error: null });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _verifyPasskeyAuthentication(e3) {
      try {
        let { data: t2, error: n2 } = await J(this.fetch, `POST`, `${this.url}/passkeys/authentication/verify`, { headers: this.headers, body: { challenge_id: e3.challengeId, credential: e3.credential }, xform: Y });
        return n2 ? this._returnResult({ data: null, error: n2 }) : (t2.session && (await this._saveSession(t2.session), await this._notifyAllSubscribers(`SIGNED_IN`, t2.session)), this._returnResult({ data: t2, error: null }));
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _listPasskeys() {
      try {
        return await this._useSession(async (e3) => {
          let { data: { session: t2 }, error: n2 } = e3;
          if (n2) return this._returnResult({ data: null, error: n2 });
          if (!t2) return this._returnResult({ data: null, error: new L() });
          let { data: r2, error: i2 } = await J(this.fetch, `GET`, `${this.url}/passkeys`, { headers: this.headers, jwt: t2.access_token, xform: (e4) => ({ data: e4, error: null }) });
          return i2 ? this._returnResult({ data: null, error: i2 }) : this._returnResult({ data: r2, error: null });
        });
      } catch (e3) {
        if (P(e3)) return this._returnResult({ data: null, error: e3 });
        throw e3;
      }
    }
    async _updatePasskey(e3) {
      try {
        return await this._useSession(async (t2) => {
          let { data: { session: n2 }, error: r2 } = t2;
          if (r2) return this._returnResult({ data: null, error: r2 });
          if (!n2) return this._returnResult({ data: null, error: new L() });
          let { data: i2, error: a2 } = await J(this.fetch, `PATCH`, `${this.url}/passkeys/${e3.passkeyId}`, { headers: this.headers, jwt: n2.access_token, body: { friendly_name: e3.friendlyName } });
          return a2 ? this._returnResult({ data: null, error: a2 }) : this._returnResult({ data: i2, error: null });
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
    async _deletePasskey(e3) {
      try {
        return await this._useSession(async (t2) => {
          let { data: { session: n2 }, error: r2 } = t2;
          if (r2) return this._returnResult({ data: null, error: r2 });
          if (!n2) return this._returnResult({ data: null, error: new L() });
          let { error: i2 } = await J(this.fetch, `DELETE`, `${this.url}/passkeys/${e3.passkeyId}`, { headers: this.headers, jwt: n2.access_token, noResolveJson: true });
          return i2 ? this._returnResult({ data: null, error: i2 }) : this._returnResult({ data: null, error: null });
        });
      } catch (e4) {
        if (P(e4)) return this._returnResult({ data: null, error: e4 });
        throw e4;
      }
    }
  };
  qi.nextInstanceID = {};
  var Ji = qi, Yi = mi, Xi = Ji, Zi = class extends Xi {
    constructor(e2) {
      super(e2);
    }
  }, Qi = class {
    constructor(e2, t2, n2) {
      var _a2, _b2, _c2;
      this.supabaseUrl = e2, this.supabaseKey = t2;
      let r2 = Un(e2);
      if (!t2) throw Error(`supabaseKey is required.`);
      Nn(t2), Vn(n2), this.realtimeUrl = new URL(`realtime/v1`, r2), this.realtimeUrl.protocol = this.realtimeUrl.protocol.replace(`http`, `ws`), this.authUrl = new URL(`auth/v1`, r2), this.storageUrl = new URL(`storage/v1`, r2), this.functionsUrl = new URL(`functions/v1`, r2);
      let i2 = `sb-${r2.hostname.split(`.`)[0]}-auth-token`, a2 = { db: yn, realtime: xn, auth: { ...bn, storageKey: i2 }, global: vn, tracePropagation: Sn }, o2 = Hn(n2 != null ? n2 : {}, a2);
      this.settings = o2, this.storageKey = (_a2 = o2.auth.storageKey) != null ? _a2 : ``, this.headers = (_b2 = o2.global.headers) != null ? _b2 : {}, o2.accessToken ? (this.accessToken = o2.accessToken, this.auth = new Proxy({}, { get: (e3, t3) => {
        throw Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(t3)} is not possible`);
      } })) : this.auth = this._initSupabaseAuthClient((_c2 = o2.auth) != null ? _c2 : {}, this.headers, o2.global.fetch), this.fetch = Pn(t2, e2, this._getSessionToken.bind(this), o2.global.fetch, o2.tracePropagation), this.functionsFetch = Pn(t2, e2, this._getSessionToken.bind(this), o2.global.fetch, o2.tracePropagation, { omitApiKeyAsBearer: true }), this.realtime = this._initRealtimeClient({ headers: this.headers, accessToken: this._getAccessToken.bind(this), fetch: this.fetch, ...o2.realtime }), this.accessToken && Promise.resolve(this.accessToken()).then((e3) => this.realtime.setAuth(e3)).catch((e3) => console.warn(`Failed to set initial Realtime auth token:`, e3)), this.rest = new fe(new URL(`rest/v1`, r2).href, { headers: this.headers, schema: o2.db.schema, fetch: this.fetch, timeout: o2.db.timeout, urlLengthLimit: o2.db.urlLengthLimit, retry: o2.db.retry }), this.storage = new mn(this.storageUrl.href, this.headers, this.fetch, n2 == null ? void 0 : n2.storage), o2.accessToken || this._listenForAuthEvents();
    }
    get functions() {
      return new l(this.functionsUrl.href, { headers: this.headers, customFetch: this.functionsFetch });
    }
    from(e2) {
      return this.rest.from(e2);
    }
    schema(e2) {
      return this.rest.schema(e2);
    }
    getOpenApiSpec() {
      return this.rest.getOpenApiSpec();
    }
    rpc(e2, t2 = {}, n2 = { head: false, get: false, count: void 0 }) {
      return this.rest.rpc(e2, t2, n2);
    }
    channel(e2, t2 = { config: {} }) {
      return this.realtime.channel(e2, t2);
    }
    getChannels() {
      return this.realtime.getChannels();
    }
    removeChannel(e2) {
      return this.realtime.removeChannel(e2);
    }
    removeAllChannels() {
      return this.realtime.removeAllChannels();
    }
    async _getSessionToken() {
      var _a2, _b2;
      if (this.accessToken) return await this.accessToken();
      let { data: e2 } = await this.auth.getSession();
      return (_b2 = (_a2 = e2.session) == null ? void 0 : _a2.access_token) != null ? _b2 : null;
    }
    async _getAccessToken() {
      var _a2;
      return (_a2 = await this._getSessionToken()) != null ? _a2 : this.supabaseKey;
    }
    _initSupabaseAuthClient({ autoRefreshToken: e2, persistSession: t2, detectSessionInUrl: n2, storage: r2, userStorage: i2, storageKey: a2, flowType: o2, lock: s2, debug: c2, throwOnError: l2, experimental: u2, lockAcquireTimeout: d2, skipAutoInitialize: f2 }, p2, m2) {
      let h2 = { Authorization: `Bearer ${this.supabaseKey}`, apikey: `${this.supabaseKey}` };
      return new Zi({ url: this.authUrl.href, headers: { ...h2, ...p2 }, storageKey: a2, autoRefreshToken: e2, persistSession: t2, detectSessionInUrl: n2, storage: r2, userStorage: i2, flowType: o2, lock: s2, debug: c2, throwOnError: l2, experimental: u2, fetch: m2, lockAcquireTimeout: d2, skipAutoInitialize: f2, hasCustomAuthorizationHeader: Object.keys(this.headers).some((e3) => e3.toLowerCase() === `authorization`) });
    }
    _initRealtimeClient(e2) {
      return new _t(this.realtimeUrl.href, { ...e2, params: { apikey: this.supabaseKey, ...e2 == null ? void 0 : e2.params } });
    }
    _listenForAuthEvents() {
      return this.auth.onAuthStateChange((e2, t2) => {
        this._handleTokenChanged(e2, `CLIENT`, t2 == null ? void 0 : t2.access_token);
      });
    }
    _handleTokenChanged(e2, t2, n2) {
      (e2 === `TOKEN_REFRESHED` || e2 === `SIGNED_IN` || e2 === `INITIAL_SESSION`) && this.changedAccessToken !== n2 ? (this.changedAccessToken = n2, this.realtime.setAuth(n2)) : e2 === `SIGNED_OUT` && (this.realtime.setAuth(), t2 == `STORAGE` && this.auth.signOut(), this.changedAccessToken = void 0);
    }
  };
  let $i = (e2, t2, n2) => new Qi(e2, t2, n2);
  function ea() {
    if (typeof window < `u` || globalThis.Deno !== void 0) return false;
    let e2 = globalThis.process;
    if (!e2) return false;
    let t2 = e2.version;
    if (t2 == null) return false;
    let n2 = t2.match(/^v(\d+)\./);
    return n2 ? parseInt(n2[1], 10) <= 20 : false;
  }
  return ea() && console.warn(`⚠️  Node.js 20 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 22 or later. For more information, visit: https://github.com/orgs/supabase/discussions/45715`), e.AuthAdminApi = Yi, e.AuthApiError = Zn, e.AuthClient = Xi, e.AuthError = Xn, e.AuthImplicitGrantRedirectError = tr, e.AuthInvalidCredentialsError = er, e.AuthInvalidJwtError = fr, e.AuthInvalidTokenResponseError = R, e.AuthPKCECodeVerifierMissingError = ir, e.AuthPKCEGrantCodeExchangeError = rr, e.AuthRefreshDiscardedError = cr, e.AuthRetryableFetchError = or, e.AuthSessionMissingError = L, e.AuthUnknownError = F, e.AuthWeakPasswordError = ur, e.CustomAuthError = I, Object.defineProperty(e, `FunctionRegion`, { enumerable: true, get: function() {
    return c;
  } }), e.FunctionsError = i, e.FunctionsFetchError = a, e.FunctionsHttpError = s, e.FunctionsRelayError = o, e.GoTrueAdminApi = mi, e.GoTrueClient = Ji, e.NavigatorLockAcquireTimeoutError = _i, e.PostgrestError = u, e.REALTIME_CHANNEL_STATES = ut, Object.defineProperty(e, `REALTIME_LISTEN_TYPES`, { enumerable: true, get: function() {
    return T;
  } }), Object.defineProperty(e, `REALTIME_POSTGRES_CHANGES_LISTEN_EVENT`, { enumerable: true, get: function() {
    return lt;
  } }), Object.defineProperty(e, `REALTIME_PRESENCE_LISTEN_EVENTS`, { enumerable: true, get: function() {
    return Xe;
  } }), Object.defineProperty(e, `REALTIME_SUBSCRIBE_STATES`, { enumerable: true, get: function() {
    return E;
  } }), e.RealtimeChannel = dt, e.RealtimeClient = _t, e.RealtimePostgresFilterBuilder = st, e.RealtimePresence = Ze, e.SIGN_OUT_SCOPES = pi, e.StorageApiError = Pt, e.SupabaseClient = Qi, e.WebSocketFactory = pe, e.createClient = $i, e.isAuthApiError = Qn, e.isAuthError = P, e.isAuthImplicitGrantRedirectError = nr, e.isAuthPKCECodeVerifierMissingError = ar, e.isAuthRefreshDiscardedError = lr, e.isAuthRetryableFetchError = sr, e.isAuthSessionMissingError = $n, e.isAuthWeakPasswordError = dr, e.lockInternals = Z, e.navigatorLock = yi, e.postgresChangesFilter = ct, e.processLock = xi, e;
})({});
