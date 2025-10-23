#!/bin/bash

# Deploy the Speech-to-Speech app to fal.ai
# Usage: ./deploy.sh

set -e

echo "🚀 Deploying Speech-to-Speech App to fal.ai..."

# Check if fal CLI is installed
if ! command -v fal &> /dev/null; then
    echo "❌ fal CLI is not installed. Please install it first:"
    echo "   pip install fal"
    exit 1
fi

# Deploy the app
echo "📦 Deploying app.py::SpeechToSpeechApp..."
fal deploy app.py::SpeechToSpeechApp

echo "✅ Deployment complete!"
echo ""
echo "You can now use the app at:"
echo "  https://fal.run/your-username/speech-to-speech"
echo ""
echo "Test the endpoints:"
echo "  POST /transcribe - Speech-to-text transcription"
echo "  POST /synthesize - Text-to-speech synthesis"
echo "  POST / - End-to-end speech-to-speech"

