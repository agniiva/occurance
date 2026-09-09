"""Generate a soft switch-click with no noise burst or sweeping tone."""
import math
import struct
import wave
from pathlib import Path

rate = 24000
duration = 0.055
samples = []
for i in range(round(rate * duration)):
    t = i / rate
    # A smooth bipolar impulse: rounded attack, no sustained hiss or pitch.
    x = (t - 0.009) / 0.0025
    samples.append(0.16 * x * math.exp(-0.5 * x * x) * min(1.0, t / 0.002))
path = Path(__file__).resolve().parents[1] / 'static/audio/channel-click.wav'
path.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(path), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(rate)
    output.writeframes(b''.join(struct.pack('<h', round(sample * 32767)) for sample in samples))
print({'path': str(path), 'duration': duration, 'peak': max(abs(x) for x in samples),
       'rms': math.sqrt(sum(x*x for x in samples)/len(samples))})
