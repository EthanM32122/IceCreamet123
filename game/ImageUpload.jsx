import React, { useRef, useState } from 'react';
import { uploadFile } from '@/lib/uploadFile';
import { Input } from '@/components/ui/input';
import { Upload, X } from 'lucide-react';

export default function ImageUpload({ value, onChange, label = 'Image', className = '' }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await uploadFile(file);
      onChange(file_url);
    } catch (err) {
      console.error('Upload failed', err);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className={className}>
      <span className="text-xs text-muted-foreground block mb-1">{label}</span>
      <div className="flex items-center gap-2 mb-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-input bg-transparent text-xs hover:bg-accent transition-colors disabled:opacity-50"
        >
          <Upload size={12} />
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        <Input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="or paste image URL"
          className="flex-1 h-8 text-xs"
        />
        {value && (
          <div className="flex items-center gap-1">
            <img src={value} alt="" className="w-8 h-8 rounded object-cover" />
            <button type="button" onClick={() => onChange('')} className="text-red-500 hover:scale-110 transition-transform">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}