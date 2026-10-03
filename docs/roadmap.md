# Project Roadmap

This roadmap tracks milestone progress. I will update it when working code and
verification support a completed item. Provider access, course performance, and
glasses integration remain unverified in my own environment.

## Foundation

- [x] Choose `club-picker` as the repository name
- [x] Record the feasibility investigation and source links
- [x] Write the initial design, data contract, and evaluation plan
- [x] Configure Python 3.12, uv, Ruff, strict Pyright, and pre-commit
- [x] Set up an installable package and scaffold CI
- [x] Exclude personal data, credentials, and generated outputs from Git

## Phase 1: Prove the data path

- [ ] Obtain one individual-shot Trackman CSV from a simulator or coach session
- [ ] Check available columns, units, club labels, and normalization settings
- [ ] Inspect one Toptracer My Practice session and available sharing options
- [ ] Implement the validated canonical shot record and a manual import format
- [ ] Implement the first Trackman adapter with import preview and deduplication
- [ ] Add synthetic fixtures, meaningful tests, and full pytest execution in CI
- [ ] Produce a private local audit showing usable shots and exclusion reasons

Exit criterion: one real session can be imported locally without losing source
meaning, mixing units, or duplicating shots when imported again.

## Phase 2: Establish club profiles

- [ ] Summarize carry, sideways bias, dispersion, and mishit frequency by club
- [ ] Separate full swings, partial shots, punches, and deliberate experiments
- [ ] Compare nearest typical-carry and empirical-distribution baselines
- [ ] Return distance-based candidates with sample support and limitations
- [ ] Export a versioned profile and reproducible analysis metadata

Exit criterion: a local command returns explainable candidates and appropriately
limited confidence from synthetic examples and the first usable private data.

## Phase 3: Compare risk and recent trends

- [ ] Accept target front/back limits and manually specified hazards
- [ ] Preserve paired distance and lateral misses in shot simulations
- [ ] Define safe, balanced, and aggressive objectives explicitly
- [ ] Compare clubs and supported aim points, including layups
- [ ] Compare stable profiles with conservative weighting of recent sessions
- [ ] Evaluate on later sessions and report uncertainty and calibration
- [ ] Record simple course outcomes separately from practice observations

Exit criterion: recommendations respond sensibly to hazard placement, and recent
weighting is adopted only when it improves evaluation on unseen sessions.

## Phase 4: Make it useful on a phone

- [ ] Build a responsive browser interface for distance entry and explanations
- [ ] Choose browser-local scoring or an API with a defined offline fallback
- [ ] Add optional voice input with editable parsed values
- [ ] Show data freshness, unsupported conditions, and recommendation reasons
- [ ] Test poor connectivity, sunlight readability, and the time needed per shot

Exit criterion: I can use the core flow on the course without depending on a
cloud model or discovering that a cached screen has no working calculations.

## Phase 5: Add Meta Ray-Ban Display

- [ ] Confirm the phone platform, glasses firmware, and developer capabilities
- [ ] Prototype short visual and spoken recommendations using the same profile
- [ ] Test dictated input, connection recovery, latency, and battery use
- [ ] Prototype direct camera capture through the mobile Device Access Toolkit

Exit criterion: a real device can receive a recommendation and recover from a
lost connection. A phone workflow remains available.

## Phase 6: Investigate visual course context

- [ ] Evaluate visible hazards and corridors using owner-captured phone photos
- [ ] Combine photographs with measured distances and permitted map data
- [ ] Keep uncertain or hidden course geometry explicit
- [ ] Compare annotations with measured ground truth before using them for risk
- [ ] Add trajectory inputs before attempting tree or branch clearance advice

Exit criterion: vision provides verified useful context. Exact widths, carry
requirements, and clearance claims require measured evidence.

## Next concrete task

Obtain one Trackman CSV. Keep it under ignored `data/raw/trackman/` and inspect
its structure locally. The file will determine the first importer rather than
forcing an assumed vendor schema onto real data.
