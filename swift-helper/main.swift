import ApplicationServices
import AppKit
import Foundation
import Carbon

let claudeBundleID = "com.anthropic.claudefordesktop"
var trackedText = ""

func outputJSON(_ dict: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: dict),
       let str = String(data: data, encoding: .utf8) {
        print(str)
        fflush(stdout)
    }
}

func isClaudeFrontmost() -> Bool {
    return NSWorkspace.shared.frontmostApplication?.bundleIdentifier == claudeBundleID
}

func getClaudeWindowFrame() -> CGRect? {
    guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: claudeBundleID).first else { return nil }
    let axApp = AXUIElementCreateApplication(app.processIdentifier)
    var windowsRef: CFTypeRef?
    guard AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &windowsRef) == .success,
          let windows = windowsRef as? [AXUIElement],
          let window = windows.first else { return nil }
    var posRef: CFTypeRef?
    var sizeRef: CFTypeRef?
    guard AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &posRef) == .success,
          AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &sizeRef) == .success else { return nil }
    var pos = CGPoint.zero
    var size = CGSize.zero
    AXValueGetValue(posRef as! AXValue, .cgPoint, &pos)
    AXValueGetValue(sizeRef as! AXValue, .cgSize, &size)
    return CGRect(origin: pos, size: size)
}

// キーコードから文字へのマッピング（記号類）
func charFromKeyCode(_ keyCode: CGKeyCode, flags: CGEventFlags) -> String? {
    let shift = flags.contains(.maskShift)
    switch keyCode {
    case 0:  return shift ? "A" : "a"
    case 1:  return shift ? "S" : "s"
    case 2:  return shift ? "D" : "d"
    case 3:  return shift ? "F" : "f"
    case 4:  return shift ? "H" : "h"
    case 5:  return shift ? "G" : "g"
    case 6:  return shift ? "Z" : "z"
    case 7:  return shift ? "X" : "x"
    case 8:  return shift ? "C" : "c"
    case 9:  return shift ? "V" : "v"
    case 11: return shift ? "B" : "b"
    case 12: return shift ? "Q" : "q"
    case 13: return shift ? "W" : "w"
    case 14: return shift ? "E" : "e"
    case 15: return shift ? "R" : "r"
    case 16: return shift ? "Y" : "y"
    case 17: return shift ? "T" : "t"
    case 18: return shift ? "!" : "1"
    case 19: return shift ? "@" : "2"
    case 20: return shift ? "#" : "3"
    case 21: return shift ? "$" : "4"
    case 22: return shift ? "^" : "6"
    case 23: return shift ? "%" : "5"
    case 24: return shift ? "+" : "="
    case 25: return shift ? "(" : "9"
    case 26: return shift ? "&" : "7"
    case 27: return shift ? "_" : "-"
    case 28: return shift ? "*" : "8"
    case 29: return shift ? ")" : "0"
    case 30: return shift ? "}" : "]"
    case 31: return shift ? "O" : "o"
    case 32: return shift ? "U" : "u"
    case 33: return shift ? "{" : "["
    case 34: return shift ? "I" : "i"
    case 35: return shift ? "P" : "p"
    case 37: return shift ? "L" : "l"
    case 38: return shift ? "J" : "j"
    case 39: return shift ? "\"" : "'"
    case 40: return shift ? "K" : "k"
    case 41: return shift ? ":" : ";"
    case 42: return shift ? "|" : "\\"
    case 43: return shift ? "<" : ","
    case 44: return shift ? "?" : "/"
    case 45: return shift ? "N" : "n"
    case 46: return shift ? "M" : "m"
    case 47: return shift ? ">" : "."
    case 50: return shift ? "~" : "`"
    case 36: return "\n"  // Return
    case 48: return "\t"  // Tab
    case 49: return " "   // Space
    default: return nil
    }
}

let eventCallback: CGEventTapCallBack = { proxy, type, event, _ in
    // マウスクリックでポップアップを閉じる
    if type == .leftMouseDown || type == .rightMouseDown {
        if !trackedText.isEmpty {
            trackedText = ""
            outputJSON(["type": "app_inactive"])
        }
        return Unmanaged.passRetained(event)
    }
    guard type == .keyDown else { return Unmanaged.passRetained(event) }
    guard isClaudeFrontmost() else {
        // Claudeがフォアグラウンドでなければトラッキングをリセット
        if !trackedText.isEmpty {
            trackedText = ""
            outputJSON(["type": "app_inactive"])
        }
        return Unmanaged.passRetained(event)
    }

    let keyCode = CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode))
    let flags = event.flags

    // Deleteキー
    if keyCode == 51 {
        if !trackedText.isEmpty {
            trackedText = String(trackedText.dropLast())
            if trackedText.hasPrefix("/") {
                outputJSON(["type": "text_change", "text": trackedText, "x": 0, "y": 0])
            } else {
                trackedText = ""
                outputJSON(["type": "app_inactive"])
            }
        }
        return Unmanaged.passRetained(event)
    }

    // Escapeキーやメタキー系はリセット
    if keyCode == 53 || flags.contains(.maskCommand) || flags.contains(.maskControl) {
        if !trackedText.isEmpty {
            trackedText = ""
            outputJSON(["type": "app_inactive"])
        }
        return Unmanaged.passRetained(event)
    }

    // Enter/Returnで送信→リセット
    if keyCode == 36 || keyCode == 76 {
        trackedText = ""
        outputJSON(["type": "app_inactive"])
        return Unmanaged.passRetained(event)
    }

    guard let char = charFromKeyCode(keyCode, flags: flags) else {
        return Unmanaged.passRetained(event)
    }

    // スペースや改行でリセット
    if char == " " || char == "\n" || char == "\t" {
        trackedText = ""
        outputJSON(["type": "app_inactive"])
        return Unmanaged.passRetained(event)
    }

    // / で始まるときだけ追跡
    if char == "/" {
        trackedText = "/"
    } else if trackedText.hasPrefix("/") {
        trackedText += char
    } else {
        return Unmanaged.passRetained(event)
    }

    // Claudeウィンドウ右上付近を基準にポップアップ位置を計算
    var px: CGFloat = 0
    var py: CGFloat = 0
    if let frame = getClaudeWindowFrame() {
        px = frame.maxX  // ウィンドウ右端
        py = frame.maxY  // ウィンドウ下端（入力欄付近）
    } else {
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.main?.frame.height ?? 800
        px = mouse.x
        py = screen - mouse.y
    }
    outputJSON(["type": "text_change", "text": trackedText, "x": px, "y": py])
    return Unmanaged.passRetained(event)
}

// 入力監視権限チェック
let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: false] as CFDictionary
if !AXIsProcessTrustedWithOptions(options) {
    outputJSON(["type": "error", "message": "入力監視権限が必要です。システム設定 > プライバシーとセキュリティ > 入力監視 で許可してください。"])
}

let eventMask = CGEventMask(
    (1 << CGEventType.keyDown.rawValue) |
    (1 << CGEventType.leftMouseDown.rawValue) |
    (1 << CGEventType.rightMouseDown.rawValue)
)
guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .defaultTap,
    eventsOfInterest: eventMask,
    callback: eventCallback,
    userInfo: nil
) else {
    outputJSON(["type": "error", "message": "CGEventTapの作成に失敗しました。入力監視権限を確認してください。"])
    exit(1)
}

let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

outputJSON(["type": "ready", "message": "キー監視を開始しました"])
CFRunLoopRun()
