"""
Speech-to-Speech Application using Fal Serverless

This app provides real-time speech-to-speech translation using:
- Whisper (via transformers pipeline) for speech-to-text
- Chatterbox TTS for voice cloning text-to-speech

The app is completely self-contained and doesn't rely on external endpoints.
Following the same patterns as the fal registry. Uses SpongeBob voice by default!
"""

import tempfile
from pathlib import Path
from typing import Literal

import fal
from fal.exceptions import FieldException
from fal.toolkit import File
from fastapi import Response
from pydantic import BaseModel, Field


class SpeechToTextInput(BaseModel):
    """Input for speech-to-text transcription"""

    audio_url: str = Field(
        description="URL of the audio file to transcribe. Supported formats: mp3, mp4, mpeg, mpga, m4a, wav or webm.",
        examples=[
            "https://storage.googleapis.com/falserverless/model_tests/whisper/dinner_conversation.mp3"
        ],
    )
    task: Literal["transcribe", "translate"] = Field(
        default="transcribe",
        description="Task to perform on the audio file. Either transcribe or translate to English.",
    )
    language: str = Field(
        default="en",
        description="Language of the audio file (e.g., 'en', 'es', 'fr'). If translate is selected, audio will be translated to English.",
    )


class SpeechToTextOutput(BaseModel):
    """Output from speech-to-text transcription"""

    text: str = Field(description="Transcribed text from the audio")


class TextToSpeechInput(BaseModel):
    """Input for text-to-speech synthesis with voice cloning"""

    text: str = Field(
        description="Text to convert to speech",
        examples=[
            "The future belongs to those who believe in the beauty of their dreams. So, dream big, work hard, and make it happen!"
        ],
    )
    audio_url: str = Field(
        description="URL of reference audio for voice cloning (e.g., SpongeBob voice)",
        examples=[
            "https://storage.googleapis.com/remade-v2/tests/Spongebob%20Squarepants%20-%20They're%20Using%20Actors.mp3"
        ],
        default="https://storage.googleapis.com/remade-v2/tests/Spongebob%20Squarepants%20-%20They're%20Using%20Actors.mp3",
    )
    exaggeration: float = Field(
        default=0.25,
        ge=0.0,
        le=1.0,
        description="Exaggeration level for the voice. Default is 0.25.",
    )
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Temperature for generation. Default is 0.7.",
    )
    cfg: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Classifier-free guidance scale. Default is 0.5.",
    )


class TextToSpeechOutput(BaseModel):
    """Output from text-to-speech synthesis"""

    audio: File = Field(
        description="The generated audio file",
        examples=[
            File._from_url(
                "https://fal.media/files/elephant/dXVMqWsBDG9yan3kaOT0Z_tmp0vvkha3s.wav"
            )
        ],
    )


class SpeechToSpeechInput(BaseModel):
    """Input for end-to-end speech-to-speech with voice cloning"""

    audio_url: str = Field(
        description="URL of the audio file to process. The audio will be transcribed and then converted back to speech.",
        examples=[
            "https://storage.googleapis.com/falserverless/model_tests/whisper/dinner_conversation.mp3"
        ],
    )
    task: Literal["transcribe", "translate"] = Field(
        default="transcribe",
        description="Task to perform. 'transcribe' maintains original language, 'translate' converts to English.",
    )
    source_language: str = Field(
        default="en",
        description="Language of the source audio",
    )
    reference_audio_url: str = Field(
        description="URL of reference audio for voice cloning (e.g., SpongeBob voice)",
        examples=[
            "https://storage.googleapis.com/remade-v2/tests/Spongebob%20Squarepants%20-%20They're%20Using%20Actors.mp3"
        ],
        default="https://storage.googleapis.com/remade-v2/tests/Spongebob%20Squarepants%20-%20They're%20Using%20Actors.mp3",
    )
    exaggeration: float = Field(
        default=0.25,
        ge=0.0,
        le=1.0,
        description="Exaggeration level for the voice. Default is 0.25.",
    )
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Temperature for generation. Default is 0.7.",
    )
    cfg: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Classifier-free guidance scale. Default is 0.5.",
    )


class SpeechToSpeechOutput(BaseModel):
    """Output from end-to-end speech-to-speech"""

    transcribed_text: str = Field(description="The transcribed text from the input audio")
    audio: File = Field(description="The generated audio file from the transcribed text")


