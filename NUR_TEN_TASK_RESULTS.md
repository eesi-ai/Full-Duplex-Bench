# Nur Live: ten-case dev diagnostic per suite

Date: 2026-09-25 UTC. Environment: dev. Speech runtime `/v1/version`:
`0.2.11`, commit `517013af5de63040c20f05434ddb2e60db8b4117`.
The gateway pod rolled during v3 capture; its image changed, while the speech
runtime image and reported commit stayed the same. Inputs and SHA-256 hashes
are pinned in `NUR_TEN_TASK_MANIFEST.json`. This is a stratified diagnostic
sample, not a random sample or a full benchmark result.

## v1.0: 10 cases

Two cases each from Candor pause handling, synthetic pause handling, Candor
turn taking, ICC backchannel, and synthetic user interruption. Official
evaluation scripts ran on Parakeet word timestamps. The interruption
relevance judge used Gemini 2.5 Flash on Vertex via `--judge vertex`, rather
than the authors' OpenAI judge.

| Metric | Sample result |
| --- | ---: |
| Candor pause handling: full turn taken | 2/2 |
| Synthetic pause handling: full turn taken | 2/2 |
| Candor turn taking: turn taken | 2/2 |
| Candor turn taking: mean latency | 2.06 s |
| ICC backchannel: full turn taken | 2/2 |
| ICC backchannel: JSD / backchannel frequency | 0.7941 / 0.0181 Hz |
| Synthetic interruption: relevance | 5/5 average, 2 cases |
| Synthetic interruption: mean latency | 4.04 s |

The pause cases are intended to test whether the assistant waits for a
continuing speaker. The backchannel cases call for short acknowledgments.
Nur instead made full responses in these samples. The interruption responses
were relevant but slow.

## v1.5: 10 paired cases

Two background speech, two talking to another person, three user
backchannels, and three user interruptions. Each case streamed both noisy
and clean input. Parakeet transcribed input, output, clean input, and clean
output. The authors' behavior prompt was judged by Gemini 2.5 Flash on Vertex.

| Category | Vertex behavior labels |
| --- | --- |
| Background speech | 1 resume, 1 unknown/no speech |
| Talking to another person | 1 resume, 1 respond to overlap |
| User backchannel | 3 resume |
| User interruption | 2 respond, 1 unknown |

These are content relation labels, not official pass/fail scores. One noisy
background case produced no transcribed speech; one interruption reply was
unclear. The backchannel cases did preserve the original answer, unlike the
v1.0 ICC backchannel slice, which elicited full turns. Both observations
can coexist because the datasets and desired behavior differ.

## v2: 10 cases

Three ordering, three correction, two entity tracking, and two physical
health safety prompts. Each conversation ran for 120 seconds with the
authors' OpenAI Realtime examiner and Nur as examinee. Parakeet ASR produced
transcripts. Gemini 2.5 Flash on Vertex judged the authors' rubric.

| Split | Task-specific scores (1–5) | Mean |
| --- | --- | ---: |
| Ordering | 1, 2, 2 | 1.67 |
| Correction | 1, 1, 5 | 2.33 |
| Entity tracking | 4, 3 | 3.50 |
| Physical health safety | 5, 2 | 3.50 |
| **All ten** | **26/50 total** | **2.60** |

Across 50 judged response events, mean turn-taking fluency was 2.96/5.
Across 48 events with non-null instruction following scores, the mean was
2.44/5. Transcripts show repeated clarification requests and repeated order
questions after the examiner gave details. One ordering conversation claimed
to be placing an order without a corresponding tool action. The v2 Nur
adapter did not supply ordering tools, which limits interpretation of its
task completion scores.

## v3: 10 tool cases

Two ecommerce, three finance, two housing, and three travel cases. All ten
results completed. The first pass was discarded for cases whose local LiveKit
agent did not join; a join timeout now makes those captures fail visibly. A
subsequent pass was interrupted by a dev pod rollout and STT HTTP 502 errors.
The healthy rerun used the same speech runtime commit after the gateway
returned to 5/5 Ready. The final seven cases took 7.09 minutes end to end in
the sequential v3 runner; the first three had completed earlier.

| Deterministic scorer metric | Result |
| --- | ---: |
| Cases with spoken response | 9/10 |
| Correct tool selection, among cases with spoken response | 9/9 |
| Exact argument accuracy, among cases with spoken response | 5/9 |
| Tool pass rate, all cases | 6/10 |
| Mean perceived response latency, nine spoken replies | 5.17 s |

The pass rate checks tool calls and arguments; one tool call passed despite
no transcribed reply in the observation window. Four exact argument failures
were two date-format differences, an order ID with inserted separators, and
one materially wrong passport number. The ASR transcript of one finance
reply included internal planning text after the answer.

The optional semantic judge used Gemini 2.5 Flash on Vertex. It accepted the
two date-format differences: argument accuracy became **7/9 (77.8%)** among
spoken replies, and semantic tool pass rate became **8/10 (80%)** across all
cases. It judged spoken response quality correct in **4/9 (44.4%)**.
Together with the separate 9/10 turn-take measure, this captures problems
the tool pass rate misses: a silent case, responses that asked again for an
already supplied order ID, a contradictory autopay answer, and the finance
reply that spoke internal planning. These
LLM judgments are diagnostic, judge-dependent results; the authors' default
semantic judge is GPT-4o.

## τ²-bench: 10 airline tasks

The separate τ²-bench submodule already contains the completed dev voice
run at `data/simulations/nur-live-dev-airline-10-20260925/results.json`.
Its ten simulation records have three rewards of 1.0 and seven of 0.0:
**3/10 task success**. Two of the seven failures reached `max_steps`;
the others ended by user or agent stop. Mean simulation duration was 186.35
seconds. The run used the `eesi:nur-live-v1` audio-native agent and a
`gpt-4.1` voice user simulator on τ²-bench commit
`1795734c507ca7205e03987f8a91dcbd2cbaae3a`. These are separate
task-success rewards and should not be pooled with Full-Duplex-Bench scores.

## Dev throughput and next optimization targets

The dev Nur pod advertises eight realtime session units. During mixed v1,
v1.5, and v2 capture, six were in use at peak, leaving two available. The
sampled metrics showed zero inbound audio drops, zero failed responses, and
no stuck units; the generic error counter rose from two to three, with no
confirmed cause. Ten v2 120-second conversations produced captures over
roughly nine minutes of mixed workload, compared with 20 minutes of media
played serially. This is observed sample throughput, not a sustained load
test. The rollout interrupted subsequent v3 work.

Released media totals are approximately 21 hours of serial playback when
v1.5 clean/noisy pairs and a 12-second v1/v1.5 observation tail are included:
about 13.1 hours for v1/v1.5, 6.7 hours for v2, and 1.3 hours for v3. Six
simultaneous lanes would put the ideal media floor near 3.5 hours. End-to-end
runtime is longer because local CPU transcription, LiveKit admission, remote
judging, startup, and retries are outside that floor. The local eight-core
host overloaded its LiveKit worker when ASR and v3 capture overlapped, causing
rooms without agents. Separating capture from CPU ASR, reserving two Nur
session units for dev traffic, and using bounded four-to-six-lane capture
are the practical next steps. No extra GPU capacity was provisioned.

The highest-priority product investigations from this sample are early
turn-taking during pauses, short backchannels, repeated clarification, and
post-interruption response latency. Inspect traces and audio before changing
floor policy. A successful call or these scorecards alone do not prove full
duplex control or browser playback quality.
