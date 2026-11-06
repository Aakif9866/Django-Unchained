// Colour maths with no DOM.
window.ColorCore = (() => {
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function hslToHex(h, s, l) {
    const hue = ((h % 360) + 360) % 360;
    const sat = clamp(s, 0, 100) / 100;
    const light = clamp(l, 0, 100) / 100;
    const a = sat * Math.min(light, 1 - light);
    const channel = (n) => {
      const k = (n + hue / 30) % 12;
      const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(value * 255).toString(16).padStart(2, "0");
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
  }

  function hexToRgb(hex) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }

  function hexToHsl(hex) {
    const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    if (!d) return [0, 0, l * 100];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s * 100, l * 100];
  }

  /** WCAG 2 relative luminance. */
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a, b) {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  }

  /** WCAG grade for normal-size text. */
  function grade(ratio) {
    if (ratio >= 7) return "AAA";
    if (ratio >= 4.5) return "AA";
    if (ratio >= 3) return "AA large";
    return "Fail";
  }

  const bestText = (background) => (contrast(background, "#000000") >= contrast(background, "#ffffff") ? "#000000" : "#ffffff");

  const random = (low, high) => low + Math.random() * (high - low);

  /** Hues for a scheme, each with a lightness and saturation spread so palettes stay usable. */
  function generate(scheme, count) {
    const base = random(0, 360);
    const hueFor = {
      harmonic: (i) => base + i * 137.508 * 0.25, // A quarter golden angle: varied but related.
      analogous: (i) => base + (i - count / 2) * (60 / count),
      complementary: (i) => base + (i % 2 ? 180 : 0) + random(-10, 10),
      triadic: (i) => base + (i % 3) * 120 + random(-8, 8),
      monochrome: () => base,
    }[scheme];
    if (!hueFor) return Array.from({ length: count }, () => hslToHex(random(0, 360), random(20, 100), random(10, 92)));
    return Array.from({ length: count }, (_, i) => {
      // Lightness walks across the range, so a palette always spans dark to light.
      const step = count > 1 ? i / (count - 1) : 0.5;
      const lightness = 14 + step * 72 + random(-4, 4);
      return hslToHex(hueFor(i), scheme === "monochrome" ? random(35, 70) : random(50, 92), lightness);
    });
  }

  return { hslToHex, hexToRgb, hexToHsl, luminance, contrast, grade, bestText, generate };
})();
