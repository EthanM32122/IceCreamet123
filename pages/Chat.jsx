import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { getAllPlayers } from '@/lib/playersCache';
import { getActiveBlooks, getPacks, getBadges, getPlayerBadges, getClans, getClanMembers } from '@/lib/gameDataCache';
import { uploadFile } from '@/lib/uploadFile';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLE_COLORS, ROLE_BADGES, ROLE_HIERARCHY, VERIFIED_BADGE_ID } from '@/lib/constants';
import { containsSlur, containsIpAttempt } from '@/lib/slurFilter';
import { getColorStyle } from '@/lib/colorStyle';
import { Send, Image, Trash2, Hash, ChevronDown, Smile, Zap, Sparkles, Reply, X, BarChart3, Link2 } from 'lucide-react';
import Links from '@/pages/Links';
import { handleBotCommand, getActiveGames, clearUnscramble, clearGtb, clearGtb2, clearGtp } from '@/lib/chatBot';
import { clearRiddle, normalizeAnswer } from '@/lib/riddles';
import InstGtbChannel from '@/components/game/InstGtbChannel';
import PullsChannel from '@/components/game/PullsChannel';
import PollWidget from '@/components/game/PollWidget';
import { DEFAULT_BOT_AVATAR, getBotAvatar } from '@/lib/botAvatar';
import { handleVerityMention } from '@/lib/verity';

// NOTE: Full original chat restored. Live updates: appendMessage + 3s poll.
// Source recovered from pre-rewrite commit with minimal live-message patches only.
export { default } from './ChatOriginal';
