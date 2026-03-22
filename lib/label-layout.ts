import type { LabelFieldKey, LabelFieldLayout, LabelTemplate } from "@/lib/types";

function mmToPt(mm: number) {
  return (mm / 25.4) * 72;
}

function charWidthFactor(char: string) {
  if (char === " ") return 0.33;
  if ("ilI1.,:;!|'`".includes(char)) return 0.28;
  if ("-_/".includes(char)) return 0.36;
  if ("MWÅÄÖ@#%&".includes(char)) return 0.9;
  if (/[A-Z]/.test(char)) return 0.68;
  if (/[0-9]/.test(char)) return 0.56;
  return 0.54;
}

function fontWidthAdjustment(field: LabelFieldLayout) {
  let factor = 1;
  if (field.fontWeight === 700) factor += 0.05;
  if (field.fontFamily === "georgia") factor += 0.03;
  if (field.fontFamily === "verdana") factor += 0.02;
  return factor;
}

function measureTextPt(text: string, field: LabelFieldLayout) {
  const adjust = fontWidthAdjustment(field);
  let width = 0;
  for (const char of text) {
    width += charWidthFactor(char) * field.fontSizePt * adjust;
  }
  return width;
}

function splitBreakableWord(word: string) {
  if (!word.includes("-")) {
    return [word];
  }

  const parts = word.split("-");
  const tokens: string[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) continue;
    if (index < parts.length - 1) {
      tokens.push(`${part}-`);
    } else {
      tokens.push(part);
    }
  }
  return tokens.length ? tokens : [word];
}

function breakLongToken(token: string, field: LabelFieldLayout, maxWidthPt: number) {
  const segments: string[] = [];
  let current = "";

  for (const char of token) {
    const next = current + char;
    if (current && measureTextPt(next, field) > maxWidthPt) {
      segments.push(current);
      current = char;
      continue;
    }
    current = next;
  }

  if (current) {
    segments.push(current);
  }

  return segments.length ? segments : [token];
}

export function wrapFieldText(template: LabelTemplate, fieldKey: LabelFieldKey, text: string) {
  const field = template.fields[fieldKey];
  const raw = text.trim();
  if (!field.visible || !raw) {
    return [];
  }

  const widthPt = mmToPt(field.rotationDeg === 0 ? field.widthMm : field.heightMm);
  const heightPt = mmToPt(field.rotationDeg === 0 ? field.heightMm : field.widthMm);
  const lineHeightPt = field.fontSizePt * 1.2;
  const maxLines = Math.max(1, Math.floor(heightPt / lineHeightPt));
  const paragraphs = raw.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const baseWords = paragraph.trim().split(/\s+/).filter(Boolean);
    const tokens = baseWords.flatMap((word) => splitBreakableWord(word));

    let current = "";

    for (const token of tokens) {
      const tokenVariants =
        measureTextPt(token, field) > widthPt ? breakLongToken(token, field, widthPt) : [token];

      for (const piece of tokenVariants) {
        const next = current ? `${current} ${piece}` : piece;
        if (current && measureTextPt(next, field) > widthPt) {
          lines.push(current);
          current = piece;
          if (lines.length >= maxLines) {
            return lines.slice(0, maxLines);
          }
          continue;
        }
        current = next;
      }
    }

    if (current) {
      lines.push(current);
      if (lines.length >= maxLines) {
        return lines.slice(0, maxLines);
      }
    }
  }

  return lines.slice(0, maxLines);
}
