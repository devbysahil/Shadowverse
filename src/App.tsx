import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Shield, Flame, Swords, Users, Trophy, Sparkles, MessageSquare, 
  Settings, LogOut, Search, Plus, Play, User, Bell, Copy, Check, 
  Crown, Lock, Unlock, Eye, ArrowRight, RefreshCw, Zap, Award, 
  Radio, Volume2, VolumeX, Menu, X, Send, ChevronRight, Hash,
  Compass, Palette, BookOpen, Clock, CheckSquare, Edit3, Grid,
  Circle, HelpCircle, Gamepad2, UserPlus, Link, MessageCircle, Share2
} from 'lucide-react';

// ==========================================
// UTILS & SOUND SYNTHESIZER (Cyan/Bass Tuned)
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  playPortal() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {}
  }

  playWin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [220.00, 277.18, 329.63, 440.00];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.09 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.09);
        osc.stop(this.ctx.currentTime + idx * 0.09 + 0.3);
      });
    } catch (e) {}
  }
}

const soundFX = new SoundFX();

// ALL GAMES CATALOG DATA
const GAMES_CATALOG = [
  {
    id: 'drawguess',
    title: 'Draw & Guess',
    subtitle: 'Collaborative Sketching',
    type: 'Multiplayer Party',
    minPlayers: 2,
    maxPlayers: 8,
    status: 'AVAILABLE',
    icon: Palette,
    desc: 'Real-time drawing canvas where players sketch assigned words and guess for high scores.',
    tag: 'Popular'
  },
  {
    id: 'tictactoe',
    title: 'Shadow Runes',
    subtitle: 'Tic-Tac-Toe',
    type: '2 Player Strategy',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'AVAILABLE',
    icon: Flame,
    desc: 'Classic 3x3 strategic alignment duel with glowing cyan rune counters.',
    tag: 'Quick Duel'
  },
  {
    id: 'ludo',
    title: 'Monarch Ludo',
    subtitle: 'Board Game Classic',
    type: '4 Player Board',
    minPlayers: 2,
    maxPlayers: 4,
    status: 'AVAILABLE',
    icon: Grid,
    desc: 'Roll the dice, maneuver shadow tokens around the sanctuary, and race to home base.',
    tag: 'Board Classic'
  },
  {
    id: 'connect4',
    title: 'Abyss Drop',
    subtitle: 'Connect Four',
    type: 'Grid Tactics',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'AVAILABLE',
    icon: Shield,
    desc: 'Drop cyan energy orbs to claim four aligned monolith points in a vertical grid.',
    tag: 'Tactical'
  },
  {
    id: 'rps',
    title: 'Elemental Duel',
    subtitle: 'Rock-Paper-Scissors',
    type: 'Simultaneous Duel',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'AVAILABLE',
    icon: Swords,
    desc: 'Channel Shadow, Magic, or Blade in rapid simultaneous combat rounds.',
    tag: 'Fast Pace'
  },
  {
    id: 'quiz',
    title: 'Lore Quiz Battle',
    subtitle: 'Trivia Speed Challenge',
    type: 'Multiplayer Speed Trivia',
    minPlayers: 1,
    maxPlayers: 6,
    status: 'AVAILABLE',
    icon: HelpCircle,
    desc: 'Test your knowledge of dungeons, pop culture, science, and monarch lore.',
    tag: 'Trivia'
  },
  {
    id: 'reaction',
    title: 'Reflex Strike',
    subtitle: 'Reaction Speed Duel',
    type: 'Reflex Contest',
    minPlayers: 1,
    maxPlayers: 4,
    status: 'AVAILABLE',
    icon: Zap,
    desc: 'Strike the instant the gate flares with electric cyan light to test millisecond reflexes.',
    tag: 'Reflex'
  },
  {
    id: 'memory',
    title: 'Shadow Memory',
    subtitle: 'Memory Grid',
    type: 'Co-op Memory',
    minPlayers: 1,
    maxPlayers: 2,
    status: 'AVAILABLE',
    icon: Eye,
    desc: 'Uncover paired shadow sigils across temple tile walls in record turns.',
    tag: 'Mind Game'
  },
  {
    id: 'chess',
    title: 'Monarch Chess',
    subtitle: 'Strategic Chess',
    type: '2 Player Strategy',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'PREVIEW',
    icon: Crown,
    desc: 'Full 8x8 strategic chess warfare with shadow soldier piece sets.',
    tag: 'Coming Soon'
  },
  {
    id: 'uno',
    title: 'Rune Deck Clash',
    subtitle: 'UNO-Style Card Game',
    type: 'Party Card Game',
    minPlayers: 2,
    maxPlayers: 4,
    status: 'PREVIEW',
    icon: Circle,
    desc: 'Match color runes, cast skip spells, and force opponents to draw shadow cards.',
    tag: 'Coming Soon'
  },
  {
    id: 'word',
    title: 'Word Spellcraft',
    subtitle: 'Anagram Clash',
    type: 'Word Puzzle',
    minPlayers: 2,
    maxPlayers: 4,
    status: 'PREVIEW',
    icon: Sparkles,
    desc: 'Forge combat spells from cryptic ancient alphabet tiles before the timer expires.',
    tag: 'Coming Soon'
  }
];

