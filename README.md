# Vos

A Spanish reference for your phone, built for Uruguay first. Installable as an app from the browser on Android and iPhone. A country setting in Ajustes adapts it to any of 20 Spanish-speaking countries; Uruguay is always the default.

**Conjugate** works fully offline: 638 verbs, every tense, vos first. Type an infinitive for the full table, or any conjugated form (`dijeran`, `andate`, `sos`) to find out what it is. Verbs outside the database can be conjugated by AI, clearly labelled.

**Palabra**, **Traducir** and **Corregir** call AI through your own API key, with prompts that target Montevideo usage rather than generic Latin American Spanish. With an Anthropic key, text goes to Claude Haiku and photos to Claude Sonnet, which reads handwriting far better. With a Google Gemini key (free tier available at aistudio.google.com) everything goes to Gemini Flash. The app tells the two apart from the key itself (Anthropic keys start with sk-ant-; Google keys start with AQ., or AIza for older ones). Traducir and Corregir also take dictation through Chrome's built-in speech recognition. The interface is in Spanish or English, and AI explanations have their own language setting.

## Install on the phone

1. Android: open the site in Chrome, menu ⋮ → **Add to Home screen**. iPhone: open it in Safari, Share → **Add to Home Screen** (important: otherwise Safari may erase saved data).
2. On first launch a setup guide explains how to get a free Google Gemini key or a paid Anthropic key; paste it right there.
3. Palabra can also identify objects and dishes from a photo.

The key is stored only in that browser on that phone. It is never in this repo. With Anthropic, set a monthly spend limit in the Console. On Gemini's free tier, Google may use what you send to improve its products.

## Updating

Edit files, bump `VERSION` in `sw.js` so phones pick up the change, push to `main`. GitHub Pages redeploys on its own.

To rebuild the verb data after changing the vos rules: `cd tools && python3 build_data.py`.

## Credits

Conjugations come from the Spanish Verb Forms database by Fred Jehle, compiled by Brian Ghidinelli
([source](https://github.com/ghidinelli/fred-jehle-spanish-verbs)), licensed
[CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/). Vos forms, the -se subjunctive and haber
were derived or added here. This project is shared under the same licence.
