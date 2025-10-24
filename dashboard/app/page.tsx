"use client";

import { useCallback, useRef, useState } from "react";
import { fal } from "@fal-ai/client";

const FAL_API_KEY = process.env.NEXT_PUBLIC_FAL_KEY || "";
const FAL_ENDPOINT = process.env.NEXT_PUBLIC_FAL_ENDPOINT || "alex-w67ic4anktp1/8a22dddb-5b9a-4e38-98a8-46c7fd0cd42e";

// Configure fal client
fal.config({
  credentials: FAL_API_KEY,
});

// SpongeBob voice by default! (same as web app demo)
const SPONGEBOB_VOICE = "https://storage.googleapis.com/remade-v2/tests/Spongebob%20Squarepants%20-%20They're%20Using%20Actors.mp3";

const REFERENCE_VOICES = [
  { value: SPONGEBOB_VOICE, label: "SpongeBob (Default)" },
  // Users can add their own reference audio URLs here
];

export default function SpeechToSpeechApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [partialTranscription, setPartialTranscription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [referenceVoice, setReferenceVoice] = useState(SPONGEBOB_VOICE);
  const [exaggeration, setExaggeration] = useState(0.25);
  const [temperature, setTemperature] = useState(0.7);
  const [cfg, setCfg] = useState(0.5);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkCounterRef = useRef<number>(0);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const SILENCE_THRESHOLD = 0.02; // Increased for easier detection
  const SILENCE_DURATION = 1500; // Increased to 1.5s to get more audio
  const MAX_CHUNKS_BEFORE_PROCESS = 50; // Process after 50 chunks (~5 seconds)
  
  // Add debug logging
  const [audioLevel, setAudioLevel] = useState(0);
  const lastProcessTimeRef = useRef<number>(0);

  const uploadAudioChunk = async (audioBlob: Blob, fileName: string): Promise<string> => {
    // Use fal.ai client library for upload (avoids CORS issues)
    const file = new File([audioBlob], fileName, { type: audioBlob.type });
    const url = await fal.storage.upload(file);
    return url;
  };

  const processAudioChunk = async (chunkNumber: number, audioBlob: Blob, fileName: string) => {
    try {
      console.log(`🎵 Starting to process chunk ${chunkNumber}, size: ${(audioBlob.size / 1024).toFixed(2)}KB`);
      setPartialTranscription(`Processing audio chunk ${chunkNumber}...`);

      // Upload audio chunk
      console.log(`📤 Uploading chunk ${chunkNumber} to fal.ai/storage...`);
      const audioUrl = await uploadAudioChunk(audioBlob, fileName);
      console.log(`✓ Chunk ${chunkNumber} uploaded to:`, audioUrl);

      setPartialTranscription(`Transcribing and cloning voice for chunk ${chunkNumber}...`);

      // Call YOUR speech-to-speech endpoint using fal client
      console.log(`🎙️ Calling endpoint: ${FAL_ENDPOINT}`);
      console.log(`📋 Payload:`, {
        audio_url: audioUrl,
        task: "transcribe",
        source_language: "en",
        reference_audio_url: referenceVoice,
        exaggeration: exaggeration,
        temperature: temperature,
        cfg: cfg,
      });
      
      const result = await fal.subscribe(FAL_ENDPOINT, {
        input: {
          audio_url: audioUrl,
          task: "transcribe",
          source_language: "en",
          reference_audio_url: referenceVoice,
          exaggeration: exaggeration,
          temperature: temperature,
          cfg: cfg,
        },
        logs: true,
        onQueueUpdate: (update: any) => {
          console.log(`📊 Queue update:`, update);
        },
      }) as any;

       console.log(`✅ Full result received:`, result);
       console.log(`✅ Result data:`, result.data);
       
       // Extract from result.data (fal.subscribe returns {data: {...}, requestId: ...})
       const newText = result.data?.transcribed_text || "";
       const audioFileUrl = result.data?.audio?.url;
       
       console.log(`📝 Transcribed text:`, newText);
       console.log(`🔊 Audio URL:`, audioFileUrl);
       
       if (newText.trim()) {
         setTranscription((prev) => prev + (prev ? " " : "") + newText);
         console.log(`📝 Updated transcription in state`);
       }
       
       if (audioFileUrl) {
         console.log(`🎵 Setting generated audio and attempting playback:`, audioFileUrl);
         setGeneratedAudio(audioFileUrl);
         
         // Auto-play the audio (like web app does)
         try {
           const audio = new Audio(audioFileUrl);
           await audio.play();
           console.log(`🔊 Audio playback started successfully!`);
         } catch (playErr) {
           console.error(`⚠️ Auto-play failed (user interaction may be required):`, playErr);
         }
       } else {
         console.warn(`⚠️ No audio URL found in result`);
       }
    } catch (err) {
      console.error(`❌ Error processing chunk ${chunkNumber}:`, err);
      setError(err instanceof Error ? err.message : "Failed to process audio chunk");
    } finally {
      setPartialTranscription("");
    }
  };

  const detectSilence = useCallback(() => {
    if (!analyserRef.current) return false;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / bufferLength);
    
    // Update audio level for UI
    setAudioLevel(rms);

    return rms < SILENCE_THRESHOLD;
  }, []);

  const monitorSilence = useCallback(() => {
    if (!isRecording || !detectSilence) return;

    const isSilent = detectSilence();
    const now = Date.now();
    
    // Auto-process if we have too many chunks (prevent infinite buffering)
    if (audioChunksRef.current.length >= MAX_CHUNKS_BEFORE_PROCESS) {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const chunkNumber = ++chunkCounterRef.current;
      const fileName = `chunk_${chunkNumber}_${Date.now()}.webm`;

      console.log(`⏱️ Max chunks reached (${audioChunksRef.current.length}), processing chunk ${chunkNumber}`);
      processAudioChunk(chunkNumber, audioBlob, fileName);

      audioChunksRef.current = [];
      lastProcessTimeRef.current = now;
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    }
    // Process on silence detection
    else if (isSilent && audioChunksRef.current.length > 0) {
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const chunkNumber = ++chunkCounterRef.current;
          const fileName = `chunk_${chunkNumber}_${Date.now()}.webm`;

          console.log(`🔇 Silence detected, processing chunk ${chunkNumber}`);
          processAudioChunk(chunkNumber, audioBlob, fileName);

          audioChunksRef.current = [];
          lastProcessTimeRef.current = Date.now();
          silenceTimeoutRef.current = null;
        }, SILENCE_DURATION);
      }
    } else {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    }

    if (isRecording) {
      requestAnimationFrame(monitorSilence);
    }
  }, [isRecording, detectSilence]);

  const startRecording = async () => {
    try {
      setError(null);
      setTranscription("");
      setPartialTranscription("");
      setGeneratedAudio(null);
      chunkCounterRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`📊 Audio chunk received: ${(event.data.size / 1024).toFixed(2)}KB, total chunks: ${audioChunksRef.current.length}`);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const chunkNumber = ++chunkCounterRef.current;
          const fileName = `chunk_${chunkNumber}_${Date.now()}.webm`;
          processAudioChunk(chunkNumber, audioBlob, fileName);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      requestAnimationFrame(monitorSilence);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Real-time Speech-to-Speech</h1>
          <p className="text-gray-400">
            Transform your voice with AI - Powered by Wizper (STT) + Kokoro (TTS)
          </p>
        </header>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-sm font-medium mb-2">Reference Voice</label>
            <select
              value={referenceVoice}
              onChange={(e) => setReferenceVoice(e.target.value)}
              disabled={isRecording}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {REFERENCE_VOICES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Exaggeration: {exaggeration.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={exaggeration}
              onChange={(e) => setExaggeration(parseFloat(e.target.value))}
              disabled={isRecording}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Temperature: {temperature.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              disabled={isRecording}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              CFG Scale: {cfg.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={cfg}
              onChange={(e) => setCfg(parseFloat(e.target.value))}
              disabled={isRecording}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>
        </div>

        {/* Main Panel */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Transcription</h2>
            <div className="flex gap-2">
              {isRecording && audioChunksRef.current.length > 0 && (
                <button
                  onClick={() => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                    const chunkNumber = ++chunkCounterRef.current;
                    const fileName = `chunk_${chunkNumber}_${Date.now()}.webm`;
                    console.log(`🔵 Manual trigger - processing chunk ${chunkNumber}`);
                    processAudioChunk(chunkNumber, audioBlob, fileName);
                    audioChunksRef.current = [];
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-sm transition-colors"
                >
                  ⚡ Process Now
                </button>
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isRecording
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isRecording ? "🔴 Stop Recording" : "🎤 Start Recording"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {isRecording && (
            <div className="mb-4 p-3 bg-blue-900/50 border border-blue-700 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <p className="text-blue-200">Listening...</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Audio Level:</span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-100"
                    style={{ width: `${Math.min(100, audioLevel * 5000)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{audioLevel.toFixed(4)}</span>
              </div>
              <div className="mt-2">
                <span className="text-xs text-gray-400">
                  Chunks collected: {audioChunksRef.current.length}
                </span>
              </div>
            </div>
          )}

          <div className="min-h-[200px] bg-gray-900 rounded-lg p-4">
            {transcription && (
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-1">Transcribed:</p>
                <p className="text-lg leading-relaxed">{transcription}</p>
              </div>
            )}

            {partialTranscription && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Processing:</p>
                <p className="text-lg leading-relaxed italic text-gray-400">
                  {partialTranscription}
                </p>
              </div>
            )}

            {!transcription && !partialTranscription && !error && (
              <p className="text-center text-gray-500">
                {isRecording
                  ? "Speak now to see your transcription..."
                  : "Click 'Start Recording' to begin"}
              </p>
            )}
          </div>
        </div>

        {/* Audio Player */}
        {generatedAudio && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3">Generated Audio</h3>
            <audio
              src={generatedAudio}
              controls
              autoPlay
              className="w-full"
            />
          </div>
        )}

          {/* Info */}
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">How it works</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>✓ Click "Start Recording" to activate your microphone</li>
            <li>✓ Speak naturally - pauses (800ms silence) trigger automatic processing</li>
            <li>✓ Your speech is transcribed using Whisper (transformers pipeline)</li>
            <li>✓ Text is converted to speech with <strong>SpongeBob's voice</strong> using Chatterbox TTS voice cloning!</li>
            <li>✓ Generated audio plays automatically when ready</li>
            <li>✓ Adjust exaggeration, temperature, and CFG to fine-tune the voice</li>
          </ul>

          <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
            <p className="text-sm text-yellow-200">
              <strong>🧽 SpongeBob Voice Active!</strong> Your speech will be transformed into SpongeBob's iconic voice in real-time.
            </p>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Parameters:</h4>
            <ul className="space-y-1 text-xs text-gray-400">
              <li><strong>Exaggeration:</strong> Higher values make the voice more exaggerated and characteristic</li>
              <li><strong>Temperature:</strong> Controls randomness (higher = more varied)</li>
              <li><strong>CFG Scale:</strong> Controls how closely it follows the reference voice</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
