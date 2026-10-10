// Shared helper for rendering name_color / chat_color values.
// Supports three formats:
//   - '' (empty): no style (falls back to caller's default)
//   - 'rainbow': animated rainbow text (uses .rainbow-name CSS class)
//   - 'gradient:#hex1,#hex2': two-color linear gradient text
//   - '#hex' or any CSS color: plain color
// Returns { className, style } to spread onto the text element.

// allowRainbow: when false, a stored 'rainbow' value is rendered as plain blue
// instead of the animated rainbow. Used to restrict rainbow names to admin+ users.
export function getColorStyle(color, allowRainbow = true) {
  if (!color) return { className: '', style: {} };
  if (color === 'rainbow') return allowRainbow
    ? { className: 'rainbow-name', style: {} }
    : { className: '', style: { color: '#60a5fa' } };
  if (color.startsWith('gradient:')) {
    const colors = color.slice(9).split(',').filter(Boolean);
    if (colors.length < 2) return { className: '', style: {} };
    return {
      className: '',
      style: {
        // inline-block ensures the gradient background paints on the element's
        // own box so background-clip:text actually shows the gradient (otherwise
        // the transparent text fill can render the name invisible).
        display: 'inline-block',
        background: `linear-gradient(90deg, ${colors.join(', ')})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
      },
    };
  }
  return { className: '', style: { color } };
}

export const GRADIENT_PRESETS = [
  ['#ff6b6b', '#feca57'],
  ['#00ccff', '#a855f7'],
  ['#4ade80', '#06b6d4'],
  ['#f472b6', '#a855f7'],
  ['#f59e0b', '#ef4444'],
  ['#34d399', '#fbbf24'],
  ['#60a5fa', '#a855f7'],
  ['#fb7185', '#fbbf24'],
  ['#22d3ee', '#3b82f6'],
  ['#a7fcc9', '#4ade80'],
];

export const formatGradient = (c1, c2) => `gradient:${c1},${c2}`;