export default function App() {
  // User Profile State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('shadowverse_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      id: 'usr-882103',
      name: 'Sung_JinWoo',
      email: 'monarch@shadowverse.io',
      avatar: '👑',
      status: 'Online',
      tag: '#1001'
    };
  });

  const [activeTab, setActiveTab] = useState('home');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Auth Modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');

  // Active Social Rooms State
  const [rooms, setRooms] = useState([
    {
      id: 'ROOM-801',
      name: 'Chill Draw & Guess Lounge',
      activity: 'drawguess',
      activityTitle: 'Draw & Guess',
      host: 'Cha_HaeIn',
      hostId: 'usr-2',
      maxPlayers: 6,
      players: [
        { id: 'usr-2', name: 'Cha_HaeIn', avatar: '⚔️', status: 'Ready', isHost: true },
        { id: 'usr-3', name: 'Igris_Knight', avatar: '🗡️', status: 'Ready', isHost: false }
      ],
      isPrivate: false,
      code: 'DRAW801'
    },
    {
      id: 'ROOM-802',
      name: 'Midnight Study Session #3',
      activity: 'study',
      activityTitle: 'Study Together',
      host: 'Go_GunHee',
      hostId: 'usr-4',
      maxPlayers: 10,
      players: [
        { id: 'usr-4', name: 'Go_GunHee', avatar: '🛡️', status: 'Focusing', isHost: true },
        { id: 'usr-5', name: 'Yoo_Jinho', avatar: '📱', status: 'Focusing', isHost: false }
      ],
      isPrivate: false,
      code: 'STUDY802'
    }
  ]);

  const [activeRoom, setActiveRoom] = useState(null);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [joinCodeModalOpen, setJoinCodeModalOpen] = useState(false);
  const [inputJoinCode, setInputJoinCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomActivity, setNewRoomActivity] = useState('drawguess');
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);

  // Friends & Messaging
  const [friends] = useState([
    { id: 'usr-2', name: 'Cha_HaeIn', status: 'In Room', activity: 'Drawing', avatar: '⚔️' },
    { id: 'usr-3', name: 'Igris_Knight', status: 'Online', activity: 'In Lobby', avatar: '🗡️' },
    { id: 'usr-4', name: 'Go_GunHee', status: 'Studying', activity: 'Focusing', avatar: '🛡️' },
    { id: 'usr-5', name: 'Yoo_Jinho', status: 'Offline', activity: 'Idle', avatar: '📱' }
  ]);

  const [messages, setMessages] = useState([
    { id: 'm1', sender: 'Cha_HaeIn', text: 'Hey JinWoo! Ready for a Draw & Guess round?', time: '14:20' },
    { id: 'm2', sender: 'Igris_Knight', text: 'My blade is sharp for Ludo!', time: '14:22' }
  ]);
  const [messageInput, setMessageInput] = useState('');

  // Save User to LocalStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('shadowverse_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('shadowverse_user');
    }
  }, [user]);

  soundFX.enabled = soundEnabled;

  // Handle Create Room
  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    soundFX.playPortal();
    let actTitle = 'Draw & Guess';
    if (newRoomActivity === 'study') actTitle = 'Study Together';
    else {
      const g = GAMES_CATALOG.find(item => item.id === newRoomActivity);
      if (g) actTitle = g.title;
    }

    const room = {
      id: 'ROOM-' + Math.floor(100 + Math.random() * 900),
      name: newRoomName || `${user.name}'s Social Lounge`,
      activity: newRoomActivity,
      activityTitle: actTitle,
      host: user.name,
      hostId: user.id,
      maxPlayers: 8,
      players: [
        { id: user.id, name: user.name, avatar: user.avatar, status: 'Ready', isHost: true }
      ],
      isPrivate: newRoomPrivate,
      code: 'SHADOW' + Math.floor(100 + Math.random() * 900)
    };
    setRooms(prev => [room, ...prev]);
    setActiveRoom(room);
    setCreateRoomOpen(false);
    setNewRoomName('');
  };

  // Join Room by Code
  const handleJoinByCode = (e) => {
    e.preventDefault();
    soundFX.playClick();
    const found = rooms.find(r => r.code.toUpperCase() === inputJoinCode.trim().toUpperCase());
    if (found) {
      handleJoinRoom(found);
      setJoinCodeModalOpen(false);
      setInputJoinCode('');
    } else {
      alert('Room code not found in Shadowverse!');
    }
  };

  const handleJoinRoom = (room) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    soundFX.playClick();
    let updatedPlayers = [...room.players];
    if (!updatedPlayers.some(p => p.id === user.id)) {
      updatedPlayers.push({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        status: 'Ready',
        isHost: false
      });
    }
    const updatedRoom = { ...room, players: updatedPlayers };
    setRooms(prev => prev.map(r => r.id === room.id ? updatedRoom : r));
    setActiveRoom(updatedRoom);
  };

  const handleLeaveRoom = () => {
    if (!activeRoom || !user) return;
    soundFX.playClick();
    const updatedPlayers = activeRoom.players.filter(p => p.id !== user.id);
    if (updatedPlayers.length === 0) {
      setRooms(prev => prev.filter(r => r.id !== activeRoom.id));
    } else {
      if (activeRoom.hostId === user.id) {
        updatedPlayers[0].isHost = true;
      }
      const updatedRoom = {
        ...activeRoom,
        host: updatedPlayers[0].name,
        hostId: updatedPlayers[0].id,
        players: updatedPlayers
      };
      setRooms(prev => prev.map(r => r.id === activeRoom.id ? updatedRoom : r));
    }
    setActiveRoom(null);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !user) return;
    soundFX.playClick();
    const msg = {
      id: 'm-' + Date.now(),
      sender: user.name,
      text: messageInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, msg]);
    setMessageInput('');
  };

  return (
    <div className="min-h-screen bg-[#020610] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black flex flex-col relative overflow-x-hidden">
      
      {/* BACKGROUND GRAPHICS (DEEP NAVY & ELECTRIC CYAN LIGHTING PRESERVED) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/40 via-blue-950/20 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[35%] right-[-10%] w-[500px] h-[500px] bg-cyan-900/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-950/20 blur-[150px] rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.04]" />
      </div>

      {/* BRANDING TOP HEADER */}
      <header className="relative z-40 bg-[#030814] border-b border-cyan-950/80 px-4 lg:px-6 py-2.5 flex items-center justify-between shadow-lg shadow-cyan-950/20">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { soundFX.playPortal(); setActiveTab('home'); setActiveRoom(null); }}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-600 to-slate-900 p-[2px] shadow-[0_0_15px_rgba(0,240,255,0.4)]">
            <div className="w-full h-full bg-[#050b18] rounded-full flex items-center justify-center">
              <Crown className="w-4 h-4 text-cyan-300 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-[0.25em] text-white uppercase font-serif">
              SHADOWVERSE
            </h1>
            <span className="text-[9px] font-mono tracking-[0.3em] text-cyan-400 block -mt-1">
              SOCIAL GAMING & STUDY REALM
            </span>
          </div>
        </div>

        {/* Top Header Controls */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-[#0a1128] border border-cyan-900/40 text-slate-400 hover:text-cyan-300 transition-all"
            title="Toggle Audio Effects"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
          </button>

          {user ? (
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => { soundFX.playClick(); setActiveTab('settings'); }}
                className="flex items-center space-x-2 p-1.5 pr-3 rounded-xl bg-[#0a1128] border border-cyan-500/40 hover:border-cyan-300 transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-700 flex items-center justify-center text-sm">
                  {user.avatar}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-white">{user.name}</div>
                  <div className="text-[9px] text-cyan-400 font-mono">{user.tag}</div>
                </div>
              </button>

              <button 
                onClick={() => setUser(null)}
                className="p-2 rounded-xl bg-[#0a1128] border border-slate-800 text-slate-400 hover:text-rose-400 transition-all"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { soundFX.playPortal(); setShowAuthModal(true); }}
              className="px-5 py-2 rounded-full bg-white hover:bg-slate-200 text-black font-extrabold text-xs tracking-wider shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all"
            >
              SIGN IN
            </button>
          )}

          <button 
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="md:hidden p-2 rounded-xl bg-[#0a1128] border border-cyan-900/40 text-slate-300"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* DISCORD-STYLE MAIN APPLICATION BODY */}
      <div className="flex-1 flex overflow-hidden z-10">
        
        {/* 1. DISCORD-INSPIRED SIDEBAR NAVIGATION */}
        <aside className={`w-64 bg-[#050b18]/95 border-r border-cyan-900/40 p-4 flex flex-col justify-between shrink-0 transition-all duration-300 ${
          mobileNavOpen ? 'fixed inset-y-14 left-0 z-30 bg-[#050b18]' : 'hidden md:flex'
        }`}>
          <div className="space-y-6">
            
            {/* Nav Group 1: Core Hubs */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold text-cyan-400/80 uppercase tracking-widest px-3 block mb-2">
                Navigation Hub
              </span>

              {[
                { id: 'home', label: 'Home', icon: Flame },
                { id: 'games', label: 'Discover Games', icon: Gamepad2 },
                { id: 'friends', label: 'Friends', icon: Users },
                { id: 'messages', label: 'Direct Messages', icon: MessageSquare },
                { id: 'drawing', label: 'Drawing & Guessing', icon: Palette },
                { id: 'study', label: 'Study Together', icon: BookOpen },
                { id: 'settings', label: 'Settings', icon: Settings }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      soundFX.playClick();
                      setActiveTab(tab.id);
                      setActiveRoom(null);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive 
                        ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-950' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Nav Group 2: Room Shortcuts & Quick Actions */}
            <div className="space-y-3 pt-4 border-t border-cyan-900/30">
              <span className="text-[10px] font-mono font-bold text-cyan-400/80 uppercase tracking-widest px-3 block">
                Active Lounge Shortcuts
              </span>

              <div className="space-y-2">
                <button
                  onClick={() => setCreateRoomOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-cyan-950/40 border border-cyan-800/40 hover:border-cyan-400 text-xs text-cyan-300 font-bold transition-all"
                >
                  <span className="flex items-center space-x-2">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Room</span>
                  </span>
                </button>

                <button
                  onClick={() => setJoinCodeModalOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-black border border-cyan-900/50 hover:border-cyan-500 text-xs text-slate-300 font-bold transition-all"
                >
                  <span className="flex items-center space-x-2">
                    <Hash className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Join with Code</span>
                  </span>
                </button>
              </div>
            </div>

          </div>

          {/* User Mini Bar bottom sidebar */}
          {user && (
            <div className="p-3 rounded-2xl bg-[#070e20] border border-cyan-900/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-700 flex items-center justify-center text-sm">
                  {user.avatar}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{user.name}</div>
                  <span className="text-[9px] text-cyan-400 font-mono flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>Online</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* 2. MAIN WORKSPACE VIEW CONTAINER */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6">
          
          {/* LOBBY / ROOM OVERRIDE IF ACTIVE ROOM */}
          {activeRoom ? (
            <SocialRoomWorkspace 
              room={activeRoom} 
              user={user} 
              onLeave={handleLeaveRoom}
              onUpdateRoom={(up) => {
                setActiveRoom(up);
                setRooms(prev => prev.map(r => r.id === up.id ? up : r));
              }}
            />
          ) : (
            <>
              {/* HOME DASHBOARD VIEW */}
              {activeTab === 'home' && (
                <div className="space-y-6">
                  
                  {/* COMPACT SOCIAL HERO BANNER */}
                  <div className="rounded-3xl bg-gradient-to-r from-[#0a142e] via-[#050b18] to-[#020610] border border-cyan-500/30 p-6 lg:p-8 shadow-2xl shadow-cyan-950/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-xs font-mono">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                        <span>Welcome back, {user ? user.name : 'Shadow Hunter'}</span>
                      </div>
                      <h2 className="text-2xl lg:text-3xl font-black text-white">
                        SOCIAL GAMING & STUDY SANCTUARY
                      </h2>
                      <p className="text-slate-300 text-xs lg:text-sm max-w-xl">
                        Play multiplayer games, sketch live in Draw & Guess, or focus together in quiet study lounges.
                      </p>
                    </div>

                    {/* Quick Action Chips */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => { soundFX.playPortal(); setCreateRoomOpen(true); }}
                        className="px-5 py-2.5 rounded-full bg-white hover:bg-slate-200 text-black font-extrabold text-xs shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all"
                      >
                        Create Room (YES)
                      </button>
                      <button
                        onClick={() => setJoinCodeModalOpen(true)}
                        className="px-5 py-2.5 rounded-full bg-[#050b18]/80 hover:bg-[#0a1128] border border-slate-600 text-slate-300 font-bold text-xs transition-all"
                      >
                        Join Code
                      </button>
                      <button
                        onClick={() => setActiveTab('study')}
                        className="px-5 py-2.5 rounded-full bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-bold text-xs transition-all"
                      >
                        Study Lounge
                      </button>
                    </div>
                  </div>

                  {/* ACTIVE PUBLIC ROOMS */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                        <span>Active Social Rooms</span>
                      </h3>
                      <button onClick={() => setCreateRoomOpen(true)} className="text-xs text-cyan-400 font-mono hover:underline">
                        + Host New Room
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rooms.map(room => (
                        <div key={room.id} className="p-4 rounded-2xl bg-[#070e20] border border-cyan-900/40 hover:border-cyan-400/60 transition-all flex items-center justify-between">
                          <div className="space-y-1">
                            <h4 className="font-bold text-white text-sm">{room.name}</h4>
                            <div className="flex items-center space-x-2 text-xs text-cyan-400 font-mono">
                              <span>{room.activityTitle}</span>
                              <span>•</span>
                              <span>Host: {room.host}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleJoinRoom(room)}
                            className="px-5 py-1.5 rounded-full bg-white hover:bg-slate-200 text-black font-extrabold text-xs shadow-md shadow-cyan-950 transition-all"
                          >
                            ENTER
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RECOMMENDED GAMES GRID */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                      <Gamepad2 className="w-4 h-4 text-cyan-400" />
                      <span>Featured Games</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {GAMES_CATALOG.slice(0, 6).map(game => (
                        <div key={game.id} className="p-5 rounded-2xl bg-[#070e20] border border-cyan-900/40 hover:border-cyan-400/60 transition-all space-y-3 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <game.icon className="w-5 h-5 text-cyan-400" />
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                                {game.tag}
                              </span>
                            </div>
                            <h4 className="font-bold text-white text-sm">{game.title}</h4>
                            <p className="text-xs text-slate-400">{game.desc}</p>
                          </div>

                          <button
                            onClick={() => {
                              setNewRoomActivity(game.id);
                              setCreateRoomOpen(true);
                            }}
                            className="w-full py-2 rounded-full bg-white hover:bg-slate-200 text-black font-extrabold text-xs transition-all"
                          >
                            PLAY NOW
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* DISCOVER GAMES PAGE */}
              {activeTab === 'games' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Social Multiplayer Games</h2>
                    <p className="text-xs text-slate-400">Select an activity to launch a live room with friends.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {GAMES_CATALOG.map(game => (
                      <div key={game.id} className="p-5 rounded-2xl bg-[#070e20] border border-cyan-900/40 hover:border-cyan-400/80 transition-all space-y-4 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <game.icon className="w-6 h-6 text-cyan-400" />
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                              {game.minPlayers}-{game.maxPlayers} Players
                            </span>
                          </div>
                          <h3 className="font-bold text-white text-base">{game.title}</h3>
                          <span className="text-xs text-cyan-400/90 font-mono block">{game.subtitle}</span>
                          <p className="text-xs text-slate-400 leading-relaxed">{game.desc}</p>
                        </div>

                        {game.status === 'AVAILABLE' ? (
                          <button
                            onClick={() => {
                              setNewRoomActivity(game.id);
                              setCreateRoomOpen(true);
                            }}
                            className="w-full py-2.5 rounded-full bg-white hover:bg-slate-200 text-black font-extrabold text-xs transition-all shadow-md shadow-cyan-950"
                          >
                            PLAY (LAUNCH ROOM)
                          </button>
                        ) : (
                          <span className="w-full text-center block py-2 text-xs font-mono text-slate-500 bg-black rounded-full border border-slate-800">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FRIENDS PAGE */}
              {activeTab === 'friends' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-white">Shadowverse Friends</h2>

                  <div className="bg-[#070e20] border border-cyan-900/40 rounded-2xl p-4 space-y-3">
                    {friends.map(f => (
                      <div key={f.id} className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-900/30 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-lg">
                            {f.avatar}
                          </div>
                          <div>
                            <span className="font-bold text-white text-sm block">{f.name}</span>
                            <span className="text-xs text-cyan-400 font-mono">{f.status} • {f.activity}</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => setActiveTab('messages')}
                          className="px-4 py-1.5 rounded-full bg-white text-black font-extrabold text-xs"
                        >
                          MESSAGE
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DIRECT MESSAGES PAGE */}
              {activeTab === 'messages' && (
                <div className="bg-[#070e20] border border-cyan-900/40 rounded-2xl p-4 h-[550px] flex flex-col">
                  <h2 className="font-bold text-white pb-3 border-b border-cyan-900/40">Direct Messages</h2>

                  <div className="flex-1 overflow-y-auto space-y-3 py-4">
                    {messages.map(m => (
                      <div key={m.id} className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-900/30 text-xs">
                        <div className="flex justify-between font-bold text-cyan-300 mb-1">
                          <span>{m.sender}</span>
                          <span className="text-slate-500 font-mono text-[10px]">{m.time}</span>
                        </div>
                        <p className="text-slate-200">{m.text}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendMessage} className="pt-3 border-t border-cyan-900/40 flex space-x-2">
                    <input 
                      type="text"
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      className="flex-1 bg-black border border-cyan-900/50 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button type="submit" className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-xs">
                      Send
                    </button>
                  </form>
                </div>
              )}

              {/* DRAWING & GUESSING PAGE DIRECT ACCESS */}
              {activeTab === 'drawing' && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white">Collaborative Canvas & Draw Game</h2>
                  <DrawingCanvasActivity />
                </div>
              )}

              {/* STUDY TOGETHER ROOM ACCESS */}
              {activeTab === 'study' && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white">Shadow Study Lounge</h2>
                  <StudyTogetherActivity />
                </div>
              )}

              {/* SETTINGS PAGE */}
              {activeTab === 'settings' && (
                <div className="max-w-xl mx-auto bg-[#070e20] border border-cyan-900/40 rounded-2xl p-6 space-y-4">
                  <h2 className="text-xl font-bold text-white">Account & Theme Settings</h2>
                  <p className="text-xs text-slate-400">Manage user details and system sound preferences.</p>
                  
                  {user && (
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-cyan-300 font-mono block mb-1">Username</label>
                        <input type="text" value={user.name} readOnly className="w-full bg-black border border-cyan-900 rounded-xl p-2.5 text-white" />
                      </div>
                      <div>
                        <label className="text-cyan-300 font-mono block mb-1">Email</label>
                        <input type="text" value={user.email} readOnly className="w-full bg-black border border-cyan-900 rounded-xl p-2.5 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </main>
      </div>

      {/* MODAL: CREATE ROOM */}
      {createRoomOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#070e20] border border-cyan-900/60 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-cyan-900/40 pb-3">
              <h3 className="font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <span>Create Social Room</span>
              </h3>
              <button onClick={() => setCreateRoomOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-cyan-300 mb-1">Room Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Midnight Drawing Squad"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-black border border-cyan-900/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-cyan-300 mb-1">Select Activity / Game</label>
                <select 
                  value={newRoomActivity}
                  onChange={(e) => setNewRoomActivity(e.target.value)}
                  className="w-full bg-black border border-cyan-900/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="drawguess">Draw & Guess</option>
                  <option value="study">Study Together</option>
                  {GAMES_CATALOG.filter(g => g.status === 'AVAILABLE').map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button type="submit" className="flex-1 py-3 rounded-full bg-white text-black font-extrabold text-xs shadow-lg shadow-cyan-950">
                  YES / CREATE
                </button>
                <button type="button" onClick={() => setCreateRoomOpen(false)} className="py-3 px-5 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">
                  NO / CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: JOIN BY CODE */}
      {joinCodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#070e20] border border-cyan-900/60 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-900/40 pb-3">
              <h3 className="font-bold text-white">Enter Room Code</h3>
              <button onClick={() => setJoinCodeModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <form onSubmit={handleJoinByCode} className="space-y-4">
              <input 
                type="text"
                placeholder="e.g. DRAW801"
                value={inputJoinCode}
                onChange={(e) => setInputJoinCode(e.target.value)}
                className="w-full bg-black border border-cyan-900/50 rounded-xl px-4 py-3 text-xs text-white uppercase font-mono tracking-wider focus:outline-none focus:border-cyan-400"
              />

              <div className="flex space-x-3">
                <button type="submit" className="flex-1 py-2.5 rounded-full bg-white text-black font-extrabold text-xs">
                  JOIN ROOM
                </button>
                <button type="button" onClick={() => setJoinCodeModalOpen(false)} className="py-2.5 px-5 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#070e20] border border-cyan-900/60 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl relative">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>

            <div className="text-center space-y-2">
              <Crown className="w-8 h-8 text-cyan-300 mx-auto" />
              <h3 className="text-lg font-black text-white">Awaken Shadowverse Account</h3>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              setUser({ id: 'usr-900', name: authName || 'ShadowHunter', email: authEmail || 'hunter@realm.io', avatar: '⚔️', tag: '#1010' });
              setShowAuthModal(false);
            }} className="space-y-3">
              <input 
                type="text" 
                placeholder="Username" 
                value={authName} 
                onChange={e => setAuthName(e.target.value)} 
                className="w-full bg-black border border-cyan-900 rounded-xl px-4 py-2 text-xs text-white" 
              />
              <input 
                type="email" 
                placeholder="Email Address" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)} 
                className="w-full bg-black border border-cyan-900 rounded-xl px-4 py-2 text-xs text-white" 
              />
              <button type="submit" className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs">
                SIGN IN
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// ==========================================
// DISCORD-STYLE DISPATCHED ROOM WORKSPACE
// ==========================================
function SocialRoomWorkspace({ room, user, onLeave, onUpdateRoom }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
      
      {/* Left: Participant Roster */}
      <div className="bg-[#070e20] border border-cyan-900/40 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-cyan-900/30">
          <h3 className="font-bold text-white text-sm">{room.name}</h3>
          <span className="text-[10px] font-mono text-cyan-400">{room.code}</span>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-mono text-slate-400 block uppercase">Members ({room.players.length})</span>
          {room.players.map(p => (
            <div key={p.id} className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-900/30 flex items-center space-x-3">
              <span className="text-base">{p.avatar}</span>
              <div className="flex-1">
                <span className="font-bold text-white text-xs block">{p.name}</span>
                <span className="text-[10px] text-cyan-400 font-mono">{p.isHost ? 'Room Host' : 'Member'}</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onLeave} className="w-full py-2 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">
          LEAVE ROOM (NO)
        </button>
      </div>

      {/* Center: Activity Component */}
      <div className="lg:col-span-3 bg-[#070e20] border border-cyan-900/50 rounded-2xl p-6">
        {room.activity === 'drawguess' && <DrawingCanvasActivity />}
        {room.activity === 'study' && <StudyTogetherActivity />}
        {room.activity === 'tictactoe' && <TicTacToeGame onEndMatch={onLeave} />}
        {room.activity === 'ludo' && <LudoGameActivity onEndMatch={onLeave} />}
        {room.activity === 'connect4' && <ConnectFourGame onEndMatch={onLeave} />}
        {room.activity === 'rps' && <RPSGame onEndMatch={onLeave} />}
        {room.activity === 'quiz' && <QuizBattleGame onEndMatch={onLeave} />}
        {room.activity === 'reaction' && <ReactionSpeedGame onEndMatch={onLeave} />}
        {room.activity === 'memory' && <MemoryMatchGame onEndMatch={onLeave} />}
      </div>

    </div>
  );
}

// ==========================================
// 1. DRAWING & GUESSING ACTIVITY
// ==========================================
function DrawingCanvasActivity() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#00f0ff');
  const [lineWidth, setLineWidth] = useState(4);
  const [guesses, setGuesses] = useState([
    { user: 'Igris', text: 'Is it a dragon?', time: '14:30' }
  ]);
  const [guessInput, setGuessInput] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
  }, []);

  const startDraw = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const submitGuess = (e) => {
    e.preventDefault();
    if (!guessInput.trim()) return;
    setGuesses(prev => [...prev, { user: 'You', text: guessInput, time: 'Now' }]);
    setGuessInput('');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Canvas */}
      <div className="md:col-span-2 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
          <span>Word to Draw: <strong className="text-white font-bold">SHADOW MONARCH</strong></span>
          <span>Time Left: 45s</span>
        </div>

        <canvas 
          ref={canvasRef}
          width={450}
          height={320}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          className="w-full h-[320px] bg-black border border-cyan-900/60 rounded-2xl cursor-crosshair"
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between bg-black p-2.5 rounded-xl border border-cyan-900/40">
          <div className="flex items-center space-x-2">
            {['#00f0ff', '#3b82f6', '#ffffff', '#ef4444', '#eab308'].map(c => (
              <button key={c} onClick={() => setColor(c)} className="w-5 h-5 rounded-full border border-slate-700" style={{ backgroundColor: c }} />
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={() => setLineWidth(2)} className="px-2 py-1 text-[10px] font-mono bg-cyan-950 text-cyan-300 rounded">Thin</button>
            <button onClick={() => setLineWidth(6)} className="px-2 py-1 text-[10px] font-mono bg-cyan-950 text-cyan-300 rounded">Thick</button>
            <button onClick={clearCanvas} className="px-3 py-1 text-xs font-bold bg-rose-950 text-rose-300 rounded-lg">Clear</button>
          </div>
        </div>
      </div>

      {/* Guess Chat */}
      <div className="bg-black border border-cyan-900/40 rounded-2xl p-3 flex flex-col justify-between h-[380px]">
        <span className="text-xs font-bold text-cyan-300 border-b border-cyan-900/30 pb-2">Guess Feed</span>
        
        <div className="flex-1 overflow-y-auto space-y-2 py-2 text-xs">
          {guesses.map((g, i) => (
            <div key={i} className="p-1.5 rounded bg-cyan-950/30">
              <strong className="text-cyan-400">{g.user}:</strong> <span className="text-slate-200">{g.text}</span>
            </div>
          ))}
        </div>

        <form onSubmit={submitGuess} className="pt-2 border-t border-cyan-900/30 flex space-x-2">
          <input 
            type="text" 
            placeholder="Type your guess..."
            value={guessInput}
            onChange={e => setGuessInput(e.target.value)}
            className="flex-1 bg-[#050b18] border border-cyan-900 rounded-lg px-3 py-1.5 text-xs text-white"
          />
          <button type="submit" className="px-3 py-1.5 bg-cyan-500 text-black font-bold rounded-lg text-xs">Guess</button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. STUDY TOGETHER ACTIVITY
// ==========================================
function StudyTogetherActivity() {
  const [seconds, setSeconds] = useState(1500);
  const [isActive, setIsActive] = useState(false);
  const [notes, setNotes] = useState('• Complete Shadowverse UI specs\n• Review Monarch Lore');
  const [todos, setTodos] = useState([
    { id: 1, text: 'Study 25 mins', done: true },
    { id: 2, text: 'Solve Math Equations', done: false }
  ]);
  const [newTodo, setNewTodo] = useState('');

  useEffect(() => {
    let interval = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => { setIsActive(false); setSeconds(1500); };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const addTodo = (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setTodos(prev => [...prev, { id: Date.now(), text: newTodo, done: false }]);
    setNewTodo('');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Pomodoro Timer */}
      <div className="bg-black border border-cyan-900/40 rounded-2xl p-6 text-center space-y-4">
        <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest block">Pomodoro Focus Timer</span>
        <div className="text-5xl font-black font-mono text-white tracking-widest">{formatTime(seconds)}</div>

        <div className="flex justify-center space-x-3">
          <button onClick={toggleTimer} className="px-6 py-2 rounded-full bg-white text-black font-extrabold text-xs">
            {isActive ? 'PAUSE' : 'START FOCUS'}
          </button>
          <button onClick={resetTimer} className="px-4 py-2 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">
            RESET
          </button>
        </div>
      </div>

      {/* Shared Notes & Todos */}
      <div className="space-y-4">
        <div className="bg-black border border-cyan-900/40 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-bold text-cyan-300">Shared Study Notes</span>
          <textarea 
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-[#050b18] border border-cyan-900/40 rounded-xl p-3 text-xs text-white focus:outline-none"
          />
        </div>

        <div className="bg-black border border-cyan-900/40 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-bold text-cyan-300">Session To-Do List</span>
          <div className="space-y-1 text-xs">
            {todos.map(t => (
              <div key={t.id} className="flex items-center space-x-2 text-slate-200">
                <input 
                  type="checkbox" 
                  checked={t.done} 
                  onChange={() => setTodos(prev => prev.map(x => x.id === t.id ? {...x, done: !x.done} : x))}
                  className="rounded border-cyan-900 text-cyan-500 bg-black"
                />
                <span className={t.done ? 'line-through text-slate-500' : ''}>{t.text}</span>
              </div>
            ))}
          </div>

          <form onSubmit={addTodo} className="pt-2 flex space-x-2">
            <input 
              type="text" 
              placeholder="Add goal..."
              value={newTodo}
              onChange={e => setNewTodo(e.target.value)}
              className="flex-1 bg-[#050b18] border border-cyan-900 rounded-lg px-3 py-1 text-xs text-white"
            />
            <button type="submit" className="px-3 py-1 bg-cyan-500 text-black font-bold rounded-lg text-xs">+ Add</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. LUDO GAME ACTIVITY
// ==========================================
function LudoGameActivity({ onEndMatch }) {
  const [diceVal, setDiceVal] = useState(1);
  const [p1Pos, setP1Pos] = useState(0);

  const rollDice = () => {
    soundFX.playClick();
    const roll = Math.floor(Math.random() * 6) + 1;
    setDiceVal(roll);
    setP1Pos(prev => Math.min(28, prev + roll));
  };

  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <h3 className="text-xl font-bold text-white">Monarch Ludo Board</h3>

      <div className="w-64 h-64 mx-auto bg-black border-2 border-cyan-500/50 rounded-2xl p-4 grid grid-cols-4 gap-2 relative">
        <div className="bg-cyan-950/60 rounded-xl border border-cyan-800 flex items-center justify-center font-bold text-cyan-300">Base 1</div>
        <div className="bg-blue-950/60 rounded-xl border border-blue-800 flex items-center justify-center font-bold text-blue-300">Base 2</div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center font-bold text-slate-300">Base 3</div>
        <div className="bg-sky-950/60 rounded-xl border border-sky-800 flex items-center justify-center font-bold text-sky-300">Base 4</div>

        <div className="col-span-4 bg-cyan-950/20 border border-cyan-900 rounded-xl p-2 flex items-center justify-center text-xs text-cyan-300">
          Token Position: Step {p1Pos} / 28
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-2xl font-mono font-black text-cyan-300">Dice Roll: {diceVal}</div>
        <button onClick={rollDice} className="px-6 py-2.5 rounded-full bg-white text-black font-extrabold text-xs">
          ROLL DICE
        </button>
      </div>

      <button onClick={onEndMatch} className="px-5 py-2 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">
        Exit (NO)
      </button>
    </div>
  );
}

// ==========================================
// 4. TIC TAC TOE
// ==========================================
function TicTacToeGame({ onEndMatch }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);

  const handleClick = (i) => {
    if (board[i]) return;
    const next = [...board];
    next[i] = isXNext ? '⚡' : '🗡️';
    setBoard(next);
    setIsXNext(!isXNext);
  };

  return (
    <div className="max-w-xs mx-auto space-y-4 text-center">
      <h3 className="text-xl font-bold text-white">Shadow Runes</h3>
      <div className="grid grid-cols-3 gap-2 w-60 h-60 mx-auto">
        {board.map((cell, i) => (
          <button key={i} onClick={() => handleClick(i)} className="bg-black border border-cyan-900 rounded-xl text-2xl flex items-center justify-center">
            {cell}
          </button>
        ))}
      </div>
      <button onClick={onEndMatch} className="px-5 py-2 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">
        Exit Match (NO)
      </button>
    </div>
  );
}

function ConnectFourGame({ onEndMatch }) {
  return (
    <div className="text-center space-y-4">
      <h3 className="text-xl font-bold text-white">Connect Four</h3>
      <button onClick={onEndMatch} className="px-5 py-2 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">Exit</button>
    </div>
  );
}

function RPSGame({ onEndMatch }) {
  return (
    <div className="text-center space-y-4">
      <h3 className="text-xl font-bold text-white">Rock Paper Scissors</h3>
      <button onClick={onEndMatch} className="px-5 py-2 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">Exit</button>
    </div>
  );
}

function QuizBattleGame({ onEndMatch }) {
  return (
    <div className="text-center space-y-4">
      <h3 className="text-xl font-bold text-white">Lore Quiz Battle</h3>
      <button onClick={onEndMatch} className="px-5 py-2 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">Exit</button>
    </div>
  );
}

function ReactionSpeedGame({ onEndMatch }) {
  return (
    <div className="text-center space-y-4">
      <h3 className="text-xl font-bold text-white">Reaction Speed Duel</h3>
      <button onClick={onEndMatch} className="px-5 py-2 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">Exit</button>
    </div>
  );
}

function MemoryMatchGame({ onEndMatch }) {
  return (
    <div className="text-center space-y-4">
      <h3 className="text-xl font-bold text-white">Memory Match</h3>
      <button onClick={onEndMatch} className="px-5 py-2 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">Exit</button>
    </div>
  );
}