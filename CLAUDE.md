# Vos: working notes for Claude

Vos is a Spanish reference app for one learner, Cory (English speaker living in Uruguay, B2 working toward C1). It's a PWA (progressive web app) served from GitHub Pages at https://ghostpants0111.github.io/vos/ and installed to his Android home screen. Read README.md for what the app does from a user's point of view, and BACKLOG.md for what's requested, parked and shipped.

## How Cory works with this repo

- He leaves feedback in chat. Log each item in BACKLOG.md under **Requested** with the next number, and push the backlog change. Don't build it yet.
- Build and ship only when he says so ("ship it", "go ahead and ship"). Then build, test, bump the version, move the items to **Done** under a new version heading with the date, commit and push.
- Ideas you come up with yourself go under **Proposed, not yet approved** until he approves them.
- He likes short, direct replies with 1 to 3 real follow-up questions. Spell out a domain acronym the first time it comes up. Never use the word "expat". In anything that ships (UI text, README, docs) avoid em dashes and AI-sounding phrasing.
- His API key never goes in chat or in the repo. It lives only in the app's localStorage on his phone.

## Principles

- **Uruguay first.** Uruguay is the default country, first in the list, and the app's identity. The country setting (20 countries) adapts prompts and the vos/tú/vosotros display, but never switch country automatically and never let another variety leak into the Uruguay defaults. Prompts must not invent a local difference where there isn't one.
- Vos forms come first in conjugation tables. Rare tenses are hidden by default.
- Two independent language settings: interface language (`S.ui`, es/en) and AI explanation language (`S.explain`, es/en; also drives Palabra definitions). Don't merge them.
- Photos must stay one step: a photo on Traducir or Corregir goes straight to the result.

## Architecture

No build step, no framework, no dependencies to install. Everything is plain files:

- `index.html`: the five views (`view-conj`, `view-word`, `view-tr`, `view-check`, `view-more`) and the bottom tab bar (`data-go`).
- `app.js`: the whole app, in labelled sections (CLAUDE API, CONJUGATE, WORD, TRANSLATE, CHECK, MORE, PHOTOS, TEXT BOXES, PALABRA photo lookup, SETUP GUIDE, INSTALL PROMPT, DICTATION, BOOT). Settings live in `S` and persist through the `store` wrapper (localStorage in try/catch).
- `style.css`: tokens at the top (celeste `#2270B0`, dark mode), then one block per release.
- `sw.js`: service worker, network first with cache fallback, cache named by `VERSION`. Ignores cross-origin requests, so API calls are never cached.
- `data/verbs.json`: 638 verbs, built by `tools/build_data.py` from `tools/jehle.csv` (Fred Jehle database, CC BY-NC-SA 3.0, which means **no commercial use**). Vos present, imperative and subjunctive are derived in the build script (vos subjunctive comes from the nosotros stem: podás, not puedás). Rebuild with `cd tools && python3 build_data.py`.
- `lib/qrcode.js`: qrcode-generator 1.4.4 (MIT), used for the desktop "open this on your phone" screen.

### i18n

All UI strings live in `I18N.es` and `I18N.en` in app.js; look them up with `t(key, ...args)`. Markup uses `data-i18n` (text), `data-i18n-html` (strings containing `<b>`), `data-i18n-ph` (placeholder), `data-i18n-aria`, `data-i18n-alt`. `applyI18n()` fills them and `refreshLanguage()` re-renders. Every new string needs both languages.

### AI providers

`ask({system, content, maxTokens, photo})` routes by key: keys starting `sk-ant-` go to Anthropic, anything else to Google Gemini (AI Studio now issues `AQ.` keys; older ones start `AIza`).

- Anthropic: direct browser calls with the `anthropic-dangerous-direct-browser-access: true` header. Models are fixed in code: `claude-haiku-4-5` for text, `claude-sonnet-5-5` for photos. Haiku could not read handwriting at all, so photos must stay on Sonnet. There is no model picker on purpose.
- Gemini: `generateContent` with the `x-goog-api-key` header (retried with `?key=`), JSON response mode, low thinking. Falls back through `gemini-3.8-flash`, `3.6-flash`, `3.5-flash`, `3.5-flash-lite` on 429/500/503/404, but stops at once on a per-minute 429. Errors show Google's reason for each model tried.
- Every prompt asks for JSON. Prompt builders: `conjSystem`, `wordSystem`, `trSystem`, `checkSystem`, `photoCheckSystem`, `identSystem`. Each one includes `VARIETY()` for the selected country.

### Platform quirks

- Dictation uses the Web Speech API. Android: non-continuous with an auto-restart loop. iOS: continuous, no restart. Firefox has no speech recognition, so the mic button focuses the box and suggests the keyboard's mic.
- Viewport uses `interactive-widget=resizes-content` so the Android keyboard doesn't cover the buttons. iOS lifts the tab bar with visualViewport.
- File inputs are visually hidden (`.vh`), not `display:none`, so camera and gallery work on iPhone.
- The install banner and setup guide only target phones. Desktop gets a QR handoff screen.

## Releasing

1. Bump `VERSION` in **both** `app.js` and `sw.js` (phones only pick up a change when the service worker cache name changes).
2. Run `tests/run.sh`. All suites must pass.
3. Update BACKLOG.md (move items to Done under the new version) and README.md if behaviour changed.
4. Commit and push to `main`. GitHub Pages redeploys in a minute or two.

## Tests

`tests/run.sh` runs eight headless Playwright suites. Each serves the repo on its own localhost port, mocks both AI APIs and fakes the speech recognizer, so no key or network is needed. Screenshots land in `tests/out/` (gitignored); look at them after UI changes.

| Suite | Covers |
|---|---|
| smoke.py | setup guide, help, every tab end to end, photos, dictation, history and saved, both providers, iPhone emulation, English UI |
| android.py | Android photo and dictation paths |
| install.py | install banner on Android Chrome and iPhone (also in English), hidden once installed and on desktop |
| busy.py | Gemini fallback chain and error reporting |
| aqkey.py | `AQ.` key detection |
| desk.py | desktop QR gate and "continue anyway" |
| firefox.py | Firefox on Android: install text and the no-speech-recognition fallback |
| hints.py | input hints show on an empty tab and hide once there's input or a result |

Add a suite or extend one for each new feature. Real iPhone testing has never been done; emulation only.
