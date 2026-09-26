# Nur Live control-loop replay on dev

Date: 2026-09-26 UTC. This compares the fixed control-loop dev runtime
`fd87409ce5ddbe053ca01a7209760402e84a8056` (speech image digest
`sha256:4c7de57aebff39237f034d8a8332bd60df6df97597487f863483ad9856b15a50`)
with the pre-control-loop diagnostic in [NUR_TEN_TASK_RESULTS.md](NUR_TEN_TASK_RESULTS.md).
The same ten pinned cases from each released suite were used; hashes and
case IDs are in [NUR_TEN_TASK_MANIFEST.json](NUR_TEN_TASK_MANIFEST.json).
This is a stratified diagnostic sample, not a full benchmark or statistical
claim. The v1 and v1.5 inputs were replayed through the dev WebRTC gateway;
v2 used the published two-minute conversation examiner; v3 used the local
LiveKit tool runner. Local CPU ASR and Vertex judging ran after capture.

## Direct audio probes

After the initial control-loop deployment, a real WebRTC call showed a
Gemma `listen interrupt=true` action while only Nur was speaking. Playback
was cleared twice and the same reply restarted three times. The deployed
`fd87409c` fix requires current caller speech before an interrupt can cut
playback. In the same pause probe, there was one completed answer with no
restart; a correction probe yielded one answer per user utterance and a
genuine cut about 1.15 seconds after the correction was injected. Eight
silent false interrupt attempts were ignored and traced. Both probes decoded
audio without receive errors. Their first output audio arrived 2.75 seconds
after the pause input in one probe, so these do not demonstrate a 200 ms
audible response.

The trace gives approximately 236 ms P50 and 605 ms P95 model decision
latency. The 200 ms cadence is a scheduling opportunity, not guaranteed
Gemma execution at five decisions per second. The Activity decision inspector
shows the observation, proposed action, guard outcome, latency, and resulting
state for each recorded tick.

In a real WebRTC replay of v1.5 `user_backchannel/2/input.wav`, the caller's
brief “Right, yeah? Yeah.” lasted about 846 ms, but the emergency 700 ms
voice bound cut Nur's ongoing reply after about 742 ms of detected speech.
Gemma produced no BACKCHANNEL action in this particular probe. This exposed
an important remaining floor issue despite the aggregate labels below. A
follow-up change increases the emergency voice bound to 1.25 seconds and
asks Gemma to preserve the floor on brief caller acknowledgments. Its
deployed audio replay is reported in the final-revision section below.

## v1.0: ten cases

| Metric | Before | Control loop |
| --- | ---: | ---: |
| Candor pause: full turn taken | 2/2 | 2/2 |
| Synthetic pause: full turn taken | 2/2 | 2/2 |
| Candor turn taking: turn taken | 2/2 | 2/2 |
| Candor turn taking: mean latency | 2.06 s | 3.22 s |
| ICC backchannel: full turn taken | 2/2 | 2/2 |
| ICC backchannel: JSD | 0.7941 | 0.7522 |
| ICC backchannel: frequency | 0.0181 Hz | 0.0365 Hz |
| Synthetic interruption: relevance | 5/5 | 5/5 |
| Synthetic interruption: mean latency | 4.04 s | 4.40 s |

Turn-taking and interruption responses remained relevant but became slower
in this sample. ICC backchannel frequency doubled, yet the transcripts still
contain full answers where short acknowledgments were desired. The
interruption relevance score used Gemini 2.5 Flash on Vertex.

## v1.5: ten clean/noisy pairs

| Category | Before labels | Control-loop labels |
| --- | --- | --- |
| Background speech (2) | 1 resume, 1 unknown | 1 respond, 1 unknown |
| Talking to another person (2) | 1 resume, 1 respond | 1 respond, 1 unknown |
| User backchannel (3) | 3 resume | 3 resume |
| User interruption (3) | 2 respond, 1 unknown | 1 respond, 1 uncertain handling, 1 unknown |

These are Vertex judgments of the authors' content-relation prompt, not
pass/fail scores. The transcripts show cases in which Nur answered background
speech instead of the primary user's request, and one interruption where it
missed the requested meeting time. Speaker focus and interruption recovery
need work even when the three backchannel cases are labeled resume.

## v2: ten two-minute conversations

| Split | Before scores (1–5) | Control-loop scores (1–5) |
| --- | --- | --- |
| Daily ordering (3) | 1, 2, 2 | 3, 2, 2 |
| Correction (3) | 1, 1, 5 | 5, 1, 2 |
| Entity tracking (2) | 4, 3 | 4, 3 |
| Physical health safety (2) | 5, 2 | 5, 5 |
| **All ten** | **26/50, mean 2.60** | **32/50, mean 3.20** |

Mean turn-taking fluency across 50 judged events improved from 2.96 to
3.60/5. Mean instruction following improved from 2.44/5 across 48 valid
events to 2.84/5 across 50. The same Gemini 2.5 Flash Vertex rubric was
used. Ten captures completed in 8.2 minutes using three parallel lanes,
versus 20 minutes of serial media. Transcripts still show repeated location
clarification, unrelated replies, and unsupported claims of placing orders.
The v2 adapter offers no order tools, so order completion scores have that
known limitation.

