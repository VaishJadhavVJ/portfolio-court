# AFK run report (2026-09-24)

Every phase passed and is pushed. Nothing was reverted or skipped. One budget is over, and it needs your decision (see "Needs you").

## Commits (all pushed to main)

| Commit | Phase |
|---|---|
| 227ff69 | 0. Audio work plus the iOS Safari unlock |
| 42aa180 | 1. Title menu, deep links, "take it to court" links |
| 6e0350c | 2. Court Record evidence cards |
| 4af843e | 3. Narrator title cards and verdicts, missing debates |
| d0c1c36 | 4. Chicago clock, season and day/night mechanism, footer |
| 253b428 | 5. Behind the Bench draft (docs only) |
| b07ee54 | 6. GLM_API_KEY rename, Notion report, council design doc |
| 685f825 | Final: Lighthouse regression fix (see Decisions) |

Every code phase passed the full harness on a local production build before it was pushed. Phase 5 is docs only, so it went out with Phase 6 after that phase's full run.

## What each phase did

**0. Audio.** The audio work from last session shipped with one fix. Howler's shared AudioContext is now created and unlocked inside the begin click handler itself: it resumes the context and plays a one-sample silent buffer, so iOS Safari treats the click as the gesture. The audio files still load only after the click. Checked in Chromium and WebKit: no context exists before the click, it is "running" after, and nothing logs to the console. `howler` is now a declared dependency, at the same 2.2.4 that use-sound already installed, and `@types/howler` is a dev dependency.

**1. Title screen and deep links.**
- The begin screen is now a small terminal menu: `[ WATCH A CASE ]` (the default case is Portfolio Review) and `[ REPLAY INTRO ]`. `[ TALK TO VAISHNAVI ↗ ]` is hidden while its config value is empty.
- Every option counts as the audio gesture. Focus lands on the first option, and the arrow keys move between options.
- `/court?topic=<slug>` goes straight to that case after one press. Slugs come from `lib/slug.ts`, so "Alzheimer's" becomes `alzheimers`. An unknown slug shows the menu with no error.
- Each Exhibit card whose project has a debate gets a `take it to court →` link. Right now all 13 projects have one.

**2. Court Record.**
- `scripts/court-record.ts` reads Notion only, with no LLM calls, and writes `data/court-record.json`: 13 projects, 9 of them with a working link.
- At the start of each case, an "Evidence added to the Court Record" card slides into the top of the stage. It never overlaps the dialogue box, which the harness checks at all three widths.
- It dismisses itself after 7 seconds (paused while hovered or focused), when you advance, or with its × button. It makes no sound and sits in the tab order.

**3. Narrator.**
- **Sprites:** the two narrator sprites were re-sliced as 500px lossless WebP. The other 10 sprites re-slice pixel-identical to what is deployed.
- **`--missing-only`:** generated Portfolio Court and AI Police. It checks that the 12 existing debates are byte-identical before writing.
- **`scripts/generate-verdicts.ts`:** one LLM call per case, validated. The code builds the title from a character and a wish so the "The X Wants to Y" pattern always holds. A failed call gets one retry that includes the rejection reason, then the script throws, and it writes only if all 14 cases pass.
- **Playback:** each case now runs full-screen title card (serif), then evidence and the debate, then the narrator's verdict (NARRATOR nameplate, narrator sprite, judge background), then the end card.

**4. Landing.**
- **Clock:** "5:14 PM · Chicago", on a dark chip under the "Looking for 2027" line in the hero. It is computed in the browser only and updates on the minute.
- **Season and day/night:** chosen in the browser. Day or night comes from Chicago's sunrise and sunset, calculated with NOAA's solar equations; the check script matches US Naval Observatory tables within 2 minutes on four dates. Seasons are meteorological.
- **Build-time manifest:** `scripts/hero-variants.mjs` runs as `prebuild` and writes `lib/hero-variants.json`, listing only complete variants. An incomplete variant falls back to summer-day, and the browser never asks for a missing file.
- **No flash:** a chosen variant fades in over the summer-day scene once it has loaded, and the summer-day video is never downloaded underneath it. I tested this in a scratch build with fake autumn files: it picked autumn-day, crossfaded, and logged nothing.
- **Footer:** the inspiration line sits beside the music credit. The Spotify embed and the Medium link are hidden while their config values are empty.

