"use client";

import * as React from "react";
import { Music, Plus, RotateCcw, Trash2, Volume2, VolumeX } from "lucide-react";
import type { AudioKind, AudioTrackIR } from "@democraft/schema";
import { AUDIO_KINDS } from "@democraft/schema";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";
import { Field } from "./ui/Field";
import { Slider } from "./ui/slider";
import { InspectorSection } from "./ui/InspectorSection";
import { Button } from "./ui/button";

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
    <InspectorSection
      icon={<Music className="h-4 w-4" />}
      title="Audio"
      description={hasAudioOverrides ? "Studio override active. Changes persist for preview and render." : "Manage music, narration, and sound effects from demo.ts."}
      action={<div className="flex items-center gap-1">
          {hasAudioOverrides && (
            <Button variant="ghost" size="sm"
              onClick={() => void resetAudioTracks()}
              title="Reset to demo.ts"
            >
              <RotateCcw className="h-3.5 w-3.5" />Reset
            </Button>
          )}
          <Button variant="ghost" size="icon"
            onClick={handleAdd}
            title="Add audio track"
            aria-label="Add audio track"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>}
    >

      {(!audioTracks || audioTracks.length === 0) && (
        <div className="studio-empty">
          <span className="font-medium text-[var(--studio-fg)]">No audio tracks</span>
          Add background music, narration, or a sound effect. Audio changes are stored as a Studio override.
          <Button variant="outline" size="sm" onClick={handleAdd}><Plus className="h-3.5 w-3.5" />Add audio track</Button>
        </div>
      )}

      {audioTracks && audioTracks.length > 0 && (
        <div className="space-y-3">
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
        <div role="alert" className="rounded-md border border-[var(--studio-error)]/40 bg-[var(--studio-error)]/10 p-2.5 text-[11px] text-[var(--studio-error)] leading-snug">
          {audioError}
        </div>
      )}
    </InspectorSection>
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
        "studio-card p-3 space-y-3",
        disabled && "bg-[var(--studio-surface-2)]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--studio-border)] pb-2.5">
        <input
          type="text"
          value={track.label ?? ""}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder={track.id}
          aria-label="Audio track label"
          className="flex-1 min-w-0 border-0 bg-transparent p-0 text-xs font-semibold text-[var(--studio-fg)] outline-none placeholder:text-[var(--studio-fg-dim)]"
        />
        <button
          type="button"
          onClick={() => patch({ disabled: !disabled })}
          title={disabled ? "Enable track" : "Disable track"}
          aria-label={disabled ? "Enable track" : "Disable track"}
          className="grid h-8 w-8 place-items-center rounded-md text-[var(--studio-fg-dim)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)]"
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
          aria-label="Remove audio track"
          className="grid h-8 w-8 place-items-center rounded-md text-[var(--studio-fg-dim)] hover:bg-[var(--studio-error)]/10 hover:text-[var(--studio-error)]"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <details className="group/track">
        <summary className="flex h-8 cursor-pointer list-none items-center rounded-md px-2 text-[11px] text-[var(--studio-fg-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)]">
          <span>Configure track</span>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[var(--studio-fg-dim)]">
            <span className="capitalize">{track.kind ?? "sfx"}</span>
            <span aria-hidden>·</span>
            <span>{Math.round(track.volume * 100)}%</span>
            <span className="group-open/track:hidden">Show</span>
            <span className="hidden group-open/track:inline">Hide</span>
          </span>
        </summary>
        <div className="mt-3 space-y-3 border-t border-[var(--studio-border)] pt-3">
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

      <div className="grid grid-cols-2 gap-3">
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
            trackClassName="h-8"
          />
        </Field>
      </div>

      <details className="group rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface-2)]">
        <summary className="flex h-9 cursor-pointer list-none items-center px-2.5 text-[11px] font-medium text-[var(--studio-fg-muted)] hover:text-[var(--studio-fg)]">Timing and fades <span className="ml-auto text-[10px] text-[var(--studio-fg-dim)] group-open:hidden">Show</span><span className="ml-auto hidden text-[10px] text-[var(--studio-fg-dim)] group-open:inline">Hide</span></summary>
        <div className="space-y-3 border-t border-[var(--studio-border)] p-2.5">
      <div className="grid grid-cols-2 gap-3">
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

      <div className="grid grid-cols-2 gap-3">
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
        </div>
      </details>

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
      </details>
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
