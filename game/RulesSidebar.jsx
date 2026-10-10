import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, X } from 'lucide-react';

export default function RulesSidebar({ open, onClose }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    base44.entities.Rule.list('order', 100)
      .then(setRules)
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-[#1a1a1a] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[#a7fcc9]" />
            <span className="font-display text-white">ICECREAMET Rules</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>}
          {!loading && rules.length === 0 && <p className="text-white/50 text-sm text-center py-8">No rules have been set yet.</p>}
          {rules.length > 0 && (
            <div className="space-y-3">
              {rules.map((rule, i) => (
                <div key={rule.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="font-display text-base text-[#a7fcc9] mb-1">{i + 1}. {rule.title}</h3>
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{rule.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}