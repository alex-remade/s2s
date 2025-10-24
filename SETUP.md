# Complete Setup Guide

## Step-by-Step Setup

### 1. Backend Setup (Fal Serverless)

```bash
cd speech-to-speech

# Test locally first
fal run app.py
```

This will output something like:
```
Playground:
    https://fal.ai/dashboard/sdk/alex-w67ic4anktp1/d3a393b4-44d8-48c2-a03a-ba7de38c1f16/
Asynchronous Endpoints (Recommended):
    https://queue.fal.run/alex-w67ic4anktp1/d3a393b4-44d8-48c2-a03a-ba7de38c1f16/
```

**Copy your endpoint ID** (e.g., `alex-w67ic4anktp1/d3a393b4-44d8-48c2-a03a-ba7de38c1f16`)

### 2. Frontend Setup

```bash
cd dashboard

# Install dependencies
npm install

# Create .env.local
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_FAL_KEY=your_fal_api_key_here
NEXT_PUBLIC_FAL_ENDPOINT=alex-w67ic4anktp1/d3a393b4-44d8-48c2-a03a-ba7de38c1f16
```

Replace with your actual:
- FAL API key (get from https://fal.ai/dashboard/keys)
- Endpoint ID (from step 1)

### 3. Run the Frontend

```bash
npm run dev
```

Open http://localhost:3000

## Usage

1. **Allow microphone access** when prompted
2. **Click "Start Recording"**
3. **Speak** into your microphone
4. **Pause** for 800ms - processing starts automatically
5. **Listen** to your voice transformed into SpongeBob! 🧽

## Troubleshooting

### Backend Issues

**Error: No module named 'fal'**
- Make sure you have fal installed: `pip install fal`

**Error: Failed to download**
- Check your internet connection
- Verify the audio URLs are accessible

### Frontend Issues

**Error: Failed to upload**
- Check your `NEXT_PUBLIC_FAL_KEY` in `.env.local`
- Make sure the API key is valid

**Error: Failed to call endpoint**
- Check your `NEXT_PUBLIC_FAL_ENDPOINT` in `.env.local`
- Make sure the backend is running (`fal run app.py`)
- Verify the endpoint ID is correct

**Microphone not working**
- Allow microphone permissions in your browser
- Use HTTPS or localhost (required for mic access)

## Advanced: Deploy to Production

### Deploy Backend

```bash
fal deploy app.py::SpeechToSpeechApp --alias speech-to-speech
```

This gives you a permanent endpoint like:
```
https://fal.run/your-username/speech-to-speech
```

Update your `.env.local`:
```
NEXT_PUBLIC_FAL_ENDPOINT=your-username/speech-to-speech
```

### Deploy Frontend

Deploy to Vercel:
```bash
cd dashboard
vercel deploy
```

Make sure to add environment variables in Vercel dashboard:
- `NEXT_PUBLIC_FAL_KEY`
- `NEXT_PUBLIC_FAL_ENDPOINT`

## Customizing Voices

To use different reference voices, edit `dashboard/app/page.tsx`:

```typescript
const REFERENCE_VOICES = [
  { value: SPONGEBOB_VOICE, label: "SpongeBob (Default)" },
  { value: "https://your-voice.mp3", label: "My Voice" },
  { value: "https://celebrity-voice.mp3", label: "Celebrity Voice" },
];
```

Any audio file will work as a reference! The model will clone the voice characteristics.

