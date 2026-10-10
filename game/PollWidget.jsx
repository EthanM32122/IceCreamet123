import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BarChart3, X, Plus, Vote } from 'lucide-react';
import { ROLE_HIERARCHY } from '@/lib/constants';

export default function PollWidget() {
  const { profile } = useGame();
  const [polls, setPolls] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);

  const isMod = profile && ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.moderator;

  const loadPolls = async () => {
    try {
      const list = await base44.entities.Poll.filter({ is_active: true, game: 'icecreamet' }, '-created_date', 10);
      setPolls(list);
    } catch (e) {}
  };

  useEffect(() => {
    loadPolls();
    const unsub = base44.entities.Poll.subscribe(() => loadPolls());
    return unsub;
  }, []);

  const createPoll = async () => {
    if (!question.trim()) return;
    const cleanOpts = options.map(o => o.trim()).filter(Boolean);
    if (cleanOpts.length < 2) { alert('Add at least 2 options.'); return; }
    setBusy(true);
    try {
      await base44.entities.Poll.create({
        question: question.trim(),
        options: JSON.stringify(cleanOpts),
        votes: JSON.stringify({}),
        creator_id: profile.user_id,
        creator_username: profile.username,
        is_active: true,
        game: 'icecreamet'
      });
      await base44.entities.ChatMessage.create({
        content: `📊 **${profile.username}** started a poll: "${question.trim()}"`,
        username: 'ICECREAMET Bot',
        avatar_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/5c6cf25a3_1786830938521-ezgif-89c69b824b200526.gif',
        is_system: true,
        user_role: 'admin',
        game: 'icecreamet'
      });
      setQuestion('');
      setOptions(['', '']);
      setShowCreate(false);
      loadPolls();
    } catch (e) {
      alert('Failed to create poll: ' + (e.message || 'unknown'));
    }
    setBusy(false);
  };

  const vote = async (poll, optIdx) => {
    if (!profile) return;
    try {
      const voteMap = JSON.parse(poll.votes || '{}');
      if (voteMap[profile.user_id] !== undefined) return; // already voted
      voteMap[profile.user_id] = optIdx;
      await base44.entities.Poll.update(poll.id, { votes: JSON.stringify(voteMap) });
      loadPolls();
    } catch (e) {}
  };

  const endPoll = async (poll) => {
    try {
      await base44.entities.Poll.update(poll.id, { is_active: false });
      loadPolls();
    } catch (e) {}
  };

  const addOption = () => setOptions(prev => [...prev, '']);
  const removeOption = (idx) => setOptions(prev => prev.filter((_, i) => i !== idx));

  const tally = (poll) => {
    const voteMap = JSON.parse(poll.votes || '{}');
    const opts = JSON.parse(poll.options || '[]');
    const counts = opts.map((_, i) => Object.values(voteMap).filter(v => v === i).length);
    const total = counts.reduce((s, c) => s + c, 0);
    return { opts, counts, total };
  };

  return (
    <div className="space-y-2">
      {isMod && (
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)} className="border-white/20 text-white">
          <BarChart3 size={14} className="mr-1" /> {showCreate ? 'Cancel' : 'Create Poll'}
        </Button>
      )}
      {showCreate && (
        <div className="bg-white/5 rounded-xl border border-white/15 p-3 space-y-2">
          <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Poll question..." maxLength={200} className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
          {options.map((opt, i) => (
            <div key={i} className="flex gap-1">
              <Input value={opt} onChange={e => setOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))} placeholder={`Option ${i + 1}`} maxLength={80} className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
              {options.length > 2 && <Button size="sm" variant="outline" onClick={() => removeOption(i)} className="border-white/20 text-white"><X size={14} /></Button>}
            </div>
          ))}
          {options.length < 6 && <Button size="sm" variant="ghost" onClick={addOption} className="text-white/70"><Plus size={14} className="mr-1" /> Add Option</Button>}
          <Button size="sm" onClick={createPoll} disabled={busy || !question.trim()} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{busy ? 'Creating...' : 'Start Poll'}</Button>
        </div>
      )}
      {polls.map(poll => {
        const { opts, counts, total } = tally(poll);
        const voteMap = JSON.parse(poll.votes || '{}');
        const myVote = voteMap[profile?.user_id];
        const canEnd = isMod && profile?.user_id === poll.creator_id;
        return (
          <div key={poll.id} className="bg-white/5 rounded-xl border border-white/15 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm text-white font-display flex-1">📊 {poll.question}</p>
              {canEnd && <button onClick={() => endPoll(poll)} className="text-white/30 hover:text-red-400"><X size={14} /></button>}
            </div>
            <p className="text-[10px] text-white/40 mb-2">by {poll.creator_username} · {total} vote{total !== 1 ? 's' : ''}</p>
            <div className="space-y-1.5">
              {opts.map((opt, i) => {
                const pct = total > 0 ? (counts[i] / total) * 100 : 0;
                const isMine = myVote === i;
                return (
                  <button
                    key={i}
                    onClick={() => vote(poll, i)}
                    disabled={myVote !== undefined}
                    className={`w-full text-left rounded-lg border p-2 transition-colors ${isMine ? 'border-[#a7fcc9] bg-[#a7fcc9]/15' : 'border-white/10 bg-white/5 hover:bg-white/10'} ${myVote !== undefined ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white flex items-center gap-1">{isMine && <Vote size={10} className="text-[#a7fcc9]" />}{opt}</span>
                      <span className="text-white/60">{counts[i]} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isMine ? '#a7fcc9' : '#67e8f9' }} />
                    </div>
                  </button>
                );
              })}
            </div>
            {myVote !== undefined && <p className="text-[10px] text-[#a7fcc9] mt-1.5">✓ You voted</p>}
          </div>
        );
      })}
      {polls.length === 0 && !showCreate && <p className="text-xs text-white/40 text-center py-2">No active polls</p>}
    </div>
  );
}