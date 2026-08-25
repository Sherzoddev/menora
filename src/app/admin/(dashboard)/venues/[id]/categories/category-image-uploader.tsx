"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import { uploadCategoryImage } from "./actions";

export default function CategoryImageUploader({
  venueId,
  categoryId,
  currentUrl,
}: {
  venueId: string;
  categoryId: string;
  currentUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.set("file", file);
    startTransition(() => {
      uploadCategoryImage(venueId, categoryId, formData);
    });
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-700 bg-neutral-800 text-neutral-500 hover:border-amber-500"
      title="Фото категории"
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImagePlus size={15} />
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleChange} />
      {pending && <span className="sr-only">Загрузка...</span>}
    </button>
  );
}
