import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, type ReactNode } from 'react';
import { fromDoc, toHtml } from '../lib/richtext';

/**
 * WYSIWYG-Editor für Texte. Gespeichert wird weiterhin das schlanke Lapis-Format
 * (Absätze, Zeilenumbrüche, **fett**, *kursiv*, > Zitat, *** Szenenwechsel),
 * damit Leseansicht, API und spätere native Apps unverändert bleiben.
 */
export function RichEditor({ value, onChange, placeholder, autoFocus, onReady }: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onReady?: (editor: Editor) => void;
}) {
  const placeholderRef = useRef(placeholder);
  placeholderRef.current = placeholder;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false,
        code: false, codeBlock: false, strike: false, underline: false, link: false,
      }),
      Placeholder.configure({ placeholder: () => placeholderRef.current }),
    ],
    content: toHtml(value),
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: { class: 'prose paper-editor', 'aria-label': 'Text', 'aria-multiline': 'true', role: 'textbox', spellcheck: 'true' },
    },
    onUpdate: ({ editor }) => onChangeRef.current(fromDoc(editor.getJSON())),
  });

  useEffect(() => { if (editor) onReady?.(editor); }, [editor]);

  // Platzhalter neu zeichnen, wenn die Form wechselt.
  useEffect(() => { editor?.view.dispatch(editor.state.tr); }, [placeholder, editor]);

  return <EditorContent editor={editor} className="paper-editor-wrap" />;
}

type Tool = { key: string; label: string; icon: ReactNode; run: (e: Editor) => void; active?: (e: Editor) => boolean; disabled?: (e: Editor) => boolean };

const TOOLS: (Tool | 'sep')[] = [
  { key: 'bold', label: 'Fett (Strg+B)', icon: <b style={{ fontWeight: 750 }}>B</b>, run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
  { key: 'italic', label: 'Kursiv (Strg+I)', icon: <i style={{ fontFamily: 'var(--serif)', fontWeight: 500 }}>I</i>, run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
  'sep',
  {
    key: 'quote', label: 'Zitat', run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote'),
    icon: <svg width="17" height="17" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><path d="M3 10.5C3 7.4 4.6 5.2 7.4 4.3l.6 1.2C6.3 6.3 5.6 7.4 5.5 8.6h2v5H3Zm7 0c0-3.1 1.6-5.3 4.4-6.2l.6 1.2c-1.7.8-2.4 1.9-2.5 3.1h2v5H10Z" /></svg>,
  },
  {
    key: 'scene', label: 'Szenenwechsel', run: (e) => e.chain().focus().setHorizontalRule().run(),
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><circle cx="4" cy="9" r="1.3" /><circle cx="9" cy="9" r="1.3" /><circle cx="14" cy="9" r="1.3" /></svg>,
  },
  {
    key: 'break', label: 'Zeilenumbruch ohne neuen Absatz (Umschalt+Enter)', run: (e) => e.chain().focus().setHardBreak().run(),
    icon: <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 3.5v5a2.5 2.5 0 0 1-2.5 2.5H4M7 8l-3 3 3 3" /></svg>,
  },
  'sep',
  {
    key: 'undo', label: 'Rückgängig (Strg+Z)', run: (e) => e.chain().focus().undo().run(), disabled: (e) => !e.can().undo(),
    icon: <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6.5 4 3 7.5 6.5 11M3 7.5h7.5a4 4 0 0 1 0 8H8" /></svg>,
  },
  {
    key: 'redo', label: 'Wiederholen (Strg+Umschalt+Z)', run: (e) => e.chain().focus().redo().run(), disabled: (e) => !e.can().redo(),
    icon: <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11.5 4 15 7.5 11.5 11M15 7.5H7.5a4 4 0 0 0 0 8H10" /></svg>,
  },
];

/** Feste Formatierungsleiste am unteren Rand – auf dem Handy direkt über der Tastatur. */
export function FormatBar({ editor, info }: { editor: Editor | null; info: ReactNode }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const out: Record<string, { active: boolean; disabled: boolean }> = {};
      for (const t of TOOLS) if (t !== 'sep') out[t.key] = { active: t.active?.(e) ?? false, disabled: t.disabled?.(e) ?? false };
      return out;
    },
  });
  const ref = useKeyboardOffset();
  return (
    <div className="format-bar" ref={ref} role="toolbar" aria-label="Formatierung">
      <div className="format-bar-in">
        <div className="format-tools">
          {TOOLS.map((t, i) => t === 'sep'
            ? <span key={`s${i}`} className="format-sep" aria-hidden="true" />
            : (
              <button
                key={t.key}
                type="button"
                className="format-btn"
                title={t.label}
                aria-label={t.label}
                aria-pressed={t.active ? Boolean(state?.[t.key]?.active) : undefined}
                disabled={!editor || state?.[t.key]?.disabled}
                // Fokus im Text behalten, sonst springt auf dem Handy die Tastatur weg.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor && t.run(editor)}
              >
                {t.icon}
              </button>
            ))}
          <span className="format-info">{info}</span>
        </div>
      </div>
    </div>
  );
}

/** Hebt die Leiste über die Bildschirmtastatur (iOS/Android), über visualViewport. */
function useKeyboardOffset() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      ref.current?.style.setProperty('--kb', `${offset}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);
  return ref;
}
