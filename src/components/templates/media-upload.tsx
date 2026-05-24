'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image, Video, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface MediaUploadProps {
  value: string;
  onChange: (url: string) => void;
  mediaType: 'image' | 'video' | 'document';
  /** Unique path segment to avoid collisions */
  pathPrefix?: string;
}

const ACCEPT_MAP = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/quicktime',
  document: 'application/pdf',
};

const ICON_MAP = {
  image: Image,
  video: Video,
  document: FileText,
};

/**
 * Upload media to Supabase Storage (template-media bucket)
 * and return the public URL.
 */
export function MediaUpload({ value, onChange, mediaType, pathPrefix = '' }: MediaUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = ICON_MAP[mediaType];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10 MB');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'bin';
      const fileName = `${user.id}/${pathPrefix}${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('template-media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from('template-media')
        .getPublicUrl(fileName);

      onChange(urlData.publicUrl);
      toast.success('Media uploaded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[MediaUpload] Upload error:', msg);
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleRemove() {
    onChange('');
  }

  if (value) {
    return (
      <div className="relative rounded-lg border border-border overflow-hidden bg-muted">
        {mediaType === 'image' ? (
          <img src={value} alt="Preview" className="w-full h-32 object-cover" />
        ) : mediaType === 'video' ? (
          <video src={value} className="w-full h-32 object-cover" />
        ) : (
          <div className="h-16 flex items-center gap-2 px-3">
            <FileText className="size-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate flex-1">{value.split('/').pop()}</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {uploading ? 'Uploading...' : `Upload ${mediaType}`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_MAP[mediaType]}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
