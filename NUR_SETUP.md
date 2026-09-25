# Nur Live on Full-Duplex-Bench

This checkout has Nur adapters for the static v1/v1.5 audio sets, the v2
two-agent WebRTC orchestrator, and the v3 LiveKit tool benchmark. Use the dev
EESI API key and `EESI_BASE_URL=https://api.dev.eesi.ai/v1` for all three.
The source label is telemetry; the public Nur session uses its normal floor
policy. The data and local credentials are ignored by Git.
The two-case dev diagnostic is recorded in `NUR_TWO_TASK_RESULTS.md`.

## Setup and released data

From this directory, use Node 24, Python 3.12, `ffmpeg`, and `gdown`:

```bash
python setup_nur_data.py --verify-only
```

If the data is missing, install `gdown` and run `python setup_nur_data.py`.
The script downloads from the authors' Google Drive releases, checks every
archive against `NUR_DATA_MANIFEST.json`, extracts it, and checks the audio
counts: 727 v1.0, 498 v1.5, and 100 v3 examples. The v1.5 release actually
contains 98 `user_backchannel` samples; its README lists 99.

Configure ignored local files:

- `v1_v1.5/model_inference/gpt-realtime/.env`: `EESI_API_KEY`, `EESI_BASE_URL`.
- `v1_v1.5/.env`: `OPENAI_API_KEY` for judges in some v1/v1.5 metrics;
  `HF_TOKEN` helps download public audio models.
- `v2/.env`: `EESI_API_KEY`, `EESI_BASE_URL`, `OPENAI_API_KEY`; add
  `GEMINI_API_KEY` for Gemini API judging, or use Vertex credentials below.
- `v3/.env.local`: `EESI_API_KEY`, `EESI_BASE_URL`, `OPENAI_API_KEY`,
  `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

Install the Node dependencies in `v1_v1.5/model_inference/gpt-realtime` and
`v2` with `npm ci`. Install the Python dependencies for v1/v1.5 and v3 into a
Python 3.12 environment using `v1_v1.5/requirements.txt`, the local
`livekit-plugins-eesi` package in `../../libs/agents/livekit-plugins/`,
`livekit[crypto]`, `numpy`, `pydub`, `ffmpeg-python`, `soundfile`, `openai`,
and `torchcodec` (needed by current torchaudio for feature scoring).
The v2 ASR scripts can use that same environment. The Parakeet ASR model is
downloaded on first use and both v1/v1.5 and v2 ASR support CPU when CUDA is
unavailable.

## v1 and v1.5

From `v1_v1.5/model_inference/gpt-realtime`:

```bash
bash run_eesi.sh ../../dataset/Full-Duplex-Bench-Data/v1.0
bash run_eesi.sh ../../dataset/Full-Duplex-Bench-Data/v1.5
```

An optional second argument limits newly processed samples for a smoke run.
The runner uses `ffmpeg` to normalize the released PCM16 and float WAV inputs,
then writes time-aligned `output.wav` beside each `input.wav`. For v1.5
it also streams `clean_input.wav` and writes `clean_output.wav`. It skips WAVs
already present. `eesi_inference.js --tail-seconds 12` controls the default
post-input observation window; keep it fixed across runs.

Run `get_transcript/asr.py` for each subset with `--root_dir` pointing to that
subset directory. For v1.5, also run it with `--audio_name clean_input.wav`
and `--audio_name clean_output.wav`. Then use `evaluation/evaluate.py` with the
task and subset directory described in `evaluation/README.md`.

## v2

From `v2`:

```bash
bash run_dataset.sh prompts_staged_200.json \
  --adapter-b adapters/eesi_adapter.js --voice-b alloy \
  --base-out outputs/nur-dev --limit 2
```

Remove `--limit` for the full 200-prompt inference run. The launcher now
exports its selected signaling port to the orchestrator. The examiner remains
OpenAI Realtime; Nur is the examinee. The official `eval/run_evaluation.sh`
uses a Gemini judge. Set `GEMINI_API_KEY` for the Gemini API, or use Google
Cloud credentials with `GEMINI_PROVIDER=vertex`, `GOOGLE_CLOUD_PROJECT`, and
`GOOGLE_CLOUD_LOCATION` (for example `us-central1`). The Vertex path uses
`gcloud auth print-access-token` and needs no Gemini API key.
Its old preview model is shut down, so this checkout defaults to the stable
`gemini-2.5-flash`. Record the judge model when comparing scores.

## v3

Run a local LiveKit server in development mode (for example,
`livekit-server --dev` from LiveKit v1.13.7). Set `LIVEKIT_URL` to
`ws://127.0.0.1:7880`, `LIVEKIT_API_KEY=devkey`, and
`LIVEKIT_API_SECRET=secret` in `v3/.env.local`. In separate terminals from
`v3`:

```bash
LK_PROVIDER=eesi .venv/bin/python lk_agent_tool.py start
.venv/bin/python run_tool_benchmark_all_released.py --provider eesi --limit 1
```

Remove `--limit` for all 100 examples. Then score the saved results:

```bash
.venv/bin/python evaluate_tool_calls.py --benchmark benchmark_data_v2.json \
  --results-dir fdb_v3_data_released --provider eesi \
  --output fdb_v3_data_released/eesi_tools.json
.venv/bin/python evaluate_pass_rate.py --benchmark benchmark_data_v2.json \
  --results-dir fdb_v3_data_released --provider eesi \
  --output fdb_v3_data_released/eesi_pass.json
```

Add `--use-llm` for the paper's LLM judge. Without it, argument matching is
exact and response quality is not judged. Preserve the submodule revisions,
archive hashes, dev runtime revision, and session capabilities with any score.
