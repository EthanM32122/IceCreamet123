import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, GripVertical, Shield } from 'lucide-react';

export default function RulesManager() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    base44.entities.Rule.list('order', 50)
      .then(setRules)
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const addRule = async () => {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await base44.entities.Rule.create({
        title: title.trim(),
        body: body.trim(),
        order: rules.length
      });
      setTitle('');
      setBody('');
      load();
    } catch (e) {
      console.error('Failed to create rule', e);
    } finally {
      setBusy(false);
    }
  };

  const deleteRule = async (id) => {
    try {
      await base44.entities.Rule.delete(id);
      load();
    } catch (e) {
      console.error('Failed to delete rule', e);
    }
  };

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="text-amber-400" size={20} />
        <h3 className="font-display text-amber-400">Rules Manager</h3>
        <span className="text-xs text-white/50 ml-auto">Owner only · shown to new players before news</span>
      </div>

      {/* Add new rule */}
      <div className="bg-white/5 rounded-xl p-3 mb-3 space-y-2">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Rule title (e.g. No Scamming)"
          className="bg-white/10 border-white/20 text-white"
        />
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Rule description..."
          className="bg-white/10 border-white/20 text-white min-h-[70px]"
        />
        <Button onClick={addRule} disabled={busy || !title.trim() || !body.trim()} size="sm" style={{ backgroundColor: '#f59e0b', color: '#000' }}>
          <Plus size={14} className="mr-1" /> Add Rule
        </Button>
      </div>

      {/* Existing rules */}
      {loading ? (
        <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
      ) : rules.length === 0 ? (
        <p className="text-xs text-white/50 text-center py-4">No rules yet. Add some above.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <div key={rule.id} className="bg-white/5 rounded-lg p-3 flex items-start gap-2">
              <GripVertical size={16} className="text-white/30 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm text-amber-300">{i + 1}. {rule.title}</p>
                <p className="text-xs text-white/70 whitespace-pre-wrap mt-0.5">{rule.body}</p>
              </div>
              <button onClick={() => deleteRule(rule.id)} className="text-red-400 hover:text-red-300 flex-shrink-0 mt-1">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}