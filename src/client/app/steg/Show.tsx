import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

const ALLOWED_TYPES = ["image/png", "image/jpeg"];
const ACCEPT = "image/png,image/jpeg";

function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only PNG and JPEG images are allowed.";
  }
  return null;
}

export function ShowForm () {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setImage(file: File) {
    const error = validateImageFile(file);
    if (error) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setImageFile(null);
      setPreviewUrl(null);
      setImageError(error);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageError(null);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(null);
    setPreviewUrl(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setImage(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setImage(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageFile) {
      setImageError("Please select an image.");
      return;
    }

    setIsLoading(true);
    setSubmitError(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const image_type = imageFile.type === "image/png" ? "png" : "jpeg";

      const res = await fetch("/api/steg/show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, image_type, image_base64: base64 }),
      });

      const data = await res.json();

      if (!data.success) {
        setSubmitError("Something went wrong. Please try again.");
        return;
      }

      navigate("/show/complete", { state: { result: data.res } });
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="px-6 lg:px-8 w-full">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl dark:text-white">
              Show
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg/8 text-pretty text-gray-600 dark:text-gray-300">
              Unhide the message from your image.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-6 sm:p-8 shadow-sm"
          >
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Image
                </label>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  The image with the hidden message (JPG or PNG only)
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  onChange={handleFileChange}
                  className="sr-only"
                />

                {imageError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {imageError}
                  </p>
                )}

                {previewUrl ? (
                  <div className="mt-2 relative inline-block">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-48 rounded-lg border border-gray-300 dark:border-gray-600 object-contain bg-gray-100 dark:bg-gray-800"
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                      {imageFile?.name}
                    </p>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium"
                    >
                      Remove image
                    </button>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
                    className={`mt-2 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
                      isDragging
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800"
                    }`}
                  >
                    <span className="text-4xl text-gray-400 dark:text-gray-500 mb-2">
                      ↑
                    </span>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Drag & drop an image here, or click to browse
                    </span>
                    <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      JPG, PNG only
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Password
                </label>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  The password to unlock the image
                </p>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="mt-2 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {submitError && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{submitError}</p>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="submit"
                disabled={isLoading || !imageFile}
                className="flex-1 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Unhiding..." : "Unhide message"}
              </button>
              <Link
                to="/"
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-3.5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 shadow-xs hover:bg-gray-50 dark:hover:bg-gray-700 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Back
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
