# Speech-to-Speech Quickstart

Get started with the Speech-to-Speech application in minutes!

## Project Structure

```
speech-to-speech/
├── app.py                 # Fal serverless backend
├── requirements.txt       # Python dependencies
├── deploy.sh             # Deployment script
└── dashboard/            # Next.js frontend
    ├── app/
    │   └── page.tsx      # Main UI
    ├── package.json
    └── README.md
```

## Quick Start

### 1. Deploy the Backend (Fal Serverless)

```bash
# Install fal CLI if you haven't
pip install fal

# Deploy the app
cd speech-to-speech
./deploy.sh
```

This will deploy three endpoints:
- `/transcribe` - Speech-to-text only
- `/synthesize` - Text-to-speech only
- `/` - Full speech-to-speech pipeline

### 2. Run the Frontend

```bash
# Navigate to dashboard
cd dashboard

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Edit .env.local and add:
# NEXT_PUBLIC_FAL_KEY=your_fal_api_key
# NEXT_PUBLIC_FAL_ENDPOINT=your-endpoint-id
# (Get the endpoint ID from the 'fal run' output above)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Test the Real-time Flow

1. Open the dashboard in your browser
2. Click "Start Recording" and allow microphone access
3. Speak into your microphone
4. Pause for 800ms - the app will automatically:
   - Upload your audio chunk
   - Transcribe it with Whisper
   - Clone the SpongeBob voice with your transcribed text
   - Play the audio back to you in SpongeBob's voice! 🧽

## Usage

1. **Select Voice**: Choose from 20+ voices
2. **Adjust Speed**: Set speech speed (0.5x - 2.0x)
3. **Start Recording**: Click to begin
4. **Speak**: Talk naturally, pauses trigger processing
5. **Listen**: Generated audio plays automatically

## Testing the API Directly

```python
import fal_client

# Speech-to-Speech
result = fal_client.subscribe(
    "your-username/speech-to-speech",
    arguments={
        "audio_url": "https://example.com/audio.mp3",
        "task": "transcribe",
        "source_language": "en",
        "voice": "af_heart",
        "speed": 1.0
    }
)

print(result["transcribed_text"])
print(result["audio"]["url"])
```

## Next Steps

- Customize voices and settings
- Integrate into your application
- Add language translation support
- Deploy frontend to Vercel/Netlify

## Support

- [Fal Documentation](https://docs.fal.ai)
- [GitHub Issues](https://github.com/fal-ai)

