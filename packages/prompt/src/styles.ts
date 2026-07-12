/**
 * CSS for the prompt layer's own chrome — shipped as a string and injected once by the
 * provider (via a <style> tag) so it works regardless of whether the host app's Tailwind
 * build scans node_modules. These are plain, namespaced class names (not Tailwind), so
 * they never collide with generated overlay classes or need a safelist entry.
 *
 * `.dotui-panel-active` draws an animated gradient ring around the panel the generator is
 * currently working on — the border-only effect comes from a masked pseudo-element.
 */
export const PROMPT_STYLES = `
@keyframes dotui-border-flow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@keyframes dotui-badge-in {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}
.dotui-panel-active::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 10px;
  padding: 2.5px;
  background: linear-gradient(115deg, #8b5cf6, #ec4899, #38bdf8, #8b5cf6);
  background-size: 200% 200%;
  animation: dotui-border-flow 1.6s linear infinite;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 45;
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.2), 0 0 22px rgba(139, 92, 246, 0.45);
}
.dotui-active-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 46;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(115deg, #8b5cf6, #ec4899);
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
  pointer-events: none;
  animation: dotui-badge-in 0.2s ease-out both;
}
.dotui-toasts {
  position: fixed;
  bottom: 16px;
  left: 352px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 320px;
}
.dotui-toast {
  border: 1px solid;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.18);
  animation: dotui-badge-in 0.2s ease-out both;
}
.dotui-toast--error { background: #fef2f2; border-color: #fca5a5; color: #b91c1c; }
.dotui-toast--info { background: #eef2ff; border-color: #c7d2fe; color: #3730a3; }
`;
