import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Trophy } from 'lucide-react';
import { RARITY_COLORS } from '@/lib/constants';

export default function AuctionCard({ auction, profile, now, onBid, onClaim }) {
  const [bidInput, setBidInput] = useState('');
  const ended = new Date(auction.end_time).getTime() < now;
  const isWinner = ended && auction.current_bidder_id === profile?.user_id;
  const isSeller = auction.seller_id === profile?.user_id;
  const hasBid = (auction.current_bid || 0) > 0;
  const minBid = hasBid ? auction.current_bid + 1 : auction.starting_price;

  const timeLeft = () => {
    const ms = new Date(auction.end_time).getTime() - now;
    if (ms <= 0) return 'Ended';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div
      className={`bg-panel rounded-xl border p-3 relative ${
        auction.is_event ? 'border-purple-500/50 ring-1 ring-purple-500/20' : 'border-white/10'
      } ${auction.is_shiny ? 'ring-1 ring-yellow-400/30' : ''}`}
    >
      {/* Status badge */}
      <span
        className={`absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full font-display ${
          auction.is_event ? 'bg-purple-500 text-white' : 'bg-[#a7fcc9] text-panel'
        }`}
      >
        {auction.is_event ? 'EVENT' : 'AUCTION'}
      </span>

      {/* Content: image + metadata */}
      <div className="flex gap-3 mb-2">
        {auction.blook_image_url ? (
          <img
            src={auction.blook_image_url}
            className={`w-16 h-16 object-contain flex-shrink-0 ${auction.is_shiny ? 'shiny-blook' : ''}`}
            alt=""
          />
        ) : (
          <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-10 h-10 object-contain flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0 space-y-0.5 text-xs pt-1">
          <p className="truncate">
            <span className="text-white/50">Name: </span>
            <span className="font-display" style={{ color: RARITY_COLORS[auction.blook_rarity] }}>
              {auction.is_shiny && '✨ '}
              {auction.blook_name}
            </span>
          </p>
          <p>
            <span className="text-white/50">Type: </span>
            <span className="text-white">Blook</span>
          </p>
          <p>
            <span className="text-white/50">{hasBid ? 'Current Bid: ' : 'Starting Bid: '}</span>
            <span className="text-[#a7fcc9] font-display">🪙 {(auction.current_bid || auction.starting_price).toLocaleString()}</span>
          </p>
          <p className="truncate">
            <span className="text-white/50">Seller: </span>
            <Link to={`/player/${auction.seller_id}`} className="text-white hover:underline">
              {auction.seller_username}
            </Link>
          </p>
          <p>
            <span className="text-white/50">Bids: </span>
            <span className="text-white">{auction.bid_count || 0}</span>
          </p>
        </div>
      </div>

      {/* Time */}
      <div className="flex items-center justify-end mt-1 pt-2 border-t border-white/10">
        <span className={`text-xs flex items-center gap-1 ${ended ? 'text-red-400' : 'text-white/50'}`}>
          <Clock size={11} /> {timeLeft()}
        </span>
      </div>

      {/* Actions */}
      {!ended && !isSeller && (
        <div className="flex gap-1 mt-2">
          <Input
            type="number"
            value={bidInput}
            onChange={(e) => setBidInput(e.target.value)}
            placeholder={`Min 🪙 ${minBid}`}
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            onClick={() => {
              onBid(auction, parseInt(bidInput));
              setBidInput('');
            }}
            style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}
          >
            Bid
          </Button>
        </div>
      )}
      {isWinner && (
        <Button
          size="sm"
          onClick={() => onClaim(auction)}
          className="w-full mt-2"
          style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}
        >
          <Trophy size={12} className="mr-1" /> Claim Win
        </Button>
      )}
      {ended && !isWinner && auction.current_bidder_id && !isSeller && (
        <p className="text-xs text-white/50 mt-2">Won by {auction.current_bidder_username}</p>
      )}
      {isSeller && !ended && <p className="text-xs text-white/50 mt-2">Your listing</p>}
    </div>
  );
}