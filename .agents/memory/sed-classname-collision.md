---
name: sed class name collision
description: Bulk sed replacements on class names that are substrings of other class names create doubled prefixes.
---

## Rule
Never run `sed 's/\bStation\b/GasStation/g'` on a file that already contains `GasStation`. The word boundary `\b` does NOT prevent `GasStation` from being matched and rewritten to `GasGasStation`.

**Why:** sed's `\b` matches at word boundaries, but `GasStation` contains `Station` — the replacement runs on it too, producing `GasGasStation`.

**How to apply:**
- Always use a negative lookahead-safe pattern, or explicitly match only the bare name: `sed 's/\([^a-zA-Z]\)Station\b/\1GasStation/g'`.
- Alternatively, use Python's `re.sub(r'(?<!Gas)Station', 'GasStation', text)` for safer replacement.
- After any bulk sed replacement, immediately grep to verify zero occurrences of the doubled form: `grep -c "GasGasStation" file.py` should return 0.
