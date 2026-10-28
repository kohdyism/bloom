"use client";

import { Settings2 } from "lucide-react";
import { Dialog, DialogTrigger, SheetContent, Switch } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { useA11y } from "@/components/a11y-provider";
import { cn } from "@/lib/utils";

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="grid gap-1 rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <label key={o.value} className={cn("cursor-pointer rounded-lg px-2 py-2 text-center text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]", value === o.value ? "bg-surface text-ink shadow-soft" : "text-ink-muted")}>
            <input type="radio" className="sr-only" name={label} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AccessibilitySettingsPanel({ showStudentOptions = false }: { showStudentOptions?: boolean }) {
  const { prefs, update, saving } = useA11y();
  return (
    <div className="flex flex-col gap-6 p-5">
      <Segmented label="Text size" value={prefs.textSize} onChange={(v) => update({ textSize: v })}
        options={[{ value: "md", label: "Standard" }, { value: "lg", label: "Large" }, { value: "xl", label: "Extra large" }]} />
      <div>
        <Segmented label="Reading font" value={prefs.font} onChange={(v) => update({ font: v })}
          options={[{ value: "default", label: "Standard" }, { value: "lexend", label: "Lexend" }, { value: "opendyslexic", label: "OpenDyslexic" }]} />
        <p className="mt-1.5 text-sm text-ink-muted">Lexend and OpenDyslexic can make text easier to read for some people, including many with dyslexia.</p>
      </div>
      <Switch id="a11y-contrast" label="High contrast" description="Stronger text and borders."
        checked={prefs.contrast === "high"} onCheckedChange={(v) => update({ contrast: v ? "high" : "normal" })} />
      <Switch id="a11y-motion" label="Reduce motion" description="Turns off moving and bouncing animations."
        checked={prefs.motion === "reduce"} onCheckedChange={(v) => update({ motion: v ? "reduce" : "system" })} />
      <Switch id="a11y-celebrate" label="Celebrations" description="Small celebrations when your group reaches a milestone."
        checked={prefs.celebrations} onCheckedChange={(v) => update({ celebrations: v })} />
      <Switch id="a11y-sound" label="Sounds" description="Soft sounds when you tap Bloom, Pip or the plant, and gentle chimes. Every sound also has a visual signal."
        checked={prefs.sound} onCheckedChange={(v) => update({ sound: v })} />
      {showStudentOptions ? (
        <>
          <Segmented label="Bloom and Pip (the helper characters)" value={prefs.mascot} onChange={(v) => update({ mascot: v })}
            options={[{ value: "show", label: "Show" }, { value: "minimised", label: "Small" }, { value: "hidden", label: "Hide" }]} />
          <Segmented label="Group progress picture" value={prefs.gamification} onChange={(v) => update({ gamification: v })}
            options={[{ value: "show", label: "Show" }, { value: "minimised", label: "Minimise" }]} />
          <Switch id="a11y-simple" label="Simpler instructions first" description="Show a short, plain-language version of each task at the top."
            checked={prefs.simplifiedInstructions} onCheckedChange={(v) => update({ simplifiedInstructions: v })} />
          <Switch id="a11y-read" label="Read aloud" description="Speaker buttons next to the task, messages and ideas read them out with your device's voice. Nothing is sent anywhere."
            checked={prefs.readAloud} onCheckedChange={(v) => update({ readAloud: v })} />
          {prefs.readAloud ? (
            <>
              <Segmented label="Reading speed" value={prefs.speechRate} onChange={(v) => update({ speechRate: v })}
                options={[{ value: "slow", label: "Slower" }, { value: "normal", label: "Normal" }]} />
              <Switch id="a11y-autoread" label="Read each new task aloud" description="When your group moves to a new stage, the task is read out automatically."
                checked={prefs.autoRead} onCheckedChange={(v) => update({ autoRead: v })} />
            </>
          ) : null}
          <Switch id="a11y-speech" label="Speech-to-text button" description="Lets you speak instead of type, where your device supports it. Canopy never listens unless you press the button."
            checked={prefs.speechInput} onCheckedChange={(v) => update({ speechInput: v })} />
        </>
      ) : null}
      <p className="text-sm text-ink-muted" aria-live="polite">
        {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved — these settings follow you to any device." : saving === "error" ? "Couldn't save just now. Your settings still apply on this device." : showStudentOptions ? "These settings follow you to any device." : "Saved on this device."}
      </p>
    </div>
  );
}

/** The same settings sheet, opened from elsewhere (e.g. the student "More" menu). */
export function AccessibilitySettingsDialog({ open, onOpenChange, showStudentOptions }: { open: boolean; onOpenChange: (o: boolean) => void; showStudentOptions?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Settings" description="Make Canopy work the way that suits you.">
        <AccessibilitySettingsPanel showStudentOptions={showStudentOptions} />
      </SheetContent>
    </Dialog>
  );
}

export function AccessibilitySettingsButton({ showStudentOptions, compact }: { showStudentOptions?: boolean; compact?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "sm"} aria-label="Accessibility and display settings">
          <Settings2 />
          {compact ? null : <span>Settings</span>}
        </Button>
      </DialogTrigger>
      <SheetContent title="Settings" description="Make Canopy work the way that suits you.">
        <AccessibilitySettingsPanel showStudentOptions={showStudentOptions} />
      </SheetContent>
    </Dialog>
  );
}
