import { useLocation, useNavigate } from "react-router";

export function HideComplete() {
  const location = useLocation();
  const navigate = useNavigate();
  const { result, image_type } = (location.state ?? {}) as {
    result?: { image_base64?: string };
    image_type?: "png" | "jpeg";
  };

  if (!result?.image_base64) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-4">No result to display.</p>
          <button
            onClick={() => navigate("/hide")}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const mimeType = image_type === "jpeg" ? "image/jpeg" : "image/png";
  const dataUrl = `data:${mimeType};base64,${result.image_base64}`;
  const filename = `steg-hidden.${image_type ?? "png"}`;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="px-6 lg:px-8 w-full">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl dark:text-white">
              Done
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg/8 text-pretty text-gray-600 dark:text-gray-300">
              Your message has been hidden inside the image.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-6 sm:p-8 shadow-sm flex flex-col items-center gap-6">
            <img
              src={dataUrl}
              alt="Image with hidden message"
              className="max-h-96 rounded-lg border border-gray-300 dark:border-gray-600 object-contain bg-gray-100 dark:bg-gray-800"
            />

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
              <a
                href={dataUrl}
                download={filename}
                className="flex-1 text-center rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400"
              >
                Download image
              </a>
              <button
                type="button"
                onClick={() => navigate("/hide")}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-3.5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 shadow-xs hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Hide another
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
