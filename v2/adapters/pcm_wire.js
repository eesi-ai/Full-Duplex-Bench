/** Convert one PCM16 mono sink frame to the orchestrator's wire sample rate. */
function resampleToWire(samples, fromRate, wireRate) {
  if (!Number.isFinite(fromRate) || fromRate <= 0) throw new Error('Invalid sink sample rate');
  if (fromRate === wireRate) return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const output = new Int16Array(Math.round(samples.length * wireRate / fromRate));
  for (let i = 0; i < output.length; i += 1) {
    const position = i * fromRate / wireRate;
    const left = Math.floor(position);
    const right = Math.min(left + 1, samples.length - 1);
    const weight = position - left;
    output[i] = Math.round(samples[left] * (1 - weight) + samples[right] * weight);
  }
  return Buffer.from(output.buffer);
}

module.exports = { resampleToWire };
