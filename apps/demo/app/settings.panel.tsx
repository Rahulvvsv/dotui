import { dot } from '@dotui/elements';

type SettingsProps = {
  email: string;
};

/** Account settings panel — a couple of labelled rows + a save action. */
export function Settings({ email }: SettingsProps) {
  return (
    <dot.panel
      description="Account settings form — editable fields and a save action."
      className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4"
    >
      <dot.text
        required
        type="h2"
        description="Section heading."
        className="text-lg font-semibold text-slate-900"
      >
        Account settings
      </dot.text>

      <dot.panel className="flex flex-col gap-1">
        <dot.text type="label" className="text-sm font-medium text-slate-700">
          Email
        </dot.text>
        <dot.input
          required
          description="The account's email address (must stay editable)."
          type="email"
          defaultValue={email}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </dot.panel>

      <dot.panel className="flex flex-col gap-1">
        <dot.text type="label" className="text-sm font-medium text-slate-700">
          Display name
        </dot.text>
        <dot.input
          type="text"
          placeholder="Your name"
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </dot.panel>

      <dot.button
        required
        description="Saves the settings — the primary action."
        className="w-fit rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white"
      >
        Save changes
      </dot.button>
    </dot.panel>
  );
}
