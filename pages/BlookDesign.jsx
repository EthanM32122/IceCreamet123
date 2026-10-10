import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Eraser, Trash2, Send, Link2, Pencil, Square, Circle, Triangle, PaintBucket, Sun } from 'lucide-react';

const COLORS = ['#000000', '#ffffff', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#06b6d4', '#84cc16', '#6366f1'];

const normalizeUrl = (url) => {
  let u = url.trim();
  if (u.includes('media.discordapp.net')) u = u.replace('media.discordapp.net', 'cdn.discordapp.com');
  return u;
};

export default function BlookDesign() {
  const { profile } = useGame();
  const canvasRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [drawing, setDrawing] = useState(false);
  const [blookName, setBlookName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myApps, setMyApps] = useState([]);
  const [eraser, setEraser] = useState(false);
  const [mode, setMode] = useState('draw');
  const [tool, setTool] = useState('brush'); // brush | rect | circle | triangle | fill
  const [opacity, setOpacity] = useState(1);
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState(false);
  const [galleryApps, setGalleryApps] = useState([]);
  const [view, setView] = useState('create');

  const shapeStartRef = useRef(null);
  const snapshotRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!profile) return;
    base44.entities.BlookApplication.filter({ user_id: profile.user_id }, '-created_date').then(setMyApps).catch(() => {});
  }, [profile]);

  useEffect(() => {
    base44.entities.BlookApplication.filter({}, '-created_date', 60).then(setGalleryApps).catch(() => {});
  }, [profile]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    return { x: (cx - rect.left) * (canvas.width / rect.width), y: (cy - rect.top) * (canvas.height / rect.height) };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');

    if (tool === 'fill') {
      floodFill(Math.round(pos.x), Math.round(pos.y), color);
      return;
    }

    setDrawing(true);
    if (tool === 'brush') {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    } else {
      // Shape — save snapshot for preview
      shapeStartRef.current = pos;
      snapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);

    if (tool === 'brush') {
      ctx.strokeStyle = eraser ? '#ffffff' : color;
      ctx.lineWidth = eraser ? brushSize * 3 : brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = eraser ? 1 : opacity;
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // Shape preview — restore snapshot then draw
      const start = shapeStartRef.current;
      if (!start) return;
      ctx.putImageData(snapshotRef.current, 0, 0);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      if (tool === 'rect') {
        ctx.fillRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
      } else if (tool === 'circle') {
        const r = Math.max(1, Math.sqrt((pos.x - start.x) ** 2 + (pos.y - start.y) ** 2));
        ctx.beginPath();
        ctx.arc(start.x, start.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (tool === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(start.x, pos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.lineTo((start.x + pos.x) / 2, start.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };

  const stopDraw = () => {
    setDrawing(false);
    shapeStartRef.current = null;
  };

  // Flood fill algorithm
  const floodFill = (startX, startY, fillColor) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const startIdx = (startY * w + startX) * 4;
    const tR = data[startIdx], tG = data[startIdx + 1], tB = data[startIdx + 2], tA = data[startIdx + 3];
    const hex = fillColor.replace('#', '');
    const fR = parseInt(hex.slice(0, 2), 16);
    const fG = parseInt(hex.slice(2, 4), 16);
    const fB = parseInt(hex.slice(4, 6), 16);
    if (tR === fR && tG === fG && tB === fB && tA === 255) return;
    const stack = [[startX, startY]];
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const idx = (y * w + x) * 4;
      if (data[idx] !== tR || data[idx + 1] !== tG || data[idx + 2] !== tB || data[idx + 3] !== tA) continue;
      data[idx] = fR; data[idx + 1] = fG; data[idx + 2] = fB; data[idx + 3] = 255;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const submit = async () => {
    if (!blookName.trim() || !description.trim()) { alert('Please give your blook a name and description!'); return; }
    if (blookName.trim().length < 2) { alert('Blook name must be at least 2 characters.'); return; }
    let imageData;
    if (mode === 'url') {
      if (!imageUrl.trim()) { alert('Please paste an image URL!'); return; }
      imageData = normalizeUrl(imageUrl.trim());
    } else {
      const canvas = canvasRef.current;
      imageData = canvas.toDataURL('image/jpeg', 0.8);
    }
    setSubmitting(true);
    try {
      await base44.entities.BlookApplication.create({
        user_id: profile.user_id,
        username: profile.username,
        blook_name: blookName.trim(),
        description: description.trim(),
        image_data: imageData,
        status: 'pending'
      });
      setBlookName('');
      setDescription('');
      setImageUrl('');
      clearCanvas();
      const apps = await base44.entities.BlookApplication.filter({ user_id: profile.user_id }, '-created_date');
      setMyApps(apps);
      alert('Your blook design has been submitted! Staff will review it.');
    } catch (e) {
      alert('Failed to submit: ' + e.message);
    }
    setSubmitting(false);
  };

  if (!profile) return null;

  const tools = [
    { id: 'brush', label: 'Brush', Icon: Pencil },
    { id: 'fill', label: 'Fill', Icon: PaintBucket },
    { id: 'rect', label: 'Rect', Icon: Square },
    { id: 'circle', label: 'Circle', Icon: Circle },
    { id: 'triangle', label: 'Tri', Icon: Triangle },
  ];

  return (
    <div>
      <h2 className="text-3xl font-display text-[#a7fcc9] mb-2">🎨 Blook Design Studio</h2>
      <p className="text-white/70 text-sm mb-4">Draw your own blook design and submit it as an application! If staff love it, it could become a real blook in the game.</p>
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setView('create')} className={`px-4 py-2 rounded-lg text-sm font-display transition-colors ${view === 'create' ? 'bg-[#a7fcc9] text-panel' : 'bg-white/10 text-white/70 hover:text-white'}`}>✏️ Create</button>
        <button onClick={() => setView('community')} className={`px-4 py-2 rounded-lg text-sm font-display transition-colors ${view === 'community' ? 'bg-[#a7fcc9] text-panel' : 'bg-white/10 text-white/70 hover:text-white'}`}>🌍 Community Gallery</button>
      </div>
      {view === 'create' ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3 justify-center">
            <button onClick={() => setMode('draw')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display transition-colors ${mode === 'draw' ? 'bg-[#a7fcc9] text-panel' : 'bg-white/10 text-white/70 hover:text-white'}`}><Pencil size={14} /> Draw</button>
            <button onClick={() => setMode('url')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display transition-colors ${mode === 'url' ? 'bg-[#a7fcc9] text-panel' : 'bg-white/10 text-white/70 hover:text-white'}`}><Link2 size={14} /> Image URL</button>
          </div>
          {mode === 'draw' ? (
            <div className="flex flex-col items-center gap-3">
              {/* Tool selector */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {tools.map(t => (
                  <button key={t.id} onClick={() => { setTool(t.id); setEraser(false); }} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display transition-colors ${tool === t.id && !eraser ? 'bg-[#a7fcc9] text-panel' : 'bg-white/10 text-white/70 hover:text-white'}`} title={t.label}>
                    <t.Icon size={14} /> {t.label}
                  </button>
                ))}
                <button onClick={() => setEraser(!eraser)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display transition-colors ${eraser ? 'bg-[#a7fcc9] text-panel' : 'bg-white/10 text-white/70 hover:text-white'}`} title="Eraser"><Eraser size={14} /> Erase</button>
              </div>
              <canvas
                ref={canvasRef}
                width={400}
                height={400}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
                className="rounded-xl border-2 border-white/20 touch-none cursor-crosshair bg-white"
                style={{ maxWidth: '100%', aspectRatio: '1' }}
              />
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {COLORS.map(c => (
                  <button key={c} onClick={() => { setColor(c); setEraser(false); }} className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c && !eraser ? 'border-[#a7fcc9] scale-110' : 'border-white/30'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2 w-full max-w-xs">
                <span className="text-xs text-white/60">Size</span>
                <input type="range" min="1" max="20" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="flex-1" />
              </div>
              {/* Shading / opacity slider */}
              <div className="flex items-center gap-2 w-full max-w-xs">
                <Sun size={14} className="text-white/60" />
                <span className="text-xs text-white/60">Shading</span>
                <input type="range" min="10" max="100" value={Math.round(opacity * 100)} onChange={e => setOpacity(parseInt(e.target.value) / 100)} className="flex-1" />
                <span className="text-xs text-white/40 w-8">{Math.round(opacity * 100)}%</span>
              </div>
              <Button size="sm" variant="outline" onClick={clearCanvas} className="border-white/20 text-white"><Trash2 size={14} className="mr-1" />Clear</Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-full max-w-sm aspect-square rounded-xl border-2 border-white/20 bg-white/5 flex items-center justify-center overflow-hidden">
                {imageUrl && !imageError ? (
                  <img src={normalizeUrl(imageUrl)} alt="Preview" className="w-full h-full object-contain" onError={() => setImageError(true)} />
                ) : (
                  <div className="text-white/40 text-sm text-center px-4">{imageUrl ? '⚠️ Could not load image. Discord links expire after ~24h — try imgur or a direct PNG/JPG link.' : 'Paste an image URL to preview your blook design here.'}</div>
                )}
              </div>
              <Input value={imageUrl} onChange={e => { setImageUrl(e.target.value); setImageError(false); }} placeholder="https://example.com/blook.png or Discord link" className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
              <p className="text-[10px] text-white/50 text-center">Paste a direct link to your blook image (PNG, JPG, or GIF). Discord links work but expire after ~24h.</p>
            </div>
          )}
        </div>
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-white/50 mb-1">Blook Name</p>
              <Input value={blookName} onChange={e => setBlookName(e.target.value)} maxLength={30} placeholder="e.g. Ice Cream Dragon" className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Description</p>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={300} placeholder="Describe your blook — what makes it special?" rows={4} className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <Button onClick={submit} disabled={submitting || !blookName.trim() || !description.trim()} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }} className="w-full">
              <Send size={14} className="mr-2" /> {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
          {myApps.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-white/50 mb-2 font-display">Your Submitted Designs</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {myApps.map(app => (
                  <div key={app.id} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                    <img src={app.image_data} alt={app.blook_name} className="w-12 h-12 rounded object-cover border border-white/10" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-display truncate">{app.blook_name}</p>
                      <p className="text-[10px] text-white/50 truncate">{app.description}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${app.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : app.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{app.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {galleryApps.map(app => (
            <div key={app.id} className="bg-panel rounded-2xl border border-white/10 p-3 flex flex-col">
              <div className="aspect-square rounded-xl border border-white/10 bg-white/5 overflow-hidden mb-2 flex items-center justify-center">
                {app.image_data ? (
                  <img src={app.image_data} alt={app.blook_name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-white/30 text-xs">No image</span>
                )}
              </div>
              <p className="text-sm text-white font-display truncate">{app.blook_name}</p>
              <p className="text-[10px] text-white/50 truncate mb-1">by {app.username}</p>
              <p className="text-[10px] text-white/40 line-clamp-2 flex-1">{app.description}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full text-center mt-1 ${app.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : app.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{app.status}</span>
            </div>
          ))}
          {galleryApps.length === 0 && <p className="text-white/40 text-sm col-span-full text-center py-8">No community designs yet. Be the first!</p>}
        </div>
      )}
    </div>
  );
}