# Edge TTS for Zotero

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

**Read aloud selected text in Zotero's PDF reader** using Microsoft Edge TTS neural voices — high-quality, natural-sounding speech in 300+ voices across 70+ languages.

## Features

- **Read Aloud** — Select text in any PDF and hear it spoken aloud
- **300+ Neural Voices** — All Microsoft Edge TTS voices available (Portuguese, English, Spanish, French, German, and many more)
- **Speed Control** — Adjustable playback speed from 0.5x to 4.0x
- **Keyboard Shortcuts** — `Ctrl+Shift+S` to read, `Ctrl+Shift+X` to stop
- **Persistent Settings** — Voice and speed preferences are saved automatically
- **Multilingual** — Interface available in English and Portuguese (Brazil)

## Requirements

1. **Zotero 7** (beta or later)
2. **Python 3** installed on your system
3. **edge-tts** Python package:

```bash
pip install edge-tts
```

## Installation

1. Download the latest `.xpi` file from [Releases](https://github.com/geraldohomero/edge-tts-zotero/releases)
2. In Zotero, go to **Tools → Add-ons**
3. Click the gear icon → **Install Add-on From File...**
4. Select the downloaded `.xpi` file

## Usage

### Read Aloud
1. Open a PDF in Zotero's reader
2. Select the text you want to hear
3. Use any of these methods:
   - **Keyboard shortcut**: `Ctrl+Shift+S`
   - **Right-click** → "🔊 Read Aloud (Edge TTS)"
   - **Tools menu** → "🔊 Read Aloud (Edge TTS)"

### Stop Reading
- Press `Ctrl+Shift+X`
- Or use the menu: "⏹ Stop Reading"

### Settings
Go to **Tools → Add-ons → Edge TTS for Zotero → Preferences**:

- **Voice**: Choose from all available Edge TTS voices, grouped by locale
- **Speed**: Adjust playback speed (0.5x to 4.0x)
- **Python Path**: Auto-detected, or set manually if needed
- **Test Voice**: Preview the selected voice

## Popular Voices

| Voice | Language | Gender |
|-------|----------|--------|
| `pt-BR-FranciscaNeural` | Portuguese (Brazil) | Female |
| `pt-BR-AntonioNeural` | Portuguese (Brazil) | Male |
| `en-US-JennyNeural` | English (US) | Female |
| `en-US-GuyNeural` | English (US) | Male |
| `en-GB-SoniaNeural` | English (UK) | Female |
| `es-ES-ElviraNeural` | Spanish (Spain) | Female |
| `fr-FR-DeniseNeural` | French (France) | Female |

> Run `edge-tts --list-voices` to see all 300+ available voices.

## Development

```bash
# Clone the repository
git clone https://github.com/geraldohomero/edge-tts-zotero.git
cd edge-tts-zotero

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your Zotero binary path

# Start development (hot reload)
npm start

# Build for production
npm run build
```

## License

AGPL-3.0-or-later

## Credits

- [edge-tts](https://github.com/rany2/edge-tts) — Python module for Microsoft Edge TTS
- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) — Plugin scaffold
- [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit) — Toolkit for Zotero plugin development
