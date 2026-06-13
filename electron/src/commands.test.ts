/**
 * commands.ts のユニットテスト
 *
 * fs をモックし、jest.resetModules() でモジュール状態をリセットする。
 * resetModules() 後は require('fs') が新しいモックインスタンスを返すため、
 * freshModule() 内でそのインスタンスに mock を設定してから commands を require する。
 */

jest.mock("fs");

const mockCommands = [
  { command: "/btw", category: "会話管理", description: "履歴を汚さず質問する", detail: "詳細" },
  { command: "/clear", category: "基本操作", description: "画面をクリアする", detail: "詳細" },
  { command: "/checkpoint", category: "会話管理", description: "チェックポイントを作成する", detail: "詳細" },
  { command: "/help", category: "基本操作", description: "ヘルプを表示する", detail: "詳細" },
];

/** モジュールをリセットして fresh な状態で読み込む。fs mock も再設定する。 */
function freshModule(mockImpl?: () => unknown) {
  jest.resetModules();
  // resetModules() 後は require('fs') が新しいインスタンスを返すのでここで取得
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
  const freshFs = require("fs") as any;
  if (mockImpl) {
    freshFs.readFileSync.mockImplementation(mockImpl);
  } else {
    freshFs.readFileSync.mockReturnValue(JSON.stringify(mockCommands));
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("./commands");
}

// ----------------------------------------------------------------
// searchCommands のテスト
// ----------------------------------------------------------------
describe("searchCommands", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let searchCommands: (input: string) => any;

  beforeEach(() => {
    const mod = freshModule();
    mod.loadCommands();
    searchCommands = mod.searchCommands;
  });

  test('空文字列 → { grouped: false, commands: [] }', () => {
    expect(searchCommands("")).toEqual({ grouped: false, commands: [] });
  });

  test('"hello"（スラッシュなし） → { grouped: false, commands: [] }', () => {
    expect(searchCommands("hello")).toEqual({ grouped: false, commands: [] });
  });

  test('"/" → grouped: true でカテゴリ別グループが返る', () => {
    const result = searchCommands("/");
    expect(result.grouped).toBe(true);
    expect(result.groups.length).toBeGreaterThan(0);

    const kanwaGroup = result.groups.find(
      (g: { category: string }) => g.category === "会話管理"
    );
    expect(kanwaGroup).toBeDefined();
    const cmds = kanwaGroup.commands.map((c: { command: string }) => c.command);
    expect(cmds).toContain("/btw");
    expect(cmds).toContain("/checkpoint");
  });

  test('"/cl" → /clear にマッチ（前方一致）', () => {
    const result = searchCommands("/cl");
    expect(result.grouped).toBe(false);
    const cmds = result.commands.map((c: { command: string }) => c.command);
    expect(cmds).toContain("/clear");
    expect(cmds).not.toContain("/btw");
  });

  test('"/CL" → 大文字小文字を無視して /clear にマッチ', () => {
    const result = searchCommands("/CL");
    expect(result.grouped).toBe(false);
    expect(
      result.commands.map((c: { command: string }) => c.command)
    ).toContain("/clear");
  });

  test('"/zzz" → マッチなし → { grouped: false, commands: [] }', () => {
    expect(searchCommands("/zzz")).toEqual({ grouped: false, commands: [] });
  });
});

// ----------------------------------------------------------------
// loadCommands のテスト
// ----------------------------------------------------------------
describe("loadCommands", () => {
  test("loadCommands() 後に searchCommands('/') が全コマンドを返す", () => {
    const mod = freshModule();
    mod.loadCommands();
    const result = mod.searchCommands("/");
    expect(result.grouped).toBe(true);
    const allCommands = result.groups.flatMap(
      (g: { commands: unknown[] }) => g.commands
    );
    expect(allCommands.length).toBe(mockCommands.length);
  });

  test("存在しないJSONパスでも loadCommands() がエラーを投げず空のまま維持する", () => {
    const mod = freshModule(() => {
      throw new Error("ENOENT: no such file or directory");
    });
    expect(() => mod.loadCommands()).not.toThrow();

    const result = mod.searchCommands("/");
    expect(result.grouped).toBe(true);
    expect(result.groups.length).toBe(0);
  });
});
