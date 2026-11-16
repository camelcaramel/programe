// Monaco 를 CDN 없이 로컬 번들로 사용하고, 학생용 자동완성/도움말/테마를 등록한다.
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import { MONSTER_KINDS } from '../sim';
import { API_DOCS } from './apiDocs';

(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

monaco.editor.defineTheme('programe', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8d8aa6', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'ff8fb8' },
    { token: 'string', foreground: '7ee2a0' },
    { token: 'number', foreground: 'ffc533' },
  ],
  colors: {
    'editor.background': '#2e2d3d',
    'editor.foreground': '#ecebf7',
    'editor.lineHighlightBackground': '#38374a',
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': '#6b6884',
    'editorLineNumber.activeForeground': '#ffc533',
    'editorGutter.background': '#2e2d3d',
    'editor.selectionBackground': '#57538a',
    'editorCursor.foreground': '#ffc533',
    'editorIndentGuide.background1': '#3f3e52',
    'editorWidget.background': '#38374a',
    'editorWidget.border': '#1f1e2a',
    'editorSuggestWidget.background': '#38374a',
    'editorSuggestWidget.border': '#1f1e2a',
    'editorSuggestWidget.selectedBackground': '#57538a',
    'editorSuggestWidget.highlightForeground': '#ffc533',
    'editorHoverWidget.background': '#38374a',
    'editorHoverWidget.border': '#1f1e2a',
    'scrollbarSlider.background': '#55546b88',
    'scrollbarSlider.hoverBackground': '#55546bcc',
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
