import { useEffect, useRef } from 'react';
import { monaco, setAllowedApi } from './monaco';
import { codeFor, codeStore, setCode } from '../state/codeStore';
import { currentTrace, gameStore, uiStore, useStore } from '../state/store';
import { backToPlan } from '../game/play';
import { getStage } from '../stages';

/** 스테이지마다 모델을 하나씩 두고, 스테이지를 바꾸면 모델만 교체한다 (되돌리기 기록 유지) */
const models = new Map<string, monaco.editor.ITextModel>();
function modelFor(stageId: string) {
  let m = models.get(stageId);
  if (!m) {
    const model = monaco.editor.createModel(codeFor(stageId), 'python');
    model.onDidChangeContent(() => {
      setCode(stageId, model.getValue());
      monaco.editor.setModelMarkers(model, 'programe', []);
      uiStore.set({ codeError: null });
      // 재생을 보다가 코드를 고치기 시작하면 계획 단계로 돌아간다
      const p = gameStore.get().phase;
      if (p === 'replay' || p === 'done') backToPlan();
    });
    models.set(stageId, model);
    m = model;
  }
  return m;
}

/** '처음 코드로' 처럼 바깥에서 코드가 바뀌었을 때 에디터에 반영 */
codeStore.subscribe(() => {
  for (const [id, m] of models) {
    const code = codeFor(id);
    if (m.getValue() !== code) m.setValue(code);
  }
});

/** 한글까지 같은 폭 규칙(영문 1칸·한글 2칸)으로 그리는 코드 글꼴. style.css 의 --mono 와 같은 순서 */
export const CODE_FONT = '"D2Coding", "Nanum Gothic Coding", Consolas, monospace';

/** 재생 중 지금 실행되는 줄 */
function activeLine(): number | null {
  const s = gameStore.get();
  if ((s.phase !== 'replay' && s.phase !== 'done') || s.step === 0) return null;
  return currentTrace(s)[s.step - 1]?.line ?? null;
}

export function CodeEditor() {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const deco = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const stageId = useStore(gameStore, (s) => s.stageId);
  const running = useStore(gameStore, (s) => s.phase === 'running');
  const line = useStore(gameStore, () => activeLine());
  const error = useStore(uiStore, (s) => s.codeError);
  const fontSize = useStore(uiStore, (s) => s.editorFontSize);

  useEffect(() => {
    const ed = monaco.editor.create(host.current!, {
      model: modelFor(gameStore.get().stageId),
      theme: 'programe',
      fontSize: uiStore.get().editorFontSize,
      fontFamily: CODE_FONT,
      lineHeight: 1.5,
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 4,
      insertSpaces: true,
      renderLineHighlight: 'all',
      padding: { top: 10, bottom: 10 },
      // 줄 번호 영역은 좁게: 코드가 들어갈 폭을 최대한 남긴다
      lineNumbersMinChars: 2,
      lineDecorationsWidth: 12,
      glyphMargin: false,
      folding: false,
      // 긴 주석(설명)이 잘리지 않게 창 폭에 맞춰 줄바꿈
      wordWrap: 'on',
      wrappingIndent: 'same',
      quickSuggestions: { other: true, strings: true, comments: false },
      fixedOverflowWidgets: true,
    });
    // Ctrl+Enter 실행은 App 의 전역 단축키가 처리한다
    editor.current = ed;
    deco.current = ed.createDecorationsCollection();
    // 코드 글꼴(웹폰트)이 늦게 도착하면 글자 폭을 다시 재야 커서 위치가 맞는다
    let alive = true;
    void document.fonts?.ready.then(() => alive && monaco.editor.remeasureFonts());
    return () => {
      alive = false;
      ed.dispose();
    };
  }, []);

  useEffect(() => {
    editor.current?.updateOptions({ fontSize });
  }, [fontSize]);

  useEffect(() => {
    editor.current?.setModel(modelFor(stageId));
    setAllowedApi(getStage(stageId).api);
    deco.current = editor.current?.createDecorationsCollection() ?? null;
  }, [stageId]);

  useEffect(() => {
    editor.current?.updateOptions({ readOnly: running });
  }, [running]);

  // 재생 중인 줄 하이라이트
  useEffect(() => {
    if (!deco.current) return;
    if (!line) {
      deco.current.clear();
      return;
    }
    deco.current.set([
      {
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: 'run-line', linesDecorationsClassName: 'run-glyph' },
      },
    ]);
    editor.current?.revealLineInCenterIfOutsideViewport(line);
  }, [line]);

  // 파이썬 오류가 난 줄에 빨간 밑줄
  useEffect(() => {
    const m = modelFor(stageId);
    if (!error) {
      monaco.editor.setModelMarkers(m, 'programe', []);
      return;
    }
    const ln = Math.min(Math.max(1, error.line ?? 1), m.getLineCount());
    monaco.editor.setModelMarkers(m, 'programe', [
      {
        startLineNumber: ln,
        endLineNumber: ln,
        startColumn: m.getLineFirstNonWhitespaceColumn(ln) || 1,
        endColumn: m.getLineMaxColumn(ln),
        message: error.message,
        severity: monaco.MarkerSeverity.Error,
      },
    ]);
    if (error.line) editor.current?.revealLineInCenterIfOutsideViewport(ln);
  }, [error, stageId]);

  return <div className="editor" ref={host} />;
}
