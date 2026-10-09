"use client";

import { useCallback, useState } from "react";

import Editor from "@/components/Editor";
import UploadPanel from "@/components/UploadPanel";
import type { DecomposeResponse } from "@/lib/types";
import type { ValidatedImage } from "@/lib/validateImage";

interface Session {
  result: DecomposeResponse;
  original: ValidatedImage;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);

  const handleResult = useCallback(
    (result: DecomposeResponse, original: ValidatedImage) => {
      setSession({ result, original });
    },
    []
  );

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Seedream Layer Separation
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Upload a photo and let Seedream 5.0 split it into editable layers. Then move,
            resize and re-order the detected objects.
          </p>
        </div>
        {session && (
          <button
            type="button"
            onClick={() => setSession(null)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Start over
          </button>
        )}
      </header>

      <UploadPanel onResult={handleResult} compact={Boolean(session)} />

      {session ? (
        <Editor
          key={session.result.elapsedMs + session.result.modelId}
          result={session.result}
          original={session.original}
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Upload",
              body: "Pick any PNG or JPEG photo, poster or illustration.",
            },
            {
              step: "2",
              title: "Separate",
              body: "Seedream detects people, objects, text and decorations and returns each as a transparent layer.",
            },
            {
              step: "3",
              title: "Edit",
              body: "Click a layer to select it, drag it around, resize it, change the stacking order or hide it.",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {s.step}
              </span>
              <h3 className="mt-3 text-base font-semibold text-zinc-100">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{s.body}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
