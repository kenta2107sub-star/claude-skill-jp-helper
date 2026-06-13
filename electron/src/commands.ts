import * as fs from "fs";
import * as path from "path";

export interface Command {
  command: string;
  category: string;
  description: string;
  detail: string;
}

export interface GroupedCommands {
  grouped: true;
  groups: { category: string; commands: Command[] }[];
}

export interface FlatCommands {
  grouped: false;
  commands: Command[];
}

let commands: Command[] = [];

export function loadCommands(): void {
  const dictPath = path.join(__dirname, "../../data/commands.json");
  try {
    const raw = fs.readFileSync(dictPath, "utf-8");
    commands = JSON.parse(raw);
  } catch (e) {
    console.error("[commands] failed to load commands.json:", e instanceof Error ? e.message : e);
  }
}

export function searchCommands(input: string): GroupedCommands | FlatCommands {
  if (!input.startsWith("/")) return { grouped: false, commands: [] };

  if (input === "/") {
    const map = new Map<string, Command[]>();
    for (const cmd of commands) {
      if (!map.has(cmd.category)) map.set(cmd.category, []);
      map.get(cmd.category)!.push(cmd);
    }
    return {
      grouped: true,
      groups: Array.from(map.entries()).map(([category, cmds]) => ({ category, commands: cmds })),
    };
  }

  const query = input.toLowerCase();
  const matched = commands.filter((c) => c.command.toLowerCase().startsWith(query));
  return { grouped: false, commands: matched };
}
