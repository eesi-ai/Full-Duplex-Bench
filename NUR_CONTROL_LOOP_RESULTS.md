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
asks Gemma to preserve the floor on brief caller acknowledgments. It needs
its own deployed audio replay before its effect can be claimed.

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

## Interpretation and next replay

The fixed control loop corrected one concrete repeated-answer failure and
raised the v2 rubric and v3 spoken quality in these samples. It did not
improve exact or semantic v3 tool pass, and its mean v1 turn-taking,
interruption, and v3 response latencies rose. Background speaker focus and
short-acknowledgment handling remain weak. No result here establishes
browser playout, AEC, or performance across all released cases.

The next deployed revision changes brief-overlap guidance, emergency
barge-in behavior, and delegation for offered tool-backed facts/actions.
Replay the same audio backchannel, correction, and tool probes after dev
reports that revision; compare actual trace actions and output audio before
attributing any further benchmark change to it.
