# Speech-to-Speech Application

A real-time speech-to-speech application built with Fal Serverless, combining:
- **Whisper** (transformers pipeline) for fast speech-to-text transcription
- **Chatterbox TTS** for voice cloning text-to-speech synthesis

🧽 **Features SpongeBob voice by default!** Clone any voice from reference audio.

## Features

- 🎤 **Fast Speech-to-Text**: Whisper (transformers) for accurate transcription
- 🔊 **Voice Cloning TTS**: Chatterbox TTS clones any voice from reference audio
- 🧽 **SpongeBob Voice**: Default SpongeBob voice for fun real-time transformations
- 🌍 **Multi-language Support**: Transcribe and translate multiple languages
- ⚡ **Real-time Processing**: Optimized for low-latency interactions
- 🎯 **Multiple Endpoints**: Separate endpoints for STT, TTS, and combined speech-to-speech
- 🏗️ **Self-Contained**: No external dependencies - everything runs in one app
- 🎛️ **Adjustable Parameters**: Fine-tune exaggeration, temperature, and CFG

## Deployment

Deploy the app using the Fal CLI:

```bash
fal deploy speech-to-speech/app.py::SpeechToSpeechApp
```

## Usage

### Speech-to-Text (Transcription)

```python
import fal_client

result = fal_client.subscribe(
    "your-username/speech-to-speech/transcribe",
    arguments={
        "audio_url": "https://example.com/audio.mp3",
        "task": "transcribe",
        "language": "en"
    }
)

print(result["text"])
```

### Text-to-Speech (Synthesis)

```python
import fal_client

result = fal_client.subscribe(
    "your-username/speech-to-speech/synthesize",
    arguments={
        "text": "Hello, this is a test!",
        "voice": "af_heart",
        "speed": 1.0
    }
)

# Download the audio file
audio_url = result["audio"]["url"]
```

### End-to-End Speech-to-Speech

```python
import fal_client

result = fal_client.subscribe(
    "your-username/speech-to-speech",
    arguments={
        "audio_url": "https://example.com/input.mp3",
        "task": "transcribe",
        "source_language": "en",
        "voice": "af_heart",
        "speed": 1.0
    }
)

print("Transcribed:", result["transcribed_text"])
print("Audio URL:", result["audio"]["url"])
```

## API Endpoints

### `/transcribe` - Speech-to-Text
Transcribe audio to text using Wizper.

**Input:**
- `audio_url` (string): URL of audio file (mp3, wav, webm, etc.)
- `task` (string): "transcribe" or "translate"
- `language` (string): Source language code (e.g., "en", "es", "fr")

**Output:**
- `text` (string): Transcribed text

### `/synthesize` - Text-to-Speech
Convert text to speech using Kokoro TTS.

**Input:**
- `text` (string): Text to convert to speech
- `voice` (string): Voice ID (e.g., "af_heart", "am_adam")
- `speed` (float): Speech speed (0.1-5.0)

**Output:**
- `audio` (File): Generated audio file

### `/` - Speech-to-Speech
End-to-end speech transformation.

**Input:**
- `audio_url` (string): Input audio URL
- `task` (string): "transcribe" or "translate"
- `source_language` (string): Source language
- `voice` (string): Output voice ID
- `speed` (float): Output speech speed

**Output:**
- `transcribed_text` (string): Transcribed text
- `audio` (File): Generated audio file

## Voice Options

Available voices for TTS:
- **Female voices**: af_heart, af_alloy, af_aoede, af_bella, af_jessica, af_kore, af_nicole, af_nova, af_river, af_sarah, af_sky
- **Male voices**: am_adam, am_echo, am_eric, am_fenrir, am_liam, am_michael, am_onyx, am_puck, am_santa

## Requirements

- GPU: Any NVIDIA GPU (uses CTranslate2 optimization)
- Python: 3.11+
- fal CLI

## Architecture

```
┌─────────────┐
│  Input      │
│  Audio      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Wizper     │  ← TensorRT-optimized Whisper
│  (STT)      │    Fast transcription
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Text       │
│  Processing │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Kokoro     │  ← Natural TTS
│  (TTS)      │    Multiple voices
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Output     │
│  Audio      │
└─────────────┘
```

## License

See the main repository LICENSE file.

# speech-speech-realtime
