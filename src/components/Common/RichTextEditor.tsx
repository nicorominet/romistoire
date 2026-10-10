import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Bold, Heading2, Heading3, Image as ImageIcon, Italic, List, ListOrdered, Quote, Redo2, Undo2, type LucideIcon } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { i18n } from '@/lib/i18n';

/** Picture offered for insertion in the text (the story's illustrations). */
export interface EditorImage {
  src: string;
  alt?: string;
}

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Illustrations of the story: one click places them in the text */
  images?: EditorImage[];
}

// The macOS shortcuts show the Cmd key
const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

/** Legacy plain-text stories: one paragraph per line, at most one empty line in a row. */
const legacyToHtml = (content: string) =>
  content
    .split(/\r?\n/)
    .reduce((acc: string[], line) => {
      const trimmed = line.trim();
      if (trimmed === '' && acc.length > 0 && acc[acc.length - 1] === '<p><br></p>') return acc;
      acc.push(trimmed === '' ? '<p><br></p>' : `<p>${line}</p>`);
      return acc;
    }, [])
    .join('');

/** What the toolbar shows: read on every change of the editor (TipTap 3 no longer re-renders by itself). */
const toolbarState = ({ editor: current }: { editor: Editor | null }) => {
  const editor = current?.isDestroyed ? null : current;
  return {
  bold: editor?.isActive('bold') ?? false,
  italic: editor?.isActive('italic') ?? false,
  h2: editor?.isActive('heading', { level: 2 }) ?? false,
  h3: editor?.isActive('heading', { level: 3 }) ?? false,
  bulletList: editor?.isActive('bulletList') ?? false,
  orderedList: editor?.isActive('orderedList') ?? false,
  blockquote: editor?.isActive('blockquote') ?? false,
  canUndo: editor?.can().undo() ?? false,
  canRedo: editor?.can().redo() ?? false,
  };
};

/**
 * RichTextEditor Component
 *
 * Story text editor. Only the formats every reader of a story understands (story page, preview, PDF,
 * audio): paragraphs, bold, italic, section titles, lists and quotes, plus pictures placed in the text.
 * Content set from outside (loaded story, discarded changes, restored version) replaces what is shown.
 */
