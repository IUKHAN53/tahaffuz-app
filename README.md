# Tahaffuz · App

Expo Android app for the **Tahaffuz** EPI vaccinator-training assistant. Chat
(text + voice) against the [tahaffuz-backend](https://github.com/IUKHAN53/tahaffuz-backend)
RAG service.

- **Stack:** Expo SDK 54 · React Native · TypeScript · React Native Paper (Material 3)
- **Voice in:** `expo-audio` (m4a) → Gemini transcribe + answer
- **Voice out:** `expo-speech` (`ur-PK` / `en-US`)
- **Language:** in-chat dropdown (English default, Urdu option). Auto-detects per chat if not overridden.

## Run (local dev)

```bash
npm install
npx expo start --clear
# in the running terminal: press `a` to open the Android emulator
```

To point at a local backend instead of production, edit `app.json` →
`extra.apiBase` (use `http://10.0.2.2:8000` for the Android emulator hitting the
host machine).

## Brand pipeline

The Speech-Shield icon set is regenerated from `assets/brand-source.svg`:

```bash
node scripts/gen-icons.mjs
```

This:
1. Downloads Noto Nastaliq Urdu TTF once (`scripts/.fonts/`, gitignored).
2. Shapes `تحفظ` with HarfBuzz (full GSUB substitution — Nastaliq requires it).
3. Converts shaped glyphs → SVG paths via `opentype.js`.
4. Composes the mark and rasterizes via `sharp` into `icon.png`,
   `adaptive-icon.png`, `splash-icon.png`, and `favicon.png`.

The pre-rendered PNGs are committed so cloning + running doesn't require the
font download / HarfBuzz / Sharp chain.
