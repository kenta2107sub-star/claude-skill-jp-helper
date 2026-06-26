import { app, BrowserWindow, screen } from "electron";
import * as path from "path";
import { execFile, execFileSync } from "child_process";
import { loadCommands, searchCommands } from "./commands";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { uIOhook, UiohookKey } = require("uiohook-napi");

const KEYCODE_MAP: Record<number, [string, string]> = {
  [UiohookKey.A]: ["a", "A"], [UiohookKey.B]: ["b", "B"], [UiohookKey.C]: ["c", "C"],
  [UiohookKey.D]: ["d", "D"], [UiohookKey.E]: ["e", "E"], [UiohookKey.F]: ["f", "F"],
  [UiohookKey.G]: ["g", "G"], [UiohookKey.H]: ["h", "H"], [UiohookKey.I]: ["i", "I"],
  [UiohookKey.J]: ["j", "J"], [UiohookKey.K]: ["k", "K"], [UiohookKey.L]: ["l", "L"],
  [UiohookKey.M]: ["m", "M"], [UiohookKey.N]: ["n", "N"], [UiohookKey.O]: ["o", "O"],
  [UiohookKey.P]: ["p", "P"], [UiohookKey.Q]: ["q", "Q"], [UiohookKey.R]: ["r", "R"],
  [UiohookKey.S]: ["s", "S"], [UiohookKey.T]: ["t", "T"], [UiohookKey.U]: ["u", "U"],
  [UiohookKey.V]: ["v", "V"], [UiohookKey.W]: ["w", "W"], [UiohookKey.X]: ["x", "X"],
  [UiohookKey.Y]: ["y", "Y"], [UiohookKey.Z]: ["z", "Z"],
  [UiohookKey[0]]: ["0", ")"], [UiohookKey[1]]: ["1", "!"], [UiohookKey[2]]: ["2", "@"],
  [UiohookKey[3]]: ["3", "#"], [UiohookKey[4]]: ["4", "$"], [UiohookKey[5]]: ["5", "%"],
  [UiohookKey[6]]: ["6", "^"], [UiohookKey[7]]: ["7", "&"], [UiohookKey[8]]: ["8", "*"],
  [UiohookKey[9]]: ["9", "("],
  [UiohookKey.Slash]: ["/", "?"],
  [UiohookKey.Minus]: ["-", "_"], [UiohookKey.Equal]: ["=", "+"],
  [UiohookKey.BracketLeft]: ["[", "{"], [UiohookKey.BracketRight]: ["]", "}"],
  [UiohookKey.Backslash]: ["\\", "|"], [UiohookKey.Semicolon]: [";", ":"],
  [UiohookKey.Quote]: ["'", '"'], [UiohookKey.Comma]: [",", "<"],
  [UiohookKey.Period]: [".", ">"], [UiohookKey.Backquote]: ["`", "~"],
};

const CLAUDE_BUNDLE_ID = "com.anthropic.claudefordesktop";
let claudeIsFrontmost = false;
let ownBundleId = "";

function getFrontmostBundleIdSync(): string {
  try {
    const asn = execFileSync("/usr/bin/lsappinfo", ["front"], { encoding: "utf8", timeout: 500 }).trim();
    if (!asn) return "";
    const out = execFileSync("/usr/bin/lsappinfo", ["info", "-only", "bundleID", asn], { encoding: "utf8", timeout: 500 });
    const match = out.match(/"CFBundleIdentifier"="([^"]+)"/);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

function getFrontmostBundleId(callback: (id: string) => void): void {
  execFile("/usr/bin/lsappinfo", ["front"], { encoding: "utf8", timeout: 500 }, (err, asn) => {
    if (err || !asn.trim()) { callback(""); return; }
    execFile("/usr/bin/lsappinfo", ["info", "-only", "bundleID", asn.trim()], { encoding: "utf8", timeout: 500 }, (_err, out) => {
      const match = out.match(/"CFBundleIdentifier"="([^"]+)"/);
      callback(match ? match[1] : "");
    });
  });
}

function checkFrontmostSync(): boolean {
  return getFrontmostBundleIdSync() === CLAUDE_BUNDLE_ID;
}

function startFrontmostWatcher(): void {
  const schedule = () => {
    const delay = trackedText !== "" ? 100 : 1000;
    setTimeout(() => {
      getFrontmostBundleId((frontmost) => {
          const isClaude = frontmost === CLAUDE_BUNDLE_ID;
          const isOurApp = ownBundleId !== "" && frontmost === ownBundleId;
          if (isOurApp && popupVisible) {
            // Our popup stole focus — give it back to Claude
            activateClaude();
          } else if (!isClaude && !isOurApp && claudeIsFrontmost) {
            trackedText = "";
            hidePopup();
          }
          if (!isOurApp) {
            claudeIsFrontmost = isClaude;
          }
          schedule();
        }
      );
    }, delay);
  };
  schedule();
}

let popupWindow: BrowserWindow | null = null;
let trackedText = "";

const LIST_HEIGHT = 300;
const TOOLTIP_HEIGHT = 150;
const POPUP_WIDTH = 400;
const POPUP_HEIGHT = TOOLTIP_HEIGHT + LIST_HEIGHT;

function getPopupPosition(): { x: number; y: number } {
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;
  const x = Math.max(10, screenWidth - POPUP_WIDTH - 20);
  const listTop = screenHeight - LIST_HEIGHT - 20;
  const y = listTop - TOOLTIP_HEIGHT;
  return { x, y };
}

function createPopupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, "../renderer/popup.html"));
  win.setAlwaysOnTop(true, "pop-up-menu");
  win.setOpacity(0);
  return win;
}

let popupVisible = false;

function activateClaude(): void {
  execFile("osascript", ["-e", `tell application id "${CLAUDE_BUNDLE_ID}" to activate`], () => {});
}

function showPopup(commands: object): void {
  if (!popupWindow) return;
  const { x, y } = getPopupPosition();
  popupWindow.setBounds({ x, y, width: POPUP_WIDTH, height: POPUP_HEIGHT });
  popupWindow.webContents.send("hide-tooltip");
  popupWindow.webContents.send("update-commands", commands);
  if (!popupVisible) {
    popupWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    popupWindow.setOpacity(1);
    popupWindow.showInactive();
    popupWindow.setIgnoreMouseEvents(false);
    popupVisible = true;
  }
}

function hidePopup(): void {
  if (!popupVisible) return;
  popupWindow?.setIgnoreMouseEvents(true);
  popupWindow?.setOpacity(0);
  popupWindow?.setVisibleOnAllWorkspaces(false);
  popupVisible = false;
}

function handleTextChange(text: string): void {
  const result = searchCommands(text);
  const hasResults = result.grouped
    ? result.groups.length > 0
    : result.commands.length > 0;

  if (hasResults) {
    showPopup(result);
  } else {
    hidePopup();
  }
}

function processKey(e: { keycode: number; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }): void {
  if (!claudeIsFrontmost) {
    if (trackedText !== "") { trackedText = ""; hidePopup(); }
    return;
  }

  const key = e.keycode;

  if (key === UiohookKey.Escape || key === 28 /* Return */ || key === 96 /* NumpadEnter */
      || e.metaKey || e.ctrlKey) {
    trackedText = ""; hidePopup(); return;
  }

  if (key === UiohookKey.Backspace) {
    if (trackedText.length > 0) {
      trackedText = trackedText.slice(0, -1);
      if (trackedText.startsWith("/")) { handleTextChange(trackedText); }
      else { trackedText = ""; hidePopup(); }
    }
    return;
  }

  if (key === UiohookKey.Space) { trackedText = ""; hidePopup(); return; }

  const char = keycodeToChar(key, e.shiftKey);
  if (!char) return;

  if (char === "/") {
    if (!checkFrontmostSync()) return;
    trackedText = "/";
  } else if (trackedText.startsWith("/")) { trackedText += char; }
  else { return; }

  handleTextChange(trackedText);
}

let lastKeyEventAt = Date.now();

function startKeyMonitor(): void {
  uIOhook.on("keydown", (e: { keycode: number; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    lastKeyEventAt = Date.now();
    const snapshot = { keycode: e.keycode, shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey };
    setImmediate(() => processKey(snapshot));
  });

  uIOhook.on("mousedown", () => {
    lastKeyEventAt = Date.now();
    setImmediate(() => {
      if (trackedText !== "") { trackedText = ""; hidePopup(); }
    });
  });

  uIOhook.start();
  console.log("[main] uIOhook started");
  startHookWatchdog();
}

function startHookWatchdog(): void {
  // CGEventTap timeout が続くとフックが無効化される。
  // stderr に "CGEventTap timeout" が出始めたら uiohook を再起動する。
  const origStderr = process.stderr.write.bind(process.stderr);
  let timeoutCount = 0;
  let restarting = false;

  (process.stderr as unknown as { write: (chunk: unknown, enc?: unknown, cb?: unknown) => boolean }).write = (chunk: unknown, enc?: unknown, cb?: unknown) => {
    const msg = String(chunk);
    if (msg.includes("CGEventTap timeout")) {
      timeoutCount++;
      if (timeoutCount >= 5 && !restarting) {
        restarting = true;
        console.log("[main] CGEventTap timeout detected, restarting uiohook...");
        try { uIOhook.stop(); } catch { /* ignore */ }
        setTimeout(() => {
          try {
            uIOhook.start();
            console.log("[main] uIOhook restarted");
          } catch (err) {
            console.log("[main] uIOhook restart failed, exiting for LaunchAgent to revive:", err);
            app.quit();
          }
          timeoutCount = 0;
          restarting = false;
        }, 1000);
      }
    } else {
      timeoutCount = 0;
    }
    return origStderr(chunk as string, enc as BufferEncoding, cb as () => void);
  };
}

function keycodeToChar(keycode: number, shift: boolean): string | null {
  const pair = KEYCODE_MAP[keycode];
  if (!pair) return null;
  return shift ? pair[1] : pair[0];
}

app.whenReady().then(() => {
  // Get own bundle ID from Info.plist (process.execPath = .../App.app/Contents/MacOS/binary)
  try {
    const plistPath = path.join(path.dirname(path.dirname(process.execPath)), "Info.plist");
    ownBundleId = execFileSync("/usr/libexec/PlistBuddy",
      ["-c", "Print :CFBundleIdentifier", plistPath],
      { encoding: "utf8", timeout: 500 }
    ).trim();
    console.log(`[main] own bundle ID: ${ownBundleId}`);
  } catch {
    console.log("[main] could not read own bundle ID");
  }

  loadCommands();
  popupWindow = createPopupWindow();
  startFrontmostWatcher();
  startKeyMonitor();

  app.dock?.hide();
});

app.on("will-quit", () => {
  uIOhook.stop();
});
