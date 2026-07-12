/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@dotui/elements', '@dotui/devtools', '@dotui/prompt'],
  // libSQL ships native bindings; keep it external so it isn't bundled by the server.
  serverExternalPackages: ['@libsql/client', 'libsql'],
};

export default nextConfig;
