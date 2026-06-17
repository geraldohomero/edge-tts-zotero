/**
 * UI module — registers context menus, toolbar buttons, and keyboard shortcuts.
 */

import { getSelectedText, isReaderActive } from "./reader";
import { speak, stop, getState, getVoices, setPlaybackRate, pause, resume } from "./tts";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";

/**
 * Register the right-click context menu item in the item menu.
 * Adds a "🔊 Read Aloud" option.
 */
export function registerReaderContextMenu() {
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: `${addon.data.config.addonRef}-reader-read-aloud`,
    label: getString("menu-read-aloud"),
    icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
    commandListener: async () => {
      await handleReadAloud();
    },
  });
}

/**
 * Register the "Stop Reading" menu item.
 */
export function registerStopMenuItem() {
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: `${addon.data.config.addonRef}-reader-stop`,
    label: getString("menu-stop-reading"),
    commandListener: async () => {
      await stop();
    },
  });
}

/**
 * Register the Tools menu items.
 */
export function registerToolsMenu() {
  // Read Aloud menu item under Tools
  ztoolkit.Menu.register("menuTools", {
    tag: "menuitem",
    id: `${addon.data.config.addonRef}-tools-read-aloud`,
    label: getString("menu-read-aloud"),
    icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
    commandListener: async () => {
      await handleReadAloud();
    },
  });

  // Stop Reading menu item under Tools
  ztoolkit.Menu.register("menuTools", {
    tag: "menuitem",
    id: `${addon.data.config.addonRef}-tools-stop`,
    label: getString("menu-stop-reading"),
    commandListener: async () => {
      await stop();
    },
  });

  // Settings menu item under Tools
  ztoolkit.Menu.register("menuTools", {
    tag: "menuitem",
    id: `${addon.data.config.addonRef}-tools-preferences`,
    label: getString("menu-preferences"),
    commandListener: () => {
      Zotero.getActiveZoteroPane().openPreferences("edge-tts-preferences-pane");
    },
  });
}

/**
 * Register the keyboard shortcut for Read Aloud.
 * Ctrl+Shift+S to read aloud, Ctrl+Shift+X to stop.
 */
export function registerShortcuts() {
  ztoolkit.Keyboard.register((ev: KeyboardEvent) => {
    // Ctrl+Shift+S — Read Aloud
    if (ev.ctrlKey && ev.shiftKey && ev.key === "S") {
      ev.preventDefault();
      ev.stopPropagation();
      handleReadAloud();
    }
    // Ctrl+Shift+X — Stop
    if (ev.ctrlKey && ev.shiftKey && ev.key === "X") {
      ev.preventDefault();
      ev.stopPropagation();
      stop();
    }
  });
}

/**
 * Handle the "Read Aloud" action.
 * Gets selected text and speaks it.
 */
async function handleReadAloud(): Promise<void> {
  const state = getState();

  // If already playing, stop first
  if (state !== "idle") {
    await stop();
    return;
  }

  const text = await getSelectedText();
  if (!text) {
    new ztoolkit.ProgressWindow(
      addon.data.config.addonName,
      {
        closeOnClick: true,
        closeTime: 3000,
      },
    )
      .createLine({
        text: getString("tts-no-text"),
        type: "default",
      })
      .show();
    return;
  }

  try {
    await speak(text);
  } catch (e: any) {
    ztoolkit.log("Read aloud error: " + (e?.stack || e?.message || e));
  }
}

/**
 * Register a listener to Zotero's text selection event to dynamically
 * append the premium play, pause, language/voice selector, and speed selector
 * to the PDF reader's popup tooltip.
 */
