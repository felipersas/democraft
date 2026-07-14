"use client";

import * as React from "react";
import { Trash2, Save } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { useRenderPresets, type RenderPreset } from "@/lib/render-presets";
import { makeId } from "@/lib/id";
import { Field } from "../ui/Field";

export function PresetField(props: {
  currentScale: number;
  currentCrf: number;
  onApply: (preset: RenderPreset) => void;
}) {
  const { presets, addPreset, removePreset } = useRenderPresets();
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");

  const applySelected = (id: string) => {
    const preset = presets.find((p) => p.id === id);
    if (preset) props.onApply(preset);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addPreset({
      id: makeId("preset"),
      name: trimmed,
      scale: props.currentScale,
      crf: props.currentCrf,
    });
    setName("");
    setSaving(false);
  };

  const currentId = presets.find(
    (p) => p.scale === props.currentScale && p.crf === props.currentCrf,
  )?.id;

  return (
    <Field label="Preset">
      <div className="flex items-center gap-1.5">
        <select
          value={currentId ?? ""}
          onChange={(e) => applySelected(e.target.value)}
          className={cn(
            "flex-1 h-7 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)]",
            "px-1.5 text-[11px] text-[var(--color-fg)]",
            "focus:outline-none focus:border-[var(--color-accent-muted)]",
          )}
        >
          <option value="">Choose preset…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.scale}×, CRF {p.crf})
            </option>
          ))}
        </select>
        {currentId && (
          <button
            type="button"
            onClick={() => removePreset(currentId)}
            title="Delete preset"
            className="text-[var(--color-fg-dim)] hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setSaving((s) => !s)}
          title="Save current as preset"
          className="text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors p-1"
        >
          <Save className="w-3 h-3" />
        </button>
      </div>
      {saving && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setSaving(false);
                setName("");
              }
            }}
            placeholder="Preset name…"
            className={cn(
              "flex-1 h-7 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)]",
              "px-2 text-[11px] text-[var(--color-fg)]",
              "focus:outline-none focus:border-[var(--color-accent-muted)]",
            )}
          />
          <Button variant="primary" size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      )}
    </Field>
  );
}
