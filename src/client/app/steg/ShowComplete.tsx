import { useLocation, useNavigate } from "react-router";

export function ShowComplete() {
  const location = useLocation();
  const navigate = useNavigate();
  const { result } = (location.state ?? {}) as {
    result?: { secret_message?: string };
  };

  if (result?.secret_message == null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-4">No result to display.</p>
          <button
            onClick={() => navigate("/show")}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="px-6 lg:px-8 w-full">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl dark:text-white">
              Message found
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg/8 text-pretty text-gray-600 dark:text-gray-300">
              The hidden message has been revealed.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-6 sm:p-8 shadow-sm flex flex-col gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Secret message
              </label>
              <p className="whitespace-pre-wrap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white text-sm">
                {result.secret_message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/show")}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3.5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 shadow-xs hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Unhide another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
