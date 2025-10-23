"use client";

import { useCallback, useRef, useState } from "react";

const FAL_API_KEY = process.env.NEXT_PUBLIC_FAL_KEY || "";

const VOICE_OPTIONS = [
  { value: "af_heart", label: "Female - Heart" },
  { value: "af_alloy", label: "Female - Alloy" },
  { value: "af_bella", label: "Female - Bella" },
  { value: "af_nova", label: "Female - Nova" },
  { value: "af_sarah", label: "Female - Sarah" },
  { value: "am_adam", label: "Male - Adam" },
  { value: "am_echo", label: "Male - Echo" },
  { value: "am_liam", label: "Male - Liam" },
  { value: "am_michael", label: "Male - Michael" },
  { value: "am_onyx", label: "Male - Onyx" },
];

export default function SpeechToSpeechApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [partialTranscription, setPartialTranscription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState("af_heart");
  const [speechSpeed, setSpeechSpeed] = useState(1.0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkCounterRef = useRef<number>(0);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const SILENCE_THRESHOLD = 0.01;
  const SILENCE_DURATION = 800;

  const uploadAudioChunk = async (audioBlob: Blob, fileName: string): Promise<string> => {
    const formData = new FormData();
    formData.append("file", audioBlob, fileName);

    const response = await fetch("https://fal.ai/storage/upload", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.file_url;
  };

  const processAudioChunk = async (chunkNumber: number, audioBlob: Blob, fileName: string) => {
    try {
      setPartialTranscription(`Processing audio chunk ${chunkNumber}...`);

      // Upload audio chunk
      console.log(`📤 Uploading chunk ${chunkNumber}...`);
      const audioUrl = await uploadAudioChunk(audioBlob, fileName);
      console.log(`✓ Chunk ${chunkNumber} uploaded:`, audioUrl);

      setPartialTranscription(`Transcribing chunk ${chunkNumber}...`);

      // Call speech-to-speech endpoint
      const response = await fetch("https://queue.fal.run/fal-ai/speech-to-speech", {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          task: "transcribe",
          source_language: "en",
          voice: selectedVoice,
          speed: speechSpeed,
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const result = await response.json();
      const requestId = result.request_id;

      // Poll for results
      let completed = false;
      let pollCount = 0;
      const maxPolls = 60;

      while (!completed && pollCount < maxPolls) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        pollCount++;

        const statusResponse = await fetch(
          `https://queue.fal.run/fal-ai/speech-to-speech/requests/${requestId}/status`,
          {
            headers: {
              Authorization: `Key ${FAL_API_KEY}`,
            },
          }
        );

        const statusData = await statusResponse.json();

        if (statusData.status === "COMPLETED") {
          completed = true;
          const newText = statusData.response_data?.transcribed_text || "";
          if (newText.trim()) {
            setTranscription((prev) => prev + (prev ? " " : "") + newText);
            const audioFileUrl = statusData.response_data?.audio?.url;
            if (audioFileUrl) {
              setGeneratedAudio(audioFileUrl);
            }
          }
        } else if (statusData.status === "FAILED") {
          throw new Error(`Processing failed: ${statusData.error || "Unknown error"}`);
        }
      }

      if (!completed) {
        throw new Error("Processing timeout");
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

    return rms < SILENCE_THRESHOLD;
  }, []);

  const monitorSilence = useCallback(() => {
    if (!isRecording || !detectSilence) return;

    const isSilent = detectSilence();

    if (isSilent && audioChunksRef.current.length > 0) {
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const chunkNumber = ++chunkCounterRef.current;
          const fileName = `chunk_${chunkNumber}_${Date.now()}.webm`;

          console.log(`🔇 Silence detected, processing chunk ${chunkNumber}`);
          processAudioChunk(chunkNumber, audioBlob, fileName);

          audioChunksRef.current = [];
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
            <label className="block text-sm font-medium mb-2">Voice</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              disabled={isRecording}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {VOICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Speech Speed: {speechSpeed.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speechSpeed}
              onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
              disabled={isRecording}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>
        </div>

        {/* Main Panel */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Transcription</h2>
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

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {isRecording && (
            <div className="mb-4 p-3 bg-blue-900/50 border border-blue-700 rounded-lg flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <p className="text-blue-200">Listening...</p>
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
            <li>✓ Select your preferred voice and speech speed</li>
            <li>✓ Click "Start Recording" to activate your microphone</li>
            <li>✓ Speak naturally - pauses trigger automatic processing</li>
            <li>✓ Your speech is transcribed using Wizper (TensorRT-optimized Whisper)</li>
            <li>✓ Text is converted back to speech with your chosen voice using Kokoro TTS</li>
            <li>✓ Audio plays automatically when ready</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
