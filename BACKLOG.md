# Backlog

Feedback collected while using v1.0.0. Batched into the next release.

## Requested

1. **Check: add camera and photo upload.** Take a picture or pick an image of handwritten or on-screen text, have it read, then corrected.
   Note: the reading step has to transcribe exactly, mistakes included, or Haiku will quietly fix errors before Check ever sees them. Plan: read the photo into the text box first so it can be eyeballed and edited, then Check it. Must handle both handwriting and printed or on-screen text; both will get heavy use. _Small-medium._

2. **Keyboard covers the bottom tab bar.** Keep auto-opening the keyboard, but tabs must stay reachable while it's up. Either move tabs to the top or pin them above the keyboard.
   Note: Chrome on Android supports making the layout shrink when the keyboard opens (viewport `interactive-widget=resizes-content`), which keeps the bottom bar sitting on top of the keyboard. Try that first, fall back to top tabs. Keep auto-opening the keyboard on every tab, including Translate and Check. _Quick._

3. **Translate: camera button only opens the gallery.** Needs to be able to take a photo directly.
   Note: bug, missing capture setting. Fix with two buttons, camera and gallery, and use the same pair on Check (#1). _Quick._

## Proposed, not yet approved

- Report button on AI results that copies input + output in one tap, for faster feedback.
- Show the version number more prominently so it's obvious when an update has landed.

## Done
