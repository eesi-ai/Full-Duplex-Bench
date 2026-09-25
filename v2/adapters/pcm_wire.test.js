const assert = require('node:assert/strict');
const test = require('node:test');
const { resampleToWire } = require('./pcm_wire');

test('16 kHz sink frames retain ten millisecond duration at 48 kHz', () => {
  const rate = 16000;
  const frame = new Int16Array(rate / 100);
  for (let i = 0; i < frame.length; i += 1) frame[i] = Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / rate));
  const wire = resampleToWire(frame, rate, 48000);
  assert.equal(wire.length, 960);
  const output = new Int16Array(wire.buffer, wire.byteOffset, wire.length / 2);
  assert.ok(Math.max(...output) > 10000);
  assert.ok(Math.min(...output) < -10000);
});

test('adjacent frames preserve sample count and waveform continuity', () => {
  const rate = 16000;
  const frames = [0, 1].map(chunk => {
    const frame = new Int16Array(rate / 100);
    for (let i = 0; i < frame.length; i += 1) frame[i] = Math.round(10000 * Math.sin(2 * Math.PI * 200 * (chunk * frame.length + i) / rate));
    return new Int16Array(resampleToWire(frame, rate, 48000).buffer);
  });
  assert.equal(frames[0].length + frames[1].length, 960);
  assert.ok(Math.abs(frames[1][0] - frames[0].at(-1)) < 1000);
});
