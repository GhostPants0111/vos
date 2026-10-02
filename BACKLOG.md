# Backlog

Feedback collected while using v1.0.0. Batched into the next release.

## Requested

_None open._

## Proposed, not yet approved

- Tappable word-family entries on Word cards (each tap is a new lookup). Parked: maybe later.
- Report button on AI results that copies input + output in one tap, for faster feedback.
- Show the version number more prominently so it's obvious when an update has landed.

## Done

### v1.9.0 (2026-10-02)

22. **Firefox on Android: no mic button.** Firefox doesn't support web speech recognition, so the app hides the mic (keyboard dictation still works). Proposed: keep the mic button visible everywhere; in browsers without speech recognition, tapping it focuses the text box and shows "usá el micrófono del teclado". Also make the install banner browser-aware (Firefox: menu ⋮ → Instalar / Agregar a la pantalla de inicio; Chrome steps only in Chrome) and mention Chrome works best on Android. _Small._

23. **Photos in one step.** Corregir: one call to the photo model that reads the photo and corrects it together; the result shows the corrections, and the text it read goes into the box so a misread can be fixed and re-checked. Words it was unsure about are flagged in the result. Traducir already reads and translates in one call. Preview/rotate screen dropped on Traducir and Corregir (kept on Palabra for its focus box); photo goes straight to the result, retake if needed. _Small-medium._

24. **English UI: rename "Check" to "Correct"** (tab, button, help, messages), to match Corregir. _Quick._

### v1.8.2 (2026-10-01)

- **Diagnostics for Gemini failures.** When every model refuses, the error now lists what Google said for each one (status and message). A per-minute rate limit (429 mentioning per-minute) stops the fallback chain at once instead of burning more requests. The free-limit message points to aistudio.google.com/rate-limit.

### v1.8.1 (2026-10-01)

- **Fix: Gemini kept answering "overloaded".** Google returns 503 when a model is busy across all users, and free-tier traffic is turned away first; gemini-3.8-flash (newest) is the most crowded. The app now falls back through gemini-3.6-flash, 3.5-flash and 3.5-flash-lite on 503/500/429/404, remembers which one worked for the rest of the session, and only shows "overloaded" if all four are busy.

### v1.8.0 (2026-10-01)

21. **Setup guide: focus on getting the app working; phones only.**
    (a) Drop the "Conjugar already works" intro; the guide is only about getting set up (install to home screen on phones, then the key). Feature explanations stay in Ayuda.
    (b) Bug: the guide showed Android install steps on a desktop browser. On a computer, show "open Vos on your Android or iPhone" instead, with a QR code of the link to scan with the phone, and a small "use it here anyway" link that reveals the key steps.
    Soft version chosen (QR + "use it here anyway"), not a hard block. _Small._

### v1.7.1 (2026-10-01)

- **Fix: Google keys always showed "rejected".** Google AI Studio now issues keys starting with AQ. (the old AIza keys are being retired), and the app only recognised AIza, so AQ. keys were sent to Anthropic. Now any key that isn't sk-ant- goes to Gemini; the guide says keys start with AQ.; if Google refuses the key in the header the app retries with it in the URL; key errors show Google's own reason.

### v1.7.0 (2026-09-30)

20. **Install prompt when opened in a phone browser.** A banner at the top when Vos runs in the browser instead of from the home screen, on phones only. Android: a one-tap Instalar button that opens Chrome's own install dialog; if Chrome hasn't offered it yet, menu ⋮ → Agregar a la pantalla principal instructions. iPhone: Compartir → Agregar a inicio instructions, with the warning that Safari may erase data otherwise. Hidden once installed, on desktop, and for the rest of the session after dismissing or answering the install dialog. Follows the app language. _Small._

### v1.6.0 (2026-09-30)

19. **"How to use Vos" help page.** Explains what each feature does and how to get the most out of it: Conjugar (infinitive or any form, Por persona, the toggles, tap to hear), Palabra (lookups in Spanish or English, Raíces, photo lookup with the focus box), Traducir (auto direction, Informal/Formal, photo, dictation and the ES/EN mic), Corregir (Solo errores vs Exigime, photo of handwriting with proofreading, dictation), and Más (Guardados, Historial, Ajustes). In Spanish and English, following the app language.
   Shipped as a fourth section in Más (Ayuda / Help), one card per tool with a Probalo button that opens that tool with an example filled in (Conjugar runs it; the AI tabs wait for a tap so nothing is spent). The setup guide now stays open after a working key and offers a link to Ayuda. _Small._

### v1.5.0 (2026-09-30)

