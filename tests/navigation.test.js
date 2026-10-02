"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function setup(options = {}) {
  const events = [];
  const timers = [];
  const listeners = {};
  const source = {
    id: 7,
    windowId: 2,
    index: 3,
    active: false,
    pinned: true,
    mutedInfo: { muted: true },
    cookieStoreId: "firefox-container-1",
    incognito: false,
    ...options.source,
  };
  const browser = {
    browserAction: { onClicked: { addListener() {} } },
    menus: { create() {}, onClicked: { addListener() {} } },
    storage: {
      local: {
        async get() { return {}; },
        async set(value) { events.push(["storage", value]); },
      },
      onChanged: { addListener(fn) { listeners.storage = fn; } },
    },
    tabs: {
      async get(id) {
        events.push(["get", id]);
        if (options.getFails) throw Error("missing tab");
        return source;
      },
      async create(properties) {
        events.push(["create", properties]);
        if (options.createFails) throw Error("create failed");
        return { id: 8 };
      },
      async remove(id) { events.push(["remove", id]); },
      async update(id, properties) {
        events.push(["update", id, properties]);
      },
    },
    webRequest: {
      onBeforeRequest: {
        addListener(fn, filter, extra) {
          listeners.request = fn;
          listeners.filter = filter;
          listeners.extra = extra;
        },
      },
    },
  };
  const context = vm.createContext({
    browser,
    console: {
      error(...args) { events.push(["error", args[0]]); },
      warn(...args) { events.push(["warn", args[0]]); },
    },
    URL,
    setTimeout(fn) { timers.push(fn); },
  });
  for (const filename of ["no-container-sites.js", "background.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", filename), "utf8"), context);
  }
  await Promise.resolve();
  return { events, timers, listeners, source };
}

function request(overrides = {}) {
  return {
    tabId: 7,
    url: "https://shop.example.ru/item",
    method: "GET",
    incognito: false,
    cookieStoreId: "firefox-container-1",
    ...overrides,
  };
}

(async () => {
  const current = await setup();
  assert.deepEqual(Array.from(current.listeners.filter.urls), ["<all_urls>"]);
  assert.deepEqual(Array.from(current.listeners.filter.types), ["main_frame"]);
  assert.deepEqual(Array.from(current.listeners.extra), ["blocking"]);
  assert.equal((await current.listeners.request(request())).cancel, true);
  const create = current.events.find(([kind]) => kind === "create")[1];
  assert.equal(create.cookieStoreId, "firefox-default");
  assert.equal(create.url, "about:blank");
  assert.equal(create.active, false);
  assert.equal(create.pinned, true);
  assert.equal(create.muted, true);
  assert.equal(current.events.some(([kind]) => kind === "remove"), false);
  await current.timers[0]();
  assert.deepEqual(current.events.slice(-2).map(([kind]) => kind), ["remove", "update"]);
  assert.equal(current.events.at(-1)[2].url, request().url);

  for (const overrides of [
    { cookieStoreId: "firefox-default" },
    { cookieStoreId: "firefox-private", incognito: true },
    { method: "POST" },
    { url: "https://example.com/" },
    { tabId: -1 },
  ]) {
    const env = await setup();
    assert.equal((await env.listeners.request(request(overrides))).cancel, undefined);
    assert.equal(env.events.some(([kind]) => kind === "create"), false);
  }

  const changed = await setup();
  changed.listeners.storage(
    { noContainerHosts: { newValue: ["example.org"] } }, "local",
  );
  assert.equal((await changed.listeners.request(request())).cancel, true);
  await changed.timers[0]();

  const custom = await setup();
  custom.listeners.storage(
    { noContainerHosts: { newValue: ["example.org"] } }, "local",
  );
  assert.equal(
    (await custom.listeners.request(request({ url: "https://sub.example.org/" }))).cancel,
    true,
  );

  const failed = await setup({ createFails: true });
  assert.equal((await failed.listeners.request(request())).cancel, undefined);
  assert.equal(failed.timers.length, 0);
  assert.equal(failed.events.some(([kind]) => kind === "remove"), false);
  console.log("navigation tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