class SpeechToSpeechApp(
    fal.App,
    keep_alive=600,
    min_concurrency=0,
    max_concurrency=5,
    name="speech-to-speech",
):
    """
    Real-time Speech-to-Speech Application

    This app combines Whisper (transformers) for STT and Chatterbox for voice cloning TTS
    to provide low-latency speech-to-speech capabilities with custom voices (like SpongeBob!).
    """

    machine_type = "GPU-H100"  # Use H100 for Flash Attention 2
    requirements = [
        # Chatterbox TTS dependencies (installs torch==2.6.0)
        "git+https://github.com/Harshvardhan-To1/chatterbox.git@daa9542fdeb4c94df151a8d85cfd3cec125e3f1a",
        "torch==2.6.0",
        "torchvision==0.21.0",
        "torchaudio==2.6.0",
        # Flash Attention 2 - using pre-built wheel (30-40% faster)
        "https://github.com/Dao-AILab/flash-attention/releases/download/v2.7.2.post1/flash_attn-2.7.2.post1+cu12torch2.5cxx11abiFALSE-cp311-cp311-linux_x86_64.whl",
        # Whisper dependencies
        "transformers>=4.37.0",
        "accelerate==1.8.1",
        "ffmpeg-python==0.2.0",
        # Other Chatterbox dependencies
        "librosa==0.11.0",
        "resemble-perth==1.0.1",
        "soundfile==0.13.1",
        "numpy==1.26.4",
        # Common dependencies
        "httpx==0.27.0",
    ]

    async def setup(self) -> None:
        """Initialize both Faster-Whisper (STT) and Kokoro (TTS) models"""
        print("=== Setting up Speech-to-Speech App ===")

        # Setup Whisper (STT)
        print("Loading Whisper (Speech-to-Text)...")
        self._setup_whisper()

        # Setup Chatterbox (TTS)
        print("Loading Chatterbox (Text-to-Speech with voice cloning)...")
        self._setup_chatterbox()

        print("=== Setup Complete ===")

    def _setup_whisper(self) -> None:
        """Setup Whisper speech-to-text model using transformers pipeline (optimized for speed)"""
        import torch
        from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

        # Use turbo model for 2x faster inference
        model_id = "openai/whisper-large-v3-turbo"
        
        # Load model with Flash Attention 2 for maximum speed
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_id,
            torch_dtype=torch.float16,
            attn_implementation="flash_attention_2",  # 30-40% faster than default
        )
        model.to("cuda:0")

        processor = AutoProcessor.from_pretrained(model_id)

        # Create pipeline optimized for low latency
        self.stt_pipeline = pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            chunk_length_s=15,  # Reduced from 30 for lower latency
            batch_size=8,       # Reduced from 24 for faster processing
            torch_dtype=torch.float16,
            device="cuda:0",
        )
        
        print("✓ Whisper-turbo model loaded with Flash Attention 2 (ultra-low latency)")

    def _setup_chatterbox(self) -> None:
        """Setup Chatterbox text-to-speech model for voice cloning"""
        import httpx
        import torch
        from chatterbox.tts import ChatterboxTTS
        from chatterbox.models.s3gen import S3Gen

        # Load Chatterbox TTS model
        self.tts_model = ChatterboxTTS.from_pretrained(device="cuda")
        
        # Download and load S3Gen model for speech enhancement
        s3_gen_url = "https://storage.googleapis.com/falserverless/chatterbox/s3gen.pt"
        s3_gen_path = Path("/data/chatterbox") / "s3gen.pt"
        s3_gen_path.parent.mkdir(parents=True, exist_ok=True)
        
        if not s3_gen_path.exists():
            with httpx.Client(timeout=60.0) as client:
                response = client.get(s3_gen_url)
                response.raise_for_status()
                s3_gen_path.write_bytes(response.content)
        
        s3gen = S3Gen()
        s3gen.load_state_dict(torch.load(str(s3_gen_path), map_location=None))
        s3gen.to("cuda")
        s3gen.eval()
        self.s3_gen = s3gen
        
        print("✓ Chatterbox TTS model loaded (voice cloning ready with SpongeBob voice!)")

    def _transcribe_audio(
        self, audio_url: str, task: str, language: str
    ) -> str:
        """Transcribe audio using Faster-Whisper"""
        import httpx
        
        with tempfile.TemporaryDirectory() as tmpdir:
            download_dir = Path(tmpdir) / "input"
            download_dir.mkdir(parents=True, exist_ok=True)

            # Download the audio file
            try:
                # Determine file extension from URL
                from urllib.parse import urlparse
                parsed = urlparse(audio_url)
                ext = Path(parsed.path).suffix or ".mp3"
                target_path = download_dir / f"audio{ext}"
                
                # Download using httpx
                with httpx.Client(timeout=30.0) as client:
                    response = client.get(audio_url)
                    response.raise_for_status()
                    target_path.write_bytes(response.content)
                    
            except Exception as e:
                raise FieldException(
                    "audio_url",
                    f"Failed to download audio file: {str(e)}",
                ) from e

            # Transcribe using transformers pipeline
            try:
                generate_kwargs = {
                    "task": task,
                    "language": language if language else None,
                }
                
                result = self.stt_pipeline(
                    str(target_path),
                    generate_kwargs=generate_kwargs,
                    return_timestamps=False,
                )
                
                transcription = result["text"].strip()
                
                if not transcription:
                    raise FieldException(
                        "audio_url",
                        "No speech detected in the audio.",
                    )
                
                return transcription
                
            except Exception as e:
                if "No speech detected" in str(e) or isinstance(e, FieldException):
                    raise
                raise FieldException(
                    "audio_url",
                    f"Failed to transcribe audio: {str(e)}",
                ) from e

    def _synthesize_speech(
        self, text: str, reference_audio_url: str, exaggeration: float, 
        temperature: float, cfg: float, response: Response
    ) -> File:
        """Synthesize speech using Chatterbox TTS with voice cloning"""
        import httpx
        import soundfile as sf
        import torch

        if len(text) >= 20000:
            raise FieldException(
                field="text",
                message="Text must be less than 20000 characters.",
            )

        # Download reference audio
        with tempfile.TemporaryDirectory() as tmpdir:
            ref_audio_path = Path(tmpdir) / "reference.mp3"
            try:
                with httpx.Client(timeout=30.0) as client:
                    response_http = client.get(reference_audio_url)
                    response_http.raise_for_status()
                    ref_audio_path.write_bytes(response_http.content)
            except Exception as e:
                raise FieldException(
                    "audio_url",
                    f"Failed to download reference audio: {str(e)}",
                ) from e

            # Generate speech with voice cloning
            import torchaudio as ta
            
            with torch.inference_mode():
                wav = self.tts_model.generate(
                    text,
                    temperature=temperature,
                    cfg_weight=cfg,
                    exaggeration=exaggeration,
                    audio_prompt_path=str(ref_audio_path),
                )
                audio_array = wav

            # Set billing units based on text length
            response.headers["x-fal-billable-units"] = str(max(1, len(text) // 1000))

            # Save to file and return as File
            import torchaudio as ta
            
            output_path = "generated_speech.wav"
            ta.save(output_path, wav, self.tts_model.sr)
            
            return File.from_path(
                output_path,
                content_type="audio/wav",
                request=response,
            )

    @fal.endpoint("/transcribe")
    def transcribe(
        self,
        input: SpeechToTextInput,
        response: Response,
    ) -> SpeechToTextOutput:
        """
        Transcribe audio to text using Whisper (transformers pipeline).

        This endpoint provides fast, accurate speech-to-text transcription
        supporting multiple languages and translation to English.
        """
        text = self._transcribe_audio(input.audio_url, input.task, input.language)
        return SpeechToTextOutput(text=text)

    @fal.endpoint("/synthesize")
    def synthesize(
        self,
        input: TextToSpeechInput,
        response: Response,
    ) -> TextToSpeechOutput:
        """
        Convert text to speech using Chatterbox TTS with voice cloning.

        This endpoint provides natural-sounding text-to-speech synthesis
        by cloning the voice from a reference audio file (e.g., SpongeBob!).
        """
        audio = self._synthesize_speech(
            input.text, input.audio_url, input.exaggeration, 
            input.temperature, input.cfg, response
        )
        return TextToSpeechOutput(audio=audio)

    @fal.endpoint("/")
    async def speech_to_speech(
        self,
        input: SpeechToSpeechInput,
        response: Response,
    ) -> SpeechToSpeechOutput:
        """
        End-to-end speech-to-speech processing.

        This endpoint combines speech-to-text and text-to-speech to provide
        complete speech transformation, useful for voice translation,
        accent conversion, or voice cloning applications.
        """
        # Step 1: Transcribe input audio
        transcribed_text = self._transcribe_audio(
            input.audio_url, input.task, input.source_language
        )

        # Step 2: Synthesize speech from transcribed text with voice cloning
        output_audio = self._synthesize_speech(
            transcribed_text, input.reference_audio_url, input.exaggeration,
            input.temperature, input.cfg, response
        )

        return SpeechToSpeechOutput(
            transcribed_text=transcribed_text,
            audio=output_audio,
        )


# To deploy this app, run:
# fal deploy speech-to-speech/app.py::SpeechToSpeechApp

