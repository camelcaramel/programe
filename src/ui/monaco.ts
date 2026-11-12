// Monaco 를 CDN 없이 로컬 번들로 사용하고, 학생용 자동완성/테마를 등록한다.
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import { MONSTERS, SKILLS, SKILL_NAMES } from '../game/data';

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

const API_DOCS: { label: string; insert: string; doc: string; kind: 'fn' | 'field' }[] = [
  { label: 'cast', insert: 'cast("${1|fireball,icebolt,heal|}")', doc: '스킬을 발동해요. 한 번 실행에 최대 3번.', kind: 'fn' },
  { label: 'get_enemy_hp', insert: 'get_enemy_hp()', doc: '대상 적의 현재 HP (enemy.hp 와 같아요)', kind: 'fn' },
  { label: 'get_player_hp', insert: 'get_player_hp()', doc: '내 현재 HP', kind: 'fn' },
  { label: 'get_player_mp', insert: 'get_player_mp()', doc: '내 현재 MP', kind: 'fn' },
  { label: 'print', insert: 'print(${1})', doc: '아래 콘솔에 값을 출력해요', kind: 'fn' },
];
const ENEMY_FIELDS = [
  { label: 'hp', doc: '적의 현재 HP' },
  { label: 'max_hp', doc: '적의 최대 HP' },
  { label: 'type', doc: `적의 종류: ${Object.keys(MONSTERS).map((k) => `"${k}"`).join(', ')} (적이 없으면 "none")` },
  { label: 'distance', doc: '나와 적 사이의 거리 (칸)' },
  { label: 'exists', doc: '대상 적이 있으면 True' },
];

monaco.languages.registerCompletionItemProvider('python', {
  triggerCharacters: ['.', '"'],
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
    const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const K = monaco.languages.CompletionItemKind;

    if (/enemy\.\w*$/.test(before)) {
      return { suggestions: ENEMY_FIELDS.map((f) => ({ label: f.label, kind: K.Field, insertText: f.label, documentation: f.doc, range })) };
    }
    if (/cast\(["']\w*$/.test(before)) {
      return {
        suggestions: SKILL_NAMES.map((n) => ({ label: n, kind: K.EnumMember, insertText: n, documentation: `${SKILLS[n].label} · MP ${SKILLS[n].mp} · ${SKILLS[n].desc}`, range })),
      };
    }
    if (/==\s*["']\w*$/.test(before)) {
      return { suggestions: Object.keys(MONSTERS).map((k) => ({ label: k, kind: K.EnumMember, insertText: k, range })) };
    }
    return {
      suggestions: [
        ...API_DOCS.map((a) => ({
          label: a.label, kind: K.Function, insertText: a.insert, documentation: a.doc, range,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        })),
        { label: 'enemy', kind: K.Variable, insertText: 'enemy', documentation: '가장 가까운 적', range },
        {
          label: 'if enemy.type ==', kind: K.Snippet, range,
          insertText: 'if enemy.type == "${1|slime,fly,golem|}":\n    cast("${2|fireball,icebolt,heal|}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '적 종류에 따라 스킬 고르기',
        },
      ],
    };
  },
});

monaco.languages.registerHoverProvider('python', {
  provideHover(model, position) {
    const w = model.getWordAtPosition(position);
    if (!w) return null;
    const api = API_DOCS.find((a) => a.label === w.word);
    const skill = SKILLS[w.word as keyof typeof SKILLS];
    const text = api ? `**${api.label}** — ${api.doc}` : skill ? `**${w.word}** (${skill.label}) · MP ${skill.mp} · ${skill.desc}` : null;
    return text ? { contents: [{ value: text }] } : null;
  },
});

export { monaco };
