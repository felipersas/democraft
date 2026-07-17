"use client";

import * as React from "react";
import { Music, Plus, RotateCcw, Trash2, Volume2, VolumeX } from "lucide-react";
import type { AudioKind, AudioTrackIR } from "@democraft/schema";
import { AUDIO_KINDS } from "@democraft/schema";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";
import { Field } from "./ui/Field";
import { Slider } from "./ui/slider";

/**
 * Audio track manager. Lists every track as an editable card (add / edit /
 * remove / enable-disable / volume / mute / loop / fades / kind / timing).
 * Edits persist to studio-data/audio-overrides.json and reload the preview.
 *
 * The panel edits the IR (ms) form; the preview + render resolve to frames via
 * the shared timeline resolver. Validation errors are shown per field.
 */
export function AudioPanel() {
  const {
    status,
    audioTracks,
    hasAudioOverrides,
    addAudioTrack,
    removeAudioTrack,
    resetAudioTracks,
    audioError,
  } = useStudio();

  if (status.kind !== "ready") return null;

  const handleAdd = () => {
    const id = `track-${(audioTracks?.length ?? 0) + 1}`;
    void addAudioTrack({
      id,
      src: "",
      kind: "sfx",
      startAtMs: 0,
      volume: 1,
      muted: false,
      loop: false,
      fadeInMs: 0,
      fadeOutMs: 0,
    });
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-panel)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-[var(--color-accent)]" />
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
            Audio
          </div>
          {hasAudioOverrides && (
            <span className="text-[9px] uppercase tracking-wider text-[var(--color-accent)]">
              edited
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasAudioOverrides && (
            <button
              type="button"
              onClick={() => void resetAudioTracks()}
              title="Reset to demo.ts"
              className="flex items-center gap-1 text-[10px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={handleAdd}
            title="Add audio track"
            className="text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {(!audioTracks || audioTracks.length === 0) && (
        <div className="text-[10px] text-[var(--color-fg-dim)] py-1">
          No audio tracks. Click{" "}
          <span className="text-[var(--color-fg-muted)]">+</span> to add
          background music, narration, or sound effects.
        </div>
      )}

      {audioTracks && audioTracks.length > 0 && (
        <div className="space-y-2.5">
          {audioTracks.map((track) => (
            <AudioTrackCard
              key={track.id}
              track={track}
              onRemove={removeAudioTrack}
            />
          ))}
        </div>
      )}

      {audioError && (
        <div role="alert" className="text-[10px] text-red-400/90 leading-snug">
          {audioError}
        </div>
      )}
    </div>
  );
}