const RichTextEditor = ({ content, onChange, placeholder, className, disabled = false, images = [] }: RichTextEditorProps) => {
  const { t } = i18n;
  // Last HTML the editor sent: a `content` that differs comes from outside (discard, reset) and is shown
  const lastEmitted = useRef<string | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // The story title is the page's main title: sections start at level 2 (level 1 kept to read older texts)
        heading: { levels: [1, 2, 3] },
        // Not shown by the story page, the PDF or the audio, and without button: off
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
        strike: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder: placeholder || t('story.contentPlaceholder') }),
      // No base64 pictures pasted into the text (they would weigh megabytes in every version)
      Image.configure({ allowBase64: false }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg dark:prose-invert my-2 focus:outline-none min-h-[300px] max-w-none',
        'aria-label': t('editor.toolbar.text'),
      },
    },
  });

  const state = useEditorState({ editor, selector: toolbarState });

  useEffect(() => {
    // false: no update event (it would send the content back and mark an untouched form as changed)
    editor?.setEditable(!disabled, false);
  }, [disabled, editor]);

  useEffect(() => {
    // Typed in the editor itself: already shown (setting it again would move the cursor)
    // A destroyed editor (React remounts it in development) has no schema to serialize anymore
    if (!editor || editor.isDestroyed || content === lastEmitted.current) return;
    const html = !content ? '' : content.trim().startsWith('<') ? content : legacyToHtml(content);
    // Content from outside (first load, discarded changes, restored version): replaces what is shown,
    // without an update event (the form already has this value)
    const differs = html === '' ? !editor.isEmpty : html !== editor.getHTML();
    if (differs) {
      editor.commands.setContent(html, { emitUpdate: false });
    }
    lastEmitted.current = content;
  }, [content, editor]);

  if (!editor || !state) {
    return null;
  }

  const insertImage = (src: string, alt = '') => {
    if (!src.trim()) return;
    editor.chain().focus().setImage({ src: src.trim(), alt }).run();
    setImageOpen(false);
    setImageUrl('');
  };

  const tools: { key: string; icon: LucideIcon; label: string; shortcut?: string; active: boolean; run: () => void }[] = [
    { key: 'bold', icon: Bold, label: t('editor.toolbar.bold'), shortcut: `${MOD}B`, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: 'italic', icon: Italic, label: t('editor.toolbar.italic'), shortcut: `${MOD}I`, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: 'h2', icon: Heading2, label: t('editor.toolbar.section'), active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'h3', icon: Heading3, label: t('editor.toolbar.subsection'), active: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: 'bullet', icon: List, label: t('editor.toolbar.bulletList'), active: state.bulletList, run: () => editor.chain().focus().toggleBulletList().run() },
    { key: 'ordered', icon: ListOrdered, label: t('editor.toolbar.orderedList'), active: state.orderedList, run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: 'quote', icon: Quote, label: t('editor.toolbar.quote'), active: state.blockquote, run: () => editor.chain().focus().toggleBlockquote().run() },
  ];
  const withShortcut = (label: string, shortcut?: string) => (shortcut ? `${label} (${shortcut})` : label);
  const separator = <div aria-hidden="true" className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-700" />;

  return (
    <div className={cn("border rounded-md bg-white/50 dark:bg-gray-950/50 backdrop-blur-sm border-white/20 dark:border-white/10", className)}>
      {/* Stays in sight while writing a long story, right below the save bar */}
      <div role="toolbar" aria-label={t('editor.toolbar.label')} className="sticky top-[var(--save-bar-height,0px)] z-20 flex flex-wrap items-center gap-1 rounded-t-md border-b bg-gray-50 p-2 dark:bg-gray-900">
        <Button type="button" size="sm" variant="ghost" disabled={disabled || !state.canUndo} onClick={() => editor.chain().focus().undo().run()}
          title={withShortcut(t('editor.toolbar.undo'), `${MOD}Z`)} aria-label={t('editor.toolbar.undo')}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled || !state.canRedo} onClick={() => editor.chain().focus().redo().run()}
          title={withShortcut(t('editor.toolbar.redo'), `${MOD}Y`)} aria-label={t('editor.toolbar.redo')}>
          <Redo2 className="h-4 w-4" />
        </Button>
        {separator}
        {tools.map(({ key, icon: Icon, label, shortcut, active, run }, index) => (
          <span key={key} className="flex items-center gap-1">
            {(index === 2 || index === 4) && separator}
            <Toggle size="sm" disabled={disabled} pressed={active} onPressedChange={run} title={withShortcut(label, shortcut)} aria-label={label}>
              <Icon className="h-4 w-4" />
            </Toggle>
          </span>
        ))}
        {separator}

        <Popover open={imageOpen} onOpenChange={setImageOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="ghost" disabled={disabled} title={t('editor.toolbar.image')} aria-label={t('editor.toolbar.image')}>
              <ImageIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-3">
            <p className="text-sm font-semibold">{t('editor.toolbar.image')}</p>
            {images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {images.map((image) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() => insertImage(image.src, image.alt)}
                    className="overflow-hidden rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-story-purple-400"
                    aria-label={t('editor.image.insert', { name: image.alt || image.src.split('/').pop() || '' })}
                  >
                    <img src={image.src} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('editor.image.noIllustrations')}</p>
            )}
            {/* No <form>: React events bubble through the portal to the page form, which would save the story */}
            <div className="flex gap-2">
              <Input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); insertImage(imageUrl); } }}
                placeholder={t('editor.image.urlPlaceholder')}
                aria-label={t('editor.image.url')}
                type="url"
              />
              <Button type="button" size="sm" disabled={!imageUrl.trim()} onClick={() => insertImage(imageUrl)}>{t('editor.image.add')}</Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('editor.image.hint')}</p>
          </PopoverContent>
        </Popover>
      </div>

      <EditorContent editor={editor} className="p-4 min-h-[50vh]" />
    </div>
  );
};

export default RichTextEditor;
