import React from 'react';
import { MessageCircle } from 'lucide-react';

export default function Discord() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-24 h-24 rounded-full bg-[#5865F2] flex items-center justify-center mb-6 shadow-lg">
        <MessageCircle size={48} className="text-white" />
      </div>
      <h2 className="text-3xl font-display text-[#a7fcc9] mb-2">Join Our Discord</h2>
      <p className="text-white/70 mb-6 max-w-md">Chat with the community, get updates, and hang out with fellow players on our official Discord server!</p>
      <a href="https://discord.gg/9CekEMEDNW" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#5865F2] text-white font-display text-lg shadow-lg hover:bg-[#4752c4] transition-colors">
        <MessageCircle size={20} /> Join Discord
      </a>
    </div>
  );
}