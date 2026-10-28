import { z } from "zod";

export const accessibilitySchema = z.object({
  textSize: z.enum(["md", "lg", "xl"]).default("md"),
  /** Reading font: the default, or a dyslexia-friendly alternative. */
  font: z.enum(["default", "lexend", "opendyslexic"]).default("default"),
  contrast: z.enum(["normal", "high"]).default("normal"),
  /** "system" follows the device setting; "reduce" always reduces motion. */
  motion: z.enum(["system", "reduce"]).default("system"),
  celebrations: z.boolean().default(true),
  sound: z.boolean().default(true),
  mascot: z.enum(["show", "minimised", "hidden"]).default("show"),
  gamification: z.enum(["show", "minimised"]).default("show"),
  speechInput: z.boolean().default(true),
  simplifiedInstructions: z.boolean().default(false),
});
export type AccessibilityPrefs = z.infer<typeof accessibilitySchema>;

export const DEFAULT_A11Y: AccessibilityPrefs = accessibilitySchema.parse({});

export function parseA11y(value: unknown): AccessibilityPrefs {
  const parsed = accessibilitySchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_A11Y;
}

export function htmlDataAttributes(p: AccessibilityPrefs) {
  return {
    "data-text": p.textSize,
    "data-font": p.font,
    "data-contrast": p.contrast,
    "data-motion": p.motion,
  } as const;
}
