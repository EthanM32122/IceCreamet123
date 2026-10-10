import React from 'react';

export const PLUS_BADGE_URL = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/e5a54e967_Plus.webp';

export default function PlusBadge({ size = 16, className = '' }) {
  return (
    <img
      src={PLUS_BADGE_URL}
      alt="ICECREAMET PLUS"
      className={`inline-block object-contain align-middle ${className}`}
      style={{ width: size, height: size }}
    />
  );
}