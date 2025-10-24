# Speech-to-Speech Dashboard

Real-time speech-to-speech transformation web interface with SpongeBob voice cloning! 🧽

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

3. Add your Fal API key and endpoint to `.env.local`:
```
NEXT_PUBLIC_FAL_KEY=your_fal_api_key_here
NEXT_PUBLIC_FAL_ENDPOINT=your-username/your-app-id
```

To get your endpoint:
- Run `fal run app.py` from the parent directory
- Copy the endpoint ID from the output (e.g., `alex-w67ic4anktp1/d3a393b4-44d8-48c2-a03a-ba7de38c1f16`)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Features

- 🎤 Real-time microphone capture
- 🧽 **SpongeBob voice cloning** (or any reference audio!)
- ⚡ Smart silence detection for automatic chunking (800ms threshold)
- 🎛️ Adjustable voice parameters:
  - Exaggeration (0-1): Controls voice characteristic strength
  - Temperature (0-2): Controls variation/randomness
  - CFG Scale (0-1): Controls adherence to reference voice
- 📝 Live transcription display
- 🎵 Auto-playing generated audio

## How It Works

1. **Speak** into your microphone
2. **Silence detection** automatically creates chunks when you pause
3. **Whisper** transcribes your speech to text
4. **Chatterbox TTS** clones the reference voice (SpongeBob!) and speaks your text
5. **Auto-play** the generated audio

## Adding Custom Voices

Edit the `REFERENCE_VOICES` array in `app/page.tsx` to add your own reference audio URLs:

```typescript
const REFERENCE_VOICES = [
  { value: SPONGEBOB_VOICE, label: "SpongeBob (Default)" },
  { value: "https://your-audio.mp3", label: "Custom Voice" },
];
```

## Requirements

- Node.js 18+
- Modern browser with microphone access
- Fal API key
- Deployed speech-to-speech backend