function AudioTrackCard(props: {
  track: AudioTrackIR;
  onRemove: (id: string) => Promise<void>;
}) {
  const { updateAudioTrack, removeAudioTrack } = useStudio();
  const { track } = props;
  const errors = validateTrack(track);

  const patch = (p: Partial<AudioTrackIR>) =>
    void updateAudioTrack(track.id, p);
  const disabled = track.disabled ?? false;

  return (
    <div
      className={cn(
        "rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 space-y-2",
        disabled && "opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={track.label ?? ""}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder={track.id}
          className="flex-1 min-w-0 bg-transparent text-[11px] text-[var(--color-fg)] focus:outline-none placeholder:text-[var(--color-fg-dim)]"
        />
        <button
          type="button"
          onClick={() => patch({ disabled: !disabled })}
          title={disabled ? "Enable track" : "Disable track"}
          className="text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors"
        >
          {disabled ? (
            <VolumeX className="w-3.5 h-3.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => void removeAudioTrack(track.id)}
          title="Remove track"
          className="text-[var(--color-fg-dim)] hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <Field label="Source">
        <input
          type="text"
          value={track.src}
          onChange={(e) => patch({ src: e.target.value })}
          placeholder="./assets/music.mp3 or https://…"
          className={cn(
            "w-full rounded-md bg-[var(--color-bg-panel)] border px-2 py-1 text-[10px] text-[var(--color-fg)] focus:outline-none placeholder:text-[var(--color-fg-dim)]",
            errors.src
              ? "border-red-400/60"
              : "border-[var(--color-border)] focus:border-[var(--color-accent-muted)]",
          )}
        />
        {errors.src && (
          <div className="text-[9px] text-red-400/90">{errors.src}</div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Kind">
          <select
            value={track.kind ?? "sfx"}
            onChange={(e) => patch({ kind: e.target.value as AudioKind })}
            className="w-full rounded-md bg-[var(--color-bg-panel)] border border-[var(--color-border)] px-1.5 py-1 text-[10px] text-[var(--color-fg)] focus:outline-none"
          >
            {AUDIO_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Volume" hint={`${Math.round(track.volume * 100)}%`}>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={track.volume}
            onValueChange={(v) => patch({ volume: v })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Start (s)">
          <input
            type="number"
            min={0}
            step={0.1}
            value={msToSeconds(track.startAtMs)}
            onChange={(e) =>
              patch({
                startAtMs: Math.max(0, secondsToMs(Number(e.target.value))),
              })
            }
            className={cn(
              "w-full rounded-md bg-[var(--color-bg-panel)] border px-2 py-1 text-[10px] text-[var(--color-fg)] focus:outline-none",
              errors.startAt
                ? "border-red-400/60"
                : "border-[var(--color-border)]",
            )}
          />
        </Field>
        <Field label="End (s)">
          <input
            type="number"
            min={0}
            step={0.1}
            value={
              track.endAtMs === undefined ? "" : msToSeconds(track.endAtMs)
            }
            onChange={(e) => {
              const v = e.target.value;
              patch({ endAtMs: v === "" ? undefined : secondsToMs(Number(v)) });
            }}
            placeholder="end"
            className="w-full rounded-md bg-[var(--color-bg-panel)] border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-fg)] focus:outline-none placeholder:text-[var(--color-fg-dim)]"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Fade in (s)">
          <input
            type="number"
            min={0}
            step={0.1}
            value={msToSeconds(track.fadeInMs)}
            onChange={(e) =>
              patch({
                fadeInMs: Math.max(0, secondsToMs(Number(e.target.value))),
              })
            }
            className="w-full rounded-md bg-[var(--color-bg-panel)] border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-fg)] focus:outline-none"
          />
        </Field>
        <Field label="Fade out (s)">
          <input
            type="number"
            min={0}
            step={0.1}
            value={msToSeconds(track.fadeOutMs)}
            onChange={(e) =>
              patch({
                fadeOutMs: Math.max(0, secondsToMs(Number(e.target.value))),
              })
            }
            className="w-full rounded-md bg-[var(--color-bg-panel)] border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-fg)] focus:outline-none"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-[10px] text-[var(--color-fg-muted)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={track.muted}
            onChange={(e) => patch({ muted: e.target.checked })}
            className="accent-[var(--color-accent)]"
          />
          Mute
        </label>
        <label className="flex items-center gap-1 text-[10px] text-[var(--color-fg-muted)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={track.loop}
            onChange={(e) => patch({ loop: e.target.checked })}
            className="accent-[var(--color-accent)]"
          />
          Loop
        </label>
      </div>
    </div>
  );
}

/** Lightweight per-field validation surfaced inline (mirrors the schema rules). */
function validateTrack(track: AudioTrackIR): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  if (!track.src.trim()) errors.src = "Source is required.";
  if (track.volume < 0 || track.volume > 1)
    errors.volume = "Volume must be 0–1.";
  if (track.endAtMs !== undefined && track.endAtMs <= track.startAtMs)
    errors.startAt = "End must be after start.";
  return errors;
}

function msToSeconds(ms: number): number {
  return Math.round((ms / 1000) * 10) / 10;
}

function secondsToMs(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.round(seconds * 1000);
}
