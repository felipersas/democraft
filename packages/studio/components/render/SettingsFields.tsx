"use client";

import * as React from "react";
import { Slider } from "../ui/slider";
import { Field } from "../ui/Field";
import { STUDIO_WIDTH, STUDIO_HEIGHT } from "@/lib/constants";

export function ScaleField(props: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <Field label="Resolution scale" hint={`${props.value}× (${STUDIO_WIDTH * props.value}×${STUDIO_HEIGHT * props.value})`}>
      <Slider
        min={1}
        max={3}
        step={1}
        value={props.value}
        onValueChange={props.onChange}
        disabled={props.disabled}
      />
    </Field>
  );
}

export function QualityField(props: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const label =
    props.value <= 13 ? "High" : props.value <= 17 ? "Balanced" : "Light";
  return (
    <Field label="Quality (CRF)" hint={`${label} · ${props.value}`}>
      <Slider
        min={10}
        max={28}
        step={1}
        value={props.value}
        onValueChange={props.onChange}
        disabled={props.disabled}
      />
    </Field>
  );
}
