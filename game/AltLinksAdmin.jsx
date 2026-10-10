import React, { useState } from 'react';
import { Copy, Check, Link2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Alternate entry routes on the live app. Anyone with the link can open them —
// each route enforces its own access. Co-owners+ get them all in one place here.
const ALT_LINKS = [
  {
    label: 'Backup Entrance',
    path: '/alt-entry',
    description: 'Alternate backup entrance. Anyone with the link can open it; access is checked on entry.',
  },
  {
    label: 'Admin Panel',
    path: '/admin',
    description: 'Direct link to the admin panel. Access checked on entry.',
  },
  {
    label: 'Mod Panel',
    path: '/mod',
    description: 'Direct link to the moderator panel. Access checked on entry.',
  },
  {
    label: 'Biggie Panel',
    path: '/biggie-panel',
    description: 'Direct link to the Biggie panel. Access checked on entry.',
  },
  {
    label: 'Spooky Event',
    path: '/spooky-event',
    description: 'Direct link to the Spooky Month event page.',
  },
  {
    label: 'Soups of Hivelands',
    path: '/hivelands',
    description: 'Direct link to the Soups of Hivelands minigame event.',
  },
];

export default function AltLinksAdmin() {
  const [copied, setCopied] = useState(null);

  const copy = (url) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const open = (path) => {
    window.open(window.location.origin + path, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-1 flex items-center gap-2">
          <Link2 size={16} /> Alternate Links
        </h3>
        <p className="text-xs text-white/60 mb-4">
          Alternate entry points, all in one place. Anyone with a link can open it — each route checks access on entry.
        </p>
        <div className="space-y-2">
          {ALT_LINKS.map(link => {
            const full = window.location.origin + link.path;
            const isCopied = copied === full;
            return (
              <div key={link.path} className="bg-white/5 rounded-lg border border-white/10 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-display text-sm text-white">{link.label}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => open(link.path)} className="text-xs border-white/20 text-[#a7fcc9]">
                      <ExternalLink size={12} className="mr-1" />Open
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copy(full)} className="text-xs border-white/20 text-white">
                      {isCopied ? <><Check size={12} className="mr-1" />Copied</> : <><Copy size={12} className="mr-1" />Copy</>}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-white/60 mb-2">{link.description}</p>
                <a
                  href={link.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-[#a7fcc9] bg-black/30 rounded px-2 py-1.5 break-all hover:underline cursor-pointer"
                >
                  {full}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}