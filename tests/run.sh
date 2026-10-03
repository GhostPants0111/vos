#!/usr/bin/env bash
# Runs every Vos test suite. Needs Python 3 with Playwright and a Chromium it can find.
# Each suite serves the repo on its own localhost port and mocks the AI APIs (no key, no network).
cd "$(dirname "$0")"
fail=0
for t in smoke android install busy aqkey desk firefox hints; do
  echo "== $t"
  if ! python3 "$t.py"; then echo "!! $t FAILED"; fail=1; fi
done
[ $fail = 0 ] && echo "ALL SUITES PASS" || { echo "SOME SUITES FAILED"; exit 1; }
