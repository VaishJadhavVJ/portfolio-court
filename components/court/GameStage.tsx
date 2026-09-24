"use client";
import { useState, useEffect, useRef, useCallback, type MouseEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Howler } from "howler";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import AgentSprite from "./AgentSprite";
import CourtAudio, { AUDIO, type CourtAudioHandle } from "./CourtAudio";
import MusicCredit from "@/components/MusicCredit";
import { slugify } from "@/lib/slug";
import { TALK_TO_VAISHNAVI_URL } from "@/lib/site";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AgentName, DialogueLine, Emotion } from "@/types/court";
import debatesDataRaw from "@/data/debates.json";
import courtRecord from "@/data/court-record.json";

const debatesData = debatesDataRaw as Record<string, DialogueLine[]>;

/** Which courtroom each speaker argues from. Files live in public/backgrounds/. */
const BACKGROUNDS: Record<AgentName, string> = {
  baka: "/backgrounds/court-defense.webp",
  ice: "/backgrounds/court-prosecution.webp",
  child: "/backgrounds/court-judge.webp",
  narrator: "/backgrounds/court-judge.webp",
};

/**
 * Phones get a 960x540 cut of each courtroom: the stage is ~500 CSS px tall
 * there, so the 1920x1080 desktop file was 4x the pixels anyone could see and
 * ~1.4 MB each. Served through <picture>, so only the matching file downloads.
 */
const mobileBg = (src: string) => src.replace(/\.webp$/, "-mobile.webp");

/** Sprite height as a share of the stage, so every character reads the same size. */
const SPRITE_STAGE_SHARE = "66%";

// Speaker-change sequence: character out, THEN background, THEN character in.
// Strictly ordered, and the three together stay under 700ms.
const OUT_MS = 180;
const BG_MS = 260;
const IN_MS = 220;

/** Evidence cards, by topic title. Built by scripts/court-record.ts. */
const EVIDENCE = new Map(courtRecord.map((r) => [r.title, r]));
const EVIDENCE_MS = 7000;

const MUTE_KEY = "court-muted"; // "1" = effects off
const MUSIC_KEY = "court-music-off"; // "1" = music off
const INTRO_KEY = "court-intro-seen";

/** First-visit opening, played in the dialogue box before the first debate. */
const INTRO: DialogueLine[] = [
  { id: 1, speaker: "baka", emotion: "happy", text: "OH!! A VISITOR!! Welcome to court! If this feels like Ace Attorney crashed into Kaguya-sama: Love is War... YES. That was the whole plan." },
  { id: 2, speaker: "ice", emotion: "smug", text: "... Allow me. None of us are real people. We're the three voices in Vaishnavi's head. She simply gave the argument a courtroom." },
  { id: 3, speaker: "baka", emotion: "point", text: "I'm THE BUILDER! I ask ONE question: DID IT SHIP?! Deployed means defended. OBJECTION to everything else!!" },
  { id: 4, speaker: "ice", emotion: "neutral", text: "The Strategist. I ask whether it matters... who it serves, where it leads, what it's worth in five years." },
  { id: 5, speaker: "child", emotion: "confused", text: "HOLD IT!! I'm the Contrarian. They ask if it works. I ask why it EXISTS. Has anyone checked? ...No? Cool. Cool cool cool." },
  { id: 6, speaker: "child", emotion: "amazed", text: "Her projects are on trial and we never agree. Court is now in session!!" },
];

const TOGGLE =
  "shrink-0 h-11 px-2 sm:px-3 border-2 border-green-500 text-xs font-mono whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200";
const TOGGLE_ON = "bg-black text-green-400 hover:bg-green-950";
const TOGGLE_OFF = "bg-black text-green-400/70 line-through hover:bg-green-950";

/**
 * Must run synchronously inside the click handler. iOS Safari only lets audio
 * start inside a gesture's own call stack, and use-sound builds its players
 * after the click, in an effect. Creating Howler's shared AudioContext here and
 * playing one silent sample unlocks it for every sound that follows. Importing
 * howler does not create a context by itself, so nothing starts before the
 * click; the audio files still load lazily afterwards.
 */