## v3: ten tool conversations

| Metric | Before | Control loop |
| --- | ---: | ---: |
| Spoken response | 9/10 | 10/10 |
| Correct tool selection, among spoken | 9/9 | 9/10 |
| Exact argument accuracy, among spoken | 5/9 | 6/10 |
| Exact tool pass, all cases | 6/10 | 6/10 |
| Semantic tool pass, all cases | 8/10 | 8/10 |
| Vertex judged spoken quality, among spoken | 4/9 | 6/10 |
| Mean perceived response latency | 5.17 s | 6.34 s |

All ten control-loop runs completed with a spoken reply, and nine called
tools. The exact tool pass rate did not change. The new run missed an offered
card-benefits tool on one finance case. A travel passport argument disagreed
with the benchmark reference, while the input ASR also disagreed with that
reference; that case needs source-audio review before assigning blame.
Semantic argument accuracy was 8/10 in the new run and 7/9 in the baseline
among spoken cases. Semantic pass remained 8/10. The semantic judge was
rerun on both captures with structured Vertex JSON; parse failures are
unscored rather than counted as wrong answers. Spoken reply quality improved,
but some replies were garbled or contradictory after a successful tool call.
The slower perceived latency matters for a voice product.

## τ²-bench: ten airline voice tasks

The separate τ²-bench submodule ran the same task IDs 0–9, seed 300, with
`eesi/nur-live-v1` as the audio-native agent, a GPT-4.1 voice user simulator,
EESI user TTS, control speech complexity, and 200 ms simulation ticks.
The simulator's hallucination reviewer used GPT-4.1. Three tasks ran in
parallel. The runner commit was `1795734c507ca7205e03987f8a91dcbd2cbaae3a`.
Raw local records are under
`evals/tau2-bench/data/simulations/nur-live-dev-airline-10-control-loop-20260926/`.
The benchmark's task reward is separate from Full-Duplex-Bench scores.

| Metric | Before | Control loop |
| --- | ---: | ---: |
| Task success | 3/10 | 5/10 |
| Mean simulation duration | 186.35 s | 190.20 s |
| User or agent normal stop | 8/10 | 10/10 |

The successful task IDs were 0, 2, 4, 6, and 9. Task 2 used two user
hallucination retries; task 5 used one and ultimately failed. Several failed
tasks completed valid read calls but missed the requested database state or
communication outcome. Task 8, for example, passed three read checks and
failed the booking write check. This is evidence of incomplete end-to-end
tool workflows, not a failure to select every tool.

An unrelated main deployment (`#345`) restarted the shared dev pod near the
end of the capture. Tasks 7–9 initially received WebSocket 503 or upstream
model 502 errors. After the same speech image digest returned to Ready,
`tau2 run --auto-resume` retained tasks 0–6 and reran exactly those three
infrastructure failures. The final ten records have no infrastructure-error
terminations. The main deployment did not change the speech image, but its
pod restart added wall-clock time to this run.

## Final floor and delegation revision

The follow-up deployed as runtime commit
`61d2620f0d5abdac7d6846f16df5c5fe0edf0c52`, speech image
`sha256:5374b53c2ae1b88ec03e582ad7f21bc004ae58293d47f290b0cf6de6246cd0f3`.
It improved Gemma's brief-overlap and tool-delegation instructions and moved
the emergency voice cut from 0.7 to 1.25 seconds, removing the three-word
hard cut. The same pinned inputs were replayed. Raw local outputs are under
`/tmp/nur-final-61d262/`. Two silent v3 captures during an unrelated pod
rollout were preserved in `v3-outage/` and rerun after the same speech image
returned to Ready.

In a public-edge WebRTC call, the same caller backchannel said “Right,
yeah? Yeah.” while Nur's output was still playing. The final revision kept
playing with zero audio-clear events; the earlier one cut the reply about
742 ms after caller speech began. An injected genuine new question still cut
playback, with the first clear about 1.35 seconds after injection. Both
calls decoded audio without receiver errors. The backchannel probe tested
preserving Nur's floor during a *caller* acknowledgment; it did not elicit
a `BACKCHANNEL` action from Nur.

| v1.0 metric | First control loop | Final revision |
| --- | ---: | ---: |
| Candor / synthetic pause full turns | 2/2 / 2/2 | 2/2 / 2/2 |
| Candor turn taking: full turns, mean latency | 2/2, 3.22 s | 2/2, 2.86 s |
| ICC backchannel: full turns, JSD, frequency | 2/2, 0.7522, 0.0365 Hz | 2/2, 0.8875, 0.0092 Hz |
| Synthetic interruption: relevance, mean latency | 5/5, 4.40 s | 5/5, 2.84 s |

Interruption latency improved; ICC backchannel generation worsened. The
WebRTC probe and ICC score measure different floor behavior.

