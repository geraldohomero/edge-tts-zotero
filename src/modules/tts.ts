import { getPref } from "../utils/prefs";
import { getString } from "../utils/locale";

/**
 * TTS Engine state
 */
type TTSState = "idle" | "generating" | "playing" | "paused";

let currentState: TTSState = "idle";
let currentAudioPath: string | null = null;
let currentAbortController: any = null;

// We use HTMLAudioElement for playback inside Zotero
let audioElement: HTMLAudioElement | null = null;

/**
 * List of all available Edge TTS voices.
 * Loaded once from `edge-tts --list-voices` and cached.
 */
let cachedVoices: VoiceInfo[] | null = null;

export interface VoiceInfo {
  shortName: string;
  locale: string;
  gender: string;
  friendlyName: string;
}

/**
 * Get the current TTS state
 */
export function getState(): TTSState {
  return currentState;
}

/**
 * Pre-process text from PDF for better TTS output.
 * Removes hyphenation, excessive whitespace, and other artifacts.
 */
export function preprocessText(text: string): string {
  let result = text;

  // Remove soft hyphens
  result = result.replace(/\u00AD/g, "");

  // Fix hyphenated words at line breaks (e.g., "impor-\ntante" -> "importante")
  result = result.replace(/(\w)-\s*\n\s*(\w)/g, "$1$2");

  // Replace line breaks with spaces (PDF paragraphs often have hard breaks)
  result = result.replace(/\n+/g, " ");

  // Collapse multiple spaces into one
  result = result.replace(/\s{2,}/g, " ");

  // Remove leading/trailing whitespace
  result = result.trim();

  return result;
}

/**
 * Convert a rate multiplier (0.5 - 4.0) to edge-tts rate string.
 * edge-tts expects format like "+0%", "-50%", "+200%"
 * Rate multiplier: 1.0 = normal, 0.5 = half speed, 2.0 = double speed
 */
function rateToEdgeTTS(rate: number): string {
  const percentage = Math.round((rate - 1) * 100);
  if (percentage >= 0) {
    return `+${percentage}%`;
  }
  return `${percentage}%`;
}

/**
 * Find the Python executable path.
 * Tries user-configured path first, then common locations.
 */
async function findPythonPath(): Promise<string> {
  const configuredPath = getPref("pythonPath");
  if (configuredPath && configuredPath.trim() !== "") {
    return configuredPath.trim();
  }

  if (Zotero.isWin) {
    return "python";
  }

  // Try common python paths on Unix/macOS
  const candidates = [
    "/usr/bin/python3",
    "/usr/local/bin/python3",
    "/usr/bin/python",
  ];

  for (const candidate of candidates) {
    try {
      if (await IOUtils.exists(candidate)) {
        return candidate;
      }
    } catch {
      // Continue to next
    }
  }

  // Fallback for Unix/macOS
  return "python3";
}

/**
 * Get the list of available Edge TTS voices.
 * Caches the result after first call.
 */
export async function getVoices(): Promise<VoiceInfo[]> {
  if (cachedVoices) {
    return cachedVoices;
  }

  try {
    const pythonPath = await findPythonPath();
    const tmpDir = Zotero.getTempDirectory().path;
    const voicesFile = PathUtils.join(tmpDir, "edge-tts-voices.txt");

    // Build a script that lists voices to a file
    const scriptContent = [
      "import subprocess, sys",
      "result = subprocess.run(",
      '    [sys.executable, "-m", "edge_tts", "--list-voices"],',
      "    capture_output=True, text=True",
      ")",
      `with open(r"${voicesFile.replace(/\\/g, "\\\\")}", "w") as f:`,
      "    f.write(result.stdout)",
    ].join("\n");

    const scriptFile = PathUtils.join(tmpDir, "edge-tts-list-voices.py");
    await IOUtils.writeUTF8(scriptFile, scriptContent);

    await Zotero.Utilities.Internal.exec(pythonPath, [scriptFile]);

    const voicesText = await IOUtils.readUTF8(voicesFile);
    cachedVoices = parseVoicesList(voicesText);

    // Cleanup temp files
    await cleanupTempFiles([scriptFile, voicesFile]);

    return cachedVoices;
  } catch (e) {
    ztoolkit.log("Failed to get voices list:", e);
    return getDefaultVoices();
  }
}

/**
 * Parse the output of `edge-tts --list-voices` into VoiceInfo objects.
 */
