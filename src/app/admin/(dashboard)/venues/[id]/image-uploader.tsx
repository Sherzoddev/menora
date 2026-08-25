"use client";

import { useRef, useState, useTransition } from "react";
import { uploadVenueImage } from "../actions";

export default function ImageUploader({
  venueId,
  kind,
  currentUrl,
}: {
  venueId: string;
  kind: "logo" | "cover";
  currentUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setError(null);

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadVenueImage(venueId, kind, formData);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-700 bg-neutral-900 text-xs text-neutral-500 hover:border-amber-500 ${
          kind === "logo" ? "h-24 w-24" : "h-32 w-full"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={kind} className="h-full w-full object-cover" />
        ) : (
          "Загрузить"
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      {pending && <p className="mt-1 text-xs text-neutral-500">Загрузка...</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