**5. Behind the Bench.** `docs/behind-the-bench.md` is a draft of about 1,450 words. It covers the architecture and the six silent failures, with the details checked against git and the session record.

**6. Housekeeping.**
- `GLM_API_KEY` is renamed in `.env.local` and `lib/llm.ts`. The value was never printed, and one live call through the generator's loading path succeeded.
- `scripts/notion-report.ts` is read-only (results below).
- `docs/ask-the-council.md` is written.

## Test results

**Final full harness** on a local production build (685f825):
- Every case played to its end card at 390, 768 and 1440: 14/14 each, in order title card, verdict, end card.
- 13 evidence cards per width, all 140 lines fit their box, and all 13 "take it to court" links played to the end.
- The menu keyboard flow, unknown slugs, no audio before the click, toggles surviving a reload, and the clock all pass.
- Zero console errors or warnings and zero failed requests.

**Lighthouse mobile**, median of 3 runs each, local production builds:

| Page | Before this run (f09c440) | Final |
|---|---|---|
| `/` | Performance 97, A11y 100, BP 100, SEO 100, LCP 2.7s, CLS 0 | Performance 96, A11y 100, BP 100, SEO 100, LCP 2.8s, CLS 0 |
| `/court` | Performance 94, A11y 100, BP 100, SEO 100, LCP 3.1s, CLS 0 | Performance 93, A11y 100, BP 100, SEO 100, LCP 3.2s, CLS 0.003 |

**Clock contrast** (worst background pixel behind the text): 8.02:1 at 390 and 768, and 7.37:1 at 1440 across 5 video frames.

**/court bytes for one full case on a 390px phone** (fresh profile, deep link, intro, title card, whole case, end card):

| | Bytes |
|---|---|
| Heaviest case (UrbanScale) | **2.40 MB** |
| Of which music | 0.85 MB |
| Without the music | 1.54 MB |
| Lightest cases | 2.25 MB |

**Over the 1.5 MB budget**, see "Needs you". The heaviest case breaks down as: sprites 1,016 KB (9 files at about 110 KB), music 871 KB, JS 216 KB, backgrounds 162 KB, sound effects 95 KB, fonts 67 KB.

**Production** (one request per page, after the deploy finished): `/` returned 200 and `/court` returned 200, with no security checkpoint.

## Decisions I made for you

1. **Budget versus explicit specs.** A full case needs about 2.4 MB. The 96 kbps music you asked for is 0.85 MB of that, and the narrator art had to be 500px lossless as you specified. No version of Phase 3 fits in 1.5 MB, and reverting it would not bring things under budget either, so I kept it and am flagging the conflict rather than overriding either spec.
2. **Home Lighthouse regression.** Phase 4's `<picture>` raised the hero still's priority, and home fell from 97 to 91. I fixed it with `fetchPriority="low"` (back to 96), and also fixed a court best-practices dip (a 10px credit) and a small menu layout shift.
3. **`[ TALK TO VAISHNAVI ↗ ]`** unlocks audio but stays on the menu and opens the link in a new tab, rather than starting a case.
4. **Toggles** are labelled `[ SFX ]` and `[ MUSIC ]` (pressed means on). This was already the case from the last session.
5. **Evidence summaries** are the first sentence of each Notion description, capped at 160 characters. No LLM is involved.
6. **Verdict generation.** GLM kept producing "Wants to Ship" titles and copying the example titles. I moved the title into code ("The {character} Wants to {wish}"), rejected shipping and winning wishes, copied examples and duplicate titles, required "Today's battle result:" at the start of every verdict, and passed the rejection reason into the retry. It took five runs. The final one passed every check first time or on its retry.
7. **Hero art convention.** A variant is four files, and a variant counts only when all four exist. The current art became summer-day, with the mobile still and poster as two copies of the same image.
8. **Clock placement:** in the hero, under the job-search line, on a `bg-black/60` chip.
9. **Council recommendation:** not worth building live now. A menu of preset, pre-generated questions gets most of the charm.

