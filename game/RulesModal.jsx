import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

export default function RulesModal({ onClose, onDone }) {
  const { profile, updateProfile } = useGame();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Rule.list('order', 50)
      .then(setRules)
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, []);

  const handleAccept = async () => {
    try {
      await updateProfile({ has_seen_rules: true });
    } catch (e) {}
    onClose();
    onDone?.();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-card rounded-2xl border-2 border-primary shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center gap-3 p-5 border-b border-border">
          <Shield className="text-primary" size={28} />
          <div>
            <h2 className="text-2xl font-display text-primary">ICECREAMET Rules</h2>
            <p className="text-xs text-muted-foreground">Please read and accept before playing</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No rules have been set yet.</p>
          ) : (
            <div className="space-y-4">
              {rules.map((rule, i) => (
                <div key={rule.id} className="bg-muted/50 rounded-xl p-4 border border-border">
                  <h3 className="font-display text-base text-primary mb-1">
                    {i + 1}. {rule.title}
                  </h3>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{rule.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border">
          <Button onClick={handleAccept} className="w-full font-display text-base h-11" style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            I Accept the Rules
          </Button>
        </div>
      </div>
    </div>
  );
}