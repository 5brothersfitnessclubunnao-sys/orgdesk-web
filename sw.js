/* Small service worker: lets the card be installed and keeps the last page shell available offline. Data is always live. */
var C = "orgdesk-v2";
var SHELL = ["./card.html", "./pay.html", "./join.html", "./admin.html", "./setup.html", "./ui.css", "./core.js", "./templates.js", "./form.js", "./receipt.js", "./admin.js", "./firebase-config.js", "./manifest.json"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(function (res) { var cp = res.clone(); caches.open(C).then(function (c) { c.put(r, cp); }).catch(function () {}); return res; }).catch(function () { return caches.match(r, { ignoreSearch: true }); }));
});
