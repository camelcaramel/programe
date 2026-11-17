// Monaco 를 CDN 없이 로컬 번들로 사용하고, 학생용 자동완성/도움말/테마를 등록한다.
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import { MONSTER_KINDS } from '../sim';
import { API_DOCS } from './apiDocs';
import { COLOR, bare, withAlpha } from './tokens';

(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

monaco.editor.defineTheme('programe', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // 처음 코드의 주석은 학생에게 안내문이므로 기울이지 않고 밝게
    { token: 'comment', foreground: bare(COLOR.synComment) },
    { token: 'keyword', foreground: bare(COLOR.synKeyword) },
    { token: 'string', foreground: bare(COLOR.synString) },
    { token: 'number', foreground: bare(COLOR.gold) },
  ],
  colors: {
    'editor.background': COLOR.slate,
    'editor.foreground': COLOR.slateText,
    'editor.lineHighlightBackground': COLOR.slate2,
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': COLOR.slateLine,
    'editorLineNumber.activeForeground': COLOR.gold,
    'editorGutter.background': COLOR.slate,
    'editor.selectionBackground': COLOR.editorSelection,
    'editorCursor.foreground': COLOR.gold,
    'editorIndentGuide.background1': COLOR.editorIndent,
    'editorWidget.background': COLOR.slate2,
    'editorWidget.border': COLOR.editorBorder,
    'editorSuggestWidget.background': COLOR.slate2,
    'editorSuggestWidget.border': COLOR.editorBorder,
    'editorSuggestWidget.selectedBackground': COLOR.editorSelection,
    'editorSuggestWidget.highlightForeground': COLOR.gold,
    'editorHoverWidget.background': COLOR.slate2,
    'editorHoverWidget.border': COLOR.editorBorder,
    'scrollbarSlider.background': withAlpha(COLOR.slateThumb, 0x88),
    'scrollbarSlider.hoverBackground': withAlpha(COLOR.slateThumb, 0xcc),
  },
});

/** 지금 스테이지에서 쓸 수 있는 명령 (자동완성에 이것만 보여 준다) */
let allowed: string[] = API_DOCS.map((a) => a.name);
export function setAllowedApi(names: string[]) {
  allowed = names;
}

const DIRS = ['up', 'down', 'left', 'right'];
const LOOK_VALUES = ['empty', 'wall', 'exit', 'chest', 'key', 'door', 'sign', 'tablet', 'gate', ...MONSTER_KINDS];

monaco.languages.registerCompletionItemProvider('python', {
  triggerCharacters: ['"', "'"],
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
    const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const K = monaco.languages.CompletionItemKind;
    const words = (list: string[], doc?: string) => ({
      suggestions: list.map((w) => ({ label: w, kind: K.EnumMember, insertText: w, documentation: doc, range })),
    });

    if (/cast\(\s*["']\w*$/.test(before)) return words(['fireball', 'icebolt'], 'fireball = 불(슬라임 약점), icebolt = 얼음(박쥐·외눈 거인 약점)');
    if (/(look\(|read\(|open_gate\(|move\(|cast\(\s*["']\w+["']\s*,)\s*["']\w*$/.test(before)) return words(DIRS, '방향');
    if (/[=!]=\s*["']\w*$/.test(before)) return words(LOOK_VALUES, 'look() 이 돌려주는 값');
    if (/["']\w*$/.test(before)) return { suggestions: [] };

    return {
      suggestions: API_DOCS.filter((a) => allowed.includes(a.name)).map((a) => ({
        label: a.name,
        kind: K.Function,
        insertText: a.snippet,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: a.sig,
        documentation: a.doc,
        range,
      })),
    };
  },
});

monaco.languages.registerHoverProvider('python', {
  provideHover(model, position) {
    const w = model.getWordAtPosition(position);
    if (!w) return null;
    const api = API_DOCS.find((a) => a.name === w.word);
    if (!api) return null;
    const locked = !allowed.includes(api.name) ? '\n\n🔒 이 스테이지에서는 아직 쓸 수 없어요.' : '';
    return { contents: [{ value: `**${api.sig}** — ${api.doc}${locked}` }] };
  },
});

export { monaco };
