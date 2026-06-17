/**
 * Reader module — captures selected text from Zotero's PDF reader.
 */

/**
 * Get the selected text from the active PDF reader.
 * Uses zotero-plugin-toolkit's ReaderTool under the hood.
 * @returns The selected text, or empty string if nothing is selected.
 */
export async function getSelectedText(): Promise<string> {
  try {
    const reader = await ztoolkit.Reader.getReader();
    if (!reader) {
      ztoolkit.log("No active reader found");
      return "";
    }

    const text = ztoolkit.Reader.getSelectedText(reader);
    return text || "";
  } catch (e) {
    ztoolkit.log("Error getting selected text:", e);
    return "";
  }
}

/**
 * Check if a reader tab is currently active.
 */
export function isReaderActive(): boolean {
  try {
    const Zotero_Tabs = ztoolkit.getGlobal("Zotero_Tabs");
    return Zotero_Tabs.selectedType === "reader";
  } catch {
    return false;
  }
}
