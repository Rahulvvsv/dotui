import { dot } from '@dotui/elements';

type ProfileProps = {
  name: string;
  role: string;
  avatarUrl: string;
  online: boolean;
};

/** Profile header panel — authored as plain React + Tailwind. */
export function Profile({ name, role, avatarUrl, online }: ProfileProps) {
  return (
    <dot.panel
      description="The user's profile header — identity and primary action."
      className="flex items-center gap-4 rounded-lg border border-slate-200 p-4"
    >
      <dot.image
        required
        description="The user's avatar."
        src={avatarUrl}
        alt={name}
        className="h-16 w-16 rounded-full object-cover"
      />
      <dot.panel className="flex flex-col gap-1">
        <dot.text
          required
          type="h2"
          description="The user's name."
          className="text-lg font-semibold text-slate-900"
        >
          {name}
        </dot.text>
        <dot.text description="The user's job title." className="text-sm text-slate-500">
          {role}
        </dot.text>
        <dot.badge
          description="Online presence status."
          className="mt-1 w-fit rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
        >
          {online ? 'Online' : 'Offline'}
        </dot.badge>
      </dot.panel>
      <dot.button
        description="Opens profile editing."
        className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
      >
        Edit profile
      </dot.button>
    </dot.panel>
  );
}
