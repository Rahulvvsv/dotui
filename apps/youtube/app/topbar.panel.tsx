import { dot } from '@dotui/elements';

/** Top navigation bar — brand, search, and the cluster of action icons. */
export function Topbar() {
  return (
    <dot.panel
      description="Top navigation bar: brand, search, and action icons."
      className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2"
    >
      <dot.text
        required
        type="h1"
        description="Brand wordmark."
        className="text-lg font-bold text-red-600"
      >
        ▶ dotTube
      </dot.text>

      <dot.panel className="ml-2 flex flex-1 items-center gap-2">
        <dot.input
          required
          description="Search box (must stay editable)."
          type="search"
          placeholder="Search"
          className="w-full max-w-md rounded-full border border-slate-300 px-4 py-1.5 text-sm"
        />
        <dot.button
          description="Run the search."
          className="rounded-full bg-slate-100 px-3 py-1.5 text-sm"
        >
          🔍
        </dot.button>
      </dot.panel>

      <dot.button
        description="Upload / create a video."
        className="rounded-full bg-slate-100 px-3 py-1.5 text-sm"
      >
        📹 Create
      </dot.button>
      <dot.button
        description="Open notifications."
        className="rounded-full bg-slate-100 px-3 py-1.5 text-sm"
      >
        🔔
      </dot.button>
      <dot.image
        description="The signed-in user's avatar."
        src="https://i.pravatar.cc/64?img=12"
        alt="Your account"
        className="h-8 w-8 rounded-full object-cover"
      />
    </dot.panel>
  );
}
