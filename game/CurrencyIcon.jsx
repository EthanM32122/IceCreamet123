import React from 'react';

// Diamond blook image (mythical "Diamond" blook)
export const DIAMOND_IMG = 'https://www.image2url.com/r2/default/images/1787687311069-54d177a3-317e-46c8-b8ab-c1e8ea06aa5a.gif';

// Ancient Icecreamet Token blook image (unique rarity)
export const TOKEN_IMG = 'https://f005.backblazeb2.com/file/blacket-v2-cdn/uploads/9670385/xhek9klzrq/1787528578878-blook.gif';

// Inline diamond icon — use next to diamond balances/prices
export function DiamondIcon({ size = 16, className = '' }) {
  return (
    <img
      src={DIAMOND_IMG}
      alt="Diamonds"
      className={`inline-block object-contain align-middle ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// Inline token icon — use next to token balances/prices
export function TokenIcon({ size = 16, className = '' }) {
  return (
    <img
      src={TOKEN_IMG}
      alt="Tokens"
      className={`inline-block object-contain align-middle ${className}`}
      style={{ width: size, height: size }}
    />
  );
}