function unlockAudio() {
  if (!Howler.ctx) Howler.volume(Howler.volume()); // volume() creates the context on first use
  const ctx = Howler.ctx;
  if (!ctx) return; // no Web Audio: nothing to unlock
  if (ctx.state !== "running") void ctx.resume();
  const tick = ctx.createBufferSource();
  tick.buffer = ctx.createBuffer(1, 1, 22050);
  tick.connect(ctx.destination);
  tick.start(0);
}

const MENU_ITEM =
  "mt-2 block w-full min-h-11 px-3 py-2 text-left text-xs sm:text-sm hover:bg-green-950 hover:text-green-200 focus-visible:outline-none focus-visible:bg-green-950 focus-visible:text-green-200 focus-visible:ring-2 focus-visible:ring-green-300";

const linesFor = (topic: string) => (debatesData[topic] ?? []).filter((l) => l.text.trim());

export default function GameStage() {
  const topics = Object.keys(debatesData);
  const initialTopic = topics.includes("Portfolio Review") ? "Portfolio Review" : topics[0] || "";
  const initialLines = linesFor(initialTopic);
  const firstLine = initialLines[0];

  // Initialised straight from the data rather than in an effect, so the server
  // and the first client render agree (this was the red-flash bug).
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
  const [script, setScript] = useState<DialogueLine[]>(initialLines);
  const [index, setIndex] = useState(0);
  const [missingBackground, setMissingBackground] = useState<string | null>(null);

  // What is currently on stage. Lags the script during a speaker change so the
  // outgoing character can leave before the incoming one arrives.
  const [staged, setStaged] = useState<{ speaker: AgentName; emotion: Emotion } | null>(
    firstLine ? { speaker: firstLine.speaker, emotion: firstLine.emotion } : null
  );
  const [stagedBg, setStagedBg] = useState<string>(firstLine ? BACKGROUNDS[firstLine.speaker] : BACKGROUNDS.baka);
  const [transitioning, setTransitioning] = useState(false);
  const spriteControls = useAnimationControls();
  const stagedRef = useRef(staged);
  const transitionRunRef = useRef(0);
  const applyStaged = (v: { speaker: AgentName; emotion: Emotion }) => {
    stagedRef.current = v;
    setStaged(v);
  };

  // Sound is only mounted after the first click or key press (see CourtAudio).
  const audioRef = useRef<CourtAudioHandle>(null);
  const [audioOn, setAudioOn] = useState(false);

  // Mute is remembered across visits. Read after mount so the server render and
  // the first client render agree.
  // Effects and music switch off independently; both are remembered.
  const [muted, setMuted] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  useEffect(() => {
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === "1");
      setMusicOn(localStorage.getItem(MUSIC_KEY) !== "1");
    } catch { /* storage blocked: default to everything on */ }
  }, []);
  const toggleMute = () => {
    setMuted((m) => {
      try { localStorage.setItem(MUTE_KEY, m ? "0" : "1"); } catch { /* not persisted; still toggles */ }
      return !m;
    });
  };
  const toggleMusic = () => {
    setMusicOn((on) => {
      try { localStorage.setItem(MUSIC_KEY, on ? "1" : "0"); } catch { /* not persisted; still toggles */ }
      return !on;
    });
  };

  // Leaving fades the music out first rather than cutting it off.
  const router = useRouter();
  const exit = async (e: MouseEvent) => {
    if (!audioRef.current) return; // nothing playing: plain navigation
    e.preventDefault();
    await audioRef.current.fadeOutMusic();
    router.push("/");
  };
  const dialogueRef = useRef<HTMLButtonElement>(null);

  // Every visit opens on a single "begin" press. Browsers only allow audio after
  // a gesture, so that press mounts CourtAudio, and the debate waits until the
  // sounds are ready -- otherwise line 1 types in silence. If audio never comes
  // up (blocked, offline), the debate starts anyway after a short wait.
  const [begun, setBegun] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioTimedOut, setAudioTimedOut] = useState(false);
  const onAudioReady = useCallback(() => setAudioReady(true), []);
  const [inIntro, setInIntro] = useState(false);
  /** Every title-screen option runs this inside its click: it is the audio gesture. */
  const begin = (forceIntro = false) => {
    unlockAudio();
    let seen = false;
    try { seen = localStorage.getItem(INTRO_KEY) === "1"; } catch { /* storage blocked: play the intro */ }
    setInIntro(forceIntro || !seen);
    setAudioOn(true);
    setBegun(true);
  };

  // /court?topic=<slug> goes straight to that case after one press (still
  // needed for audio). Read after mount: the page is static, so the server
  // cannot see the query. An unknown slug just shows the menu. Until the URL
  // has been read, the title screen shows no options, so a deep link never
  // flashes the menu first.
  const [urlRead, setUrlRead] = useState(false);
  const [deepTopic, setDeepTopic] = useState<string | null>(null);
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("topic");
    const match = slug ? topics.find((t) => slugify(t) === slug) : undefined;
    if (match) {
      setDeepTopic(match);
      handleTopicChange(match);
    }
    setUrlRead(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);
  const menuKeys = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-menu-item]")];
    const i = items.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  };
  useEffect(() => {
    if (!begun) return;
    const t = setTimeout(() => setAudioTimedOut(true), 1500);
    return () => clearTimeout(t);
  }, [begun]);
  const live = begun && (audioReady || audioTimedOut);

  // After the last line: an end card instead of looping back to line 1.
  const [ended, setEnded] = useState(false);
  const replayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (ended) replayRef.current?.focus();
  }, [ended]);

  // Refs for sound triggers
  const prevIndexRef = useRef(-1);
  const blipCounterRef = useRef(0);

  const lines = inIntro ? INTRO : script;
  const currentLine = lines[index] || null;

  // The custom hook handles the typing effect
  const { displayedText, isComplete, skip } = useTypewriter(live ? currentLine?.text || "" : "", 12);

  // Trigger sounds when a new dialogue line starts
  useEffect(() => {
    if (!live || !currentLine || prevIndexRef.current === index) return;
    prevIndexRef.current = index;

    // Reset blip counter on new line
    blipCounterRef.current = 0;

    // Keyword-triggered sounds
    const text = currentLine.text.toUpperCase();
    if (currentLine.speaker === "baka" && text.includes("OBJECTION")) {
      audioRef.current?.objection();
    } else if (currentLine.speaker === "child" && text.includes("HOLD IT")) {
      audioRef.current?.holdIt();
    } else if (currentLine.speaker === "ice" && text.includes("TAKE THAT")) {
      audioRef.current?.takeThat();
    }

    // Emotion-triggered sounds. Never on back-to-back lines: a run of "point"
    // lines slams once, on the first.
    if (currentLine.emotion === "point" && lines[index - 1]?.emotion !== "point") {
      audioRef.current?.deskSlam();
    }
  }, [live, index, currentLine, lines]);

  // Typewriter blip, throttled to one per AUDIO.blipEvery characters
  useEffect(() => {
    if (!live || !currentLine || displayedText.length === 0 || isComplete) return;

    blipCounterRef.current++;
    if (blipCounterRef.current % AUDIO.blipEvery === 0) {
      audioRef.current?.blip();
    }
  }, [live, displayedText, currentLine, isComplete]);

  // Speaker-change choreography. Same speaker twice in a row is not a
  // transition at all -- the sprite just swaps emotion in place.
  //
  // `staged` is mirrored into a ref so this effect does NOT depend on it. It
  // used to: step 3 called setStaged, which re-ran the effect, fired the
  // cleanup, set cancelled = true, and skipped the line releasing
  // `transitioning`. The flag latched on and every click after line 2 was
  // swallowed. The release now lives in a finally, owned by the newest run.
  useEffect(() => {
    if (!currentLine) return;
    const prev = stagedRef.current;
    const next = { speaker: currentLine.speaker, emotion: currentLine.emotion };

    if (!prev || prev.speaker === next.speaker) {
      applyStaged(next);
      setStagedBg(BACKGROUNDS[next.speaker]);
      // Restore visibility in case a transition was interrupted mid fade-out.
      spriteControls.start({ opacity: 1, scale: 1, transition: { duration: 0.12 } });
      return;
    }

    let cancelled = false;
    const runId = ++transitionRunRef.current;

    (async () => {
      setTransitioning(true);
      try {
        // 1. outgoing character shrinks slightly and fades out
        await spriteControls.start({
          opacity: 0,
          scale: 0.92,
          transition: { duration: OUT_MS / 1000, ease: "easeIn" },
        });
        if (cancelled) return;

        // 2. background cross-fades
        setStagedBg(BACKGROUNDS[next.speaker]);
        await new Promise((r) => setTimeout(r, BG_MS));
        if (cancelled) return;

        // 3. incoming character scales up from slightly smaller and fades in
        applyStaged(next);
        await spriteControls.start({
          opacity: 1,
          scale: 1,
          transition: { duration: IN_MS / 1000, ease: "easeOut" },
        });
      } finally {
        // Always release -- an early return above still runs this. Only the
        // newest run owns the flag, so a superseded run cannot clear it early.
        if (transitionRunRef.current === runId) setTransitioning(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentLine, spriteControls]);

  // "Evidence added to the Court Record": shown when a case starts (line 1 of a
  // debate, not the intro). No dialogue, no sound. Leaves on its own after
  // EVIDENCE_MS, paused while hovered or focused, or on the next advance.
  const [evidence, setEvidence] = useState<(typeof courtRecord)[number] | null>(null);
  const [evidenceHeld, setEvidenceHeld] = useState(false);
  const caseStarted = live && !inIntro && !ended && index === 0;
  useEffect(() => {
    setEvidence(caseStarted ? EVIDENCE.get(selectedTopic) ?? null : null);
    setEvidenceHeld(false);
  }, [caseStarted, selectedTopic]);
  useEffect(() => {
    if (!evidence || evidenceHeld) return;
    const t = setTimeout(() => setEvidence(null), EVIDENCE_MS);
    return () => clearTimeout(t);
  }, [evidence, evidenceHeld]);

  const toDebate = () => {
    try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* not persisted; intro plays again next visit */ }
    setInIntro(false);
    setIndex(0);
    setEnded(false);
    prevIndexRef.current = -1;
    dialogueRef.current?.focus();
  };

  const replayIntro = () => {
    setInIntro(true);
    setIndex(0);
    setEnded(false);
    prevIndexRef.current = -1;
    dialogueRef.current?.focus();
  };

  const handleTopicChange = (topic: string) => {
    if (inIntro) {
      try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* see toDebate */ }
      setInIntro(false);
    }
    setSelectedTopic(topic);
    setScript(linesFor(topic));
    setIndex(0);
    setEnded(false);
    prevIndexRef.current = -1;
  };

  const replay = () => {
    setIndex(0);
    setEnded(false);
    prevIndexRef.current = -1;
    dialogueRef.current?.focus();
  };

  const handleNext = () => {
    if (!live || ended || !currentLine) return;
    setEvidence(null); // advancing dismisses the evidence card

    // A click on a still-typing line completes it instantly.
    if (!isComplete) {
      skip();
      return;
    }

    // Ignore advances mid-choreography so sequences cannot overlap.
    if (transitioning) return;

    if (index < lines.length - 1) setIndex(index + 1);
    else if (inIntro) toDebate();
    else setEnded(true);
  };

  // Keyboard. Focused on the dialogue button, Enter and Space already click it;
  // ArrowRight is added there too. With nothing focused, all three advance, so
  // a keyboard user never has to tab in first. Anywhere else (the topic select,
  // mute, ESCAPE) the keys keep their native meaning.
  const nextRef = useRef(handleNext);
  nextRef.current = handleNext;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = document.activeElement;
      const onNothing = !el || el === document.body;
      const onDialogue = el === dialogueRef.current;
      const advance =
        (e.key === "ArrowRight" && (onNothing || onDialogue)) ||
        ((e.key === "Enter" || e.key === " ") && onNothing);
      if (!advance) return;
      e.preventDefault();
      nextRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!currentLine || !staged) {
    return (
      <div className="relative min-h-screen bg-[#202020] text-white font-mono flex items-center justify-center">
        <p className="text-red-500">No dialogue available. Please generate debates.</p>
        {audioOn && <CourtAudio ref={audioRef} thinking muted={muted} musicOn={musicOn} typing={false} />}
        <Link href="/" className="ml-4 px-4 py-2 bg-red-600 text-white text-xs hover:bg-red-500 pixel-corners">
          [ ESCAPE ]
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-[#202020] text-white font-mono overflow-hidden flex flex-col">

      {audioOn && (
        <CourtAudio
          ref={audioRef}
          thinking={false}
          muted={muted}
          musicOn={musicOn}
          typing={live && !ended && !isComplete}
          onReady={onAudioReady}
        />
      )}

      {/* 1. CRT SCANLINE EFFECT (Overlay) */}
      <div className="absolute inset-0 z-50 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))]" style={{ backgroundSize: "100% 2px, 3px 100%" }} />

      {/* A missing background is loud, not a silent black stage. */}
      {missingBackground && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/95 p-8">
          <p className="text-red-500 text-sm text-center leading-relaxed">
            MISSING BACKGROUND: {missingBackground}
            <br />
            <span className="text-red-400">Add the file to public/backgrounds/ and reload.</span>
          </p>
        </div>
      )}

      {/* 2. TOP BAR — 44px tap targets, select takes the slack. Under 480px the
          select gets its own row: beside three buttons it shrank to its arrow. */}
      <header className="shrink-0 w-full px-3 py-2 sm:px-4 sm:py-3 z-40 flex flex-wrap min-[480px]:flex-nowrap items-center gap-2 sm:gap-4">
        <span className="hidden md:inline text-xs text-green-500 shrink-0">SYS.2026.LOGS</span>
        <select
          className="basis-full min-[480px]:basis-auto flex-1 min-w-0 h-11 bg-black border-2 border-green-500 text-green-400 text-xs px-2 outline-none font-mono rounded-none focus-visible:border-green-200 focus-visible:ring-2 focus-visible:ring-green-200"
          value={selectedTopic}
          onChange={(e) => handleTopicChange(e.target.value)}
          aria-label="Debate topic"
        >
          {topics.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {/* Pressed = on. Off reads as struck through, so the state never relies on colour alone. */}
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={!muted}
          data-testid="mute-toggle"
          className={`${TOGGLE} ${muted ? TOGGLE_OFF : TOGGLE_ON}`}
        >
          [ SFX ]
        </button>
        <button
          type="button"
          onClick={toggleMusic}
          aria-pressed={musicOn}
          data-testid="music-toggle"
          className={`${TOGGLE} ${musicOn ? TOGGLE_ON : TOGGLE_OFF}`}
        >
          [ MUSIC ]
        </button>
        {/* pixel-corners clips anything drawn outside the box, so the focus ring is inset */}
        <Link
          href="/"
          onClick={exit}
          className="ml-auto min-[480px]:ml-0 shrink-0 h-11 px-3 sm:px-4 flex items-center justify-center bg-red-600 text-white text-xs hover:bg-red-500 pixel-corners whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white"
        >
          [ ESCAPE ]
        </Link>
      </header>

      <main className="relative flex flex-1 min-h-0 flex-col">
        <h1 className="sr-only">Courtroom: {selectedTopic}</h1>
        {/* Screen readers get each whole line once, not the typewriter's letters. */}
        <p className="sr-only" aria-live="polite">
          {live && !ended ? `${currentLine.speaker}: ${currentLine.text}` : ""}
        </p>

        {!begun && (
          <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center gap-4 bg-black/80 p-4">
            <nav
              aria-label="Title screen"
              onKeyDown={menuKeys}
              data-testid="title-menu"
              className="w-full max-w-xs border-4 border-green-500 bg-black px-5 py-5 text-green-400"
            >
              <p className="text-sm sm:text-base tracking-widest">&gt; COURT IS IN SESSION</p>
              {urlRead && deepTopic && (
                <>
                  <p className="mt-2 text-xs text-green-300">&gt; CASE: {deepTopic}</p>
                  <button type="button" onClick={() => begin()} autoFocus data-menu-item data-testid="begin" className={MENU_ITEM}>
                    [ PRESS TO BEGIN ]
                  </button>
                </>
              )}
              {urlRead && !deepTopic && (
                <ul className="mt-3">
                  <li>
                    <button type="button" onClick={() => begin()} autoFocus data-menu-item data-testid="begin" className={MENU_ITEM}>
                      [ WATCH A CASE ]
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => begin(true)} data-menu-item data-testid="menu-intro" className={MENU_ITEM}>
                      [ REPLAY INTRO ]
                    </button>
                  </li>
                  {TALK_TO_VAISHNAVI_URL && (
                    <li>
                      <a
                        href={TALK_TO_VAISHNAVI_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={unlockAudio}
                        data-menu-item
                        data-testid="menu-talk"
                        className={MENU_ITEM}
                      >
                        [ TALK TO VAISHNAVI ↗ ]
                      </a>
                    </li>
                  )}
                </ul>
              )}
            </nav>
            <MusicCredit className="max-w-xs text-center text-[10px] sm:text-xs text-gray-300" />
          </div>
        )}

        {ended && (
          <section
            aria-labelledby="end-card-title"
            data-testid="end-card"
            className="absolute inset-0 z-[45] flex items-center justify-center bg-black/85 p-3 sm:p-6"
          >
            <div className="flex max-h-full w-full max-w-xl flex-col border-4 border-green-500 bg-black p-4 sm:p-6 text-green-400 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]">
              <h2 id="end-card-title" className="text-sm sm:text-base tracking-widest">&gt; COURT ADJOURNED</h2>
              <p className="mt-1 text-xs text-green-300">&gt; {selectedTopic}: {script.length} lines, no verdict.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  ref={replayRef}
                  onClick={replay}
                  data-testid="end-replay"
                  className="h-11 px-3 border-2 border-green-500 text-xs hover:bg-green-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200"
                >
                  [ REPLAY ]
                </button>
                <button
                  type="button"
                  onClick={replayIntro}
                  data-testid="end-replay-intro"
                  className="h-11 px-3 border-2 border-green-500 text-xs hover:bg-green-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200"
                >
                  [ REPLAY INTRO ]
                </button>
                <Link
                  href="/"
                  onClick={exit}
                  data-testid="end-exit"
                  className="h-11 px-3 flex items-center border-2 border-red-500 text-xs text-red-300 hover:bg-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                >
                  [ EXIT ]
                </Link>
              </div>
              <p className="mt-5 text-xs text-green-300">&gt; OR PICK ANOTHER CASE:</p>
              <ul className="mt-2 min-h-0 overflow-y-auto">
                {topics.filter((t) => t !== selectedTopic).map((t) => (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => { handleTopicChange(t); dialogueRef.current?.focus(); }}
                      className="w-full py-2 text-left text-xs sm:text-sm hover:text-green-200 hover:bg-green-950 focus-visible:outline-none focus-visible:bg-green-950 focus-visible:text-green-200"
                    >
                      &gt; {t}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

      {/* 3. THE STAGE — fills everything above the dialogue box */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">

        {/* Background, cross-faded as step 2 of the sequence */}
        <AnimatePresence initial={false}>
          <motion.div
            key={stagedBg}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: BG_MS / 1000, ease: "easeInOut" }}
          >
            <picture>
              <source media="(max-width: 767px)" srcSet={mobileBg(stagedBg)} />
              <img
                src={stagedBg}
                alt=""
                fetchPriority="high"
                // object-cover crops to fill instead of stretching the aspect ratio.
                className="absolute inset-0 h-full w-full object-cover object-center"
                style={{ imageRendering: "pixelated" }}
                onError={(e) => setMissingBackground(e.currentTarget.currentSrc || stagedBg)}
              />
            </picture>
          </motion.div>
        </AnimatePresence>

        {/* Evidence card: top of the stage, so it can never cover the dialogue box */}
        <AnimatePresence>
          {evidence && (
            <motion.aside
              key={evidence.slug}
              aria-label="Court Record"
              data-testid="evidence-card"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onMouseEnter={() => setEvidenceHeld(true)}
              onMouseLeave={() => setEvidenceHeld(false)}
              onFocus={() => setEvidenceHeld(true)}
              onBlur={() => setEvidenceHeld(false)}
              className="absolute top-2 right-2 left-2 sm:left-auto sm:w-80 z-30 border-2 border-green-500 bg-black/90 p-3 pr-10 text-left"
            >
              <p className="text-[10px] sm:text-xs tracking-widest text-green-400">&gt; EVIDENCE ADDED TO THE COURT RECORD</p>
              <p className="mt-1.5 text-sm text-white">{evidence.title}</p>
              {evidence.summary && <p className="mt-1 text-xs leading-relaxed text-gray-300">{evidence.summary}</p>}
              {evidence.link && (
                <a
                  href={evidence.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-8 items-center text-xs text-green-300 underline underline-offset-2 hover:text-green-200 focus-visible:outline-2 focus-visible:outline-green-300"
                >
                  view evidence ↗
                </a>
              )}
              <button
                type="button"
                onClick={() => setEvidence(null)}
                aria-label="Dismiss evidence"
                className="absolute top-1 right-1 h-8 w-8 text-green-400 hover:text-green-200 focus-visible:outline-2 focus-visible:outline-green-300"
              >
                ×
              </button>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Grounding shadow so the sprite does not float on the bench */}
        <div className="absolute inset-x-0 bottom-0 h-1/4 z-10 pointer-events-none bg-gradient-to-t from-black/55 to-transparent" />

        {/*
          The actor, anchored to the stage floor. The slot spans the stage and the
          image is object-contain, so height always governs and every character
          renders at the same height regardless of source pixels.
        */}
        <motion.div
          className="absolute inset-x-0 bottom-0 z-20"
          style={{ height: SPRITE_STAGE_SHARE }}
          initial={{ opacity: 1, scale: 1 }}
          animate={spriteControls}
        >
          <AgentSprite agent={staged.speaker} emotion={staged.emotion} />
        </motion.div>
      </div>

      {/* 4. THE DIALOGUE BOX — pinned to the bottom, fixed height, never scrolls */}
      <div className="relative shrink-0 w-[95vw] max-w-[1300px] mx-auto z-40 pb-3 sm:pb-4">
        {inIntro && (
          <button
            type="button"
            onClick={toDebate}
            data-testid="skip-intro"
            className="absolute bottom-full right-0 mb-2 h-11 px-3 border-2 border-green-500 bg-black text-green-400 text-xs font-mono hover:bg-green-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200"
          >
            [ SKIP INTRO ]
          </button>
        )}
        <button
          type="button"
          ref={dialogueRef}
          onClick={handleNext}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); handleNext(); }
          }}
          aria-label={isComplete ? "Next line" : "Show the whole line"}
          data-testid="dialogue-box"
          className="block w-full text-left bg-black/95 border-4 border-white relative cursor-pointer hover:border-green-400 transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:border-green-300 focus-visible:ring-4 focus-visible:ring-green-300/70"
        >
          {/* Speaker nameplate, flush into the top-left corner of the box */}
          <span aria-hidden className="absolute top-0 left-0 bg-blue-600 text-white px-2 sm:px-3 py-1 text-xs sm:text-sm font-bold capitalize tracking-wider border-r-2 border-b-2 border-white z-10">
            {staged.speaker}
          </span>

          {/* Fixed height, sized for the longest line in the data at each breakpoint. */}
          <span
            aria-hidden
            data-testid="dialogue-text"
            className="block h-[272px] min-[375px]:h-[232px] sm:h-[184px] md:h-[208px] lg:h-[160px] overflow-hidden px-3 sm:px-5 pt-9 sm:pt-10 pb-3 sm:pb-4"
          >
            <span data-testid="dialogue-line" className="block text-left text-xs sm:text-sm md:text-base leading-relaxed tracking-wide text-gray-100">
              {displayedText}
              {!isComplete && <span className="animate-pulse">_</span>}
            </span>
          </span>

          {/* "Next" Indicator (Blinking Triangle) */}
          {isComplete && (
            <span aria-hidden className="absolute bottom-1 right-2 text-green-400 animate-bounce text-lg">
              ▼
            </span>
          )}
        </button>

        <div className="text-center mt-1 text-[10px] sm:text-xs text-gray-400">
          [ CLICK TO {isComplete ? "CONTINUE" : "SKIP"} ] &nbsp;·&nbsp;{" "}
          {inIntro && "INTRO "}<span data-testid="line-counter">{index + 1}/{lines.length}</span>
        </div>
      </div>
      </main>

    </div>
  );
}
