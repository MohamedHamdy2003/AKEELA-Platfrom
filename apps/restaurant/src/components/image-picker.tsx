import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { Picture } from './ui';

export function ImagePicker({
  src,
  file,
  onFile,
  uploading = false,
}: {
  src: string | null;
  file: File | null;
  onFile: (file: File | null) => void;
  uploading?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="image-picker full">
      <Picture src={preview || src} alt="معاينة الصورة" />
      <div>
        <h3>الصورة</h3>
        {uploading && (
          <div role="status">
            <progress aria-label="جارٍ رفع الصورة" /> جارٍ رفع الصورة…
          </div>
        )}
        <p>JPEG، PNG أو WebP — حتى 5MB</p>
        <label className="button secondary upload-label">
          <Upload size={17} />
          اختيار صورة
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              if (
                !['image/jpeg', 'image/png', 'image/webp'].includes(
                  selected.type,
                ) ||
                selected.size > 5 * 1024 * 1024
              ) {
                setError('اختر صورة JPEG أو PNG أو WebP لا تتجاوز 5MB.');
                event.target.value = '';
                return;
              }
              setError('');
              onFile(selected);
            }}
          />
        </label>
        {file && <small>{file.name} · تُرفع بعد حفظ البيانات.</small>}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