| v1.5 category | First control-loop labels | Final labels |
| --- | --- | --- |
| Background speech (2) | 1 respond, 1 unknown | 1 respond, 1 uncertain |
| Talking to another person (2) | 1 respond, 1 unknown | 1 respond, 1 unknown |
| User backchannel (3) | 3 resume | 2 resume, 1 unknown |
| User interruption (3) | 1 respond, 1 uncertain, 1 unknown | 2 respond, 1 unknown |

These are Gemini 2.5 Flash Vertex content-relation labels, not binary
pass/fail grades. Background speaker focus remains weak.

| v2 metric | First control loop | Final revision |
| --- | ---: | ---: |
| Daily ordering scores | 3, 2, 2 | 3, 1, 2 |
| Correction scores | 5, 1, 2 | 1, 2, 5 |
| Entity tracking scores | 4, 3 | 1, 3 |
| Physical health safety scores | 5, 5 | 4, 1 |
| **All ten** | **32/50, mean 3.20** | **23/50, mean 2.30** |
| Turn-taking fluency, judged events | 3.60/5, 50 | 3.59/5, 98 |
| Instruction following, judged events | 2.84/5, 50 | 2.45/5, 98 |

Both ASR bundles use the same 120-second window and staged prompts. The
final run produced more judged response events, especially in ordering and
safety. One safety dialogue contained unclear, partly German-sounding
speech and repeated clarification; a sushi order repeated and altered
items. The examiner and judge are model-based, so ten cases cannot isolate
which prompt change caused the regression. The v2 adapter offers no order
tools.

| v3 metric | First control loop | Final revision |
| --- | ---: | ---: |
| Spoken response / offered-tool selection | 10/10 / 9/10 | 10/10 / 10/10 |
| Exact argument accuracy / pass | 6/10 / 6/10 | 7/10 / 7/10 |
| Semantic argument accuracy / pass | 8/10 / 8/10 | 9/10 / 9/10 |
| Vertex judged spoken quality | 6/10 | 8/10 |
| Mean perceived response latency, spoken cases | 6.34 s | 7.43 s |

The final revision called the card-benefits tool missed in the prior
replay. The remaining semantic argument failure is a passport number whose
input ASR disagrees with the benchmark reference. Two final replies were
judged poor quality, including a garbled currency answer. The scorer's
7.43-second mean uses ten healthy spoken cases; the runner's preliminary
5.54-second mean included two rollout-time silent captures and is invalid.

## Final revision: τ² airline voice tasks

The final revision was also run against airline task IDs 0–9 with the same
audio-native Nur agent, EESI user TTS, control speech complexity, 200 ms
simulation ticks, and three parallel lanes. This run used
`vertex_gcloud/gemini-2.5-flash` for both the voice user and hallucination
reviewer. The earlier ten-task result used GPT-4.1 for those roles. An attempt
to keep GPT-4.1 for the final revision hit the OpenAI organization's enforced
spend cap, so a directly comparable final GPT score is unavailable. The
Vertex result measures final-revision behavior with a different simulator;
its score should not be read as a causal before/after change from 5/10.

| Final Vertex-user metric | Result |
| --- | ---: |
| Airline task success | 4/10 |
| Mean simulation duration | 319.63 s |
| Normal user or agent stop | 10/10 |
| Unresponsive period | 0/10 |
| Matching read actions | 18/21 |
| Matching write actions | 0/4 |

The successful task IDs were 0, 3, 4, and 6. Task 5 was resumed alone after
a cached Vertex bearer token expired during its earlier attempt; the runner
retained the other nine valid records. The adapter now refreshes and retries
once on a 401. The final ten accepted records all have normal stops and no
infrastructure-error termination. The 319.63-second mean is substantially
longer than the 190.20-second GPT-user run, but the different user model and
reviewer prevent attributing that difference to Nur's runtime.

The same deployed speech image was used for this run. Raw records and duplex
audio are under
`evals/tau2-bench/data/simulations/nur-live-dev-airline-10-final-vertex-20260926/`
in the local worktree. Task 8 missed the requested booking write after three
matching read actions. Task 7 entered a long loop asking the caller to spell
their user and reservation IDs, cycled through inconsistent ID hypotheses,
and made no matching tool calls. In task 5 Nur called a Regular member Gold,
offered a travel certificate despite the scenario requiring none, and claimed
to have issued it. These are grounded in the saved audio labels, task
criteria, and action checks.

## Interpretation

The first control-loop deployment corrected one concrete repeated-answer
failure and improved the v2 rubric. The final floor/delegation revision
changed the tradeoff again. These are small, stochastic diagnostic samples;
no result here establishes browser playout, echo cancellation, or
performance across all released cases.

The final revision preserved one caller acknowledgment during real playback
and improved v3 tool grounding. It regressed on the sampled v2 task rubric
and ICC backchannel frequency while making v3 replies slower. The next
tuning cycle should focus on short acknowledgments while the caller has the
floor, speaker focus under background speech, language drift, and avoiding
repeated questions. The τ² traces additionally call for grounding completion
claims in successful writes and recovering from uncertain alphanumeric IDs.
Use paired audio and Activity traces for those changes; aggregate scores
alone do not identify their cause.
