# Open in No Container

[English](#english) | [Русский](#русский)

## English

Open in No Container is a Firefox extension for opening pages and links in a
regular tab outside Firefox Multi-Account Containers.

Source: https://github.com/dolzenko/firefox-open-no-container
License: MIT.

### Features

- Toolbar button: reopen the current page without a container.
- Context menu actions for pages and links.
- Automatic rules for hostnames that should leave a container.
- Options page for managing hostname rules without rebuilding the extension.
- Private windows are left untouched because private browsing already uses its
  own isolated cookie store and is not a Firefox Container.

The packaged defaults currently include `ru`, which matches every `.ru`
hostname and its subdomains. For example, it matches `example.ru` and
`www.example.ru`.
Packaged default rules remain active when custom rules are saved.

### How automatic rules work

When a matching HTTP(S) GET navigation starts in a container tab, the extension:

1. cancels the first request and creates an empty tab in Firefox's default cookie store;
2. closes the original container tab;
3. loads the URL in the new no-container tab.

The toolbar button and context menu use Firefox's
`tabs.create({ cookieStoreId: "firefox-default" })` API directly.

### Limitations

- Firefox may create the original container tab before the extension sees its
  navigation. The first matching request is canceled before it reaches the site.
- POST navigations stay in the original tab: reopening the URL cannot replay
  the form body safely.
- A Multi-Account Containers “Always open in this container” assignment can
  conflict with an automatic no-container rule. Remove the conflicting site
  assignment if the two extensions keep moving the same site in opposite
  directions.
- Private windows are intentionally ignored by automatic rules.

### Permissions

- `activeTab` and `tabs`: read the current tab URL and create/update tabs.
- `cookies`: required by Firefox when selecting a tab's `cookieStoreId`. The
  extension does not read, modify, or transmit cookies.
- `menus`: add page and link context menu actions.
- `storage`: save hostname rules locally in Firefox.
- `webRequest`, `webRequestBlocking`, and `<all_urls>`: intercept matching
  main-frame requests before loading. The host permission covers sites later
  added in Options without rebuilding the extension.

The extension does not collect or transmit user data.

### Development

Requirements: Firefox and `web-ext`.

```fish
node tests/navigation.test.js
web-ext lint --ignore-files sign-unlisted.sh tests amo-metadata.json README.md LICENSE
```

For manual temporary loading, open
`about:debugging#/runtime/this-firefox`, select `Load Temporary Add-on...`, and
choose `manifest.json`.

Persistent installation in Firefox Stable requires a Mozilla-signed XPI.

## Русский

Open in No Container — расширение Firefox для открытия страниц и ссылок в
обычной вкладке вне Firefox Multi-Account Containers.

Исходники: https://github.com/dolzenko/firefox-open-no-container
Лицензия: MIT.

### Возможности

- Кнопка на панели: переоткрыть текущую страницу без контейнера.
- Действия контекстного меню для страниц и ссылок.
- Автоматические правила для доменов, которые должны покидать контейнер.
- Страница настроек для изменения доменных правил без пересборки расширения.
- Private windows не затрагиваются: приватный режим уже использует отдельное
  изолированное cookie-хранилище и не является Firefox Container.

В packaged defaults сейчас есть правило `ru`: оно матчится на все домены `.ru`
и их поддомены. Например, на `example.ru` и `www.example.ru`.
Встроенные правила остаются активными после сохранения своего списка.

### Как работают автоматические правила

Когда в контейнерной вкладке начинается подходящий HTTP(S) GET-переход, расширение:

1. отменяет первый запрос и создаёт пустую вкладку в стандартном cookie store Firefox;
2. закрывает исходную контейнерную вкладку;
3. загружает URL в новой вкладке без контейнера.

Кнопка на панели и контекстное меню напрямую используют Firefox API
`tabs.create({ cookieStoreId: "firefox-default" })`.

### Ограничения

- Firefox может сначала создать контейнерную вкладку; расширение отменяет
  первый подходящий сетевой запрос до отправки сайту.
- POST-переходы остаются в исходной вкладке: повторное открытие URL не может
  безопасно восстановить тело формы.
- Назначение Multi-Account Containers «Всегда открывать в этом контейнере»
  может конфликтовать с автоматическим no-container правилом. Если два
  расширения перетаскивают один сайт в разные стороны, конфликтующее назначение
  сайта надо убрать.
- Автоматические правила намеренно игнорируют private windows.

### Разрешения

- `activeTab` и `tabs`: получить URL текущей вкладки и создавать/обновлять
  вкладки.
- `cookies`: Firefox требует это разрешение для выбора `cookieStoreId`
  вкладки. Расширение не читает, не изменяет и не передаёт cookies.
- `menus`: добавить действия в контекстное меню страниц и ссылок.
- `storage`: локально сохранять доменные правила в Firefox.
- `webRequest`, `webRequestBlocking` и `<all_urls>`: перехватывать
  подходящие запросы основного документа до загрузки. Доступ ко всем URL
  нужен, чтобы добавленные в настройках сайты работали без пересборки.

Расширение не собирает и не передаёт пользовательские данные.

### Разработка

Требуются Firefox и `web-ext`.

```fish
node tests/navigation.test.js
web-ext lint --ignore-files sign-unlisted.sh tests amo-metadata.json README.md LICENSE
```

Для временной ручной загрузки откройте
`about:debugging#/runtime/this-firefox`, нажмите `Load Temporary Add-on...` и
выберите `manifest.json`.

Для постоянной установки в Firefox Stable нужен XPI, подписанный Mozilla.