function parseVoicesList(text: string): VoiceInfo[] {
  const voices: VoiceInfo[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Name") || trimmed.startsWith("---")) {
      continue;
    }

    // Split by multiple spaces (at least 2)
    const parts = trimmed.split(/\s{2,}/);
    if (parts.length >= 2) {
      const name = parts[0];
      const gender = parts[1];

      // Extract locale from name (e.g. "pt-BR-FranciscaNeural" -> "pt-BR")
      const nameParts = name.split("-");
      let locale = "";
      if (nameParts.length >= 2) {
        locale = `${nameParts[0]}-${nameParts[1]}`;
      }

      voices.push({
        shortName: name,
        locale: locale,
        gender: gender,
        friendlyName: `${name} (${gender})`,
      });
    }
  }

  // Sort by locale then by name
  voices.sort((a, b) => {
    if (a.locale !== b.locale) return a.locale.localeCompare(b.locale);
    return a.shortName.localeCompare(b.shortName);
  });

  return voices;
}

/**
 * Fallback list of popular voices if we can't fetch from edge-tts.
 */
function getDefaultVoices(): VoiceInfo[] {
  return [
    {
      shortName: "pt-BR-FranciscaNeural",
      locale: "pt-BR",
      gender: "Female",
      friendlyName: "Francisca - Portuguese (Brazil)",
    },
    {
      shortName: "pt-BR-AntonioNeural",
      locale: "pt-BR",
      gender: "Male",
      friendlyName: "Antonio - Portuguese (Brazil)",
    },
    {
      shortName: "en-US-JennyNeural",
      locale: "en-US",
      gender: "Female",
      friendlyName: "Jenny - English (US)",
    },
    {
      shortName: "en-US-GuyNeural",
      locale: "en-US",
      gender: "Male",
      friendlyName: "Guy - English (US)",
    },
    {
      shortName: "en-GB-SoniaNeural",
      locale: "en-GB",
      gender: "Female",
      friendlyName: "Sonia - English (UK)",
    },
    {
      shortName: "es-ES-ElviraNeural",
      locale: "es-ES",
      gender: "Female",
      friendlyName: "Elvira - Spanish (Spain)",
    },
    {
      shortName: "fr-FR-DeniseNeural",
      locale: "fr-FR",
      gender: "Female",
      friendlyName: "Denise - French (France)",
    },
    {
      shortName: "de-DE-KatjaNeural",
      locale: "de-DE",
      gender: "Female",
      friendlyName: "Katja - German (Germany)",
    },
  ];
}

/**
 * Speak the given text using Edge TTS.
 * Generates an MP3 file and plays it.
 */
export async function speak(
  text: string,
  onProgress?: (
    percent: number,
    status: "generating" | "playing" | "finished" | "error",
  ) => void,
): Promise<void> {
  if (currentState !== "idle") {
    await stop();
  }

  const processedText = preprocessText(text);
  if (!processedText) {
    ztoolkit.log("No text to speak");
    return;
  }

  currentState = "generating";
  const win = Zotero.getMainWindow();
  currentAbortController =
    win && (win as any).AbortController
      ? new (win as any).AbortController()
      : null;

  const voice = getPref("voice") || "pt-BR-FranciscaNeural";
  const rateStr = getPref("rate") || "1.0";
  const rate = parseFloat(rateStr) || 1.0;
  const edgeTTSRate = rateToEdgeTTS(rate);

  let popupWin: any = null;
  const notifyProgress = (
    percent: number,
    status: "generating" | "playing" | "finished" | "error",
    label: string,
  ) => {
    if (onProgress) {
      try {
        onProgress(percent, status);
      } catch (err) {
        ztoolkit.log("Error invoking progress callback: " + err);
      }
    } else {
      if (!popupWin && status !== "error" && status !== "finished") {
        popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
          closeOnClick: true,
          closeTime: -1,
        })
          .createLine({
            text: label,
            type: "default",
            progress: percent,
          })
          .show();
      } else if (popupWin) {
        popupWin.changeLine({
          progress: percent,
          text: `[${percent}%] ${label}`,
        });
        if (status === "finished") {
          popupWin.startCloseTimer(2000);
        } else if (status === "error") {
          popupWin.startCloseTimer(5000);
        }
      }
    }
  };

  // Initial progress
  notifyProgress(0, "generating", getString("tts-generating"));

  try {
    const pythonPath = await findPythonPath();
    const tmpDir = Zotero.getTempDirectory().path;
    const ts = Date.now();
    const outputFile = PathUtils.join(tmpDir, `edge-tts-output-${ts}.mp3`);
    const textFile = PathUtils.join(tmpDir, `edge-tts-text-${ts}.txt`);

    // Write text to a temp file to avoid shell escaping issues
    await IOUtils.writeUTF8(textFile, processedText);

    // Build the Python script that calls edge-tts
    const scriptContent = [
      "import asyncio",
      "import edge_tts",
      "",
      "async def main():",
      `    with open(r"${textFile.replace(/\\/g, "\\\\")}", "r", encoding="utf-8") as f:`,
      "        text = f.read()",
      `    communicate = edge_tts.Communicate(text, "${voice}", rate="${edgeTTSRate}")`,
      `    await communicate.save(r"${outputFile.replace(/\\/g, "\\\\")}")`,
      "",
      "asyncio.run(main())",
    ].join("\n");

    const scriptFile = PathUtils.join(tmpDir, `edge-tts-script-${ts}.py`);
    await IOUtils.writeUTF8(scriptFile, scriptContent);

    notifyProgress(30, "generating", getString("tts-generating"));

    // Execute the Python script
    await Zotero.Utilities.Internal.exec(pythonPath, [scriptFile]);

    // Check if aborted
    if (currentAbortController?.signal.aborted) {
      await cleanupTempFiles([scriptFile, textFile, outputFile]);
      currentState = "idle";
      return;
    }

    // Play the generated audio
    currentAudioPath = outputFile;
    currentState = "playing";

    notifyProgress(70, "playing", getString("tts-playing"));

    // Set callback to notify completion
    const playbackPromise = playAudio(outputFile);
    playbackPromise
      .then(() => {
        notifyProgress(100, "finished", getString("tts-finished"));
      })
      .catch((err) => {
        ztoolkit.log("Playback ended with error: " + err);
        notifyProgress(0, "error", getString("tts-error"));
      });

    await playbackPromise;

    // Cleanup temp files (audio file cleaned after playback)
    await cleanupTempFiles([scriptFile, textFile]);
  } catch (e: any) {
    ztoolkit.log("TTS error: " + (e?.stack || e?.message || e));
    notifyProgress(0, "error", getString("tts-error"));
    currentState = "idle";
  }
}

