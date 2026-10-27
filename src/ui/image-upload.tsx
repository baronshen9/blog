"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "./button";
import styles from "./image-upload.module.css";

export type ImageUploadResult = { markdown: string } | { error: string };

// A button that picks an image file and hands it to `upload` as the form
// field `image`; the Markdown that shows the stored image goes to
// `onUploaded`, and a refusal is shown beside the button. `onUploadingChange`
// tells the form while an upload runs. The server decides
// what it accepts; `accept` narrows the file picker, and a file above
// `maxBytes` is refused here because it would be too large to send.
export function ImageUpload({
  accept,
  maxBytes,
  upload,
  onUploaded,
  onUploadingChange,
  disabled = false,
}: {
  accept: string[];
  maxBytes: number;
  upload: (form: FormData) => Promise<ImageUploadResult>;
  onUploaded: (markdown: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<
    { status: "idle" | "uploading" } | { status: "error"; message: string }
  >({ status: "idle" });

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again uploads it again.
    event.target.value = "";
    if (!file) return;
    if (file.size > maxBytes) {
      setState({
        status: "error",
        message: `This image is larger than the limit of ${maxBytes / 1024 / 1024} MB.`,
      });
      return;
    }
    setState({ status: "uploading" });
    onUploadingChange?.(true);
    const form = new FormData();
    form.set("image", file);
    try {
      const result = await upload(form);
      if ("error" in result) {
        setState({ status: "error", message: result.error });
        return;
      }
      setState({ status: "idle" });
      onUploaded(result.markdown);
    } catch {
      setState({ status: "error", message: "The upload failed; try again." });
    } finally {
      onUploadingChange?.(false);
    }
  }

  const uploading = state.status === "uploading";
  return (
    <div className={styles.upload}>
      <input
        ref={input}
        type="file"
        accept={accept.join(",")}
        aria-label="Image file"
        hidden
        onChange={onChange}
      />
      <Button
        type="button"
        disabled={disabled || uploading}
        onClick={() => input.current?.click()}
      >
        Upload image
      </Button>
      {uploading && (
        <span role="status" className={styles.message}>
          Uploading…
        </span>
      )}
      {state.status === "error" && (
        <span role="alert" className={`${styles.message} ${styles.error}`}>
          {state.message}
        </span>
      )}
    </div>
  );
}
