"use client";

/**
 * ChatInteractiveInput
 *
 * Renderizado no chat quando a IA chama a tool `askUserInput`.
 * Suporta 4 modos:
 *   single   — escolha única (radio buttons)
 *   multiple — múltipla escolha (checkboxes)
 *   confirm  — Sim / Não
 *   slider   — valor numérico com slider
 */

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

import type { AskUserInputArgs } from "@/types";

interface Props {
  args: AskUserInputArgs;
  onAnswer: (answer: string) => void;
  answered?: boolean;
  answeredValue?: string;
}

export function ChatInteractiveInput({ args, onAnswer, answered, answeredValue }: Props) {
  const options = args.options ? args.options.split("|").map(o => o.trim()) : [];

  const [selected, setSelected] = useState<string[]>([]);
  const [sliderValue, setSliderValue] = useState<number>(
    args.sliderMin ?? 0
  );

  const handleSubmit = (answer: string) => {
    onAnswer(answer);
  };

  // ── Já respondido ────────────────────────────────────────────
  if (answered) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-zinc-400 bg-zinc-900/50 rounded-lg px-3 py-2 border border-zinc-800/50">
        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-zinc-300">{answeredValue}</span>
      </div>
    );
  }

  // ── Confirm (Sim / Não) ──────────────────────────────────────
  if (args.type === "confirm") {
    return (
      <div className="flex flex-col gap-2.5 bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
        <p className="text-[11.5px] text-zinc-200 leading-relaxed">{args.question}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleSubmit("Sim")}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-lg h-8"
          >
            Sim
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSubmit("Não")}
            className="flex-1 border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-[11px] font-semibold rounded-lg h-8"
          >
            Não
          </Button>
        </div>
      </div>
    );
  }

  // ── Single (escolha única) ───────────────────────────────────
  if (args.type === "single") {
    return (
      <div className="flex flex-col gap-2.5 bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
        <p className="text-[11.5px] text-zinc-200 leading-relaxed">{args.question}</p>
        <div className="flex flex-col gap-1.5">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => handleSubmit(opt)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 text-[11px] text-zinc-200 font-medium transition-all text-left group"
            >
              {opt}
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Multiple (checkboxes) ────────────────────────────────────
  if (args.type === "multiple") {
    const toggle = (opt: string) => {
      setSelected(prev =>
        prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
      );
    };

    return (
      <div className="flex flex-col gap-2.5 bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
        <p className="text-[11.5px] text-zinc-200 leading-relaxed">{args.question}</p>
        <div className="flex flex-col gap-1.5">
          {options.map(opt => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border text-[11px] font-medium transition-all text-left ${
                  isSelected
                    ? "bg-zinc-700 border-zinc-500 text-zinc-100"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750 hover:border-zinc-600"
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? "bg-emerald-500 border-emerald-500" : "border-zinc-600"
                }`}>
                  {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                {opt}
              </button>
            );
          })}
        </div>
        <Button
          size="sm"
          disabled={selected.length === 0}
          onClick={() => handleSubmit(selected.join(", "))}
          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-[11px] font-semibold rounded-lg h-8 disabled:opacity-40"
        >
          Confirmar {selected.length > 0 && `(${selected.length})`}
        </Button>
      </div>
    );
  }

  // ── Slider ───────────────────────────────────────────────────
  if (args.type === "slider") {
    const min = args.sliderMin ?? 0;
    const max = args.sliderMax ?? 100;
    const step = args.sliderStep ?? 1;
    const unit = args.sliderUnit ?? "";

    return (
      <div className="flex flex-col gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
        <p className="text-[11.5px] text-zinc-200 leading-relaxed">{args.question}</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">{min.toLocaleString("pt-MZ")} {unit}</span>
            <span className="text-sm font-bold text-zinc-100">
              {sliderValue.toLocaleString("pt-MZ")} {unit}
            </span>
            <span className="text-[10px] text-zinc-500">{max.toLocaleString("pt-MZ")} {unit}</span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[sliderValue]}
            onValueChange={([v]) => setSliderValue(v)}
            className="w-full"
          />
        </div>
        <Button
          size="sm"
          onClick={() => handleSubmit(`${sliderValue.toLocaleString("pt-MZ")} ${unit}`.trim())}
          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-[11px] font-semibold rounded-lg h-8"
        >
          Confirmar
        </Button>
      </div>
    );
  }

  return null;
}