export function registerReaderSelectionPopup() {
  if (typeof Zotero === "undefined" || !Zotero.Reader) {
    return;
  }

  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    (event: any) => {
      const { doc, params, append } = event;
      const text = params.text || (params.annotation && params.annotation.text);
      if (!text || text.trim() === "") {
        return;
      }

      try {
        // Create container div
        const container = doc.createElement("div");
        container.id = "edge-tts-selection-popup-container";
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.justifyContent = "space-between";
        container.style.gap = "8px";
        container.style.padding = "5px 10px";
        container.style.borderTop = "1px solid var(--z-theme-border, rgba(128, 128, 128, 0.2))";
        container.style.background = "transparent";
        container.style.color = "inherit";
        container.style.fontSize = "11px";
        container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
        container.style.borderBottomLeftRadius = "6px";
        container.style.borderBottomRightRadius = "6px";
        container.style.width = "370px";
        container.style.boxSizing = "border-box";

        // Left section: Control buttons and status
        const controlSection = doc.createElement("div");
        controlSection.style.display = "flex";
        controlSection.style.alignItems = "center";
        controlSection.style.gap = "6px";

        // Play Button
        const playBtn = doc.createElement("button");
        playBtn.style.background = "#3b82f6";
        playBtn.style.color = "#ffffff";
        playBtn.style.border = "none";
        playBtn.style.borderRadius = "4px";
        playBtn.style.padding = "4px 8px";
        playBtn.style.cursor = "pointer";
        playBtn.style.fontWeight = "600";
        playBtn.style.display = "flex";
        playBtn.style.alignItems = "center";
        playBtn.style.justifyContent = "center";
        playBtn.style.minWidth = "28px";
        playBtn.style.transition = "all 0.2s ease";
        playBtn.textContent = "▶️";

        // Pause Button
        const pauseBtn = doc.createElement("button");
        pauseBtn.style.background = "#eab308";
        pauseBtn.style.color = "#ffffff";
        pauseBtn.style.border = "none";
        pauseBtn.style.borderRadius = "4px";
        pauseBtn.style.padding = "4px 8px";
        pauseBtn.style.cursor = "pointer";
        pauseBtn.style.fontWeight = "600";
        pauseBtn.style.display = "none"; // hidden by default
        pauseBtn.style.alignItems = "center";
        pauseBtn.style.justifyContent = "center";
        pauseBtn.style.minWidth = "28px";
        pauseBtn.style.transition = "all 0.2s ease";
        pauseBtn.textContent = "⏸️";
        
        // Stop Button
        const stopBtn = doc.createElement("button");
        stopBtn.style.background = "#ef4444";
        stopBtn.style.color = "#ffffff";
        stopBtn.style.border = "none";
        stopBtn.style.borderRadius = "4px";
        stopBtn.style.padding = "4px 8px";
        stopBtn.style.cursor = "pointer";
        stopBtn.style.fontWeight = "600";
        stopBtn.style.display = "none"; // hidden by default
        stopBtn.style.alignItems = "center";
        stopBtn.style.justifyContent = "center";
        stopBtn.style.minWidth = "28px";
        stopBtn.textContent = "⏹";

        // Progress/Status indicator (ampulheta/hourglass or speaker icon)
        const progressLabel = doc.createElement("span");
        progressLabel.style.fontWeight = "600";
        progressLabel.style.color = "inherit";
        progressLabel.style.fontSize = "10px";
        progressLabel.style.display = "none";

        // Updates UI elements based on state
        const updateUI = () => {
          const state = getState();
          if (state === "idle") {
            playBtn.textContent = "▶️";
            playBtn.disabled = false;
            playBtn.style.display = "inline-flex";
            playBtn.style.background = "#3b82f6";
            pauseBtn.style.display = "none";
            stopBtn.style.display = "none";
            progressLabel.style.display = "none";
            progressLabel.textContent = "";
          } else if (state === "generating") {
            playBtn.textContent = "⏳";
            playBtn.disabled = true;
            playBtn.style.display = "inline-flex";
            playBtn.style.background = "#9ca3af";
            pauseBtn.style.display = "none";
            stopBtn.style.display = "inline-flex";
            progressLabel.style.display = "inline";
            progressLabel.textContent = "⏳";
          } else if (state === "playing") {
            playBtn.style.display = "none";
            pauseBtn.style.display = "inline-flex";
            stopBtn.style.display = "inline-flex";
            progressLabel.style.display = "none";
          } else if (state === "paused") {
            playBtn.textContent = "▶️";
            playBtn.disabled = false;
            playBtn.style.display = "inline-flex";
            playBtn.style.background = "#10b981"; // green for resume
            pauseBtn.style.display = "none";
            stopBtn.style.display = "inline-flex";
            progressLabel.style.display = "none";
          }
        };

        // Initialize UI state
        updateUI();

        // Click handler for Play/Pause/Resume
        playBtn.addEventListener("click", async (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();

          const state = getState();
          if (state === "idle") {
            updateUI(); // Set to generating state immediately
            try {
              await speak(text, (percent, status) => {
                if (status === "generating") {
                  progressLabel.textContent = `⏳ ${percent}%`;
                  playBtn.textContent = "⏳";
                  playBtn.disabled = true;
                  stopBtn.style.display = "inline-flex";
                  progressLabel.style.display = "inline";
                } else if (status === "playing") {
                  updateUI();
                } else if (status === "finished") {
                  updateUI();
                } else if (status === "error") {
                  updateUI();
                  progressLabel.textContent = "❌";
                  progressLabel.style.display = "inline";
                }
              });
            } catch (err) {
              ztoolkit.log("Popup speak error: " + err);
              updateUI();
            }
          } else if (state === "paused") {
            resume();
            updateUI();
          }
        });

        // Click handler for Pause
        pauseBtn.addEventListener("click", (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          pause();
          updateUI();
        });

        // Click handler for Stop
        stopBtn.addEventListener("click", async (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          await stop();
          updateUI();
        });

        controlSection.appendChild(playBtn);
        controlSection.appendChild(pauseBtn);
        controlSection.appendChild(stopBtn);
        controlSection.appendChild(progressLabel);

        // Right section: Voice selector and speed slider
        const settingsSection = doc.createElement("div");
        settingsSection.style.display = "flex";
        settingsSection.style.alignItems = "center";
        settingsSection.style.gap = "8px";

        // Locale Select (Language Filter)
        const localeSelect = doc.createElement("select");
        localeSelect.style.padding = "2px 4px";
        localeSelect.style.borderRadius = "4px";
        localeSelect.style.border = "1px solid var(--z-theme-border, rgba(128, 128, 128, 0.3))";
        localeSelect.style.maxWidth = "60px";
        localeSelect.style.background = "var(--z-theme-combobox-background, #ffffff)";
        localeSelect.style.color = "var(--z-theme-combobox-color, #333333)";
        localeSelect.style.outline = "none";
        localeSelect.style.cursor = "pointer";
        localeSelect.style.fontSize = "11px";

        const loadingLocaleOpt = doc.createElement("option");
        loadingLocaleOpt.textContent = "...";
        localeSelect.appendChild(loadingLocaleOpt);

        // Voice Select
        const voiceSelect = doc.createElement("select");
        voiceSelect.style.padding = "2px 4px";
        voiceSelect.style.borderRadius = "4px";
        voiceSelect.style.border = "1px solid var(--z-theme-border, rgba(128, 128, 128, 0.3))";
        voiceSelect.style.maxWidth = "100px";
        voiceSelect.style.background = "var(--z-theme-combobox-background, #ffffff)";
        voiceSelect.style.color = "var(--z-theme-combobox-color, #333333)";
        voiceSelect.style.outline = "none";
        voiceSelect.style.cursor = "pointer";
        voiceSelect.style.fontSize = "11px";

        const loadingOpt = doc.createElement("option");
        loadingOpt.textContent = "Loading...";
        voiceSelect.appendChild(loadingOpt);

        // Fetch voices and populate asynchronously
        getVoices().then((voices) => {
          localeSelect.textContent = "";
          voiceSelect.textContent = "";

          // Allowed locales whitelist
          const ALLOWED_LOCALES = [
            "pt-BR",
            "en-US",
            "en-GB",
            "it-IT",
            "fr-FR",
            "es-ES",
            "es-AR",
            "es-MX",
            "de-DE"
          ];

          // Read saved locale filter preference, or default to current voice's locale
          let currentVoice = getPref("voice") || "pt-BR-FranciscaNeural";
          const currentVoiceObj = voices.find(v => v.shortName === currentVoice);
          let activeLocale = getPref("selectedLocaleFilter") || (currentVoiceObj ? currentVoiceObj.locale : "pt-BR");

          // All unique locales from voices list
          const allLocales = Array.from(new Set(voices.map(v => v.locale)));

          // Get unique locales filtered by whitelist and sorted (pt-BR first)
          const locales = allLocales
            .filter(locale => ALLOWED_LOCALES.includes(locale))
            .sort((a, b) => {
              if (a === "pt-BR") return -1;
              if (b === "pt-BR") return 1;
              return a.localeCompare(b);
            });

          // If activeLocale is not in the whitelist but is a valid locale, dynamically add it
          if (activeLocale && allLocales.includes(activeLocale) && !locales.includes(activeLocale)) {
            locales.push(activeLocale);
            locales.sort((a, b) => {
              if (a === "pt-BR") return -1;
              if (b === "pt-BR") return 1;
              return a.localeCompare(b);
            });
          }

          // Function to render locale options
          const renderLocaleOptions = () => {
            localeSelect.textContent = "";
            for (const locale of locales) {
              const opt = doc.createElement("option");
              opt.value = locale;
              opt.textContent = locale;
              if (locale === activeLocale) {
                opt.selected = true;
              }
              localeSelect.appendChild(opt);
            }
            const otherOpt = doc.createElement("option");
            otherOpt.value = "_other";
            otherOpt.textContent = "+ Outro...";
            localeSelect.appendChild(otherOpt);
          };

          renderLocaleOptions();

          // Helper to get clean name
          const cleanVoiceName = (name: string) => {
            const parts = name.split("-");
            if (parts.length >= 3) {
              return parts[2].replace("Neural", "").replace("Multilingual", "");
            }
            return name;
          };

          // Populate voiceSelect function
          const populateVoicesForLocale = (localeStr: string) => {
            voiceSelect.textContent = "";
            const filteredVoices = voices.filter(v => v.locale === localeStr);
            for (const v of filteredVoices) {
              const opt = doc.createElement("option");
              opt.value = v.shortName;
              opt.textContent = cleanVoiceName(v.shortName);
              voiceSelect.appendChild(opt);
            }

            // Set voice value
            let voiceToSelect = getPref("voice") || "";
            const matchesLocale = filteredVoices.some(v => v.shortName === voiceToSelect);
            if (!matchesLocale && filteredVoices.length > 0) {
              voiceToSelect = filteredVoices[0].shortName;
              setPref("voice", voiceToSelect);
            }
            voiceSelect.value = voiceToSelect;
          };

          // Initialize voice list
          populateVoicesForLocale(activeLocale);

          let lastValue = activeLocale;

          // Add listener to localeSelect
          localeSelect.addEventListener("change", (e: any) => {
            const val = e.target.value;
            if (val === "_other") {
              const otherLocales = allLocales.filter(loc => !ALLOWED_LOCALES.includes(loc)).sort();
              
              let chosenLocale: string | null = null;
              let promptService: any = null;
              try {
                const g = globalThis as any;
                const win = Zotero.getMainWindow() as any;
                if (g.Services && g.Services.prompt) {
                  promptService = g.Services.prompt;
                } else if (win && win.Services && win.Services.prompt) {
                  promptService = win.Services.prompt;
                } else if (g.ChromeUtils && typeof g.ChromeUtils.importESModule === "function") {
                  const { Services: importedServices } = g.ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
                  if (importedServices && importedServices.prompt) {
                    promptService = importedServices.prompt;
                  }
                }
              } catch (err) {
                ztoolkit.log("Error getting prompt service: " + err);
              }

              if (promptService) {
                try {
                  const selection = { value: 0 };
                  let ok = false;
                  try {
                    // Try modern Gecko signature (without length parameter)
                    ok = promptService.select(
                      Zotero.getMainWindow(),
                      "Outro Idioma",
                      "Selecione um idioma da lista:",
                      otherLocales,
                      selection
                    );
                  } catch (e) {
                    // Fallback to legacy Gecko signature (with length parameter)
                    ok = promptService.select(
                      Zotero.getMainWindow(),
                      "Outro Idioma",
                      "Selecione um idioma da lista:",
                      otherLocales.length,
                      otherLocales,
                      selection
                    );
                  }

                  if (ok) {
                    chosenLocale = otherLocales[selection.value];
                  }
                } catch (err) {
                  ztoolkit.log("Error showing select prompt: " + err);
                }
              }

              // Fallback to text input if select prompt failed or wasn't available
              if (!promptService && !chosenLocale) {
                try {
                  const promptWin = (doc.defaultView || Zotero.getMainWindow()) as any;
                  const input = promptWin.prompt("Digite o código do idioma (ex: ja-JP, zh-CN, ru-RU):", "");
                  if (input && input.trim()) {
                    const cleanInput = input.trim().toLowerCase();
                    chosenLocale = allLocales.find(loc => loc.toLowerCase() === cleanInput) || null;
                    if (!chosenLocale) {
                      promptWin.alert("Idioma '" + input + "' não encontrado!");
                    }
                  }
                } catch (err) {
                  ztoolkit.log("Error in fallback prompt: " + err);
                }
              }

              if (chosenLocale) {
                activeLocale = chosenLocale;
                lastValue = chosenLocale;
                if (!locales.includes(chosenLocale)) {
                  locales.push(chosenLocale);
                  locales.sort((a, b) => {
                    if (a === "pt-BR") return -1;
                    if (b === "pt-BR") return 1;
                    return a.localeCompare(b);
                  });
                }
                renderLocaleOptions();
                localeSelect.value = chosenLocale;
                setPref("selectedLocaleFilter", chosenLocale);
                populateVoicesForLocale(chosenLocale);
              } else {
                localeSelect.value = lastValue;
              }
            } else {
              activeLocale = val;
              lastValue = val;
              setPref("selectedLocaleFilter", val);
              populateVoicesForLocale(val);
            }
          });

        }).catch((err) => {
          ztoolkit.log("Error loading voices in popup: " + err);
        });

        voiceSelect.addEventListener("change", (e: any) => {
          setPref("voice", e.target.value);
        });

        // Speed/Rate Slider
        const speedContainer = doc.createElement("div");
        speedContainer.style.display = "flex";
        speedContainer.style.alignItems = "center";
        speedContainer.style.gap = "4px";

        const currentRate = getPref("rate") || "1.0";

        const speedLabel = doc.createElement("span");
        speedLabel.style.minWidth = "28px";
        speedLabel.style.fontWeight = "600";
        speedLabel.style.color = "inherit";
        speedLabel.style.textAlign = "right";
        speedLabel.style.fontSize = "10px";
        speedLabel.textContent = parseFloat(currentRate).toFixed(1) + "x";

        const speedSlider = doc.createElement("input");
        speedSlider.type = "range";
        speedSlider.min = "0.5";
        speedSlider.max = "4.0";
        speedSlider.step = "0.1";
        speedSlider.value = currentRate;
        speedSlider.style.width = "65px";
        speedSlider.style.cursor = "pointer";
        speedSlider.style.accentColor = "#3b82f6";
        speedSlider.style.margin = "0";

        speedSlider.addEventListener("input", (e: any) => {
          const val = parseFloat(e.target.value) || 1.0;
          speedLabel.textContent = val.toFixed(1) + "x";
          setPref("rate", val.toString());
          setPlaybackRate(val);
        });

        speedContainer.appendChild(speedSlider);
        speedContainer.appendChild(speedLabel);

        settingsSection.appendChild(localeSelect);
        settingsSection.appendChild(voiceSelect);
        settingsSection.appendChild(speedContainer);

        // Append sub-sections to main container
        container.appendChild(controlSection);
        container.appendChild(settingsSection);

        // Append container to selection popup synchronously
        append(container);

        // Adjust parent popup width recursively to prevent clipping or wrapping
        setTimeout(() => {
          try {
            let el: HTMLElement | null = container;
            while (el) {
              if (el.tagName === "DIV") {
                el.style.width = "auto";
                el.style.maxWidth = "none";
                if (el !== container) {
                  el.style.minWidth = "370px";
                }
              }
              if (el.classList && (
                el.classList.contains("reader-selection-popup") || 
                el.classList.contains("xp-popup") ||
                (el.id && el.id.includes("popup"))
              )) {
                el.style.width = "auto";
                el.style.maxWidth = "none";
                el.style.minWidth = "370px";
              }
              el = el.parentElement as HTMLElement | null;
            }
          } catch (e) {
            ztoolkit.log("Error expanding selection popup width: " + e);
          }
        }, 50);
      } catch (err) {
        ztoolkit.log("Error rendering selection popup: " + err);
      }
    },
    addon.data.config.addonID
  );
}
