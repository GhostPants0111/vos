# Vos

A personal Spanish reference for Android, tuned for Uruguay. Installable as an app from the browser.

**Conjugate** works fully offline: 638 verbs, every tense, vos first. Type an infinitive for the full table, or any conjugated form (`dijeran`, `andate`, `sos`) to find out what it is. Verbs outside the database can be conjugated by AI, clearly labelled.

**Word**, **Translate** and **Check** call Claude through your own Anthropic API key, with prompts that target Montevideo usage rather than generic Latin American Spanish.

## Install on the phone

1. Open the site in Chrome.
2. Menu, then **Add to home screen** (or **Install app**).
3. Open it, tap the gear, paste your Anthropic API key, tap **Test**.

The key is stored only in that browser on that phone. It is never in this repo. Set a monthly spend limit in the Anthropic Console.

## Updating

Edit files, bump `VERSION` in `sw.js` so phones pick up the change, push to `main`. GitHub Pages redeploys on its own.

To rebuild the verb data after changing the vos rules: `cd tools && python3 build_data.py`.

## Credits

Conjugations come from the Spanish Verb Forms database by Fred Jehle, compiled by Brian Ghidinelli
([source](https://github.com/ghidinelli/fred-jehle-spanish-verbs)), licensed
[CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/). Vos forms, the -se subjunctive and haber
were derived or added here. This project is shared under the same licence.
