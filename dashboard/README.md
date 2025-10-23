# Speech-to-Speech Dashboard

Real-time speech-to-speech transformation web interface.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

3. Add your Fal API key to `.env.local`:
```
NEXT_PUBLIC_FAL_KEY=your_fal_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Features

- 🎤 Real-time microphone capture
- 🔊 20+ voice options for TTS
- ⚡ Smart silence detection for automatic chunking
- 🎯 Adjustable speech speed (0.5x - 2.0x)
- 📝 Live transcription display
- 🎵 Auto-playing generated audio

## Requirements

- Node.js 18+
- Modern browser with microphone access
- Fal API key
