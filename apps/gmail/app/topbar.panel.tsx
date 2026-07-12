import { dot } from '@dotui/elements';

/** Top navigation bar — menu, brand, the big search field, and the action-icon cluster. */
export function Topbar() {
  return (
    <dot.panel
      description="Top navigation bar: menu, brand, search, and action icons."
      className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2"
    >
      <dot.button
        description="Toggle the navigation rail."
        className="rounded-full px-2 py-2 text-lg text-slate-600 hover:bg-slate-100"
      >
        ☰
      </dot.button>
      <dot.text
        required
        type="h1"
        description="Brand wordmark."
        className="text-xl font-semibold text-slate-700"
      >
        ✉️ Gmail
      </dot.text>

      <dot.panel
        description="Search cluster."
        className="ml-4 flex max-w-2xl flex-1 items-center gap-2 rounded-full bg-slate-100 px-4 py-2 focus-within:bg-white focus-within:shadow"
      >
        <dot.button description="Run the search." className="text-slate-500 hover:text-slate-700">
          🔍
        </dot.button>
        <dot.input
          required
          description="Search mail (must stay editable)."
          type="search"
          placeholder="Search mail"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
        />
        <dot.button
          description="Open search filters."
          className="text-slate-500 hover:text-slate-700"
        >
          ⚙
        </dot.button>
      </dot.panel>

      <dot.button
        description="Open help."
        className="rounded-full px-2 py-2 text-slate-600 hover:bg-slate-100"
      >
        ❓
      </dot.button>
      <dot.button
        description="Open settings."
        className="rounded-full px-2 py-2 text-slate-600 hover:bg-slate-100"
      >
        ⚙️
      </dot.button>
      <dot.button
        description="Open the Google apps grid."
        className="rounded-full px-2 py-2 text-slate-600 hover:bg-slate-100"
      >
        ▦
      </dot.button>
      <dot.image
        description="The signed-in user's avatar."
        src="https://i.pravatar.cc/64?img=5"
        alt="Your account"
        className="h-8 w-8 rounded-full object-cover"
      />
    </dot.panel>
  );
}