15. **"¿Qué es esto?" photo lookup on Palabra.** Camera and gallery buttons on Palabra. Every object or dish in the photo named the way it's said in Uruguay: el/la + word, most prominent first, up to about 8, the general term when it differs (frutilla, fresa elsewhere), a one-line description for dishes, a short position hint when useful ("the small round green one, front left"), and a flag when the model isn't sure. A list, not labels drawn on the photo. Each item: tap to hear, star, open a full Palabra lookup. Optional short text box with the photo to focus it ("just the food", "¿qué es lo de la izquierda?"). Uses the photo model (Sonnet, or Gemini Flash with a Gemini key). _Small-medium._

16. **Country / variety setting.** Principle: Uruguay-first. Uruguay is the default, first in the list and the app's identity; no auto-switching from the phone's language, changing country is always a deliberate choice in Ajustes.
    Decided so far: every Spanish-speaking country as its own entry, no grouping. The "acá" note on Palabra (and all regional notes) follows the selected country. Every country prompt carries a rule not to invent differences: if usage matches the wider region, say nothing.
    Conjugar modes: vos first (Uruguay, Argentina, Paraguay, Nicaragua, Costa Rica, Guatemala, Honduras, El Salvador); tú first with vos shown (Bolivia, Colombia, Venezuela, Ecuador, Chile plus a present-tense "voseo chileno" row); tú only (Perú, México, Cuba, República Dominicana, Puerto Rico, Panamá); tú only plus vosotros shown automatically (España).
    Country notes: Argentina same forms as UY, vos subjunctive more accepted; Paraguay Guaraní mixing; Chile verbal voseo (estái, podís); Bolivia vos in Santa Cruz and Tarija; Colombia usted among friends, vos in Medellín and Cali; Costa Rica ustedeo; Ecuador vos in the Sierra; Venezuela vos in Zulia; España leísmo, vosotros. Smaller varieties get thinner AI knowledge.
    Not included: Estados Unidos (US Spanish comes from other countries' varieties) and Guinea Ecuatorial. _Medium._

17. **Setup guide for new users.** When the app opens with no API key, show a guide: Conjugar works right away; for the AI tabs, step-by-step for a free Google Gemini key (recommended for newcomers) or a paid Anthropic key; paste the key right in the guide and test it. Also reachable from Ajustes and from the "no key" error. Includes install-to-home-screen steps for Android and iPhone. _Small-medium._

18. **Make camera, gallery and dictation work on iPhone.** Visually hidden file inputs instead of display:none (iOS label quirk); dictation without auto-restart on iOS (Safari only allows mic start from a tap) and a keyboard-mic fallback message; tab bar lifted above the iOS keyboard using visualViewport; voice list loaded lazily for iOS speech. Can't test on a real iPhone from here; needs a real-device check. _Small._

### v1.4.0 (2026-09-30)

12. **Fix: the language toggle should switch the interface, not the AI explanations.** Replace "Explicaciones de la IA" with an interface language toggle (Español / English) that changes every label, button, hint, toast and error. Needs a full English string set alongside the Spanish one.
    Shipped as two separate toggles in Ajustes: app language (Español / English) and AI explanation language. The explanation toggle now also drives Palabra: definitions, part of speech, and root meanings come back in Spanish (monolingual-dictionary style, no English example translation) or in English. New installs on a non-Spanish phone start in English. _Small-medium._

13. **Remove the model pickers from Ajustes.** Lock text to Haiku and photos to Sonnet in code; change them in a future version if needed. Anyone whose saved setting differs gets reset to these. _Quick._

14. **Google Gemini as an alternative AI provider**, so a stranger can use the app with a free Gemini key instead of paying for Anthropic.
    Proposed: one key field that recognises the provider from the key itself (Anthropic keys start sk-ant-, Google keys start AIza), so there is no provider picker. Gemini uses gemini-3.8-flash (current newest Flash, on the free tier) for both text and photos. Ajustes gets a short note that Google's free tier may use what you send to improve their products. Needs a round of prompt testing against real Gemini output, which requires a free Gemini key from Google AI Studio. _Medium._

### v1.3.0 (2026-09-30)

8. **Photo reading misreads Cory's handwriting on Haiku** (Check tab).
   Test 1: sideways photo returned only 16 words, all wrong. Test 2: the same kind of page upright on Haiku got roughly the first sentence right, then degraded into mostly invented words. A larger Claude model read the same upright photo almost completely, so the photo is fine and Haiku is the limit. Test 3: Sonnet on the same upright photo was near-perfect and kept Cory's real mistakes intact (por que, important, en hoy día); its only misses were on markup (two caret insertions dropped, one green correction taken). Sonnet confirmed for photo reading; Opus not needed.
   Plan: (a) send photo reading to a stronger model (Sonnet by default, own setting), everything else stays on Haiku; (b) rotate button before sending; (c) low priority, since Cory normally photographs clean pages: basic markup handling in the reading prompt (drop struck-through words, include caret insertions); (d) tap-to-enlarge photo for proofreading. _Small-medium._

9. **Voice input on Translate and Check.** Speak instead of type.
   Plan: mic button next to the camera buttons, using Chrome's built-in speech recognition (free, no API cost, needs signal). It has to be told the language before listening, so Translate gets a Spanish/English choice defaulting to Spanish; Check is always Spanish (es-UY). Text lands in the box for a quick look before Check or Translate. Dictation keeps listening until Cory taps stop (continuous mode; restart quietly if Chrome cuts out on a pause). Translate mic defaults to Spanish; Cory mostly dictates Spanish he heard.
   Note: dictation normalises what you say (no spelling or accent mistakes exist in speech, and the recognizer leans toward correct words), so Check on dictated text grades spoken grammar and word choice, not spelling. _Small._

10. **Clear (x) button on the Translate and Check text boxes.** The search fields on Conjugate and Word have one; the big text boxes don't. _Quick._

11. **Whole interface in Spanish.** Tabs, buttons, toggles, placeholders, hints, toasts and error messages, all in Uruguayan Spanish with voseo for instructions (Buscá, Traducí, Corregí, Sacá una foto). Tab names: Conjugar, Palabra, Traducir, Corregir, Más.
   AI explanations: toggle in Ajustes, "Explicaciones: español / inglés", default español. Covers the "why" on each Check fix, the pattern note, Translate notes, and the acá / ojo notes on Word.
   Word definitions stay in English regardless of the toggle (sense definitions, example translations, root and family meanings). Cory likes them as they are; revisit later. _Small._

### v1.2.0 (2026-09-30)

7. **Word: show roots and their meanings.**
   Shipped as a collapsed Roots line (tap to open): a compact "Roots" block on each Word card with (a) the parts breakdown, e.g. des- (undo) + cubrir (cover), with meanings; (b) a one-line origin (Latin, Arabic, etc.), optional, shown only for words with a clear, well-known origin; (c) word family, 3 to 6 related Spanish words with short meanings; (d) an English cognate, optional, shown only when it helps memory, flagged if it's a false friend. Family words are plain text for now (not tappable).
   Note: morphology and word families are reliable; detailed etymology is where the model is likeliest to invent things, so keep origin to one short line and allow it to be omitted. Small prompt + render change, adds a little to each lookup's cost. _Small._

### v1.1.0 (2026-09-30)

1. **Check: add camera and photo upload.** Take a picture or pick an image of handwritten or on-screen text, have it read, then corrected.
   Note: the reading step has to transcribe exactly, mistakes included, or Haiku will quietly fix errors before Check ever sees them. Plan: read the photo into the text box first so it can be eyeballed and edited, then Check it. Must handle both handwriting and printed or on-screen text; both will get heavy use. _Small-medium._

2. **Keyboard covers the bottom tab bar.** Keep auto-opening the keyboard, but tabs must stay reachable while it's up. Either move tabs to the top or pin them above the keyboard.
   Note: Chrome on Android supports making the layout shrink when the keyboard opens (viewport `interactive-widget=resizes-content`), which keeps the bottom bar sitting on top of the keyboard. Try that first, fall back to top tabs. Keep auto-opening the keyboard on every tab, including Translate and Check. _Quick._

3. **Translate: camera button only opens the gallery.** Needs to be able to take a photo directly.
   Note: bug, missing capture setting. Fix with two buttons, camera and gallery, and use the same pair on Check (#1). _Quick._

4. **Conjugator is a long scroll.** Make the tables quicker to scan.
   Approved: mood tabs under the vos box (Indicativo / Subjuntivo / Imperativo / Compuestos) showing one mood at a time; compound tenses grouped in their own tab since they're just haber + participle; pretérito anterior and futuro de subjuntivo (near-extinct in speech) hidden by default. Last-used mood tab sticks between lookups. _Small._

5. **"By person" toggle on the conjugator.** Pick one person (yo, vos, tú, él/ella/usted, nosotros, ellos/ustedes) and see just that form across every tense, one line per tense, grouped by mood.
   Note: in this mode the whole verb fits on roughly one screen, so mood tabs aren't needed while it's on. Reverse lookup should pre-select the person: typing `dijeran` opens on ellos/ustedes. Toggle and chosen person both stick between lookups. _Small._

6. **Remove the "vos" name from the top bar** to save vertical space on every screen.
   Note: the saved, history and settings icons live in that bar, so they need a new home. Approved: drop the top bar entirely and add a fifth bottom tab, More, holding Saved, History and Settings. _Small._
