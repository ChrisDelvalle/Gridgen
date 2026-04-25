# Checklist

Use this file for milestone-level tracking. Keep milestones behavior-focused and
reviewable.

## Milestone 1: Design Baseline

- [x] Define the project purpose, goals, and non-goals.
- [x] Define package boundaries for `core`, `server`, `cli`, and `web`.
- [x] Define the separation-of-concerns policy for pure domain logic and edge
      effects.
- [x] Define the starting collection, section, item, and image data model.
- [x] Define draft versus renderable collection validation expectations.
- [x] Define renderer, preview, CLI, source workspace, testing, and dependency
      policies.
- [x] Record open product questions for follow-up decisions.
- [x] Resolve version 1 image dimensions, crop mode, upload limit, browser open
      behavior, and delete behavior.
- [x] Select `react-easy-crop` for the authoring crop UI milestone.
- [x] Resolve version 1 crop rotation, upload-limit configurability, and trash
      cleanup behavior.
- [x] Review the design for separation-of-concerns gaps and move filesystem,
      image processing, workspace persistence, and generated-output writing to a
      dedicated IO boundary.
- [x] Clarify that the authoring UI saves and previews in version 1 while Jekyll
      builds remain CLI-driven.
- [x] Add local authoring server safety requirements for loopback binding,
      origin checks, session tokens, and request size limits.
- [x] Document expected production dependencies and the specific project
      responsibilities each dependency owns.
- [x] Add concrete user journeys for first run, collection authoring, image
      cropping, preview, and Jekyll build.
