/** Textos fijos de opción en encuesta tipo Sí / No. */
export const YES_OPTION_TEXT = "Sí";
export const NO_OPTION_TEXT = "No";

export function yesNoNestedCreate() {
  return {
    create: [
      { text: YES_OPTION_TEXT, sortOrder: 0 },
      { text: NO_OPTION_TEXT, sortOrder: 1 },
    ],
  };
}

/** Clasifica el texto de una opción guardada (tolerante a mayúsculas / tilde). */
export function classifyYesNoOption(text: string): "si" | "no" | null {
  const t = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (t === "si") return "si";
  if (t === "no") return "no";
  return null;
}

export function isYesNoPair(options: { text: string }[]): boolean {
  if (options.length !== 2) return false;
  const [a, b] = options;
  const ca = classifyYesNoOption(a.text);
  const cb = classifyYesNoOption(b.text);
  return (ca === "si" && cb === "no") || (ca === "no" && cb === "si");
}

/** Muestra Sí antes que No en la encuesta. */
export function orderYesNoOptions<T extends { id: string; text: string }>(
  options: T[],
): T[] {
  if (!isYesNoPair(options)) return options;
  const [x, y] = options;
  return classifyYesNoOption(x.text) === "si" ? [x, y] : [y, x];
}

