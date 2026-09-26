#!/usr/bin/env node
// Time-aligned Nur Live output for the static FDB v1/v1.5 audio sets.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import fetch from 'node-fetch';
import minimist from 'minimist';
import wrtc from 'wrtc';
import wav from 'wav';
import 'dotenv/config';

const { RTCPeerConnection, nonstandard: { RTCAudioSource, RTCAudioSink } } = wrtc;
const args = minimist(process.argv.slice(2), { string: ['input', 'output', 'model', 'voice'], default: { model: 'nur-live-v1', voice: 'alloy', 'tail-seconds': 12 } });
const base = (process.env.EESI_BASE_URL || 'https://api.dev.eesi.ai/v1').replace(/\/$/, '');
const key = process.env.EESI_API_KEY;
if (!args.input || !args.output || !key) {
  console.error('Usage: EESI_API_KEY=... node eesi_inference.js --input input.wav --output output.wav [--tail-seconds 12]');
  process.exit(2);
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function gatherIce(peer) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(done, 3000);
    function done() {
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', changed);
      resolve();
    }
    function changed() { if (peer.iceGatheringState === 'complete') done(); }
    peer.addEventListener('icegatheringstatechange', changed);
  });
}
function readWav(path) {
  return new Promise((resolve, reject) => {
    // The released v1 set mixes PCM16 and IEEE float WAVs. Normalize both
    // through ffmpeg before sending 10 ms PCM16 mono frames over WebRTC.
    const decoder = spawn('ffmpeg', ['-v', 'error', '-i', path, '-f', 's16le',
      '-ac', '1', '-ar', '48000', 'pipe:1']);
    const chunks = [];
    const errors = [];
    decoder.stdout.on('data', value => chunks.push(value));
    decoder.stderr.on('data', value => errors.push(value));
    decoder.on('error', reject);
    decoder.on('close', code => {
      if (code !== 0) return reject(new Error(`ffmpeg WAV decode failed: ${Buffer.concat(errors).toString('utf8')}`));
      const bytes = Buffer.concat(chunks);
      if (bytes.length % 2) return reject(new Error('ffmpeg returned an odd PCM byte count'));
      const mono = new Int16Array(bytes.length / 2);
      for (let i = 0; i < mono.length; i++) mono[i] = bytes.readInt16LE(i * 2);
      resolve({ mono, rate: 48000 });
    });
  });
}
function resample(input, from, to) {
  if (from === to) return input;
  const out = new Int16Array(Math.round(input.length * to / from));
  for (let i = 0; i < out.length; i++) {
    const pos = i * from / to;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    out[i] = Math.round(input[left] * (1 - (pos - left)) + input[right] * (pos - left));
  }
  return out;
}
async function jsonGet(url) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`ICE credentials failed (${response.status})`);
  return response.json();
}

const rate = 48000;
const frameSize = rate / 100;
const tailSeconds = Number(args['tail-seconds']);
if (!Number.isFinite(tailSeconds) || tailSeconds < 0 || tailSeconds > 60) throw new Error('Invalid --tail-seconds');
const { mono, rate: inputRate } = await readWav(args.input);
const input = resample(mono, inputRate, rate);
const targetLength = input.length + Math.round(tailSeconds * rate);
const output = new Int16Array(targetLength);
const ice = await jsonGet(`${base}/realtime/ice-servers`);
const peer = new RTCPeerConnection({ iceServers: ice.ice_servers || [] });
const source = new RTCAudioSource();
const track = source.createTrack();
peer.addTrack(track);
const channel = peer.createDataChannel('oai-events');
let sink;
let start = 0;
let received = 0;
peer.ontrack = ({ track: incoming }) => {
  sink = new RTCAudioSink(incoming);
  sink.ondata = ({ samples, sampleRate }) => {
    if (!start) return;
    const frame = resample(samples, sampleRate || rate, rate);
    const offset = Math.max(0, Math.round((performance.now() - start) * rate / 1000) - frame.length);
    for (let i = 0; i < frame.length && offset + i < output.length; i++) output[offset + i] = frame[i];
    received += frame.length;
  };
};
const ready = new Promise((resolve, reject) => {
  channel.onopen = () => {
    channel.send(JSON.stringify({ type: 'session.update', session: {
      instructions: 'You are a helpful AI assistant. Respond naturally to the user.', voice: args.voice,
    } }));
    resolve();
  };
  channel.onerror = () => reject(new Error('Realtime data channel failed'));
});
try {
  await peer.setLocalDescription(await peer.createOffer());
  await gatherIce(peer);
  const response = await fetch(`${base}/realtime/calls?model=${encodeURIComponent(args.model)}&source=live`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/sdp' },
    body: peer.localDescription.sdp,
  });
  if (!response.ok) throw new Error(`Realtime SDP offer failed (${response.status})`);
  await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() });
  await Promise.race([ready, delay(15000).then(() => { throw new Error('Realtime data channel timed out'); })]);
  start = performance.now();
  for (let off = 0; off < targetLength; off += frameSize) {
    const frame = new Int16Array(frameSize);
    if (off < input.length) frame.set(input.subarray(off, Math.min(off + frameSize, input.length)));
    source.onData({ samples: frame, sampleRate: rate, bitsPerSample: 16, channelCount: 1 });
    await delay(10);
  }
  const writer = new wav.Writer({ sampleRate: rate, channels: 1, bitDepth: 16 });
  const stream = fs.createWriteStream(args.output);
  writer.pipe(stream);
  writer.end(Buffer.from(output.buffer));
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });
  console.log(JSON.stringify({ input: args.input, output: args.output, inputSamples: input.length, outputSamples: output.length, receivedSamples: received }));
  // wrtc's native sink can crash when stopped during peer teardown on Node 24.
  // Process exit closes the media transport after the WAV has been flushed.
  process.exit(0);
} finally {
  sink?.stop();
  track.stop();
  channel.close();
  peer.close();
}
