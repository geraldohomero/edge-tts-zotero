import { getVoices, VoiceInfo } from "./tts";
import { getPref, setPref } from "../utils/prefs";

/**
 * Register preference scripts when the preference pane is loaded.
 */
export async function registerPrefsScripts(win: Window) {
  const doc = win.document;

  // Populate voice selector
  await populateVoiceSelector(doc);

  // Set up speed selector
  setupSpeedSelector(doc);

  // Set up python path field
  setupPythonPath(doc);

  // Set up test button
  setupTestButton(doc);
}

/**
 * Populate the voice dropdown with all available Edge TTS voices.
 */
async function populateVoiceSelector(doc: Document) {
  const voiceSelect = doc.getElementById(
    `zotero-prefpane-${addon.data.config.addonRef}-voice`,
  ) as HTMLSelectElement | null;

  if (!voiceSelect) return;

  // Show loading state
  voiceSelect.innerHTML = "";
  const loadingOption = doc.createElement("option");
  loadingOption.textContent = "Loading voices...";
  loadingOption.value = "";
  voiceSelect.appendChild(loadingOption);

  try {
    const voices = await getVoices();
    voiceSelect.innerHTML = "";

    // Group voices by locale
    const grouped = new Map<string, VoiceInfo[]>();
    for (const voice of voices) {
      const locale = voice.locale || "Other";
      if (!grouped.has(locale)) {
        grouped.set(locale, []);
      }
      grouped.get(locale)!.push(voice);
    }

    // Create optgroups for each locale
    const currentVoice = getPref("voice") as string;

    for (const [locale, localeVoices] of grouped) {
      const optgroup = doc.createElement("optgroup");
      optgroup.label = locale;

      for (const voice of localeVoices) {
        const option = doc.createElement("option");
        option.value = voice.shortName;
        // Show: "Francisca (Female)" instead of the full MS name
        const simpleName = voice.shortName
          .replace(/^[a-z]{2}-[A-Z]{2}-/, "")
          .replace(/Neural$/, "");
        option.textContent = `${simpleName} (${voice.gender})`;
        if (voice.shortName === currentVoice) {
          option.selected = true;
        }
        optgroup.appendChild(option);
      }

      voiceSelect.appendChild(optgroup);
    }

    // Listen for changes
    voiceSelect.addEventListener("change", () => {
      setPref("voice", voiceSelect.value as any);
    });
  } catch (e) {
    voiceSelect.innerHTML = "";
    const errorOption = doc.createElement("option");
    errorOption.textContent = "Error loading voices. Is edge-tts installed?";
    errorOption.value = "";
    voiceSelect.appendChild(errorOption);
  }
}

/**
 * Set up the speed/rate selector (0.5x to 4.0x).
 */
function setupSpeedSelector(doc: Document) {
  const speedRange = doc.getElementById(
    `zotero-prefpane-${addon.data.config.addonRef}-rate-range`,
  ) as HTMLInputElement | null;

  const speedLabel = doc.getElementById(
    `zotero-prefpane-${addon.data.config.addonRef}-rate-value`,
  );

  if (!speedRange) return;

  const currentRate = parseFloat((getPref("rate") as string) || "1.0");
  speedRange.value = String(currentRate);
  if (speedLabel) {
    speedLabel.textContent = `${currentRate.toFixed(1)}x`;
  }

  speedRange.addEventListener("input", () => {
    const val = parseFloat(speedRange.value);
    if (speedLabel) {
      speedLabel.textContent = `${val.toFixed(1)}x`;
    }
    setPref("rate", val.toFixed(1) as any);
  });
}

/**
 * Set up the Python path field.
 */
function setupPythonPath(doc: Document) {
  const pythonInput = doc.getElementById(
    `zotero-prefpane-${addon.data.config.addonRef}-python-path`,
  ) as HTMLInputElement | null;

  if (!pythonInput) return;

  const currentPath = (getPref("pythonPath") as string) || "";
  pythonInput.value = currentPath;
  pythonInput.placeholder = "Auto-detect (leave empty)";

  pythonInput.addEventListener("change", () => {
    setPref("pythonPath", pythonInput.value as any);
  });
}

/**
 * Set up the test voice button.
 */
function setupTestButton(doc: Document) {
  const testBtn = doc.getElementById(
    `zotero-prefpane-${addon.data.config.addonRef}-test-voice`,
  );

  if (!testBtn) return;

  testBtn.addEventListener("click", async () => {
    const { speak, stop } = await import("./tts");
    // Stop any current playback first
    await stop();
    // Speak a test phrase
    await speak("Hello! This is a test of Edge TTS for Zotero.");
  });
}
