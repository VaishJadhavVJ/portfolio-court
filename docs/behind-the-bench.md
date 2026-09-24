# Behind the Bench

*Draft. Not yet published.*

My portfolio has a courtroom in it. Three of my inner voices argue over each project I have built: the Builder, who only cares whether it shipped; the Strategist, who wants to know whether it matters; and the Contrarian, who asks why it exists at all. A narrator from a certain anime hands down a verdict. It is a joke, but it runs on real machinery, and most of what I learned building it came from that machinery lying to me.

This is how it works, and how it failed.

## How the site is put together

**Notion is the CMS.** Projects, work history, skills and coursework live in four Notion databases. Every row has a `Published` checkbox, and the site only ever reads published rows.

**A weekly routine proposes, I publish.** An automated routine I call Sentience looks through my work each week and writes suggested updates into Notion with `Published` left unchecked. Nothing it writes reaches the site until I have read it and ticked the box. The machine drafts; I decide.

**The landing page is statically regenerated.** Next.js serves a prebuilt page and rebuilds it in the background at most once a minute. If a rebuild fails, the last good page keeps serving. That property turns out to matter a great deal, and it only works if failures are allowed to be failures.

**The courtroom is pre-generated.** Each debate is written once, offline, by a script, and saved as data. The courtroom page is fully static: no model runs when you visit, and there is no public endpoint to abuse. An early version did expose one, unauthenticated, and it is gone.

**Three agents, three rounds.** For each project the three voices speak in turn for three rounds. Each round has a beat added to the prompt: the first round opens, the second asks each voice to react honestly to whatever point just landed, and the third asks for a closing position. The characters are written never to concede, so without the middle beat their rattled and blindsided expressions simply never came up.

**Dedupe is mechanical, not a request.** The prompt asks each voice not to repeat itself, but a prompt cannot reliably check a transcript that keeps growing. So the code does: every line is normalised and compared against everything that voice has already said. A repeat gets one retry with the offending line quoted back. A second repeat stops the run.

**A harness plays every case to the end.** A browser test opens the courtroom at phone, tablet and desktop widths, clicks through every debate line by line, and requires the title card, the verdict and the end card, in order. It fails on any console warning, any failed request, any text overflowing its box, and any debate that loops back to the start.

## The bugs that said everything was fine

Almost every serious bug in this project had the same shape. Something reported success, or reported a specific failure, about a thing it was not actually measuring.

### 1. The key that was never sent

The model client read its API key from one environment variable name. The environment defined it under a different one. So every request went out with no key at all.

Nothing crashed, because every layer had a fallback. When an agent could not parse a reply, it returned the raw reply as dialogue. When an agent failed outright, the orchestrator substituted filler text. The generator then printed "Done!" and wrote the file.

The file had 99 lines. 73 of them were empty. Twenty more were raw JSON pasted in as speech. Every single line had the same emotion. It was caught the unglamorous way: by opening the data file and reading it, instead of trusting the script that wrote it.

The fix was to read the variable that actually exists, then delete every fallback. An agent now gets one retry and then throws, the orchestrator has no catch at all, and before anything is written a check confirms every line has text and every speaker and emotion maps to real art. A broken run now stops at the first bad reply instead of shipping at the end.

### 2. The client built before its credentials arrived

The Notion client, and later the model client, were created at the top of their modules. In a script, imports run before the line that loads the environment file, so those clients were built while their tokens were still undefined. The script had loaded its secrets; the clients had simply been constructed too early to see them.

The fix is small: build each client on first use, not at import. The lesson is bigger. "The token is set" and "the client has the token" are different facts, and only one of them had been checked.

### 3. The budget that thinking ate

The model reasons before it answers, and its reasoning is billed against the same token budget as the answer. At a limit of 300 tokens, the reasoning alone used all 300. The reply came back as an empty string, with a finish reason of `length` that nothing was reading. With a correct key, this is what produced empty lines by itself.

Measured on a real prompt: at 300 tokens the answer was empty; at 600 it fit, using 323; with reasoning switched off it used 47. Reasoning is now off, the budget is 600, and an empty reply throws with its finish reason in the error message, so the next person to hit it sees the cause instead of a blank line.

### 4. The file check that could not tell "missing" from "busy"

Before writing a debate file, the generator checks that every speaker and emotion has a sprite on disk. After one forty-five minute run, every check failed at once, for files that plainly existed.

The check used a function that returns `false` on any error, not just "file not found". A long run holding many network connections had exhausted the process's file handles, so every lookup errored, and every error was reported as a missing file. The fix replaced over a hundred fragile lookups with a single directory read, which throws when something is actually wrong.

### 5. The empty list that would have erased the portfolio

The Notion helpers caught their own errors and returned an empty list. On a static site that regenerates in the background, that is a trap. An expired token would have produced a perfectly successful rebuild of a page with no projects on it, and that empty page would then have been cached over the good one.

Now a failed Notion call is allowed to throw, and zero published projects is treated as an error in its own right. A failed rebuild leaves the last good page in place, which is exactly the behaviour the platform offers if you let it.

### 6. The transition that locked the door behind it

When the speaker changes, the courtroom plays a short sequence: the old character leaves, the background changes, the new character arrives. A flag blocks clicks while that runs. Every debate froze at line 2.

The effect that ran the sequence depended on the very state it updated partway through. Updating it re-ran the effect, which cancelled the running sequence, which skipped the line that released the flag. The flag stayed on, and every click after line 2 was quietly ignored.

The old test checked that the page rendered its first line. It did. It had never clicked anything. The fix moved that state into a ref so the effect no longer re-runs on it, and releases the flag in a `finally` owned by the newest run. The real fix was the harness: it now plays every debate to its end, so a courtroom that renders but cannot advance can never pass again.

## The pattern

Each of these measured one thing and reported another.

- "Done!" measured that a loop finished, not that it produced anything.
- The key check measured that a variable existed, not that the client used it.
- A finish reason said `length`, and nothing read it.
- "File missing" really meant "could not look".
- An empty list meant "the request failed", and would have been cached as "no projects".
- "Page renders" said nothing about whether the page worked.

The fixes all point the same way. Let failures be failures. Delete fallbacks that turn an error into plausible-looking content. Assert on the output you actually care about, right before you ship it. And test the thing a person does, not the thing that is easy to check.