/**
 * Stop current TTS playback.
 */
export async function stop(): Promise<void> {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  if (audioElement) {
    audioElement.pause();
    audioElement.src = "";
    audioElement = null;
  }

  // Cleanup audio file
  if (currentAudioPath) {
    await cleanupTempFiles([currentAudioPath]);
    currentAudioPath = null;
  }

  currentState = "idle";
}

/**
 * Pause current TTS playback.
 */
export function pause(): void {
  if (currentState === "playing" && audioElement) {
    try {
      audioElement.pause();
      currentState = "paused";
      ztoolkit.log("TTS paused");
    } catch (e) {
      ztoolkit.log("Error pausing audio: " + e);
    }
  }
}

/**
 * Resume current TTS playback.
 */
export function resume(): void {
  if (currentState === "paused" && audioElement) {
    try {
      audioElement.play()?.catch((err) => {
        ztoolkit.log("Failed to resume playback: " + err);
        currentState = "idle";
      });
      currentState = "playing";
      ztoolkit.log("TTS resumed");
    } catch (e) {
      ztoolkit.log("Error resuming audio: " + e);
    }
  }
}

/**
 * Play an MP3 file using HTMLAudioElement.
 */
function playAudio(filePath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const win = Zotero.getMainWindow();
      if (!win) {
        reject(new Error("No main window available"));
        return;
      }

      audioElement = win.document.createElement("audio") as HTMLAudioElement;

      // Convert file path to file:// URL
      const fileURL = PathUtils.toFileURI(filePath);
      audioElement.src = fileURL;

      // Set playback rate from preferences
      const rateStr = getPref("rate") || "1.0";
      const rate = parseFloat(rateStr) || 1.0;
      audioElement.playbackRate = rate;

      audioElement.onended = () => {
        currentState = "idle";
        cleanupTempFiles([filePath]).catch(() => {});
        currentAudioPath = null;
        audioElement = null;
        resolve();
      };

      audioElement.onerror = () => {
        currentState = "idle";
        currentAudioPath = null;
        audioElement = null;
        reject(new Error("Audio playback error"));
      };

      audioElement.play()?.catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Clean up temporary files.
 */
async function cleanupTempFiles(files: string[]): Promise<void> {
  for (const file of files) {
    try {
      if (await IOUtils.exists(file)) {
        await IOUtils.remove(file);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Clear the cached voices list to force a refresh.
 */
export function clearVoicesCache(): void {
  cachedVoices = null;
}

/**
 * Dynamically change the playback rate of the currently playing audio.
 */
export function setPlaybackRate(rate: number): void {
  if (audioElement) {
    try {
      audioElement.playbackRate = rate;
      ztoolkit.log(`Updated active audio playbackRate to: ${rate}`);
    } catch (e) {
      ztoolkit.log("Failed to set playbackRate on audio element: " + e);
    }
  }
}
