import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Bold, Italic, List, Heading1, Heading2, Image as ImageIcon, Upload } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useCallback, useRef } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  onImageAdd?: (image: string, position: number, filename?: string, fileType?: string) => void;
}

const RichTextEditor = ({ content, onChange, placeholder, className, onImageAdd }: RichTextEditorProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || 'Write your story...',
      }),
      Image,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg dark:prose-invert m-5 focus:outline-none min-h-[300px] max-w-none',
      },
    },
  });

  useEffect(() => {
    if (editor && content) {
      // Check if current editor content matches the prop content
      // We need to parse legacy content slightly differently to ensure paragraphs are respected
      const editorHTML = editor.getHTML();
      
      // If content is HTML (TipTap), it's fine. 
      // If content is plain text (Legacy), we want to convert newlines to paragraphs
      const isLegacyContent = !content.trim().startsWith('<');
      
      let contentToSet = content;
      if (isLegacyContent) {
          // Convert plain newlines to proper HTML paragraphs for the editor
          contentToSet = content
            .split(/\r?\n/)
            .filter(line => line.trim() !== '')
            .map(line => `<p>${line}</p>`)
            .join('');
      }

      // Only set content if it's different to avoid cursor jumping
      // Comparing HTML to HTML is tricky, so we use a simple heuristic:
      // If editor is empty, definitely set it. 
      if (editor.isEmpty) {
          editor.commands.setContent(contentToSet);
      }
    }
  }, [content, editor]);

  const addImage = useCallback(() => {
    const url = window.prompt('URL');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageAdd && editor) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
            // Add to editor
            editor.chain().focus().setImage({ src: result }).run();
            // Notify parent to add to illustrations list
            onImageAdd(result, editor.state.selection.from, file.name, file.type);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("border rounded-md bg-white dark:bg-gray-950", className)}>
      <div className="flex items-center gap-1 border-b p-2 bg-gray-50 dark:bg-gray-900 rounded-t-md flex-wrap">
        <Toggle
          size="sm"
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Toggle bold"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Toggle italic"
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 1 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label="Toggle H1"
        >
          <Heading1 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Toggle H2"
        >
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Toggle list"
        >
          <List className="h-4 w-4" />
        </Toggle>
        
        <div className="h-6 w-px bg-gray-300 mx-1" />

        <Button
          size="sm"
          variant="ghost"
          onClick={addImage}
          title="Add Image via URL"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        {onImageAdd && (
            <Button
            size="sm"
            variant="ghost"
            onClick={handleUploadClick}
            title="Upload Image"
            >
            <Upload className="h-4 w-4" />
            </Button>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      <EditorContent editor={editor} className="p-4 min-h-[300px]" />
    </div>
  );
};

export default RichTextEditor;
