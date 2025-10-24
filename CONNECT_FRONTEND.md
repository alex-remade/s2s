# Connecting Frontend to Backend

## Quick Start (Backend Already Running)

Since your backend is already running with `fal run app.py`, follow these steps:

### Step 1: Get Your Endpoint ID

From your terminal where you ran `fal run app.py`, find this section:

```
Asynchronous Endpoints (Recommended):
    https://queue.fal.run/alex-w67ic4anktp1/d3a393b4-44d8-48c2-a03a-ba7de38c1f16/
```

Copy the endpoint ID: `alex-w67ic4anktp1/d3a393b4-44d8-48c2-a03a-ba7de38c1f16`

### Step 2: Configure Frontend

```bash
cd dashboard

# Create .env.local file
cat > .env.local << 'EOF'
NEXT_PUBLIC_FAL_KEY=your_actual_fal_api_key_here
NEXT_PUBLIC_FAL_ENDPOINT=alex-w67ic4anktp1/d3a393b4-44d8-48c2-a03a-ba7de38c1f16
EOF
```

Replace:
- `your_actual_fal_api_key_here` with your real FAL API key
- `alex-w67ic4anktp1/d3a393b4-44d8-48c2-a03a-ba7de38c1f16` with YOUR endpoint ID

### Step 3: Start Frontend

```bash
npm run dev
```

### Step 4: Test!

1. Open http://localhost:3000
2. Click "Start Recording"
3. Allow microphone access
4. **Speak** into your microphone
5. **Pause** for 800ms
6. Listen to your voice as SpongeBob! 🧽

## How the Real-time Flow Works

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js Dashboard)                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ 1. User speaks
                          ▼
                   [Microphone Capture]
                          │
                          │ 2. Silence detected (800ms)
                          ▼
                  [Create Audio Chunk]
                          │
                          │ 3. Upload to fal.ai/storage
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Fal Serverless App)                               │
│                                                              │
│  POST https://queue.fal.run/YOUR-ENDPOINT/                  │
│  Body: {                                                     │
│    audio_url: "uploaded_chunk.webm",                        │
│    task: "transcribe",                                      │
│    source_language: "en",                                   │
│    reference_audio_url: "spongebob.mp3",                    │
│    exaggeration: 0.25,                                      │
│    temperature: 0.7,                                        │
│    cfg: 0.5                                                 │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ 4. Whisper transcribes audio
                          ▼
                    [Transcription Text]
                          │
                          │ 5. Chatterbox clones SpongeBob voice
                          ▼
                   [Generated Audio File]
                          │
                          │ 6. Return response
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND                                                    │
│                                                              │
│  - Display transcription                                    │
│  - Auto-play generated audio                                │
│  - Ready for next chunk                                     │
└─────────────────────────────────────────────────────────────┘
```

## Key Configuration Points

### Frontend Environment Variables

```env
# Required
NEXT_PUBLIC_FAL_KEY=fal_key_abc123...
NEXT_PUBLIC_FAL_ENDPOINT=username/app-id

# The frontend uses these to:
# - Upload audio chunks to fal.ai/storage
# - Call your speech-to-speech endpoint
# - Poll for results
```

### Backend Configuration (app.py)

```python
# Default SpongeBob reference
reference_audio_url: str = Field(
    default="https://storage.googleapis.com/.../Spongebob.mp3",
)

# Voice parameters
exaggeration: float = Field(default=0.25)  # 0-1
temperature: float = Field(default=0.7)     # 0-2
cfg: float = Field(default=0.5)             # 0-1
```

## Testing the Flow

### Test 1: Frontend → Backend

With both running:
1. Frontend: http://localhost:3000
2. Backend: `fal run app.py` (keep running)
3. Record audio in frontend
4. Check backend terminal for processing logs
5. Listen to SpongeBob audio in frontend

### Test 2: Direct API Call

Test backend directly:

```bash
# First, upload an audio file
curl -X POST https://fal.ai/storage/upload \
  -H "Authorization: Key YOUR_KEY" \
  -F "file=@test.mp3"

# Use the returned file_url
curl -X POST https://queue.fal.run/YOUR-ENDPOINT/ \
  -H "Authorization: Key YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "audio_url": "https://fal.ai/files/...",
    "task": "transcribe",
    "source_language": "en",
    "reference_audio_url": "https://storage.googleapis.com/.../Spongebob.mp3"
  }'
```

## Common Issues & Solutions

### "Failed to upload audio"
- ✓ Check `NEXT_PUBLIC_FAL_KEY` is set correctly
- ✓ Key must have upload permissions

### "Failed to call endpoint"
- ✓ Check `NEXT_PUBLIC_FAL_ENDPOINT` matches your actual endpoint
- ✓ Backend must be running (`fal run app.py`)
- ✓ Endpoint format: `username/app-id` (no https://)

### "No audio generated"
- ✓ Wait 30-60 seconds (first time is slower)
- ✓ Check browser console for errors
- ✓ Check backend logs for errors

### "Microphone not working"
- ✓ Use localhost or HTTPS
- ✓ Allow microphone permissions
- ✓ Check browser settings

## Next Steps

1. ✅ Test locally with `fal run app.py` + `npm run dev`
2. 🚀 Deploy backend: `fal deploy app.py::SpeechToSpeechApp --alias speech-to-speech`
3. 🌐 Deploy frontend to Vercel
4. 🎨 Customize voices by adding reference audio URLs
5. 🎛️ Tune parameters for best voice quality

Enjoy your real-time SpongeBob voice transformation! 🧽🎤