## Reverted or skipped

Nothing.

## Needs you

**1. Decide the /court budget.** The options, with their effect on the heaviest case:
- (a) Accept about 2.4 MB, since the music loads only after the begin click.
- (b) Re-encode the music at 48 kbps mono. That saves about 0.43 MB, for about 1.97 MB.
- (c) Move the sprites to high-quality lossy WebP. On one sprite that was about 101 KB down to 15 KB, which would save about 0.8 MB, for about 1.6 MB. It breaks the "lossless" rule, though.
- (d) Both (b) and (c), for about 1.2 MB.

**2. Review the verdicts.** `data/verdicts.json` is plain text and safe to edit by hand. Nine of 14 go to the Contrarian, and a few titles are odd (for example "The Contrarian Wants to Question the Cruise Ship").

**3. Approve or edit `docs/behind-the-bench.md`.** One factual note: your brief said the misnamed key plus a silent catch produced the 73 empty lines. The measured reproduction in the session record shows the empty replies came from the token budget (reasoning used all 300 tokens). The misnamed key was real too, and the catches hid both. The essay tells it that way.

**4. Missing art, 28 files** in `public/backgrounds/`. Each variant needs all four:

```
court-exterior-winter-day.webm
court-exterior-winter-day.mp4
court-exterior-winter-day-poster.webp
court-exterior-winter-day-mobile.webp
court-exterior-winter-night.webm
court-exterior-winter-night.mp4
court-exterior-winter-night-poster.webp
court-exterior-winter-night-mobile.webp
court-exterior-spring-day.webm
court-exterior-spring-day.mp4
court-exterior-spring-day-poster.webp
court-exterior-spring-day-mobile.webp
court-exterior-spring-night.webm
court-exterior-spring-night.mp4
court-exterior-spring-night-poster.webp
court-exterior-spring-night-mobile.webp
court-exterior-summer-night.webm
court-exterior-summer-night.mp4
court-exterior-summer-night-poster.webp
court-exterior-summer-night-mobile.webp
court-exterior-autumn-day.webm
court-exterior-autumn-day.mp4
court-exterior-autumn-day-poster.webp
court-exterior-autumn-day-mobile.webp
court-exterior-autumn-night.webm
court-exterior-autumn-night.mp4
court-exterior-autumn-night-poster.webp
court-exterior-autumn-night-mobile.webp
```

Match the current summer-day files: 1280x720 video in WebM and MP4, and a WebP still. Drop them in, rebuild, and they are picked up with no code change.

**5. Empty config values** in `lib/site.ts`. Each one's UI is hidden while it is empty:
- `TALK_TO_VAISHNAVI_URL`: the title-menu option.
- `SPOTIFY_PLAYLIST_URL`: the footer embed. Must be `https://open.spotify.com/playlist/<id>`; a malformed value fails the build.
- `MEDIUM_URL`: the footer link.

**6. Notion cleanup.** The report only read; nothing was changed.
- Duplicate published skills: "JavaScript" and "Javascript"; "Python", "DB2", "Node.js" and "Tailwind CSS" each twice.
- Links dropped from the Court Record:
  - Portfolio Court: `https://www.heyvaish.dev/` points at the site itself.
  - Guardrailed Causal Discovery: `https://github.com/VaishJadhavVJ/agentic-causal-ad` returns 404, probably because the repo is private.
- Published projects with no debate: none.
- Unpublished rows waiting for review: 1, in Coursework (count only).

**7. The model id.** Zhipu retired GLM-4.5-Flash on 2026-01-30 and routes its requests to GLM-4.7-Flash, which is also free. The generators still ask for GLM-4.5-Flash, so the new debates and verdicts most likely came from 4.7-Flash.

**8. Vercel.** I changed nothing there.
- If an `OPENAI_API_KEY` variable exists in Vercel, it is now unused, because nothing calls an LLM at runtime.
- The apex domain still 307-redirects to www; a 308 would be the permanent version.
