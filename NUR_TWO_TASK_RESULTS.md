# Nur Live dev: two-case diagnostic (2026-09-25)

This is a small diagnostic sample, not a full benchmark estimate. Nur used the
public dev realtime call API with its normal session policy. The dev `/v1/version`
route returned 404, so the deployed runtime revision and decision capability
could not be independently pinned. The v1/v2 paths use recorded WebRTC audio;
v3 uses a local LiveKit server connected to Nur dev.

## v1.0 pause handling

Cases: `candor_pause_handling/1` and `candor_pause_handling/10`.
The released evaluator's take-over rate was **2/2 (100%)**; lower is better for
pause handling. Parakeet transcripts contain 13 and 23 Nur words respectively.
The WAV and JSON artifacts are under
`v1_v1.5/dataset/Full-Duplex-Bench-Data/v1.0/candor_pause_handling/`.

## v2 Daily ordering

Cases: `Daily.ordering.001` and `Daily.ordering.002`, 120 seconds each. OpenAI
Realtime was the examiner and Nur Live the examinee. The examiner's task
instructions were sent in the initial Realtime session; a short check confirmed
it roleplayed the breakfast order. The judge was `gemini-2.5-flash` through
Vertex AI in `eesi-dev-pzud/us-central1`. The benchmark's invalid JSON output
example was corrected to an equivalent valid array format.

| Case | Recognized Nur turns | Mean fluency | Mean instruction following | Task score |
| --- | ---: | ---: | ---: | ---: |
| `.001` | 14 | 4.43/5 | 3.86/5 | 3/5 |
| `.002` | 0 | N/A | N/A | 1/5 |

These values come from the complete `eval/run_evaluation.sh` pipeline. On a
separate judge call for `.001`, the task score was 2/5 and the mean turn scores
were 3.36/5 and 2.29/5. Judge variability is material at this sample size.
The `.002` B WAV has about four seconds of energy above 0.01 RMS, but Parakeet
recognized zero words. It should be described as no *recognized* reply, not a
silent recording. Results and transcripts are under
`v2/outputs/nur-dev-two-valid/`.

## v3 tool benchmark

The first two released inputs are two speakers for scenario `ecommerce_01`
(`Simple Order Tracking`). Exact-match pass rate was **1/2 (50%)**. Both chose
`track_order`; one supplied `a_b_c_123` where the expected order ID was
`ABC123`. Tool selection was 2/2 and exact argument accuracy was 1/2. Mean
scorer latency was 4.12 seconds. The optional response-quality LLM judge was
not run. Results are under `v3/fdb_v3_data_released/` in the `result_eesi.json`
files and `eesi_tools_two.json` / `eesi_pass_two.json`.
