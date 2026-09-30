# Backlog

Feedback collected while using v1.0.0. Batched into the next release.

## Requested

_None open._

## Proposed, not yet approved

- Report button on AI results that copies input + output in one tap, for faster feedback.
- Show the version number more prominently so it's obvious when an update has landed.

## Done

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
