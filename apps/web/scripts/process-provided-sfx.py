"""Trim provided SFX into public/audio/sfx. Originals stay in audio/sources."""

from __future__ import annotations

import math
import shutil
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "audio" / "sources"
OUT = ROOT / "public" / "audio" / "sfx"
DOWNLOADS = Path(r"C:\Users\Kurou\Downloads\sounds")

ORIGINALS = [
    "start-end-timer-countdown-1954.wav",
    "mixkit-simple-game-countdown-921.wav",
    "imposter reveal.wav",
    "Correct.mp3",
    "mixkit-game-level-completed-2059.wav",
]


def copy_originals() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    for name in ORIGINALS:
        dest = SRC / name
        src = DOWNLOADS / name
        if src.exists():
            shutil.copy2(src, dest)
        elif not dest.exists():
            raise SystemExit(f"missing source audio: {name}")


def read_wav(path: Path):
    with wave.open(str(path), "rb") as handle:
        params = handle.getparams()
        raw = handle.readframes(params.nframes)
    if params.sampwidth != 2:
        raise SystemExit(f"expected 16-bit PCM: {path}")
    count = len(raw) // 2
    samples = list(struct.unpack("<" + "h" * count, raw))
    return params, samples


def write_wav(path: Path, params, samples: list[int]) -> None:
    raw = struct.pack("<" + "h" * len(samples), *samples)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(params.nchannels)
        handle.setsampwidth(params.sampwidth)
        handle.setframerate(params.framerate)
        handle.writeframes(raw)


def frame_index(params, seconds: float) -> int:
    frame = int(round(seconds * params.framerate))
    return max(0, min(params.nframes, frame))


def slice_frames(params, samples: list[int], start_s: float, end_s: float) -> list[int]:
    start = frame_index(params, start_s) * params.nchannels
    end = frame_index(params, end_s) * params.nchannels
    return samples[start:end]


def fade(params, samples: list[int], fade_in_s: float, fade_out_s: float) -> list[int]:
    frames = len(samples) // params.nchannels
    in_n = min(frames, int(round(fade_in_s * params.framerate)))
    out_n = min(frames, int(round(fade_out_s * params.framerate)))
    out = list(samples)
    for i in range(in_n):
        gain = i / in_n if in_n else 1
        for ch in range(params.nchannels):
            idx = i * params.nchannels + ch
            out[idx] = int(out[idx] * gain)
    for i in range(out_n):
        gain = (out_n - i) / out_n if out_n else 1
        frame = frames - out_n + i
        for ch in range(params.nchannels):
            idx = frame * params.nchannels + ch
            out[idx] = int(out[idx] * gain)
    return out


def trim_silence(params, samples: list[int], pad_s: float = 0.02, thresh: float = 0.01) -> list[int]:
    frames = len(samples) // params.nchannels
    first = 0
    last = frames - 1
    for i in range(frames):
        peak = max(abs(samples[i * params.nchannels + ch]) for ch in range(params.nchannels)) / 32768.0
        if peak >= thresh:
            first = i
            break
    for i in range(frames - 1, -1, -1):
        peak = max(abs(samples[i * params.nchannels + ch]) for ch in range(params.nchannels)) / 32768.0
        if peak >= thresh:
            last = i
            break
    pad = int(round(pad_s * params.framerate))
    start = max(0, first - pad)
    end = min(frames, last + 1 + pad)
    sliced = samples[start * params.nchannels : end * params.nchannels]
    return fade(params, sliced, 0.006, 0.012)


def duration(params, samples: list[int]) -> float:
    return (len(samples) / params.nchannels) / params.framerate


def mp3_duration_seconds(path: Path) -> float:
    data = path.read_bytes()
    bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
    i = 0
    seconds = 0.0
    frames = 0
    while i + 4 <= len(data):
        if data[i] != 0xFF or data[i + 1] & 0xE0 != 0xE0:
            i += 1
            continue
        version = (data[i + 1] >> 3) & 0x03
        layer = (data[i + 1] >> 1) & 0x03
        bitrate = bitrates[(data[i + 2] >> 4) & 0x0F]
        sample_idx = (data[i + 2] >> 2) & 0x03
        padding = (data[i + 2] >> 1) & 0x01
        if version != 3 or layer != 1 or bitrate == 0:
            i += 1
            continue
        sr = [44100, 48000, 32000][sample_idx]
        frame_len = math.floor(144 * bitrate * 1000 / sr) + padding
        seconds += 1152 / sr
        frames += 1
        i += max(frame_len, 1)
    return seconds if frames else 0.0


def main() -> None:
    copy_originals()
    OUT.mkdir(parents=True, exist_ok=True)

    params, samples = read_wav(SRC / "start-end-timer-countdown-1954.wav")
    # Last audible hit is 1.800s-2.090s (the 4th beep, louder than the ticks).
    timing = fade(params, slice_frames(params, samples, 1.798, 2.108), 0.002, 0.008)
    write_wav(OUT / "timing-window.wav", params, timing)
    print(f"timing-window.wav {duration(params, timing):.3f}s")

    params, samples = read_wav(SRC / "imposter reveal.wav")
    reveal = trim_silence(params, samples)
    write_wav(OUT / "imposter-reveal.wav", params, reveal)
    print(f"imposter-reveal.wav {duration(params, reveal):.3f}s")

    params, samples = read_wav(SRC / "mixkit-game-level-completed-2059.wav")
    round_win = trim_silence(params, samples)
    write_wav(OUT / "round-result.wav", params, round_win)
    print(f"round-result.wav {duration(params, round_win):.3f}s")

    shutil.copy2(SRC / "Correct.mp3", OUT / "correct.mp3")
    print(f"correct.mp3 {mp3_duration_seconds(OUT / 'correct.mp3'):.3f}s")

    params, samples = read_wav(SRC / "mixkit-simple-game-countdown-921.wav")
    # 3-2-1 beeps at 0s/1s/2s, GO at 3.00-3.16s, then unused silence.
    countdown = fade(params, slice_frames(params, samples, 0.0, 3.22), 0.002, 0.02)
    write_wav(OUT / "countdown-tick.wav", params, countdown)
    print(f"countdown-tick.wav {duration(params, countdown):.3f}s")

    leftover = OUT / "correct.wav"
    if leftover.exists():
        leftover.unlink()
        print("removed generated correct.wav")


if __name__ == "__main__":
    main()
