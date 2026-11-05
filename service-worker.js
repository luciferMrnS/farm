"use strict";

const CACHE_NAME = "fieldnote-app-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./supabase-config.js"
].map((path) => new URL(path, self.registration.scope).href);
const APP_SHELL_PATHS = new Set(APP_SHELL.map((url) => new URL(url).pathname));
const INDEX_URL = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("fieldnote-app-shell-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(INDEX_URL, response.clone());
              return response;
            });
          }
          return response;
        })
        .catch(async () => (await caches.match(INDEX_URL)) || Response.error())
    );
    return;
  }

  if (APP_SHELL_PATHS.has(requestUrl.pathname)) {
    const cacheUrl = new URL(requestUrl.pathname, self.location.origin).href;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(cacheUrl, response.clone());
              return response;
            });
          }
          return response;
        })
        .catch(async () => (await caches.match(cacheUrl)) || Response.error())
    );
  }
});
