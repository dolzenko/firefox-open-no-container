"use strict";

const DEFAULT_COOKIE_STORE_ID = "firefox-default";
const PRIVATE_COOKIE_STORE_ID = "firefox-private";
const NO_CONTAINER_HOSTS_STORAGE_KEY = "noContainerHosts";
const requestMoves = new Set();
const defaultNoContainerHosts = normalizeHosts(
  typeof NO_CONTAINER_HOSTS === "undefined" ? [] : NO_CONTAINER_HOSTS,
);
let noContainerHosts = defaultNoContainerHosts;

function canOpenURL(url) {
  if (!url) {
    return false;
  }

  return /^(https?|ftp|about:blank)($|:)/.test(url);
}

async function openInNoContainer(sourceTab, url) {
  if (!canOpenURL(url)) {
    return null;
  }

  const createProperties = {
    active: true,
    url,
  };

  if (!sourceTab || (!sourceTab.incognito && sourceTab.cookieStoreId !== PRIVATE_COOKIE_STORE_ID)) {
    createProperties.cookieStoreId = DEFAULT_COOKIE_STORE_ID;
  }

  if (sourceTab && typeof sourceTab.windowId === "number") {
    createProperties.windowId = sourceTab.windowId;
  }

  if (sourceTab && typeof sourceTab.index === "number") {
    createProperties.index = sourceTab.index + 1;
  }

  return browser.tabs.create(createProperties);
}

// Переносим навигацию до первого запроса: поздний tabs.onUpdated может не
// наступить, если загрузка в контейнере зависла или была прервана.
async function moveConfiguredRequestBeforeLoading(details) {
  if (
    details.tabId < 0 ||
    details.incognito ||
    details.method !== "GET" ||
    details.cookieStoreId === DEFAULT_COOKIE_STORE_ID ||
    details.cookieStoreId === PRIVATE_COOKIE_STORE_ID ||
    !shouldForceNoContainer(details.url)
  ) {
    return {};
  }

  if (requestMoves.has(details.tabId)) {
    return { cancel: true };
  }

  let tab;
  try {
    tab = await browser.tabs.get(details.tabId);
  } catch (error) {
    console.error("cannot inspect tab for no-container move", error);
    return {};
  }

  if (
    tab.incognito ||
    tab.cookieStoreId === DEFAULT_COOKIE_STORE_ID ||
    tab.cookieStoreId === PRIVATE_COOKIE_STORE_ID
  ) {
    return {};
  }

  requestMoves.add(details.tabId);
  let newTab;
  try {
    const createProperties = {
      active: tab.active,
      cookieStoreId: DEFAULT_COOKIE_STORE_ID,
      pinned: Boolean(tab.pinned),
      muted: Boolean(tab.mutedInfo && tab.mutedInfo.muted),
      url: "about:blank",
      windowId: tab.windowId,
      index: tab.index + 1,
    };
    newTab = await browser.tabs.create(createProperties);
  } catch (error) {
    requestMoves.delete(details.tabId);
    console.error("cannot create no-container tab", error);
    return {};
  }

  // Возвращаем отмену прежде, чем закрыть исходную вкладку: закрытие вкладки
  // из ожидающего ответа blocking-listener может задержать сам ответ.
  setTimeout(async () => {
    try {
      await browser.tabs.remove(tab.id);
    } catch (error) {
      console.warn("original container tab already closed", error);
    }
    try {
      await browser.tabs.update(newTab.id, { url: details.url });
    } catch (error) {
      console.error("cannot load URL in no-container tab", error);
    } finally {
      requestMoves.delete(details.tabId);
    }
  }, 0);

  return { cancel: true };
}

function hostMatchesRule(hostname, rule) {
  return hostname === rule || hostname.endsWith(`.${rule}`);
}

function normalizeHosts(hosts) {
  if (!Array.isArray(hosts)) {
    return [];
  }

  return [...new Set(hosts.map((host) => host.trim().toLowerCase()).filter(Boolean))].sort();
}

async function loadNoContainerHosts() {
  const stored = await browser.storage.local.get(NO_CONTAINER_HOSTS_STORAGE_KEY);
  const storedHosts = stored[NO_CONTAINER_HOSTS_STORAGE_KEY];

  if (Array.isArray(storedHosts)) {
    noContainerHosts = normalizeHosts([...storedHosts, ...defaultNoContainerHosts]);
    if (noContainerHosts.length !== normalizeHosts(storedHosts).length) {
      await browser.storage.local.set({
        [NO_CONTAINER_HOSTS_STORAGE_KEY]: noContainerHosts,
      });
    }
    return;
  }

  await browser.storage.local.set({
    [NO_CONTAINER_HOSTS_STORAGE_KEY]: noContainerHosts,
  });
}

function shouldForceNoContainer(url) {
  if (!canOpenURL(url)) {
    return false;
  }

  let parsedURL;
  try {
    parsedURL = new URL(url);
  } catch {
    return false;
  }

  const hostname = parsedURL.hostname.toLowerCase();
  return noContainerHosts.some((rule) => hostMatchesRule(hostname, rule));
}

browser.browserAction.onClicked.addListener((tab) => {
  openInNoContainer(tab, tab && tab.url).catch((error) => {
    console.error("open in no container failed", error);
  });
});

browser.menus.create({
  contexts: ["link"],
  id: "open-link-no-container",
  title: "Open Link in No Container",
});

browser.menus.create({
  contexts: ["page"],
  id: "open-page-no-container",
  title: "Open Page in No Container",
});

browser.menus.onClicked.addListener((info, tab) => {
  const url = info.menuItemId === "open-link-no-container" ? info.linkUrl : tab && tab.url;

  openInNoContainer(tab, url).catch((error) => {
    console.error("open in no container failed", error);
  });
});

browser.webRequest.onBeforeRequest.addListener(
  moveConfiguredRequestBeforeLoading,
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["blocking"],
);

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[NO_CONTAINER_HOSTS_STORAGE_KEY]) {
    return;
  }

  noContainerHosts = normalizeHosts([
    ...normalizeHosts(changes[NO_CONTAINER_HOSTS_STORAGE_KEY].newValue),
    ...defaultNoContainerHosts,
  ]);
});

loadNoContainerHosts().catch((error) => {
  console.error("load no-container hosts failed", error);
});
