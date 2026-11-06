// ColorLab interface. Colour maths lives in color-core.js.
(() => {
  const root = document.getElementById("colorlab");
  const { el } = SQ;
  const { contrast, grade, bestText, hexToRgb, hexToHsl, generate } = window.ColorCore;
  const $ = (id) => document.getElementById(id);

  let palette = []; // [{ hex, locked }]

  const rgbText = (hex) => `rgb(${hexToRgb(hex).join(", ")})`;

  function regenerate() {
    const count = Number($("count").value);
    const fresh = generate($("scheme").value, count);
    palette = fresh.map((hex, i) => (palette[i] && palette[i].locked ? palette[i] : { hex, locked: false }));
    render();
  }

  function setCount() {
    const count = Number($("count").value);
    const fresh = generate($("scheme").value, count);
    palette = fresh.map((hex, i) => palette[i] || { hex, locked: false });
    render();
  }

  function swatch(color, index) {
    const text = bestText(color.hex);
    const ratio = contrast(color.hex, text);
    const node = el("div", { class: "swatch" },
      el("div", { class: "swatch-info" },
        el("button", { class: "swatch-code swatch-hex", type: "button", text: color.hex.toUpperCase(), title: "Copy HEX", onclick: () => SQ.copy(color.hex.toUpperCase(), `Copied ${color.hex.toUpperCase()}`) }),
        el("button", { class: "swatch-code swatch-rgb d-block", type: "button", text: rgbText(color.hex), title: "Copy RGB", onclick: () => SQ.copy(rgbText(color.hex), "Copied RGB") }),
        el("div", { class: "swatch-contrast", text: `${text === "#000000" ? "Black" : "White"} text ${ratio.toFixed(1)}:1 · ${grade(ratio)}` })),
      el("div", { class: "mt-1" },
        el("button", {
          class: "swatch-tool", type: "button", "aria-pressed": String(color.locked),
          "aria-label": `${color.locked ? "Unlock" : "Lock"} ${color.hex}`, title: color.locked ? "Unlock" : "Lock",
          onclick: () => { color.locked = !color.locked; render(); },
        }, el("i", { class: `bi bi-${color.locked ? "lock-fill" : "unlock"}` }))));
    node.style.backgroundColor = color.hex;
    node.style.color = text;
    node.dataset.index = index;
    return node;
  }

  function renderDemo() {
    const byLight = [...palette].map((c) => c.hex).sort((a, b) => hexToHsl(a)[2] - hexToHsl(b)[2]);
    const background = byLight[0];
    const surface = byLight[1] || background;
    const candidates = byLight.slice(1);
    // The most saturated colour that isn't the page background makes the most believable button.
    const accent = [...candidates].sort((a, b) => hexToHsl(b)[1] - hexToHsl(a)[1])[0] || background;
    // Page text: the palette colour with the strongest contrast, falling back to black or white if none reach AA.
    const strongest = [...byLight].sort((a, b) => contrast(b, background) - contrast(a, background))[0];
    const text = contrast(strongest, background) >= 4.5 ? strongest : bestText(background);
    const surfaceText = bestText(surface);
    const accentText = bestText(accent);
    const demo = $("demo");
    [["--d-bg", background], ["--d-surface", surface], ["--d-text", text], ["--d-surface-text", surfaceText], ["--d-accent", accent], ["--d-accent-text", accentText]]
      .forEach(([name, value]) => demo.style.setProperty(name, value));
    const badge = (label, a, b) => {
      const ratio = contrast(a, b);
      const verdict = grade(ratio);
      return el("span", { class: `sq-badge ${verdict === "Fail" ? "sq-badge-bad" : verdict === "AA large" ? "" : "sq-badge-ok"}`, text: `${label} ${ratio.toFixed(1)}:1 ${verdict}` });
    };
    $("demo-contrast").replaceChildren(
      badge("Text on page", text, background),
      badge("Text on cards", surfaceText, surface),
      badge("Button", accentText, accent),
      badge("Button on page", accent, background));
  }

  function render() {
    $("swatches").replaceChildren(...palette.map(swatch));
    renderDemo();
  }

  function loadPalette(colors) {
    palette = colors.map((hex) => ({ hex, locked: false }));
    const select = $("count");
    if (![...select.options].some((o) => Number(o.value) === colors.length)) select.append(el("option", { text: colors.length }));
    select.value = colors.length;
    render();
  }

  async function loadSaved() {
    const box = $("saved");
    try {
      const { palettes } = await SQ.api(root.dataset.palettesUrl);
      if (!palettes.length) return box.replaceChildren(SQ.emptyState("palette", "No saved palettes yet."));
      box.replaceChildren(...palettes.map((item) => {
        const strip = el("div", { class: "saved-strip" }, item.colors.map((hex) => {
          const cell = el("span", { title: hex });
          cell.style.backgroundColor = hex;
          return cell;
        }));
        return el("div", { class: "saved-row" },
          el("button", { class: "saved-load", type: "button", onclick: () => loadPalette(item.colors) }, el("span", { text: item.name }), strip),
          el("button", {
            class: "icon-btn", type: "button", "aria-label": `Delete ${item.name}`,
            onclick: async () => {
              try {
                await SQ.api(`${root.dataset.palettesUrl}${item.id}/`, { method: "DELETE" });
                SQ.toast("Palette deleted", "success");
                loadSaved();
              } catch (error) { SQ.toast(error.message, "error"); }
            },
          }, el("i", { class: "bi bi-trash" })));
      }));
    } catch (error) {
      box.replaceChildren(SQ.emptyState("wifi-off", error.message));
    }
    return undefined;
  }

  $("generate").addEventListener("click", regenerate);
  $("scheme").addEventListener("change", regenerate);
  $("count").addEventListener("change", setCount);
  $("copy-hex").addEventListener("click", () => SQ.copy(palette.map((c) => c.hex.toUpperCase()).join(", "), "Palette copied"));
  $("copy-css").addEventListener("click", () => SQ.copy(`:root {\n${palette.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join("\n")}\n}`, "CSS variables copied"));
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(event.target.tagName)) {
      event.preventDefault();
      regenerate();
    }
  });

  if (SQ.isAuth) {
    $("save-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await SQ.api(root.dataset.palettesUrl, { method: "POST", data: { name: $("save-name").value, colors: palette.map((c) => c.hex) } });
        $("save-name").value = "";
        SQ.toast("Palette saved", "success");
        loadSaved();
      } catch (error) { SQ.toast(error.message, "error"); }
    });
    loadSaved();
  }

  regenerate();
})();
