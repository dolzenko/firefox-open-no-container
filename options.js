"use strict";

const NO_CONTAINER_HOSTS_STORAGE_KEY = "noContainerHosts";
const defaultNoContainerHosts = NO_CONTAINER_HOSTS;

function normalizeHostLine(line) {
  let value = line.trim().toLowerCase();
  if (!value) {
    return "";
  }

  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) {
    value = `https://${value}`;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function normalizeHosts(text) {
  const hosts = text
    .split(/\r?\n/)
    .map(normalizeHostLine)
    .filter(Boolean);

  return [...new Set(hosts)].sort();
}

async function restoreOptions() {
  const stored = await browser.storage.local.get(NO_CONTAINER_HOSTS_STORAGE_KEY);
  const hosts = Array.isArray(stored[NO_CONTAINER_HOSTS_STORAGE_KEY])
    ? stored[NO_CONTAINER_HOSTS_STORAGE_KEY]
    : [];

  document.querySelector("#hosts").value = [...new Set([
    ...hosts,
    ...defaultNoContainerHosts,
  ])].sort().join("\n");
}

async function saveOptions(event) {
  event.preventDefault();

  const textarea = document.querySelector("#hosts");
  const hosts = [...new Set([
    ...normalizeHosts(textarea.value),
    ...defaultNoContainerHosts,
  ])].sort();
  await browser.storage.local.set({
    [NO_CONTAINER_HOSTS_STORAGE_KEY]: hosts,
  });

  textarea.value = hosts.join("\n");
  const status = document.querySelector("#status");
  status.textContent = "Saved";
  setTimeout(() => {
    status.textContent = "";
  }, 1500);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("#options-form").addEventListener("submit", saveOptions);
