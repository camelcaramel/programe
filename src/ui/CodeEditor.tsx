import { useEffect, useRef } from 'react';
import { monaco } from './monaco';
import { codeStore, setSlotCode } from '../state/codeStore';
import { uiStore, useStore } from '../state/store';

/** 슬롯마다 모델을 하나씩 두고, 슬롯을 바꾸면 모델만 교체한다 (되돌리기 기록 유지) */
const models: monaco.editor.ITextModel[] = [];
function modelFor(i: number) {
  if (!models[i]) {
    models[i] = monaco.editor.createModel(codeStore.get().slots[i].code, 'python');
    models[i].onDidChangeContent(() => {
      setSlotCode(i, models[i].getValue());
      // 고치기 시작하면 이전 오류 표시를 지운다
      monaco.editor.setModelMarkers(models[i], 'programe', []);
    });
  }
  return models[i];
}

/** '예제로 되돌리기' 처럼 바깥에서 코드가 바뀌었을 때 에디터에 반영 */
codeStore.subscribe(() => {
  codeStore.get().slots.forEach((s, i) => {
    const m = models[i];
    if (m && m.getValue() !== s.code) m.setValue(s.code);
  });
});

export function CodeEditor() {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const slot = useStore(uiStore, (s) => s.activeSlot);
  const error = useStore(uiStore, (s) => s.slotErrors[s.activeSlot]);

  useEffect(() => {
    const ed = monaco.editor.create(host.current!, {
      model: modelFor(uiStore.get().activeSlot),
      theme: 'programe',
      fontSize: 15,
      fontFamily: 'Consolas, "D2Coding", "Cascadia Code", monospace',
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 4,
      insertSpaces: true,
      renderLineHighlight: 'all',
      padding: { top: 10, bottom: 10 },
      lineNumbersMinChars: 3,
      quickSuggestions: { other: true, strings: true, comments: false },
      fixedOverflowWidgets: true,
    });
    editor.current = ed;
    return () => ed.dispose();
  }, []);

  useEffect(() => {
    editor.current?.setModel(modelFor(slot));
  }, [slot]);

  // 파이썬 오류가 난 줄에 빨간 밑줄 표시
  useEffect(() => {
    const m = modelFor(slot);
    if (!error) {
      monaco.editor.setModelMarkers(m, 'programe', []);
      return;
    }
    const line = Math.min(error.line ?? 1, m.getLineCount());
    monaco.editor.setModelMarkers(m, 'programe', [
      {
        startLineNumber: line, endLineNumber: line,
        startColumn: m.getLineFirstNonWhitespaceColumn(line) || 1, endColumn: m.getLineMaxColumn(line),
        message: error.message, severity: monaco.MarkerSeverity.Error,
      },
    ]);
    if (error.line) editor.current?.revealLineInCenterIfOutsideViewport(line);
  }, [error, slot]);

  return <div className="editor" ref={host} />;
}
