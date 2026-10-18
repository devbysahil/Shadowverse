import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Flame, Users, MessageSquare, LogOut, Plus, Crown, Radio,
  Volume2, VolumeX, Menu, Palette, BookOpen, Gamepad2, Hash, X, Bomb, Layers,Eye,
  Type
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useRooms } from './hooks/useRooms';
import { useRoomMessages } from './hooks/useRoomMessages';
// ✅ 1. Firebase Imports updated
import {
  ref,
  onChildAdded,
  push,
  set,
  update,
  remove,
  onValue,
  runTransaction,
} from 'firebase/database';
import { rtdb } from './firebase';

const WORDS = [
  "Apple", "Car", "Dog", "Cat", "House", "Tree", "Sun", "Moon", "Star", "Fish",
  "Bird", "Book", "Phone", "Clock", "Chair", "Table", "Window", "Door", "River",
  "Mountain", "Cloud", "Rain", "Snow", "Fire", "Water", "Earth", "Air", "Light",
  "Shadow", "Sword", "Shield", "Crown", "Dragon", "Knight", "Castle", "Forest"
];

// ==========================================
// SOUND SYNTHESIZER
// ==========================================
class SoundFX {
  ctx: AudioContext | null = null;
  enabled: boolean = true;
  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  playClick() { this._play('sine', 300, 700, 0.05); }
  playPortal() { this._play('sawtooth', 100, 450, 0.35); }
  _play(type: string, start: number, end: number, dur: number) {
    if (!this.enabled) return; this.init(); if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = type as any; osc.frequency.setValueAtTime(start, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(end, this.ctx.currentTime + dur);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(); osc.stop(this.ctx.currentTime + dur);
    } catch (e) { }
  }
}
const soundFX = new SoundFX();

const GAMES_CATALOG = [
  { id: 'drawguess', title: 'Draw & Guess', icon: Palette, desc: 'Sketch words and guess.' },
  { id: 'tictactoe', title: 'Shadow Runes', icon: Flame, desc: '3x3 strategic duel.' },
  { id: 'ludo', title: 'Monarch Ludo', icon: Gamepad2, desc: 'Roll dice and race.' },
  { id: 'chess', title: 'Royal Chess', icon: Crown, desc: '2-player classic duel.' },
  { id: 'bomb', title: 'Shadow Bomb', icon: Bomb, desc: 'Pass the bomb. Last one standing wins.' },
  { id: 'uno', title: 'Shadow UNO', icon: Layers, desc: 'Match colors, play action cards, empty your hand first.' },
  { id: 'spy', title: 'Find the Spy', icon: Eye, desc: 'Hints, discussion aur voting. Spy ko pakdo!' },
  { id: 'wordle', title: 'Wordle Battle', icon: Type, desc: 'Same word, sab race karo. Pehle guess karne wala jeetega!' },
];

export default function App() {
  const { user, loading, guestLogin, emailLogin, emailSignup, logout } = useAuth();
  const { rooms, createRoom, joinRoom, leaveRoom, findRoomByCode, deleteRoom } = useRooms();

  const [activeTab, setActiveTab] = useState('home');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Auth
  const [authMode, setAuthMode] = useState('guest');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // Room States
  const [activeRoom, setActiveRoom] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('shadowverse_activeRoom');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [roomClosedPopup, setRoomClosedPopup] = useState(false);

  // Create Room State
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomActivity, setNewRoomActivity] = useState('drawguess');
  const [isPrivate, setIsPrivate] = useState(false);


  // Join Room State
  const [joinRoomOpen, setJoinRoomOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');

  const ROOM_LIMITS: Record<string, number> = { chess: 2, tictactoe: 2, bomb: 6, uno: 6, spy: 5, wordle: 5   };
  const isRoomFull = (room: any) => {
    const lim = ROOM_LIMITS[room.activity];
    return !!lim && (room.players?.length || 0) >= lim && !room.players?.some((p: any) => p.uid === user?.uid);
  };

  useEffect(() => { soundFX.enabled = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    if (activeRoom) {
      localStorage.setItem('shadowverse_activeRoom', JSON.stringify(activeRoom));
    } else {
      localStorage.removeItem('shadowverse_activeRoom');
    }
  }, [activeRoom]);

  useEffect(() => {
    if (activeRoom && user) {
      const liveRoomData = rooms.find(r => r.id === activeRoom.id);

      if (liveRoomData) {
        if (JSON.stringify(liveRoomData) !== JSON.stringify(activeRoom)) {
          setActiveRoom(liveRoomData);
        }
      } else {
        setActiveRoom(null);
        setActiveTab('home');
        setRoomClosedPopup(true);
      }
    }
  }, [rooms, activeRoom, user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return;
    soundFX.playPortal();
    let actTitle = newRoomActivity === 'study' ? 'Study Together' : (GAMES_CATALOG.find(g => g.id === newRoomActivity)?.title || 'Game');
    const room = await createRoom({
      name: newRoomName || `${user.name}'s Lounge`,
      activity: newRoomActivity,
      activityTitle: actTitle,
      isPrivate: isPrivate,
      host: user
    });
    setActiveRoom(room);
    setCreateRoomOpen(false);
    setNewRoomName('');
    setIsPrivate(false);
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFX.playClick();
    setJoinError('');
    if (!joinCodeInput.trim()) return;

    const room = await findRoomByCode(joinCodeInput.trim());
    if (!room) {
      setJoinError('Room code not found!');
      return;
    }

    await joinRoom(room.id, user);
    setActiveRoom(room);
    setJoinRoomOpen(false);
    setJoinCodeInput('');
  };

  const handleJoinRoom = async (room: any) => {
    if (!user) return; soundFX.playClick();
    await joinRoom(room.id, user); setActiveRoom(room);
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom || !user) return; soundFX.playClick();
    await leaveRoom(activeRoom.id, user); setActiveRoom(null);
  };

  const handleDeleteRoom = async () => {
    if (!activeRoom || !user) return;
    soundFX.playClick();

    if (window.confirm("Are you sure you want to close this room? Everyone will be kicked out.")) {
      await deleteRoom(activeRoom.id);
      setActiveRoom(null);
      setActiveTab('home');
    }
  };

  if (loading) return <div className="min-h-screen bg-[#020610] flex items-center justify-center text-cyan-400"><Crown className="w-10 h-10 animate-pulse" /></div>;

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-[#020610] flex items-center justify-center p-4">
        <div className="bg-[#070e20] border border-cyan-900/60 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
          <div className="text-center space-y-2">
            <Crown className="w-8 h-8 text-cyan-300 mx-auto animate-pulse" />
            <h3 className="text-lg font-black text-white tracking-widest uppercase">Shadowverse</h3>
          </div>
          <div className="flex space-x-2">
            {['guest', 'login', 'signup'].map(m => (
              <button key={m} onClick={() => setAuthMode(m)} className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase ${authMode === m ? 'bg-cyan-500 text-black' : 'bg-[#0a1128] text-cyan-300'}`}>{m}</button>
            ))}
          </div>
          {authMode === 'guest' ? (
            <button onClick={guestLogin} className="w-full py-3 rounded-full bg-white text-black font-extrabold text-xs">CONTINUE AS GUEST</button>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              try { if (authMode === 'login') await emailLogin(authEmail, authPassword); else await emailSignup(authEmail, authPassword); }
              catch (err: any) { alert(err.message); }
            }} className="space-y-3">
              <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-black border border-cyan-900 rounded-xl px-4 py-2 text-xs text-white" required />
              <input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-black border border-cyan-900 rounded-xl px-4 py-2 text-xs text-white" required />
              <button type="submit" className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs">{authMode === 'login' ? 'LOGIN' : 'SIGN UP'}</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020610] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/40 via-blue-950/20 to-transparent blur-[120px] rounded-full" />
      </div>

      <header className="relative z-40 bg-[#030814] border-b border-cyan-950/80 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { soundFX.playPortal(); setActiveTab('home'); setActiveRoom(null); }}>
          <Crown className="w-6 h-6 text-cyan-300 animate-pulse" />
          <h1 className="text-xl font-black tracking-widest text-white uppercase font-serif">SHADOWVERSE</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-xl bg-[#0a1128] text-slate-400 hover:text-cyan-300">
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
          </button>
          <button onClick={() => logout()} className="p-2 rounded-xl bg-[#0a1128] text-slate-400 hover:text-rose-400"><LogOut className="w-4 h-4" /></button>
          <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="md:hidden p-2 text-slate-300"><Menu className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden z-10">
        <aside className={`w-64 bg-[#050b18]/95 border-r border-cyan-900/40 p-4 flex flex-col shrink-0 ${mobileNavOpen ? 'fixed inset-y-14 left-0 z-30' : 'hidden md:flex'}`}>
          <div className="space-y-1">
            {[
              { id: 'home', label: 'Home', icon: Flame },
              { id: 'games', label: 'Discover Games', icon: Gamepad2 },
              { id: 'study', label: 'Study Together', icon: BookOpen },
            ].map(tab => (
              <button key={tab.id} onClick={() => { soundFX.playClick(); setActiveTab(tab.id); setActiveRoom(null); setMobileNavOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold ${activeTab === tab.id ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50' : 'text-slate-400 hover:text-white'}`}>
                <tab.icon className="w-4 h-4" /><span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            <button onClick={() => setCreateRoomOpen(true)} className="w-full flex items-center px-3 py-2 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-300 font-bold"><Plus className="w-3.5 h-3.5 mr-2" /> Create Room</button>
            <button onClick={() => setJoinRoomOpen(true)} className="w-full flex items-center px-3 py-2 rounded-xl bg-black border border-cyan-900/50 text-xs text-slate-300 font-bold"><Hash className="w-3.5 h-3.5 mr-2 text-cyan-400" /> Join with Code</button>
          </div>

          <div className="mt-auto p-3 rounded-2xl bg-[#070e20] border border-cyan-900/40 flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-700 flex items-center justify-center text-sm">{user.avatar}</div>
            <div><div className="text-xs font-bold text-white">{user.name}</div><span className="text-[9px] text-cyan-400 font-mono">Online</span></div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6">
          {activeRoom ? (
            <SocialRoomWorkspace room={activeRoom} user={user} onLeave={handleLeaveRoom} onDelete={handleDeleteRoom} />
          ) : (
            <>
              {activeTab === 'home' && (
                <div className="space-y-6">
                  <div className="rounded-3xl bg-[#0a142e] border border-cyan-500/30 p-6 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                      <h2 className="text-2xl font-black text-white">SOCIAL GAMING SANCTUARY</h2>
                      <p className="text-slate-300 text-xs mt-1">Welcome back, {user.name}</p>
                    </div>
                    <button onClick={() => setCreateRoomOpen(true)} className="px-5 py-2.5 rounded-full bg-white text-black font-extrabold text-xs">Create Room</button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center space-x-2"><Radio className="w-4 h-4 text-cyan-400 animate-pulse" /><span>Active Public Rooms</span></h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rooms.filter(r => !r.isPrivate).map((room: any) => (
                        <div key={room.id} className="p-4 rounded-2xl bg-[#070e20] border border-cyan-900/40 flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-white text-sm">{room.name}</h4>
                            <div className="text-xs text-cyan-400 font-mono mt-1">
                              {room.activityTitle} • Host: {room.host} • <span className="text-white">Code: {room.code}</span>
                            </div>
                          </div>
                          <button onClick={() => handleJoinRoom(room)} className="px-5 py-1.5 rounded-full bg-white text-black font-extrabold text-xs">ENTER</button>
                        </div>
                      ))}
                      {rooms.filter(r => !r.isPrivate).length === 0 && <p className="text-xs text-slate-500">No public rooms. Create one or join with a code!</p>}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'games' && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white">Discover Games</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {GAMES_CATALOG.map(game => (
                      <div key={game.id} className="p-5 rounded-2xl bg-[#070e20] border border-cyan-900/40 flex flex-col justify-between">
                        <div>
                          <game.icon className="w-6 h-6 text-cyan-400 mb-2" />
                          <h3 className="font-bold text-white">{game.title}</h3>
                          <p className="text-xs text-slate-400 mt-1">{game.desc}</p>
                        </div>
                        <button onClick={() => { setNewRoomActivity(game.id); setCreateRoomOpen(true); }} className="w-full mt-4 py-2 rounded-full bg-white text-black font-extrabold text-xs">PLAY NOW</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'study' && <StudyTogetherActivity />}
            </>
          )}
        </main>
      </div>

      {/* CREATE ROOM MODAL */}
      {createRoomOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#070e20] border border-cyan-900/60 rounded-3xl p-6 max-w-md w-full space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center"><Plus className="w-5 h-5 text-cyan-400 mr-2" /> Create Room</h3>
              <button onClick={() => setCreateRoomOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <input type="text" placeholder="Room Name" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} className="w-full bg-black border border-cyan-900/50 rounded-xl px-4 py-2.5 text-xs text-white focus:border-cyan-400 outline-none" />

              <div>
                <label className="text-xs text-cyan-300 font-mono mb-1 block">Select Game / Mode</label>
                <select value={newRoomActivity} onChange={(e) => setNewRoomActivity(e.target.value)} className="w-full bg-black border border-cyan-900/50 rounded-xl px-4 py-2.5 text-xs text-white focus:border-cyan-400 outline-none">
                  {GAMES_CATALOG.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                  <option value="study">Study Together</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-cyan-300 font-mono mb-1 block">Room Privacy</label>
                <div className="flex space-x-4 text-xs text-slate-300">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" checked={!isPrivate} onChange={() => setIsPrivate(false)} name="privacy" className="accent-cyan-500" />
                    <span>Public (Visible to all)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" checked={isPrivate} onChange={() => setIsPrivate(true)} name="privacy" className="accent-cyan-500" />
                    <span>Private (Code only)</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button type="submit" className="flex-1 py-3 rounded-full bg-white text-black font-extrabold text-xs">CREATE</button>
                <button type="button" onClick={() => setCreateRoomOpen(false)} className="py-3 px-5 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">CANCEL</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL */}
      {joinRoomOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#070e20] border border-cyan-900/60 rounded-3xl p-6 max-w-md w-full space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center"><Hash className="w-5 h-5 text-cyan-400 mr-2" /> Join with Code</h3>
              <button onClick={() => setJoinRoomOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <input type="text" placeholder="Enter Room Code (e.g., SHADOW1234)" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())} className="w-full bg-black border border-cyan-900/50 rounded-xl px-4 py-2.5 text-xs text-white uppercase tracking-widest focus:border-cyan-400 outline-none" required />
              {joinError && <p className="text-rose-400 text-xs">{joinError}</p>}
              <div className="flex space-x-3">
                <button type="submit" className="flex-1 py-3 rounded-full bg-white text-black font-extrabold text-xs">JOIN</button>
                <button type="button" onClick={() => setJoinRoomOpen(false)} className="py-3 px-5 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">CANCEL</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROOM CLOSED CUSTOM POPUP */}
      {roomClosedPopup && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#070e20] border-2 border-rose-900/60 rounded-3xl p-8 max-w-sm w-full text-center space-y-5 shadow-[0_0_50px_rgba(225,29,72,0.3)]">
            <div className="w-16 h-16 bg-rose-950/50 rounded-full flex items-center justify-center mx-auto border border-rose-600/50">
              <X className="w-8 h-8 text-rose-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Room Closed</h3>
              <p className="text-sm text-slate-400">This room has been closed by the host.</p>
            </div>
            <button
              onClick={() => setRoomClosedPopup(false)}
              className="w-full py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition-all shadow-lg shadow-rose-900/50"
            >
              OK, GO TO HOME
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MULTIPLAYER ROOM WORKSPACE
// ==========================================
function SocialRoomWorkspace({ room, user, onLeave, onDelete }: any) {
  const { messages, send } = useRoomMessages(room.id);
  const [chatInput, setChatInput] = useState('');
  const [scores, setScores] = useState<any>({});

  const isHost = room.hostId === user.uid;

  useEffect(() => {
    if (room.activity !== 'drawguess') return;
    const scoreRef = ref(rtdb, `drawguess/${room.id}/gameState/scores`);
    const unsub = onValue(scoreRef, (snap) => {
      setScores(snap.val() || {});
    });
    return () => unsub();
  }, [room.id, room.activity]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
      <div className="bg-[#070e20] border border-cyan-900/40 rounded-2xl p-4 space-y-4">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-white text-sm">{room.name}</h3>
          <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-1 rounded-md font-mono">{room.code}</span>
        </div>

        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-cyan-400 mb-2 uppercase tracking-wider">Members & Scores</h4>
          {room.players?.map((p: any, i: number) => (
            <div key={p.uid} className="p-2.5 rounded-xl bg-cyan-950/20 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="font-mono text-cyan-500 text-xs">{i + 1}.</span>
                <div>
                  <span className="font-bold text-white text-xs block">
                    {p.name} {p.uid === room.hostId && <span className="text-[9px] text-cyan-400 font-normal">(Host)</span>}
                  </span>
                </div>
              </div>
              {room.activity === 'drawguess' && (
                <span className="text-sm font-mono font-bold text-cyan-300">{scores[p.uid] || 0} pts</span>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={isHost ? onDelete : onLeave}
          className={`w-full py-2 mt-4 rounded-full border text-xs font-bold transition-all ${isHost
            ? 'bg-rose-950/40 border-rose-600 text-rose-300 hover:bg-rose-900/60'
            : 'bg-[#050b18] border-slate-600 text-slate-300 hover:bg-slate-800'
            }`}
        >
          {isHost ? 'DELETE ROOM' : 'LEAVE ROOM'}
        </button>
      </div>

      <div className="lg:col-span-3 space-y-4">
        <div className="bg-[#070e20] border border-cyan-900/50 rounded-2xl p-6 min-h-[300px]">
          {room.activity === 'drawguess' && <DrawingGuessGame room={room} user={user} send={send} />}
          {room.activity === 'tictactoe' && <TicTacToeGame room={room} user={user} />}
          {room.activity === 'ludo' && <LudoGameActivity room={room} user={user} />}
          {room.activity === 'study' && <StudyTogetherActivity roomId={room.id} user={user} />}
          {room.activity === 'chess' && <ChessGameActivity room={room} user={user} />}
          {room.activity === 'bomb' && <ShadowBombGame room={room} user={user} />}
          {room.activity === 'uno' && <ShadowUnoGame room={room} user={user} />}
          {room.activity === 'spy' && <ShadowSpyGame room={room} user={user} />}
          {room.activity === 'wordle' && <WordleBattleGame room={room} user={user} />}

        </div>

        <div className="bg-[#070e20] border border-cyan-900/40 rounded-2xl p-4 h-56 flex flex-col">
          <span className="text-xs font-bold text-cyan-300 pb-2 border-b border-cyan-900/30">Room Chat & Guesses</span>
          <div className="flex-1 overflow-y-auto space-y-1 py-2 text-xs">
            {messages.map((m: any) => {
              const isSystem = m.sender === 'Game';
              return (
                <div key={m.id} className={`p-1.5 rounded ${isSystem ? 'bg-green-900/30 border border-green-700/50 text-green-300' :
                  m.isCorrect ? 'bg-green-900/20 border border-green-800 text-green-400' :
                    'bg-cyan-950/30 text-slate-200'
                  }`}>
                  <strong className={isSystem || m.isCorrect ? 'text-green-400' : 'text-cyan-400'}>{m.sender}:</strong> {m.text}
                </div>
              );
            })}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (chatInput.trim()) { send(user, chatInput); setChatInput(''); } }} className="pt-2 flex space-x-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type message or guess here..." className="flex-1 bg-[#050b18] border border-cyan-900 rounded-lg px-3 py-1.5 text-xs text-white outline-none" />
            <button type="submit" className="px-3 py-1.5 bg-cyan-500 text-black font-bold rounded-lg text-xs">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}



function StudyTogetherActivity({ roomId, user }: { roomId?: string, user?: any }) {
  const [seconds, setSeconds] = useState(1500);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const timerRef = ref(rtdb, `studyTimers/${roomId}`);

    const unsub = onValue(timerRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setIsActive(data.isActive);
        if (data.isActive && data.endTime) {
          const remaining = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
          setSeconds(remaining);
        } else if (!data.isActive && data.remaining !== undefined) {
          setSeconds(data.remaining);
        }
      }
    });

    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    let interval: any = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const handleStartPause = () => {
    if (!roomId) return;
    soundFX.playClick();
    const timerRef = ref(rtdb, `studyTimers/${roomId}`);

    if (isActive) {
      set(timerRef, { isActive: false, remaining: seconds });
    } else {
      set(timerRef, { isActive: true, endTime: Date.now() + (seconds * 1000) });
    }
  };

  const handleReset = () => {
    if (!roomId) return;
    soundFX.playClick();
    const timerRef = ref(rtdb, `studyTimers/${roomId}`);
    set(timerRef, { isActive: false, remaining: 1500 });
  };

  const formatTime = (sec: number) => `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;

  return (
    <div className="bg-black border border-cyan-900/40 rounded-2xl p-6 text-center space-y-4 max-w-sm mx-auto">
      <span className="text-xs font-mono text-cyan-400 block">POMODORO TIMER</span>
      <div className="text-5xl font-black font-mono text-white">{formatTime(seconds)}</div>
      <div className="flex justify-center space-x-3">
        <button onClick={handleStartPause} className="px-6 py-2 rounded-full bg-white text-black font-extrabold text-xs">
          {isActive ? 'PAUSE' : 'START'}
        </button>
        <button onClick={handleReset} className="px-4 py-2 rounded-full bg-[#050b18] border border-slate-600 text-slate-300 text-xs font-bold">
          RESET
        </button>
      </div>
    </div>
  );
}

function DrawingGuessGame({ room, user, send }: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#00f0ff');
  const [lineWidth, setLineWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState<string>('');
  const [currentDrawer, setCurrentDrawer] = useState<string>('');
  const [isChoosingWord, setIsChoosingWord] = useState<boolean>(false);
  const [guessedPlayers, setGuessedPlayers] = useState<string[]>([]);
  const [roundEnded, setRoundEnded] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState(60);

  const lastPos = useRef<{ x: number, y: number } | null>(null);
  const drawing = useRef(false);
  const seen = useRef(new Set());

  const colors = [
    '#000000', '#ffffff', '#00f0ff', '#3b82f6', '#ef4444', '#eab308', '#10b981',
    '#f97316', '#8b5cf6', '#ec4899', '#78350f', '#06b6d4', '#14b8a6', '#6366f1',
    '#d946ef', '#f43f5e', '#84cc16', '#71717a', '#a16207', '#0369a1'
  ];

  const players = room.players || [];
  const isDrawer = user.uid === currentDrawer;

  // 1. Game State Sync
  useEffect(() => {
    if (players.length < 2) return;

    const gameRef = ref(rtdb, `drawguess/${room.id}/gameState`);
    const unsub = onValue(gameRef, (snap) => {
      const data = snap.val();
      if (!data || data.roundState === 'waiting') {
        set(gameRef, {
          turnIndex: 0,
          currentDrawer: players[0].uid,
          scores: players.reduce((acc: any, p: any) => ({ ...acc, [p.uid]: 0 }), {}),
          roundState: 'starting'
        });
        send({ name: 'Game' }, `🎮 Round 1 is starting! ${players[0].name} is choosing a word...`);
      } else {
        setCurrentDrawer(data.currentDrawer);

        if (data.roundState === 'starting' || data.roundState === 'choosing') {
          setCurrentWord('');
          setRoundEnded(false);
          setGuessedPlayers([]);
          setTimeLeft(60);
          setIsChoosingWord(false);
          clearCanvas();
        } else if (data.roundState === 'drawing') {
          setCurrentWord(data.currentWord);
          setRoundEnded(false);
          setIsChoosingWord(false);
        } else if (data.roundState === 'ended') {
          setRoundEnded(true);
          setCurrentWord('');
        }
      }
    });
    return () => unsub();
  }, [room.id, players.length]);

  // 2. Word Generation (Only for Drawer)
  useEffect(() => {
    if (isDrawer && !currentWord && !roundEnded && !isChoosingWord && players.length >= 2) {
      const shuffled = [...WORDS].sort(() => 0.5 - Math.random());
      setWordOptions(shuffled.slice(0, 3));
      setIsChoosingWord(true);
    } else if (!isDrawer) {
      setIsChoosingWord(false);
    }
  }, [isDrawer, currentWord, roundEnded, players.length]);

  const selectWord = (word: string) => {
    setCurrentWord(word);
    setIsChoosingWord(false);
    const gameRef = ref(rtdb, `drawguess/${room.id}/gameState`);

    remove(ref(rtdb, `drawguess/${room.id}/canvas`));
    clearCanvas();

    // ✅ 2. Update instead of Set (Scores preserve)
    void update(gameRef, {
      currentDrawer,
      currentWord: word,
      roundState: 'drawing',
      timeLeft: 60,
    }).catch(console.error);
  };

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    seen.current.clear();
  };

  // 3. Timer
  useEffect(() => {
    if (currentWord && !roundEnded) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            if (isDrawer) endRound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentWord, roundEnded, isDrawer]);

  // 4. End Round & Next Turn
  const endRound = () => {
    if (roundEnded) return;
    setRoundEnded(true);

    const gameRef = ref(rtdb, `drawguess/${room.id}/gameState`);

    // ✅ 3. Update instead of Set (Scores preserve)
    void update(gameRef, {
      currentDrawer,
      currentWord: '',
      roundState: 'ended',
    }).catch(console.error);

    setTimeout(() => {
      const currentIndex = players.findIndex((p: any) => p.uid === currentDrawer);
      const nextIndex = (currentIndex + 1) % players.length;
      void update(gameRef, {
        currentDrawer: players[nextIndex].uid,
        roundState: 'choosing',
        turnIndex: nextIndex,
      }).catch(console.error);
    }, 1500);
  };

  // 5. Canvas Sync
  useEffect(() => {
    if (!canvasRef.current) return;
    const strokesRef = ref(rtdb, `drawguess/${room.id}/canvas`);
    const unsub = onChildAdded(strokesRef, (snap) => {
      const s = snap.val();
      if (s.by === user.uid || seen.current.has(snap.key)) return;
      seen.current.add(snap.key);
      const ctx = canvasRef.current!.getContext('2d');
      if (!ctx) return;
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y); ctx.stroke();
    });
    return () => unsub();
  }, [room.id, user.uid]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: (cx - r.left) * (c.width / r.width), y: (cy - r.top) * (c.height / r.height) };
  };

  const start = (e: any) => {
    if (!isDrawer || !currentWord) return;
    e.preventDefault(); drawing.current = true; lastPos.current = getPos(e);
  };

  const move = (e: any) => {
    if (!isDrawer || !drawing.current || !lastPos.current) return;
    e.preventDefault();
    const to = getPos(e);

    const drawColor = isEraser ? '#000000' : color;
    const drawWidth = isEraser ? lineWidth * 4 : lineWidth;

    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.strokeStyle = drawColor; ctx.lineWidth = drawWidth; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(to.x, to.y); ctx.stroke();

    const strokeRef = push(ref(rtdb, `drawguess/${room.id}/canvas`));
    seen.current.add(strokeRef.key!);
    set(strokeRef, { from: lastPos.current, to, color: drawColor, width: drawWidth, by: user.uid });

    lastPos.current = to;
  };
  const end = () => { drawing.current = false; lastPos.current = null; };

  // 6. Listen to Room Chat for Guesses (Time-Based Scoring)
  const { messages, markCorrect } = useRoomMessages(room.id);
  const processedGuesses = useRef(new Set<string>());

  useEffect(() => {
    if (!isDrawer || !currentWord || roundEnded) return;

    const latestMsg = messages[messages.length - 1];

    if (
      !latestMsg ||
      latestMsg.sender === 'Game' ||
      latestMsg.senderId === currentDrawer ||
      processedGuesses.current.has(latestMsg.id)
    ) {
      return;
    }

    const guess = String(latestMsg.text ?? '').trim().toLowerCase();
    const word = currentWord.trim().toLowerCase();

    if (!guess || guess !== word) return;

    processedGuesses.current.add(latestMsg.id);

    setGuessedPlayers(prev =>
      prev.includes(latestMsg.senderId)
        ? prev
        : [...prev, latestMsg.senderId]
    );

    void markCorrect(latestMsg.id).catch(console.error);

    const pointsEarned = Math.max(1, Math.floor((timeLeft / 60) * 100));

    void send(
      { name: 'Game' },
      `🎉 ${latestMsg.sender} guessed the word! +${pointsEarned} pts`
    ).catch(console.error);

    // ✅ 4. RunTransaction (Atomic update for points)
    const scoreRef = ref(
      rtdb,
      `drawguess/${room.id}/gameState/scores/${latestMsg.senderId}`
    );

    void runTransaction(scoreRef, (currentScore) => {
      return (Number(currentScore) || 0) + pointsEarned;
    }).catch(console.error);

    if (guessedPlayers.length + 1 >= players.length - 1) {
      endRound();
    }
  }, [messages, currentWord, isDrawer, roundEnded, guessedPlayers, players.length, room.id, currentDrawer, markCorrect, send, timeLeft]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3 space-y-4">
        {/* Header */}
        <div className="bg-[#070e20] border border-cyan-900/40 rounded-xl p-3 flex justify-between items-center">
          <div>
            {players.length < 2 ? (
              <span className="text-rose-400 font-bold text-sm">Waiting for players to join...</span>
            ) : isDrawer ? (
              <span className="text-cyan-300 font-bold text-sm">
                You are drawing: <span className="text-white bg-cyan-950 px-2 py-1 rounded">{currentWord || "Wait..."}</span>
              </span>
            ) : (
              <span className="text-slate-300 font-bold text-sm">
                {players.find((p: any) => p.uid === currentDrawer)?.name} is drawing...
              </span>
            )}
          </div>
          <div className="text-xl font-mono font-bold text-rose-400">{timeLeft}s</div>
        </div>

        {/* Word Selection */}
        {isChoosingWord && (
          <div className="bg-[#0a142e] border border-cyan-500/30 p-6 rounded-2xl flex flex-col items-center space-y-4">
            <h3 className="text-white font-bold">Choose a Word:</h3>
            <div className="flex space-x-4">
              {wordOptions.map((w, i) => (
                <button key={i} onClick={() => selectWord(w)} className="px-6 py-3 bg-white text-black font-extrabold rounded-xl hover:bg-cyan-400">
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        {!isChoosingWord && (
          <div className="space-y-2">
            <canvas
              ref={canvasRef} width={600} height={400}
              onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
              onTouchStart={start} onTouchMove={move} onTouchEnd={end}
              className={`w-full h-[320px] bg-black border border-cyan-900/60 rounded-2xl touch-none ${isDrawer ? 'cursor-crosshair' : ''}`}
            />

            {/* Drawer Tools */}
            {isDrawer && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {colors.map(c => (
                    <button
                      key={c}
                      onClick={() => { setColor(c); setIsEraser(false); }}
                      className={`w-6 h-6 rounded-full border ${color === c && !isEraser ? 'border-white scale-125' : 'border-slate-700'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => setIsEraser(true)} className={`px-3 py-1 text-xs rounded ${isEraser ? 'bg-white text-black font-bold' : 'bg-cyan-950 text-cyan-300'}`}>Eraser</button>
                  <button onClick={() => { setIsEraser(false); setColor('#00f0ff'); }} className={`px-3 py-1 text-xs rounded ${!isEraser ? 'bg-white text-black font-bold' : 'bg-cyan-950 text-cyan-300'}`}>Pen</button>

                  <div className="flex items-center space-x-2 bg-cyan-950 px-3 py-1 rounded ml-2">
                    <button onClick={() => setLineWidth(Math.max(1, lineWidth - 2))} className="text-cyan-300 font-bold text-lg leading-none">-</button>
                    <span className="text-xs text-white font-mono">{lineWidth}px</span>
                    <button onClick={() => setLineWidth(Math.min(20, lineWidth + 2))} className="text-cyan-300 font-bold text-lg leading-none">+</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


type LudoPlayer = { uid: string; name: string };

type LudoState = {
  playerIds: string[];
  seats: number[];
  turnIndex: number;
  positions: Record<string, number[]>;
  lastRoll: number;
  winner: string;
  status: 'playing' | 'finished';
};

type LudoFx = { id: number; r: number; c: number; text: string; color: string };

const HOME = -1;
const TRACK_LAST = 50;
const LANE_START = 51;
const FINISH = 56;
const TRACK_LENGTH = 52;
const SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

const SEAT_LAYOUT: Record<number, number[]> = {
  2: [0, 2],
  3: [0, 1, 2],
  4: [0, 1, 2, 3],
};

const PLAYER_COLORS = [
  { name: 'Red', main: '#ef4444', light: '#fecaca' },
  { name: 'Green', main: '#22c55e', light: '#bbf7d0' },
  { name: 'Yellow', main: '#facc15', light: '#fef08a' },
  { name: 'Blue', main: '#3b82f6', light: '#bfdbfe' },
];

const TRACK: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
];

const START_OFFSETS = [0, 13, 26, 39];

const HOME_LANES: [number, number][][] = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];

const HOME_BASES: [number, number][][] = [
  [[1, 1], [1, 4], [4, 1], [4, 4]],
  [[1, 10], [1, 13], [4, 10], [4, 13]],
  [[10, 10], [10, 13], [13, 10], [13, 13]],
  [[10, 1], [10, 4], [13, 1], [13, 4]],
];

// Corner zone (left%, top%) har seat ke liye — turn glow ke liye
const SEAT_ZONES = [
  { left: 0, top: 0 },
  { left: 60, top: 0 },
  { left: 60, top: 60 },
  { left: 0, top: 60 },
];

const LUDO_CSS = `
@keyframes ludoHop { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-55%) scale(1.18); } }
@keyframes ludoPulseRing { 0% { box-shadow: 0 0 0 0 rgba(0,0,0,.75), 0 2px 4px rgba(0,0,0,.4); } 100% { box-shadow: 0 0 0 10px rgba(0,0,0,0), 0 2px 4px rgba(0,0,0,.4); } }
@keyframes ludoFloat { 0% { opacity: 0; transform: translate(-50%, 0) scale(.6); } 20% { opacity: 1; transform: translate(-50%, -60%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -260%) scale(1); } }
@keyframes ludoBurst { 0% { transform: translate(-50%, -50%) scale(.2); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(3.4); opacity: 0; } }
@keyframes ludoTwinkle { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
@keyframes ludoTurnZone { 0%,100% { box-shadow: inset 0 0 0 0 currentColor; } 50% { box-shadow: inset 0 0 26px 7px currentColor; } }
@keyframes ludoShimmer { 0%,100% { filter: brightness(1) saturate(1); } 50% { filter: brightness(1.25) saturate(1.25); } }
@keyframes ludoConfetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }
@keyframes ludoBanner { 0% { transform: scale(.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes ludoThrow { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-46px) scale(1.18); } 60% { transform: translateY(0) scale(1); } 76% { transform: translateY(-14px) scale(1.04); } 100% { transform: translateY(0) scale(1); } }
@keyframes ludoWin { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }

.ludo-token-body { display:flex; align-items:center; justify-content:center; width:100%; height:100%; border-radius:9999px; border:2px solid #fff; color:#fff; font-weight:900; font-size:clamp(6px,1.5vw,13px); box-shadow:0 2px 4px rgba(0,0,0,.45), inset 0 -3px 5px rgba(0,0,0,.25); }
.ludo-hop { animation: ludoHop .16s ease-in-out infinite; }
.ludo-movable { animation: ludoPulseRing 1s ease-out infinite; outline: 2px solid #000; }
.ludo-burst { position:absolute; left:0; top:0; width:24px; height:24px; border:3px solid; border-radius:9999px; animation: ludoBurst .8s ease-out forwards; }
.ludo-float { position:absolute; left:0; top:0; white-space:nowrap; font-weight:900; font-size:12px; text-shadow:0 1px 2px #000, 0 0 6px #fff; animation: ludoFloat 1.1s ease-out forwards; }
.ludo-star { animation: ludoTwinkle 1.8s ease-in-out infinite; }
.ludo-turn-zone { position:absolute; width:40%; height:40%; border-radius:12px; animation: ludoTurnZone 1.4s ease-in-out infinite; }
.ludo-pinwheel { position:absolute; left:40%; top:40%; width:20%; height:20%; animation: ludoShimmer 2.6s ease-in-out infinite; }
.ludo-banner { animation: ludoBanner .35s ease-out; }
.ludo-win { animation: ludoWin 1.2s ease-in-out infinite; }

.ludo-scene { width:84px; height:84px; perspective:420px; margin:0 auto; }
.ludo-throw { animation: ludoThrow 1s ease-out; }
.ludo-cube { position:relative; width:100%; height:100%; transform-style:preserve-3d; transition: transform 1s cubic-bezier(.2,.8,.2,1); }
.ludo-face { position:absolute; inset:0; border-radius:16%; background:linear-gradient(145deg,#ffffff,#cbd5e1); box-shadow: inset 0 0 8px rgba(0,0,0,.25); display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr); padding:13%; gap:4%; }
.ludo-pip { background:#0f172a; border-radius:9999px; box-shadow: inset 0 -2px 3px rgba(255,255,255,.2); }
.ludo-f1 .ludo-pip { background:#ef4444; }
.ludo-f1 { transform: translateZ(42px); }
.ludo-f6 { transform: rotateY(180deg) translateZ(42px); }
.ludo-f2 { transform: rotateY(90deg) translateZ(42px); }
.ludo-f5 { transform: rotateY(-90deg) translateZ(42px); }
.ludo-f3 { transform: rotateX(90deg) translateZ(42px); }
.ludo-f4 { transform: rotateX(-90deg) translateZ(42px); }
`;

const FACE_BASE: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  2: [0, -90],
  5: [0, 90],
  3: [-90, 0],
  4: [90, 0],
};

const PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

function createLudoState(players: LudoPlayer[]): LudoState {
  const positions: Record<string, number[]> = {};
  players.forEach((p) => {
    positions[p.uid] = [HOME, HOME, HOME, HOME];
  });
  return {
    playerIds: players.map((p) => p.uid),
    seats: SEAT_LAYOUT[players.length] || players.map((_, i) => i),
    turnIndex: 0,
    positions,
    lastRoll: 0,
    winner: '',
    status: 'playing',
  };
}

function normalizeGame(d: any): LudoState {
  const playerIds: string[] = d.playerIds || [];
  return {
    playerIds,
    seats: d.seats || SEAT_LAYOUT[playerIds.length] || playerIds.map((_, i) => i),
    turnIndex: d.turnIndex || 0,
    positions: d.positions || {},
    lastRoll: d.lastRoll || 0,
    winner: d.winner || '',
    status: d.status || 'playing',
  };
}

function getTrackIndex(seat: number, progress: number) {
  return (START_OFFSETS[seat] + progress) % TRACK_LENGTH;
}

function getTokenCoordinate(seat: number, progress: number): [number, number] | null {
  if (progress < 0 || progress >= FINISH) return null;
  if (progress <= TRACK_LAST) return TRACK[getTrackIndex(seat, progress)];
  return HOME_LANES[seat][progress - LANE_START];
}

function getLudoValidMoves(positions: number[], roll: number): number[] {
  return positions
    .map((position, index) => ({ position, index }))
    .filter(({ position }) => {
      if (position === HOME) return roll === 6;
      if (position === FINISH) return false;
      return position + roll <= FINISH;
    })
    .map(({ index }) => index);
}

// ==========================================
// 3D DICE
// ==========================================
function DiceCube({ val, n, throwing }: { val: number; n: number; throwing: boolean }) {
  const [bx, by] = FACE_BASE[val] || [0, 0];
  const x = bx + 720 * n;
  const y = by + 1080 * n;

  return (
    <div className={`ludo-scene ${throwing ? 'ludo-throw' : ''}`}>
      <div className="ludo-cube" style={{ transform: `rotateX(${x}deg) rotateY(${y}deg)` }}>
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <div key={f} className={`ludo-face ludo-f${f}`}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={PIPS[f].includes(i + 1) ? 'ludo-pip' : ''} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// CONFETTI
// ==========================================
function LudoConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        dur: 2.5 + Math.random() * 2,
        size: 6 + Math.random() * 8,
        color: ['#ef4444', '#22c55e', '#facc15', '#3b82f6', '#ec4899', '#22d3ee'][i % 6],
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: 2,
            opacity: 0,
            animation: `ludoConfetti ${p.dur}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ==========================================
// BOARD
// ==========================================
function LudoBoard({
  players,
  game,
  user,
  onMove,
}: {
  players: LudoPlayer[];
  game: LudoState;
  user: any;
  onMove: (tokenIndex: number) => void;
}) {
  const currentUid = game.playerIds[game.turnIndex];
  const myTurn = currentUid === user.uid;
  const currentSeat = game.winner ? -1 : game.seats[game.turnIndex] ?? -1;

  const validMoves =
    myTurn && game.lastRoll > 0
      ? getLudoValidMoves(game.positions[user.uid] || [HOME, HOME, HOME, HOME], game.lastRoll)
      : [];

  const nameOf = (uid: string) => players.find((p) => p.uid === uid)?.name || 'Player';

  // Sab tokens ki actual (Firebase) position
  const entries: { key: string; uid: string; seat: number; ti: number }[] = [];
  const target: Record<string, number> = {};
  const seatOf: Record<string, number> = {};

  game.playerIds.forEach((uid, pi) => {
    const seat = game.seats[pi] ?? pi;
    (game.positions[uid] || []).forEach((pos, ti) => {
      const key = `${uid}-${ti}`;
      entries.push({ key, uid, seat, ti });
      target[key] = pos;
      seatOf[key] = seat;
    });
  });

  // "shown" = screen par dikhne wali position (square by square target tak jaati hai)
  const [shown, setShown] = useState<Record<string, number>>(() => ({ ...target }));
  const shownRef = useRef(shown);
  const [fx, setFx] = useState<LudoFx[]>([]);
  const fxId = useRef(0);

  const pushFx = (r: number, c: number, text: string, color: string) => {
    const id = ++fxId.current;
    setFx((list) => [...list, { id, r, c, text, color }]);
    window.setTimeout(() => setFx((list) => list.filter((f) => f.id !== id)), 1100);
  };

  const targetKey = JSON.stringify(target);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const cur = shownRef.current;
      const next = { ...cur };
      let forward = false;
      let back = false;
      let filled = false;

      Object.keys(target).forEach((k) => {
        if (next[k] === undefined) {
          next[k] = target[k];
          filled = true;
          return;
        }
        if (next[k] < target[k]) {
          next[k] += 1;
          forward = true;
        }
      });

      // Kata hua token tab wapas jaata hai jab koi token aage chal nahi raha
      if (!forward) {
        Object.keys(target).forEach((k) => {
          if (next[k] > target[k]) {
            if (target[k] === HOME && next[k] >= 0 && next[k] <= TRACK_LAST) {
              const co = getTokenCoordinate(seatOf[k], next[k]);
              if (co) pushFx(co[0], co[1], '💥 CUT!', PLAYER_COLORS[seatOf[k]].main);
            }
            next[k] = target[k];
            back = true;
          }
        });
      }

      Object.keys(target).forEach((k) => {
        if (next[k] === FINISH && cur[k] !== FINISH) {
          pushFx(7, 7, '⭐ HOME!', PLAYER_COLORS[seatOf[k]].main);
          soundFX.playPortal();
        }
      });

      if (forward) soundFX.playClick();
      if (back) soundFX.playPortal();

      if (forward || back || filled) {
        shownRef.current = next;
        setShown(next);
      } else {
        window.clearInterval(tick);
      }
    }, 160);

    return () => window.clearInterval(tick);
  }, [targetKey]);

  const rendered = entries
    .map((e) => {
      const pos = shown[e.key] ?? target[e.key];
      const coord = pos === HOME ? HOME_BASES[e.seat][e.ti] : getTokenCoordinate(e.seat, pos);
      return { ...e, pos, coord, moving: pos !== target[e.key] };
    })
    .filter((e) => e.coord);

  const finishedSeats = entries
    .filter((e) => (shown[e.key] ?? target[e.key]) === FINISH)
    .map((e) => e.seat);

  const groupSize: Record<string, number> = {};
  rendered.forEach((e) => {
    const gk = `${e.coord![0]},${e.coord![1]}`;
    groupSize[gk] = (groupSize[gk] || 0) + 1;
  });
  const groupSeen: Record<string, number> = {};

  const cellBackground = (r: number, c: number) => {
    if (r < 6 && c < 6) return PLAYER_COLORS[0].light;
    if (r < 6 && c > 8) return PLAYER_COLORS[1].light;
    if (r > 8 && c > 8) return PLAYER_COLORS[2].light;
    if (r > 8 && c < 6) return PLAYER_COLORS[3].light;

    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return '#e2e8f0';

    for (let pi = 0; pi < 4; pi++) {
      if (HOME_LANES[pi].some(([rr, cc]) => rr === r && cc === c)) return PLAYER_COLORS[pi].light;
    }

    const trackIndex = TRACK.findIndex(([rr, cc]) => rr === r && cc === c);
    if (trackIndex !== -1) {
      const owner = START_OFFSETS.indexOf(trackIndex);
      if (owner !== -1) return PLAYER_COLORS[owner].main;
      if (SAFE_SQUARES.includes(trackIndex)) return '#bfdbfe';
    }
    return '#f8fafc';
  };

  return (
    <div className="mx-auto w-full max-w-[560px] rounded-2xl border-4 border-slate-600 bg-white p-1 shadow-2xl">
      <div className="relative aspect-square overflow-hidden">
        {/* Grid cells */}
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: 'repeat(15, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(15, minmax(0, 1fr))',
          }}
        >
          {Array.from({ length: 225 }, (_, index) => {
            const r = Math.floor(index / 15);
            const c = index % 15;
            const ti = TRACK.findIndex(([rr, cc]) => rr === r && cc === c);
            const isSafe = ti !== -1 && SAFE_SQUARES.includes(ti);

            return (
              <div
                key={index}
                className="flex min-h-0 min-w-0 items-center justify-center border-[0.5px] border-slate-300"
                style={{ backgroundColor: cellBackground(r, c) }}
              >
                {isSafe && (
                  <span className="ludo-star text-[clamp(5px,1.4vw,12px)] text-slate-600">★</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Overlay: glow, centre, tokens, effects */}
        <div className="pointer-events-none absolute inset-0">
          {currentSeat >= 0 && (
            <div
              className="ludo-turn-zone"
              style={{
                left: `${SEAT_ZONES[currentSeat].left}%`,
                top: `${SEAT_ZONES[currentSeat].top}%`,
                color: PLAYER_COLORS[currentSeat].main,
              }}
            />
          )}

          <div
            className="ludo-pinwheel flex items-center justify-center"
            style={{
              background: `conic-gradient(from -45deg, ${PLAYER_COLORS[1].main} 0 25%, ${PLAYER_COLORS[2].main} 0 50%, ${PLAYER_COLORS[3].main} 0 75%, ${PLAYER_COLORS[0].main} 0 100%)`,
            }}
          >
            {finishedSeats.length === 0 ? (
              <span className="text-[clamp(10px,3vw,26px)] drop-shadow">🏆</span>
            ) : (
              <div className="flex max-w-[70%] flex-wrap items-center justify-center gap-[2px] rounded-full bg-black/55 p-[3px]">
                {finishedSeats.map((seat, i) => (
                  <span
                    key={i}
                    className="h-[6px] w-[6px] rounded-full border border-white sm:h-2.5 sm:w-2.5"
                    style={{ backgroundColor: PLAYER_COLORS[seat].main }}
                  />
                ))}
              </div>
            )}
          </div>

          {rendered.map(({ key, uid, seat, ti, coord, moving }) => {
            const [r, c] = coord!;
            const gk = `${r},${c}`;
            const n = groupSize[gk];
            const idx = groupSeen[gk] || 0;
            groupSeen[gk] = idx + 1;

            const dx = n === 1 ? 0 : (idx % 2) * 70 - 35;
            const dy = n <= 2 ? 0 : Math.floor(idx / 2) * 70 - 35;
            const size = (100 / 15) * (n > 1 ? 0.62 : 0.8);
            const canMove = uid === user.uid && validMoves.includes(ti);

            return (
              <button
                key={key}
                title={`${nameOf(uid)} — Token ${ti + 1}`}
                disabled={!canMove}
                onClick={() => onMove(ti)}
                className={`pointer-events-auto absolute p-0 ${canMove ? 'cursor-pointer' : 'cursor-default'}`}
                style={{
                  left: `${((c + 0.5) / 15) * 100}%`,
                  top: `${((r + 0.5) / 15) * 100}%`,
                  width: `${size}%`,
                  height: `${size}%`,
                  transform: `translate(${-50 + dx}%, ${-50 + dy}%)`,
                  transition: 'left .16s linear, top .16s linear, width .2s, height .2s',
                  zIndex: canMove ? 30 : moving ? 25 : 10,
                }}
              >
                <span
                  className={`ludo-token-body ${moving ? 'ludo-hop' : ''} ${canMove ? 'ludo-movable' : ''}`}
                  style={{
                    background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.65), transparent 45%), ${PLAYER_COLORS[seat].main}`,
                  }}
                >
                  {ti + 1}
                </span>
              </button>
            );
          })}

          {fx.map((f) => (
            <div
              key={f.id}
              className="absolute z-40"
              style={{
                left: `${((f.c + 0.5) / 15) * 100}%`,
                top: `${((f.r + 0.5) / 15) * 100}%`,
              }}
            >
              <span className="ludo-burst" style={{ borderColor: f.color }} />
              <span className="ludo-float" style={{ color: f.color }}>
                {f.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// GAME
// ==========================================
export function LudoGameActivity({ room, user }: any) {
  const roomPlayers: LudoPlayer[] = (room.players || [])
    .filter((p: any) => Boolean(p.uid))
    .slice(0, 4);

  const gamePath = `ludo/${room.id}/gameState`;
  const isHost = room.hostId === user.uid;

  const [game, setGame] = useState<LudoState | null>(null);
  const [dice, setDice] = useState({ val: 1, n: 0 });
  const [throwing, setThrowing] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Roll the dice to begin.');

  const playersRef = useRef<LudoPlayer[]>(roomPlayers);
  playersRef.current = roomPlayers;

  const localRoll = useRef(false);
  const prevRoll = useRef(0);
  const rollTimeout = useRef<number | null>(null);
  const throwTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rollTimeout.current) window.clearTimeout(rollTimeout.current);
      if (throwTimeout.current) window.clearTimeout(throwTimeout.current);
    };
  }, []);

  // Dice animation (khud ke roll par bhi, doosron ke roll par bhi)
  const triggerDice = (val: number) => {
    setDice((d) => ({ val, n: d.n + 1 }));
    setThrowing(true);
    if (throwTimeout.current) window.clearTimeout(throwTimeout.current);
    throwTimeout.current = window.setTimeout(() => setThrowing(false), 1000);
    [0, 180, 360, 540, 720].forEach((t) => window.setTimeout(() => soundFX.playClick(), t));
  };

  const canStart = roomPlayers.length >= 2;
  const playerKey = roomPlayers.map((p) => p.uid).join('|');

  // 1. Firebase sync
  useEffect(() => {
    if (!canStart) {
      setGame(null);
      return;
    }
    const gameRef = ref(rtdb, gamePath);

    const unsubscribe = onValue(
      gameRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const g = normalizeGame(data);
          setGame(g);

          // Doosre player ka roll: sabko dice animation dikhao
          if (g.lastRoll > 0 && prevRoll.current === 0 && !localRoll.current) {
            triggerDice(g.lastRoll);
          }
          prevRoll.current = g.lastRoll;
          return;
        }
        void runTransaction(gameRef, (current) => current ?? createLudoState(playersRef.current)).catch(
          (error) => {
            console.error('Ludo initialization failed:', error);
            setMessage('Game could not start. Check Firebase Database rules.');
          }
        );
      },
      (error) => {
        console.error('Ludo sync failed:', error);
        setMessage('Database connection failed.');
      }
    );

    return () => unsubscribe();
  }, [gamePath, canStart]);

  // 2. Current turn wala player room chhod de to turn aage badhao
  useEffect(() => {
    if (!game || game.winner) return;
    const turnUid = game.playerIds[game.turnIndex];
    if (roomPlayers.some((p) => p.uid === turnUid)) return;

    const firstPresent = game.playerIds.find((id) => roomPlayers.some((p) => p.uid === id));
    if (firstPresent !== user.uid) return;

    void runTransaction(ref(rtdb, gamePath), (current) => {
      if (!current || current.winner) return;
      if (current.playerIds?.[current.turnIndex] !== turnUid) return;
      return {
        ...current,
        lastRoll: 0,
        turnIndex: (current.turnIndex + 1) % current.playerIds.length,
      };
    }).catch(console.error);
  }, [game, playerKey]);

  // 3. Winner sound
  useEffect(() => {
    if (game?.winner) soundFX.playPortal();
  }, [game?.winner]);

  const currentUid = game?.playerIds?.[game.turnIndex];
  const myTurn = currentUid === user.uid;
  const inGame = !!game && game.playerIds.includes(user.uid);

  // 4. Dice roll (pehle animation, 1 sec baad result Firebase mein)
  const rollDice = () => {
    if (!game || !myTurn || game.status !== 'playing' || game.lastRoll > 0 || busy || game.winner) return;

    setBusy(true);
    setRolling(true);
    localRoll.current = true;
    setMessage('Rolling dice...');

    const roll = Math.floor(Math.random() * 6) + 1;
    triggerDice(roll);

    rollTimeout.current = window.setTimeout(() => {
      setRolling(false);

      void runTransaction(ref(rtdb, gamePath), (current) => {
        if (
          !current ||
          current.winner ||
          current.status !== 'playing' ||
          current.playerIds?.[current.turnIndex] !== user.uid ||
          current.lastRoll > 0
        ) {
          return;
        }

        const mine: number[] = current.positions?.[user.uid] || [HOME, HOME, HOME, HOME];
        const movable = getLudoValidMoves(mine, roll);

        if (movable.length === 0) {
          return {
            ...current,
            lastRoll: 0,
            turnIndex: (current.turnIndex + 1) % current.playerIds.length,
          };
        }

        return { ...current, lastRoll: roll };
      })
        .then((result) => {
          const next = result.snapshot.val();
          if (!result.committed || !next) {
            setMessage('Dice could not sync. Try again.');
            return;
          }
          if (!next.lastRoll) {
            setMessage(`You rolled ${roll}. No valid moves — turn passed.`);
          } else if (roll === 6) {
            setMessage('🎉 You rolled a 6! Select a token.');
          } else {
            setMessage(`You rolled ${roll}. Select a highlighted token.`);
          }
        })
        .catch((error) => {
          console.error(error);
          setMessage('Dice could not sync. Try again.');
        })
        .finally(() => {
          localRoll.current = false;
          setBusy(false);
        });
    }, 1000);
  };

  // 5. Token move + capture + win
  const moveToken = async (tokenIndex: number) => {
    if (!game || !myTurn || busy || game.lastRoll <= 0 || game.winner || game.status !== 'playing') return;

    const roll = game.lastRoll;
    const uid = user.uid;
    if (!game.playerIds.includes(uid)) return;

    const available = getLudoValidMoves(game.positions[uid] || [HOME, HOME, HOME, HOME], roll);
    if (!available.includes(tokenIndex)) {
      setMessage('That token cannot move with this roll.');
      return;
    }

    setBusy(true);

    try {
      const result = await runTransaction(ref(rtdb, gamePath), (current) => {
        if (
          !current ||
          current.winner ||
          current.status !== 'playing' ||
          current.playerIds?.[current.turnIndex] !== uid ||
          current.lastRoll !== roll
        ) {
          return;
        }

        const myIndex = current.playerIds.indexOf(uid);
        const mySeat: number = current.seats?.[myIndex] ?? myIndex;

        const positions: Record<string, number[]> = { ...current.positions };
        const mine = [...(positions[uid] || [HOME, HOME, HOME, HOME])];
        const oldPosition = mine[tokenIndex];

        if (oldPosition === HOME && roll !== 6) return;
        if (oldPosition === FINISH) return;
        if (oldPosition >= 0 && oldPosition + roll > FINISH) return;

        const newPosition = oldPosition === HOME ? 0 : oldPosition + roll;
        mine[tokenIndex] = newPosition;
        positions[uid] = mine;

        let captured = 0;
        if (newPosition >= 0 && newPosition <= TRACK_LAST) {
          const globalSquare = getTrackIndex(mySeat, newPosition);

          if (!SAFE_SQUARES.includes(globalSquare)) {
            current.playerIds.forEach((opponentUid: string, oi: number) => {
              if (opponentUid === uid) return;
              const opponentSeat: number = current.seats?.[oi] ?? oi;
              const theirs = [...(positions[opponentUid] || [HOME, HOME, HOME, HOME])];

              theirs.forEach((opPos, opTi) => {
                if (
                  opPos >= 0 &&
                  opPos <= TRACK_LAST &&
                  getTrackIndex(opponentSeat, opPos) === globalSquare
                ) {
                  theirs[opTi] = HOME;
                  captured++;
                }
              });
              positions[opponentUid] = theirs;
            });
          }
        }

        const won = mine.every((p) => p === FINISH);
        const extraTurn = roll === 6 || captured > 0 || newPosition === FINISH;

        return {
          ...current,
          positions,
          lastRoll: 0,
          winner: won ? uid : '',
          status: won ? 'finished' : 'playing',
          turnIndex:
            won || extraTurn
              ? current.turnIndex
              : (current.turnIndex + 1) % current.playerIds.length,
        };
      });

      const next = result.snapshot.val();

      if (!result.committed || !next) {
        setMessage('Move was not accepted. Check whose turn it is.');
      } else if (next.winner === uid) {
        setMessage('🏆 You won!');
      } else if (next.turnIndex === game.turnIndex) {
        setMessage('🎉 Extra turn! Roll again.');
      } else {
        setMessage('Token moved. Next player’s turn.');
      }
    } catch (error) {
      console.error('Ludo move failed:', error);
      setMessage('Move could not sync. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  // 6. Restart
  const restart = async () => {
    if (busy || roomPlayers.length < 2) return;
    setBusy(true);
    try {
      await set(ref(rtdb, gamePath), createLudoState(roomPlayers));
      setMessage('New game started. Red player goes first.');
    } catch (error) {
      console.error('Ludo restart failed:', error);
      setMessage('Could not restart. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  if (!canStart) {
    return (
      <div className="rounded-2xl border border-cyan-900 bg-slate-950 p-8 text-center text-white">
        <h3 className="text-2xl font-black">🎲 Monarch Ludo</h3>
        <p className="mt-3 text-slate-400">Waiting for players. At least 2 players are required.</p>
        <p className="mt-1 text-xs text-slate-500">Maximum 4 players per game.</p>
      </div>
    );
  }

  if (!game) {
    return <div className="p-8 text-center text-white">Loading Ludo board...</div>;
  }

  const nameOf = (uid?: string) => roomPlayers.find((p) => p.uid === uid)?.name || 'Player';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 py-4 text-white">
      <style>{LUDO_CSS}</style>
      {game.winner && <LudoConfetti />}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tight">
            <span className="text-cyan-400">MONARCH</span> LUDO
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {game.playerIds.length} players · Real-time multiplayer
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            key={`${currentUid}-${game.winner}`}
            className="ludo-banner rounded-full border border-cyan-500/40 bg-cyan-950/50 px-4 py-2 text-sm font-bold text-cyan-200"
          >
            {game.winner ? 'Game over' : `${nameOf(currentUid)}'s turn`}
          </div>
          {isHost && !game.winner && (
            <button
              onClick={restart}
              disabled={busy}
              className="rounded-full border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-50"
            >
              RESTART
            </button>
          )}
        </div>
      </header>

      {!inGame && (
        <div className="rounded-xl border border-yellow-700/50 bg-yellow-950/30 p-3 text-center text-xs text-yellow-300">
          Aap is game mein nahi hain (spectator). Host RESTART karega to aap shamil ho jaoge.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {game.playerIds.map((uid, pi) => {
          const seat = game.seats[pi] ?? pi;
          const finished = (game.positions[uid] || []).filter((p) => p === FINISH).length;
          const active = uid === currentUid && !game.winner;
          return (
            <div
              key={uid}
              className={`rounded-xl border p-3 transition-all duration-300 ${active ? 'scale-[1.03] border-cyan-400 bg-cyan-950/50' : 'border-slate-700 bg-slate-900'
                }`}
              style={active ? { boxShadow: `0 0 16px ${PLAYER_COLORS[seat].main}88` } : undefined}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: PLAYER_COLORS[seat].main }}
                />
                <span className="truncate font-bold">{nameOf(uid)}</span>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-2 flex-1 rounded-full transition-colors duration-500"
                    style={{ backgroundColor: i < finished ? PLAYER_COLORS[seat].main : '#334155' }}
                  />
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Finished: {finished}/4</p>
            </div>
          );
        })}
      </div>

      {game.winner && (
        <div className="ludo-win rounded-2xl border border-green-500 bg-green-950/70 p-5 text-center">
          <h3 className="text-3xl font-black text-green-300">🏆 {nameOf(game.winner)} wins!</h3>
          {(isHost || game.winner === user.uid) && (
            <button
              onClick={restart}
              disabled={busy}
              className="mt-4 rounded-full bg-white px-7 py-3 font-bold text-black disabled:opacity-50"
            >
              PLAY AGAIN
            </button>
          )}
        </div>
      )}

      <LudoBoard players={roomPlayers} game={game} user={user} onMove={moveToken} />

      {!game.winner && (
        <section className="mx-auto max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-5 text-center">
          <p className="text-xs tracking-[0.3em] text-slate-400">DICE</p>

          <div className="my-5">
            <DiceCube val={dice.val} n={dice.n} throwing={throwing} />
          </div>

          <div className="mb-3 h-6">
            {!throwing && game.lastRoll > 0 && (
              <span
                key={`${game.lastRoll}-${dice.n}`}
                className="ludo-banner inline-block rounded-full bg-cyan-400/10 px-4 py-0.5 text-sm font-black text-cyan-300"
              >
                Rolled: {game.lastRoll}
              </span>
            )}
          </div>

          <button
            onClick={rollDice}
            disabled={!inGame || !myTurn || busy || game.lastRoll > 0}
            className="rounded-full bg-cyan-400 px-10 py-3 font-black text-slate-950 transition hover:scale-105 hover:bg-cyan-300 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:hover:scale-100"
          >
            {rolling
              ? 'ROLLING...'
              : !inGame || !myTurn
                ? 'WAIT YOUR TURN'
                : game.lastRoll > 0
                  ? 'SELECT A TOKEN'
                  : '🎲 ROLL DICE'}
          </button>

          <p className="mt-4 text-sm text-cyan-200">{message}</p>
          <p className="mt-2 text-xs text-slate-500">
            Roll a 6 to leave home. Exact roll required to finish. ★ safe squares protect tokens.
            Capture an opponent or reach home for an extra turn.
          </p>
        </section>
      )}
    </div>
  );
}


// ============================================================================
// ROYAL CHESS  —  PASTE THIS AT THE VERY BOTTOM OF App.tsx
// Koi naya import nahi chahiye (useState, useEffect, useRef, useMemo, ref,
// onValue, runTransaction, set, rtdb, soundFX, LudoConfetti sab already hain).
// ============================================================================

type ChessColor = 'w' | 'b';

type ChessLastMove = { from: number; to: number; rf: number; rt: number; cap: boolean };

type ChessState = {
  playerIds: string[]; // [white, black]
  board: string; // 64 chars, index 0 = a8, '.' = empty, UPPERCASE = white
  turn: ChessColor;
  castling: string; // 'KQkq' ya '-'
  ep: number; // en-passant target square ya -1
  halfmove: number;
  moveCount: number;
  lastMove: ChessLastMove | null;
  moves: string[];
  capW: string; // white ne jo (black) pieces khaye
  capB: string; // black ne jo (white) pieces khaye
  clockW: number;
  clockB: number;
  lastTs: number;
  status: 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned' | 'timeout';
  winner: string;
  drawOffer: string;
  inCheck: boolean;
};

const CH_TIME = 10 * 60 * 1000; // har player ke liye 10 minute (yahan change kar sakte ho)
const CH_START = 'rnbqkbnr' + 'pppppppp' + '.'.repeat(32) + 'PPPPPPPP' + 'RNBQKBNR';
const CH_GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const CH_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const KNIGHT_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISH_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

const chColor = (p: string): ChessColor | null => (p === '.' ? null : p === p.toUpperCase() ? 'w' : 'b');
const chInb = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const chSqName = (i: number) => 'abcdefgh'[i & 7] + (8 - (i >> 3));

// ---------- ENGINE ----------
function chAttacked(b: string, sq: number, by: ChessColor): boolean {
  const r = sq >> 3;
  const c = sq & 7;
  const P = (t: string) => (by === 'w' ? t.toUpperCase() : t);
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (chInb(pr, c + dc) && b[pr * 8 + c + dc] === P('p')) return true;
  for (const [dr, dc] of KNIGHT_D) if (chInb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === P('n')) return true;
  for (const [dr, dc] of KING_D) if (chInb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === P('k')) return true;
  for (const [dr, dc] of ROOK_D) {
    let rr = r + dr, cc = c + dc;
    while (chInb(rr, cc)) {
      const p = b[rr * 8 + cc];
      if (p !== '.') { if (p === P('r') || p === P('q')) return true; break; }
      rr += dr; cc += dc;
    }
  }
  for (const [dr, dc] of BISH_D) {
    let rr = r + dr, cc = c + dc;
    while (chInb(rr, cc)) {
      const p = b[rr * 8 + cc];
      if (p !== '.') { if (p === P('b') || p === P('q')) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}

function chPseudo(s: Pick<ChessState, 'board' | 'castling' | 'ep'>, from: number): number[] {
  const b = s.board;
  const p = b[from];
  if (p === '.') return [];
  const col = chColor(p)!;
  const t = p.toLowerCase();
  const r = from >> 3, c = from & 7;
  const out: number[] = [];
  const enemy = (q: string) => q !== '.' && chColor(q) !== col;

  if (t === 'p') {
    const dir = col === 'w' ? -1 : 1;
    const startRow = col === 'w' ? 6 : 1;
    const r1 = r + dir;
    if (chInb(r1, c) && b[r1 * 8 + c] === '.') {
      out.push(r1 * 8 + c);
      if (r === startRow && b[(r + 2 * dir) * 8 + c] === '.') out.push((r + 2 * dir) * 8 + c);
    }
    for (const dc of [-1, 1]) {
      const cc = c + dc;
      if (!chInb(r1, cc)) continue;
      const to = r1 * 8 + cc;
      if (enemy(b[to]) || to === s.ep) out.push(to);
    }
  } else if (t === 'n' || t === 'k') {
    for (const [dr, dc] of t === 'n' ? KNIGHT_D : KING_D) {
      const rr = r + dr, cc = c + dc;
      if (!chInb(rr, cc)) continue;
      const q = b[rr * 8 + cc];
      if (q === '.' || enemy(q)) out.push(rr * 8 + cc);
    }
    if (t === 'k') {
      const home = col === 'w' ? 60 : 4;
      const opp: ChessColor = col === 'w' ? 'b' : 'w';
      const rook = col === 'w' ? 'R' : 'r';
      if (from === home && !chAttacked(b, home, opp)) {
        if (s.castling.includes(col === 'w' ? 'K' : 'k') && b[home + 1] === '.' && b[home + 2] === '.' && b[home + 3] === rook && !chAttacked(b, home + 1, opp) && !chAttacked(b, home + 2, opp)) out.push(home + 2);
        if (s.castling.includes(col === 'w' ? 'Q' : 'q') && b[home - 1] === '.' && b[home - 2] === '.' && b[home - 3] === '.' && b[home - 4] === rook && !chAttacked(b, home - 1, opp) && !chAttacked(b, home - 2, opp)) out.push(home - 2);
      }
    }
  } else {
    const dirs = t === 'r' ? ROOK_D : t === 'b' ? BISH_D : [...ROOK_D, ...BISH_D];
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (chInb(rr, cc)) {
        const q = b[rr * 8 + cc];
        if (q === '.') out.push(rr * 8 + cc);
        else { if (enemy(q)) out.push(rr * 8 + cc); break; }
        rr += dr; cc += dc;
      }
    }
  }
  return out;
}

function chApply(board: string, from: number, to: number, ep: number, promo: string) {
  const b = board.split('');
  const p = b[from];
  const col = chColor(p)!;
  const t = p.toLowerCase();
  let cap = b[to];
  let rook: [number, number] | null = null;
  if (t === 'p' && to === ep && cap === '.' && (from & 7) !== (to & 7)) {
    const cs = col === 'w' ? to + 8 : to - 8;
    cap = b[cs];
    b[cs] = '.';
  }
  b[to] = p;
  b[from] = '.';
  if (t === 'k' && Math.abs((to & 7) - (from & 7)) === 2) {
    if ((to & 7) === 6) { b[from + 1] = b[from + 3]; b[from + 3] = '.'; rook = [from + 3, from + 1]; }
    else { b[from - 1] = b[from - 4]; b[from - 4] = '.'; rook = [from - 4, from - 1]; }
  }
  if (t === 'p' && ((to >> 3) === 0 || (to >> 3) === 7)) b[to] = col === 'w' ? promo.toUpperCase() : promo.toLowerCase();
  return { board: b.join(''), cap: cap === '.' ? '' : cap, rook };
}

function chLegal(s: Pick<ChessState, 'board' | 'castling' | 'ep'>, from: number): number[] {
  const col = chColor(s.board[from]);
  if (!col) return [];
  const opp: ChessColor = col === 'w' ? 'b' : 'w';
  return chPseudo(s, from).filter((to) => {
    const { board } = chApply(s.board, from, to, s.ep, 'q');
    const k = board.indexOf(col === 'w' ? 'K' : 'k');
    return k >= 0 && !chAttacked(board, k, opp);
  });
}

function chHasMoves(s: Pick<ChessState, 'board' | 'castling' | 'ep'>, col: ChessColor): boolean {
  for (let i = 0; i < 64; i++) if (chColor(s.board[i]) === col && chLegal(s, i).length) return true;
  return false;
}

function chInsufficient(board: string): boolean {
  const pcs = board.split('').filter((p) => p !== '.' && p.toLowerCase() !== 'k');
  return pcs.length === 0 || (pcs.length === 1 && 'bn'.includes(pcs[0].toLowerCase()));
}

function chSan(s: ChessState, from: number, to: number, promo: string, cap: boolean, castled: boolean, mark: string): string {
  const p = s.board[from];
  const t = p.toLowerCase();
  if (castled) return ((to & 7) === 6 ? 'O-O' : 'O-O-O') + mark;
  let out = '';
  if (t === 'p') {
    if (cap) out += 'abcdefgh'[from & 7] + 'x';
    out += chSqName(to);
    if ((to >> 3) === 0 || (to >> 3) === 7) out += '=' + promo.toUpperCase();
  } else {
    out += t.toUpperCase();
    const others: number[] = [];
    for (let i = 0; i < 64; i++) if (i !== from && s.board[i] === p && chLegal(s, i).includes(to)) others.push(i);
    if (others.length) {
      if (others.every((o) => (o & 7) !== (from & 7))) out += 'abcdefgh'[from & 7];
      else if (others.every((o) => (o >> 3) !== (from >> 3))) out += String(8 - (from >> 3));
      else out += chSqName(from);
    }
    if (cap) out += 'x';
    out += chSqName(to);
  }
  return out + mark;
}

function chCreate(ids: string[]): ChessState {
  return {
    playerIds: ids, board: CH_START, turn: 'w', castling: 'KQkq', ep: -1, halfmove: 0, moveCount: 0,
    lastMove: null, moves: [], capW: '', capB: '', clockW: CH_TIME, clockB: CH_TIME, lastTs: 0,
    status: 'playing', winner: '', drawOffer: '', inCheck: false,
  };
}

function chNormalize(d: any): ChessState {
  return {
    playerIds: d.playerIds || [],
    board: d.board || CH_START,
    turn: d.turn || 'w',
    castling: d.castling || '-',
    ep: typeof d.ep === 'number' ? d.ep : -1,
    halfmove: d.halfmove || 0,
    moveCount: d.moveCount || 0,
    lastMove: d.lastMove || null,
    moves: Array.isArray(d.moves) ? d.moves : Object.values(d.moves || {}),
    capW: d.capW || '',
    capB: d.capB || '',
    clockW: d.clockW ?? CH_TIME,
    clockB: d.clockB ?? CH_TIME,
    lastTs: d.lastTs || 0,
    status: d.status || 'playing',
    winner: d.winner || '',
    drawOffer: d.drawOffer || '',
    inCheck: !!d.inCheck,
  };
}

function chPlay(s: ChessState, from: number, to: number, promo: string, now: number): ChessState | null {
  if (s.status !== 'playing' || !chLegal(s, from).includes(to)) return null;
  const p = s.board[from];
  const col = chColor(p)!;
  if (col !== s.turn) return null;
  const opp: ChessColor = col === 'w' ? 'b' : 'w';
  const t = p.toLowerCase();

  let clockW = s.clockW, clockB = s.clockB;
  if (s.moveCount > 0 && s.lastTs > 0) {
    const el = Math.max(0, now - s.lastTs);
    if (col === 'w') { if (el >= clockW) return null; clockW -= el; }
    else { if (el >= clockB) return null; clockB -= el; }
  }

  const res = chApply(s.board, from, to, s.ep, promo);

  let cr = s.castling === '-' ? '' : s.castling;
  if (t === 'k') cr = cr.replace(col === 'w' ? /[KQ]/g : /[kq]/g, '');
  const touch = (sq: number) => {
    if (sq === 63) cr = cr.replace('K', '');
    if (sq === 56) cr = cr.replace('Q', '');
    if (sq === 7) cr = cr.replace('k', '');
    if (sq === 0) cr = cr.replace('q', '');
  };
  touch(from); touch(to);

  const ep = t === 'p' && Math.abs(to - from) === 16 ? (from + to) / 2 : -1;
  const check = chAttacked(res.board, res.board.indexOf(opp === 'w' ? 'K' : 'k'), col);

  const next: ChessState = {
    ...s,
    board: res.board,
    turn: opp,
    castling: cr || '-',
    ep,
    halfmove: t === 'p' || res.cap ? 0 : s.halfmove + 1,
    moveCount: s.moveCount + 1,
    lastMove: { from, to, rf: res.rook ? res.rook[0] : -1, rt: res.rook ? res.rook[1] : -1, cap: !!res.cap },
    capW: col === 'w' ? s.capW + res.cap : s.capW,
    capB: col === 'b' ? s.capB + res.cap : s.capB,
    clockW, clockB, lastTs: now, drawOffer: '', inCheck: check, status: 'playing', winner: '',
  };

  const hasMoves = chHasMoves(next, opp);
  if (!hasMoves) {
    next.status = check ? 'checkmate' : 'stalemate';
    next.winner = check ? s.playerIds[col === 'w' ? 0 : 1] : '';
  } else if (next.halfmove >= 100 || chInsufficient(next.board)) {
    next.status = 'draw';
  }
  const mark = !hasMoves && check ? '#' : check ? '+' : '';
  next.moves = [...s.moves, chSan(s, from, to, promo, !!res.cap, !!res.rook, mark)];
  return next;
}

// ---------- STYLES ----------
const CHESS_CSS = `
@keyframes chessSlide { 0% { transform: translate(var(--dx), var(--dy)) scale(1); } 55% { transform: translate(calc(var(--dx) * .12), calc(var(--dy) * .12)) scale(1.12); } 100% { transform: translate(0,0) scale(1); } }
@keyframes chessHop { 0% { transform: translate(var(--dx), var(--dy)) scale(1); } 50% { transform: translate(calc(var(--dx) * .5), calc(var(--dy) * .5)) scale(1.5); } 100% { transform: translate(0,0) scale(1); } }
@keyframes chessBurst { 0% { transform: scale(.2); opacity: .95; } 100% { transform: scale(2.4); opacity: 0; } }
@keyframes chessShake { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-3px,2px); } 40% { transform: translate(3px,-2px); } 60% { transform: translate(-2px,-1px); } 80% { transform: translate(2px,1px); } }
@keyframes chessCheck { 0%,100% { opacity: .5; } 50% { opacity: 1; } }
@keyframes chessPop { 0% { transform: scale(.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes chessLow { 0%,100% { color: #fb7185; } 50% { color: #fff; } }
@keyframes ludoConfetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }

.chess-frame { position: relative; padding: clamp(12px, 3vw, 24px); border-radius: 16px;
  background: repeating-linear-gradient(95deg, rgba(0,0,0,.06) 0 3px, transparent 3px 9px), linear-gradient(135deg, #7a4a22, #3b2210 55%, #62391a);
  box-shadow: 0 24px 60px rgba(0,0,0,.65), inset 0 0 0 2px rgba(255,214,150,.18), inset 0 2px 10px rgba(255,255,255,.12); }
.chess-shake { animation: chessShake .36s ease-in-out; }
.chess-board { position: relative; container-type: inline-size; border-radius: 4px; overflow: hidden; box-shadow: 0 0 0 2px #2a170a, inset 0 0 14px rgba(0,0,0,.5); }
.chess-sq { position: relative; display: flex; align-items: center; justify-content: center; user-select: none; min-width: 0; min-height: 0; }
.chess-light { background-image: repeating-linear-gradient(92deg, rgba(120,80,30,.05) 0 2px, transparent 2px 7px), linear-gradient(135deg, #f4e1bd, #e5c995); }
.chess-dark { background-image: repeating-linear-gradient(88deg, rgba(0,0,0,.06) 0 2px, transparent 2px 6px), linear-gradient(135deg, #b47e4d, #8c5a32); }
.chess-hl { position: absolute; inset: 0; pointer-events: none; }
.chess-check { background: radial-gradient(circle, rgba(239,68,68,.95) 0, rgba(239,68,68,.5) 45%, transparent 75%); animation: chessCheck 1s ease-in-out infinite; }
.chess-coord { position: absolute; font-size: clamp(7px, 1.5vw, 11px); font-weight: 800; pointer-events: none; opacity: .8; z-index: 1; }
.chess-dot { position: absolute; width: 30%; height: 30%; border-radius: 9999px; background: rgba(20,20,20,.3); z-index: 3; pointer-events: none; }
.chess-ring { position: absolute; inset: 6%; border-radius: 9999px; border: 5px solid rgba(20,20,20,.3); z-index: 3; pointer-events: none; }
.chess-own:hover { box-shadow: inset 0 0 0 3px rgba(34,211,238,.7); }
.chess-own:hover .chess-piece { transform: translateY(-7%) scale(1.07); }
.chess-sel .chess-piece { transform: translateY(-9%) scale(1.13); }

.chess-piece { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; line-height: 1; z-index: 2; pointer-events: none; transition: transform .15s ease;
  font-family: 'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols','DejaVu Sans',serif; font-size: clamp(24px, 6.4vw, 52px); font-size: 10.4cqw; }
.chess-piece::after { content: ''; position: absolute; left: 18%; right: 18%; bottom: 7%; height: 10%; background: radial-gradient(ellipse, rgba(0,0,0,.38), transparent 70%); z-index: -1; }
.chess-pw { color: #fdfcf8; -webkit-text-stroke: 1.4px #3b2a1a; text-shadow: 0 2px 0 #cbb994, 0 5px 6px rgba(0,0,0,.45); }
.chess-pb { color: #1b1612; -webkit-text-stroke: 1px #000; text-shadow: 0 2px 0 #4a3f33, 0 5px 6px rgba(0,0,0,.5); }
.chess-slide { animation: chessSlide .34s cubic-bezier(.3,.7,.2,1) both; z-index: 20 !important; }
.chess-hop { animation: chessHop .38s cubic-bezier(.3,.7,.2,1) both; z-index: 20 !important; }
.chess-burst { position: absolute; inset: 8%; border-radius: 9999px; border: 3px solid #fbbf24; box-shadow: 0 0 18px #f59e0b, inset 0 0 12px #f59e0b; animation: chessBurst .6s ease-out .22s both; z-index: 15; pointer-events: none; }
.chess-glyph { font-size: 44px; line-height: 1; font-family: 'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols','DejaVu Sans',serif; }
.chess-cap { font-size: 17px; line-height: 1; font-family: 'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols','DejaVu Sans',serif; margin-right: -4px; }
.chess-pop { animation: chessPop .3s ease-out; }
.chess-low { animation: chessLow .8s ease-in-out infinite; }
`;

// ---------- COMPONENT ----------
export function ChessGameActivity({ room, user }: any) {
  const allPlayers: { uid: string; name: string }[] = (room.players || []).filter((p: any) => Boolean(p.uid));
  const roomPlayers = allPlayers.slice(0, 2);
  const gamePath = `chess/${room.id}/gameState`;
  const isHost = room.hostId === user.uid;
  const canStart = roomPlayers.length >= 2;
  const playerKey = roomPlayers.map((p) => p.uid).join('|');

  const [game, setGame] = useState<ChessState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualFlip, setManualFlip] = useState(false);
  const [animMove, setAnimMove] = useState(-1);
  const [shake, setShake] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [message, setMessage] = useState('');

  const offset = useRef(0);
  const prevCount = useRef(-1);
  const timeoutSent = useRef(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const playersRef = useRef(roomPlayers);
  playersRef.current = roomPlayers;

  const myColor: ChessColor | null = game ? (game.playerIds[0] === user.uid ? 'w' : game.playerIds[1] === user.uid ? 'b' : null) : null;
  const nameOf = (uid?: string) => allPlayers.find((p) => p.uid === uid)?.name || 'Player';

  const clockOf = (col: ChessColor) => {
    if (!game) return CH_TIME;
    let t = col === 'w' ? game.clockW : game.clockB;
    if (game.status === 'playing' && game.moveCount > 0 && game.turn === col && game.lastTs > 0) t -= nowMs - game.lastTs;
    return Math.max(0, t);
  };

  const legalTargets = useMemo(() => (game && selected !== null ? chLegal(game, selected) : []), [game, selected]);

  // server time offset (dono players ki clock sync rahe)
  useEffect(() => {
    const unsub = onValue(ref(rtdb, '.info/serverTimeOffset'), (s) => { offset.current = s.val() || 0; });
    return () => unsub();
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now() + offset.current), 250);
    return () => window.clearInterval(t);
  }, []);

  // Firebase sync
  useEffect(() => {
    if (!canStart) { setGame(null); prevCount.current = -1; return; }
    const gameRef = ref(rtdb, gamePath);
    const unsub = onValue(
      gameRef,
      (snap) => {
        const data = snap.val();
        if (!data) {
          const ids = playersRef.current.map((p) => p.uid);
          if (Math.random() < 0.5) ids.reverse();
          void runTransaction(gameRef, (cur) => cur ?? chCreate(ids)).catch((e) => {
            console.error('Chess init failed:', e);
            setMessage('Game start nahi hua. Firebase rules check karo.');
          });
          return;
        }
        const g = chNormalize(data);
        if (prevCount.current >= 0 && g.moveCount > prevCount.current) {
          setAnimMove(g.moveCount);
          if (g.lastMove?.cap) {
            soundFX.playPortal();
            setShake(true);
            window.setTimeout(() => setShake(false), 380);
          } else soundFX.playClick();
          if (g.inCheck) window.setTimeout(() => soundFX.playPortal(), 160);
        }
        prevCount.current = g.moveCount;
        setGame(g);
      },
      (err) => { console.error(err); setMessage('Database connection failed.'); }
    );
    return () => unsub();
  }, [gamePath, canStart]);

  // koi player room chhod ke gaya aur naya aaya -> host fresh game seat kar de
  useEffect(() => {
    if (!game || !isHost) return;
    const ok = game.playerIds.every((id) => roomPlayers.some((p) => p.uid === id));
    if (!ok && roomPlayers.length >= 2) void set(ref(rtdb, gamePath), chCreate(roomPlayers.map((p) => p.uid)));
  }, [game, playerKey]);

  // game over sound
  useEffect(() => { if (game && game.status !== 'playing') soundFX.playPortal(); }, [game?.status]);

  // turn badalte hi selection clear
  useEffect(() => { setSelected(null); setPromo(null); }, [game?.moveCount]);

  // move list auto-scroll
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [game?.moves.length]);

  const mutate = async (fn: (g: ChessState) => ChessState | null) => {
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        if (!cur) return;
        const n = fn(chNormalize(cur));
        return n ?? undefined;
      });
    } catch (e) {
      console.error(e);
      setMessage('Sync fail hua. Connection check karo.');
    }
  };

  // timeout detection
  useEffect(() => {
    if (!game || game.status !== 'playing' || game.moveCount === 0 || !myColor) return;
    if (clockOf(game.turn) > 0 || timeoutSent.current === game.moveCount) return;
    timeoutSent.current = game.moveCount;
    void mutate((g) => {
      if (g.status !== 'playing' || g.moveCount === 0) return null;
      const left = (g.turn === 'w' ? g.clockW : g.clockB) - (Date.now() + offset.current - g.lastTs);
      if (left > 700) return null;
      return { ...g, status: 'timeout', winner: g.playerIds[g.turn === 'w' ? 1 : 0] };
    });
  }, [nowMs, game?.moveCount]);

  const tryMove = async (from: number, to: number, promoPiece = 'q') => {
    if (busy) return;
    setBusy(true);
    await mutate((g) =>
      g.status === 'playing' && g.playerIds[g.turn === 'w' ? 0 : 1] === user.uid
        ? chPlay(g, from, to, promoPiece, Date.now() + offset.current)
        : null
    );
    setSelected(null);
    setBusy(false);
  };

  const onSquare = (sq: number) => {
    if (!game || game.status !== 'playing' || !myColor || game.turn !== myColor || busy || promo) return;
    const p = game.board[sq];
    if (selected !== null && legalTargets.includes(sq)) {
      const sp = game.board[selected];
      if (sp.toLowerCase() === 'p' && ((sq >> 3) === 0 || (sq >> 3) === 7)) { setPromo({ from: selected, to: sq }); return; }
      void tryMove(selected, sq);
      return;
    }
    if (p !== '.' && chColor(p) === myColor) { setSelected(sq); soundFX.playClick(); }
    else setSelected(null);
  };

  const resign = () => {
    if (!window.confirm('Resign karna hai?')) return;
    void mutate((g) => {
      const i = g.playerIds.indexOf(user.uid);
      return g.status !== 'playing' || i < 0 ? null : { ...g, status: 'resigned', winner: g.playerIds[i === 0 ? 1 : 0] };
    });
  };
  const offerDraw = () => void mutate((g) => (g.status === 'playing' && g.playerIds.includes(user.uid) ? { ...g, drawOffer: user.uid } : null));
  const acceptDraw = () => void mutate((g) => (g.status === 'playing' && g.drawOffer && g.drawOffer !== user.uid ? { ...g, status: 'draw', drawOffer: '' } : null));
  const declineDraw = () => void mutate((g) => (g.drawOffer ? { ...g, drawOffer: '' } : null));

  const restart = async () => {
    if (!game || busy) return;
    setBusy(true);
    try {
      const ids = game.playerIds.every((id) => roomPlayers.some((p) => p.uid === id))
        ? [game.playerIds[1], game.playerIds[0]] // colors swap
        : roomPlayers.map((p) => p.uid);
      await set(ref(rtdb, gamePath), chCreate(ids));
      setMessage('');
    } catch (e) {
      console.error(e);
      setMessage('Restart nahi ho paya.');
    }
    setBusy(false);
  };

  // ----- early screens (saare hooks upar hain) -----
  if (!canStart) {
    return (
      <div className="rounded-2xl border border-cyan-900 bg-slate-950 p-8 text-center text-white">
        <h3 className="text-2xl font-black">♚ Royal Chess</h3>
        <p className="mt-3 text-slate-400">Waiting for your opponent. Exactly 2 players needed.</p>
        <p className="mt-2 text-xs text-slate-500">Share room code: <span className="font-mono text-cyan-300">{room.code}</span></p>
      </div>
    );
  }
  if (!game) return <div className="p-8 text-center text-white">{message || 'Loading chessboard...'}</div>;

  // ----- derived -----
  const playing = game.status === 'playing';
  const flip = (myColor === 'b') !== manualFlip;
  const topCol: ChessColor = flip ? 'w' : 'b';
  const botCol: ChessColor = flip ? 'b' : 'w';
  const vcOf = (s: number) => (flip ? 7 - (s & 7) : s & 7);
  const vrOf = (s: number) => (flip ? 7 - (s >> 3) : s >> 3);
  const lm = game.lastMove;
  const slideOn = animMove === game.moveCount && !!lm;
  const kingSq = game.inCheck ? game.board.indexOf(game.turn === 'w' ? 'K' : 'k') : -1;
  const iAmSeated = myColor !== null;
  const fmt = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')}`;

  const bannerText =
    game.status === 'checkmate' ? `Checkmate! ${nameOf(game.winner)} wins` :
      game.status === 'timeout' ? `Time's up! ${nameOf(game.winner)} wins` :
        game.status === 'resigned' ? `${nameOf(game.winner)} wins by resignation` :
          game.status === 'stalemate' ? 'Stalemate — draw' :
            game.status === 'draw' ? 'Game drawn' : '';

  const renderBar = (col: ChessColor) => {
    const uid = game.playerIds[col === 'w' ? 0 : 1];
    const active = playing && game.turn === col;
    const t = clockOf(col);
    const caps = (col === 'w' ? game.capW : game.capB).split('').filter(Boolean).sort((a, b) => CH_VALUE[b.toLowerCase()] - CH_VALUE[a.toLowerCase()]);
    const sum = (s: string) => s.split('').reduce((a, p) => a + (CH_VALUE[p.toLowerCase()] || 0), 0);
    const diff = col === 'w' ? sum(game.capW) - sum(game.capB) : sum(game.capB) - sum(game.capW);
    return (
      <div className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-all ${active ? 'border-cyan-400 bg-cyan-950/50' : 'border-slate-700 bg-slate-900'}`}
        style={active ? { boxShadow: '0 0 16px rgba(34,211,238,.35)' } : undefined}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-500" style={{ background: col === 'w' ? '#fdfcf8' : '#1b1612' }} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{nameOf(uid)}{uid === user.uid && <span className="ml-1 text-[10px] text-cyan-400">(You)</span>}</div>
            <div className="flex h-[18px] items-center">
              {caps.map((p, i) => (
                <span key={i} className={`chess-cap ${chColor(p) === 'w' ? 'chess-pw' : 'chess-pb'}`} style={{ WebkitTextStroke: chColor(p) === 'w' ? '.6px #3b2a1a' : '.4px #000' }}>{CH_GLYPH[p.toLowerCase()] + '\uFE0E'}</span>
              ))}
              {diff > 0 && <span className="ml-2 text-[11px] font-bold text-cyan-300">+{diff}</span>}
            </div>
          </div>
        </div>
        <div className={`rounded-lg bg-black px-3 py-1 font-mono text-xl font-black ${active && t < 20000 ? 'chess-low' : active ? 'text-white' : 'text-slate-500'}`}>{fmt(t)}</div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 text-white">
      <style>{CHESS_CSS}</style>
      {game.winner === user.uid && <LudoConfetti />}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tight"><span className="text-cyan-400">ROYAL</span> CHESS</h2>
          <p className="mt-1 text-sm text-slate-400">2 players · Real-time · {Math.round(CH_TIME / 60000)} min each</p>
        </div>
        <div key={`${game.turn}-${game.status}-${game.inCheck}`} className="chess-pop rounded-full border border-cyan-500/40 bg-cyan-950/50 px-4 py-2 text-sm font-bold text-cyan-200">
          {playing ? `${nameOf(game.playerIds[game.turn === 'w' ? 0 : 1])}'s turn${game.inCheck ? ' · CHECK!' : ''}` : 'Game over'}
        </div>
      </header>

      {!iAmSeated && (
        <div className="rounded-xl border border-yellow-700/50 bg-yellow-950/30 p-3 text-center text-xs text-yellow-300">
          Aap spectator ho — chess room mein sirf 2 players khel sakte hain.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,560px)_1fr]">
        <div className="space-y-2">
          {renderBar(topCol)}

          <div className={`chess-frame ${shake ? 'chess-shake' : ''}`}>
            <div className="chess-board">
              <div className="grid" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gridTemplateRows: 'repeat(8, minmax(0, 1fr))', aspectRatio: '1' }}>
                {Array.from({ length: 64 }, (_, i) => {
                  const vr = i >> 3, vc = i & 7;
                  const sq = flip ? (7 - vr) * 8 + (7 - vc) : vr * 8 + vc;
                  const p = game.board[sq];
                  const col = chColor(p);
                  const light = ((sq >> 3) + (sq & 7)) % 2 === 0;
                  const isLast = !!lm && (lm.from === sq || lm.to === sq);
                  const isSel = selected === sq;
                  const isTarget = legalTargets.includes(sq);
                  const isCapTarget = isTarget && selected !== null && (p !== '.' || (game.board[selected].toLowerCase() === 'p' && (selected & 7) !== (sq & 7)));
                  const canPick = playing && !!myColor && game.turn === myColor && col === myColor;
                  const sliding = slideOn && !!lm && (sq === lm.to || sq === lm.rt);
                  const from = sliding && lm ? (sq === lm.to ? lm.from : lm.rf) : 0;
                  const dx = sliding ? `${(vcOf(from) - vcOf(sq)) * 100}%` : '0%';
                  const dy = sliding ? `${(vrOf(from) - vrOf(sq)) * 100}%` : '0%';
                  const hop = sliding && p.toLowerCase() === 'n';
                  const burst = slideOn && !!lm && lm.cap && lm.to === sq;
                  const coordColor = light ? '#8c5a32' : '#f4e1bd';

                  return (
                    <div key={i} onClick={() => onSquare(sq)}
                      className={`chess-sq ${light ? 'chess-light' : 'chess-dark'} ${canPick ? 'chess-own' : ''} ${isSel ? 'chess-sel' : ''}`}
                      style={{ cursor: canPick || isTarget ? 'pointer' : 'default' }}>
                      {isLast && <span className="chess-hl" style={{ background: 'rgba(250,204,21,.36)' }} />}
                      {isSel && <span className="chess-hl" style={{ background: 'rgba(34,211,238,.5)' }} />}
                      {sq === kingSq && <span className="chess-hl chess-check" />}
                      {vc === 0 && <span className="chess-coord" style={{ top: 2, left: 3, color: coordColor }}>{8 - (sq >> 3)}</span>}
                      {vr === 7 && <span className="chess-coord" style={{ bottom: 1, right: 3, color: coordColor }}>{'abcdefgh'[sq & 7]}</span>}
                      {isTarget && (isCapTarget ? <span className="chess-ring" /> : <span className="chess-dot" />)}
                      {p !== '.' && (
                        <span key={`${sq}-${p}-${sliding ? game.moveCount : 0}`}
                          className={`chess-piece ${col === 'w' ? 'chess-pw' : 'chess-pb'} ${sliding ? (hop ? 'chess-hop' : 'chess-slide') : ''}`}
                          style={sliding ? ({ ['--dx' as any]: dx, ['--dy' as any]: dy } as React.CSSProperties) : undefined}>
                          {CH_GLYPH[p.toLowerCase()] + '\uFE0E'}
                        </span>
                      )}
                      {burst && <span key={`b${game.moveCount}`} className="chess-burst" />}
                    </div>
                  );
                })}
              </div>

              {promo && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
                  <div className="chess-pop rounded-2xl border border-cyan-500/40 bg-[#070e20] p-4 text-center">
                    <p className="mb-3 text-sm font-bold">Promote pawn to</p>
                    <div className="flex gap-3">
                      {['q', 'r', 'b', 'n'].map((pc) => (
                        <button key={pc} onClick={() => { const m = promo; setPromo(null); void tryMove(m.from, m.to, pc); }}
                          className="rounded-xl border border-amber-900 bg-[#c9a36b] px-3 py-2 transition hover:scale-110">
                          <span className={`chess-glyph ${myColor === 'w' ? 'chess-pw' : 'chess-pb'}`}>{CH_GLYPH[pc] + '\uFE0E'}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setPromo(null)} className="mt-3 text-xs text-slate-400 hover:text-white">Cancel</button>
                  </div>
                </div>
              )}

              {!playing && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55">
                  <div className="chess-pop rounded-2xl border border-cyan-400/50 bg-[#070e20]/95 p-6 text-center shadow-2xl">
                    <p className="text-2xl font-black text-cyan-300">{bannerText}</p>
                    {game.winner && <p className="mt-1 text-xs text-slate-400">{game.winner === user.uid ? '🏆 Well played, champion!' : iAmSeated ? 'Better luck next time.' : ''}</p>}
                    {(isHost || iAmSeated) && (
                      <button onClick={restart} disabled={busy} className="mt-4 rounded-full bg-white px-7 py-2.5 text-xs font-extrabold text-black disabled:opacity-50">NEW GAME (swap colors)</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {renderBar(botCol)}
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
            <p className="mb-3 text-xs tracking-[0.3em] text-slate-400">CONTROLS</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setManualFlip(!manualFlip)} className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200">FLIP BOARD</button>
              {playing && iAmSeated && (
                <>
                  <button onClick={resign} className="rounded-full border border-rose-600 bg-rose-950/40 px-4 py-2 text-xs font-bold text-rose-300">RESIGN</button>
                  {game.drawOffer !== user.uid && !game.drawOffer && (
                    <button onClick={offerDraw} className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200">OFFER DRAW</button>
                  )}
                </>
              )}
            </div>
            {playing && game.drawOffer === user.uid && <p className="mt-3 text-xs text-cyan-300">Draw offer bheja gaya, opponent ka jawab wait ho raha hai...</p>}
            {playing && iAmSeated && game.drawOffer && game.drawOffer !== user.uid && (
              <div className="chess-pop mt-3 rounded-xl border border-cyan-500/40 bg-cyan-950/40 p-3">
                <p className="text-xs font-bold text-cyan-200">{nameOf(game.drawOffer)} draw offer kar raha hai</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={acceptDraw} className="rounded-full bg-white px-4 py-1.5 text-xs font-extrabold text-black">ACCEPT</button>
                  <button onClick={declineDraw} className="rounded-full border border-slate-600 px-4 py-1.5 text-xs font-bold text-slate-300">DECLINE</button>
                </div>
              </div>
            )}
            {message && <p className="mt-3 text-xs text-rose-300">{message}</p>}
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
            <p className="mb-2 text-xs tracking-[0.3em] text-slate-400">MOVES</p>
            <div ref={listRef} className="max-h-64 space-y-0.5 overflow-y-auto pr-1 font-mono text-xs">
              {game.moves.length === 0 && <p className="text-slate-500">White ki pehli chaal ka intezaar... (clock pehli chaal ke baad shuru hoti hai)</p>}
              {Array.from({ length: Math.ceil(game.moves.length / 2) }, (_, i) => (
                <div key={i} className="grid grid-cols-[28px_1fr_1fr] rounded px-1 py-0.5 odd:bg-slate-900/60">
                  <span className="text-slate-500">{i + 1}.</span>
                  <span className="text-white">{game.moves[2 * i]}</span>
                  <span className="text-cyan-200">{game.moves[2 * i + 1] || ''}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            Click a piece, then a highlighted square. Castling, en passant, promotion, check/checkmate, stalemate, draw offers aur 10-min clocks supported hain.
          </p>
        </aside>
      </div>
    </div>
  );
}


// ============================================================================
// SHADOW RUNES (Tic-Tac-Toe)  —  purane `function TicTacToeGame(...)` ko DELETE
// karke uski jagah ye poora code paste karo (App.tsx mein, kahin bhi neeche).
// Koi naya import nahi chahiye.
// ============================================================================

type TttMark = 'X' | 'O';

type TttState = {
  playerIds: string[]; // [X player, O player]
  board: string; // 9 chars: '.', 'X', 'O'
  turn: TttMark;
  status: 'playing' | 'won' | 'draw';
  winner: string;
  line: number[];
  s0: number; // X player ki wins
  s1: number; // O player ki wins
  round: number;
  last: number;
};

const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const TTT_COLOR: Record<TttMark, string> = { X: '#22d3ee', O: '#c084fc' };
const TTT_CENTER = [156.67, 500, 843.33]; // overlay line ke liye cell centers (viewBox 1000)

function tttCreate(ids: string[], round = 0, s0 = 0, s1 = 0): TttState {
  return { playerIds: ids, board: '.........', turn: 'X', status: 'playing', winner: '', line: [], s0, s1, round, last: -1 };
}

function tttNormalize(d: any): TttState {
  return {
    playerIds: d.playerIds || [],
    board: d.board || '.........',
    turn: d.turn || 'X',
    status: d.status || 'playing',
    winner: d.winner || '',
    line: Array.isArray(d.line) ? d.line : Object.values(d.line || {}),
    s0: d.s0 || 0,
    s1: d.s1 || 0,
    round: d.round || 0,
    last: typeof d.last === 'number' ? d.last : -1,
  };
}

function tttResult(b: string): { mark: string; line: number[] } | null {
  for (const [x, y, z] of TTT_LINES) if (b[x] !== '.' && b[x] === b[y] && b[x] === b[z]) return { mark: b[x], line: [x, y, z] };
  return null;
}

const TTT_CSS = `
@keyframes tttDraw { to { stroke-dashoffset: 0; } }
@keyframes tttBurst { 0% { transform: scale(.3); opacity: .9; } 100% { transform: scale(1.9); opacity: 0; } }
@keyframes tttWin { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
@keyframes tttPop { 0% { transform: scale(.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes tttFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes tttGlow { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
@keyframes ludoConfetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }

.ttt-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: tttDraw .38s ease-out forwards; }
.ttt-ghost { opacity: .28; }
.ttt-cell { position: relative; aspect-ratio: 1; border-radius: 18px; padding: 18%; background: linear-gradient(145deg, #08122a, #040a18); border: 1px solid rgba(21,94,117,.55); box-shadow: inset 0 0 18px rgba(0,0,0,.6); transition: border-color .15s, transform .15s, opacity .3s; }
.ttt-cell.ttt-playable { cursor: pointer; }
.ttt-cell.ttt-playable:hover { border-color: rgba(34,211,238,.9); transform: translateY(-2px); }
.ttt-burst { position: absolute; inset: 14%; border-radius: 9999px; border: 3px solid; pointer-events: none; animation: tttBurst .55s ease-out forwards; }
.ttt-win { animation: tttWin .9s ease-in-out infinite; }
.ttt-dim { opacity: .35; }
.ttt-pop { animation: tttPop .3s ease-out; }
.ttt-aura { position: absolute; inset: -8%; border-radius: 32px; filter: blur(34px); pointer-events: none; transition: background .5s; animation: tttGlow 2.4s ease-in-out infinite; }
`;

function TttRune({ mark, ghost, still }: { mark: TttMark; ghost?: boolean; still?: boolean }) {
  const cls = still ? '' : ghost ? 'ttt-ghost' : 'ttt-draw';
  const color = TTT_COLOR[mark];
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round"
      style={{ color, filter: `drop-shadow(0 0 7px ${color})` }}>
      {mark === 'X' ? (
        <>
          <line className={cls} x1="26" y1="26" x2="74" y2="74" pathLength={1} />
          <line className={cls} style={{ animationDelay: '.16s' }} x1="74" y1="26" x2="26" y2="74" pathLength={1} />
        </>
      ) : (
        <circle className={cls} cx="50" cy="50" r="26" pathLength={1} transform="rotate(-90 50 50)" />
      )}
    </svg>
  );
}

function TicTacToeGame({ room, user }: any) {
  const allPlayers: { uid: string; name: string }[] = (room.players || []).filter((p: any) => Boolean(p.uid));
  const roomPlayers = allPlayers.slice(0, 2);
  const gamePath = `tictactoe/${room.id}/gameState`;
  const isHost = room.hostId === user.uid;
  const canStart = roomPlayers.length >= 2;
  const playerKey = roomPlayers.map((p) => p.uid).join('|');

  const [game, setGame] = useState<TttState | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const playersRef = useRef(roomPlayers);
  playersRef.current = roomPlayers;
  const prev = useRef<{ round: number; filled: number; status: string } | null>(null);

  const nameOf = (uid?: string) => allPlayers.find((p) => p.uid === uid)?.name || 'Player';

  // Firebase sync + sounds
  useEffect(() => {
    if (!canStart) { setGame(null); prev.current = null; return; }
    const gameRef = ref(rtdb, gamePath);
    const unsub = onValue(
      gameRef,
      (snap) => {
        const data = snap.val();
        if (!data) {
          const ids = playersRef.current.map((p) => p.uid);
          if (Math.random() < 0.5) ids.reverse();
          void runTransaction(gameRef, (cur) => cur ?? tttCreate(ids)).catch((e) => {
            console.error('Shadow Runes init failed:', e);
            setMessage('Game start nahi hua. Firebase rules check karo.');
          });
          return;
        }
        const g = tttNormalize(data);
        const filled = g.board.split('').filter((c) => c !== '.').length;
        const p = prev.current;
        if (p) {
          if (g.round !== p.round) soundFX.playPortal();
          else if (filled > p.filled) {
            if (g.board[g.last] === 'X') soundFX._play('triangle', 500, 900, 0.1);
            else soundFX._play('sine', 300, 520, 0.14);
          }
          if (g.round === p.round && p.status === 'playing' && g.status !== 'playing') {
            if (g.status === 'won' && g.winner === user.uid) {
              [0, 130, 260].forEach((t, i) =>
                window.setTimeout(() => soundFX._play('triangle', [523, 659, 784][i], [659, 784, 1047][i], 0.22), 120 + t));
            } else if (g.status === 'won') {
              window.setTimeout(() => soundFX._play('sawtooth', 300, 120, 0.4), 120);
            } else {
              window.setTimeout(() => soundFX._play('sine', 300, 200, 0.3), 120);
            }
          }
        }
        prev.current = { round: g.round, filled, status: g.status };
        setGame(g);
      },
      (err) => { console.error(err); setMessage('Database connection failed.'); }
    );
    return () => unsub();
  }, [gamePath, canStart]);

  // koi player gaya aur naya aaya -> host fresh game seat kar de
  useEffect(() => {
    if (!game || !isHost) return;
    const ok = game.playerIds.every((id) => roomPlayers.some((p) => p.uid === id));
    if (!ok && roomPlayers.length >= 2) void set(ref(rtdb, gamePath), tttCreate(roomPlayers.map((p) => p.uid)));
  }, [game, playerKey]);

  const place = async (i: number) => {
    if (!game || game.status !== 'playing' || busy || game.board[i] !== '.') return;
    if (game.playerIds[game.turn === 'X' ? 0 : 1] !== user.uid) return;
    setBusy(true);
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        if (!cur) return;
        const g = tttNormalize(cur);
        if (g.status !== 'playing' || g.board[i] !== '.' || g.playerIds[g.turn === 'X' ? 0 : 1] !== user.uid) return;
        const b = g.board.split('');
        b[i] = g.turn;
        const board = b.join('');
        const res = tttResult(board);
        const next: TttState = { ...g, board, last: i };
        if (res) {
          next.status = 'won';
          next.winner = user.uid;
          next.line = res.line;
          if (g.turn === 'X') next.s0 = g.s0 + 1; else next.s1 = g.s1 + 1;
        } else if (!board.includes('.')) {
          next.status = 'draw';
        } else {
          next.turn = g.turn === 'X' ? 'O' : 'X';
        }
        return next;
      });
    } catch (e) {
      console.error(e);
      setMessage('Move sync nahi hua.');
    }
    setBusy(false);
  };

  const rematch = async () => {
    if (!game || busy) return;
    setBusy(true);
    try {
      const keep = game.playerIds.every((id) => roomPlayers.some((p) => p.uid === id));
      await set(
        ref(rtdb, gamePath),
        keep
          ? tttCreate([game.playerIds[1], game.playerIds[0]], game.round + 1, game.s1, game.s0)
          : tttCreate(roomPlayers.map((p) => p.uid))
      );
      setMessage('');
    } catch (e) {
      console.error(e);
      setMessage('Rematch start nahi hua.');
    }
    setBusy(false);
  };

  if (!canStart) {
    return (
      <div className="rounded-2xl border border-cyan-900 bg-slate-950 p-8 text-center text-white">
        <style>{TTT_CSS}</style>
        <div className="mx-auto mb-3 h-14 w-14" style={{ animation: 'tttFloat 2s ease-in-out infinite' }}><TttRune mark="O" still /></div>
        <h3 className="text-2xl font-black">Shadow Runes</h3>
        <p className="mt-3 text-slate-400">Waiting for your opponent. Exactly 2 players needed.</p>
        <p className="mt-2 text-xs text-slate-500">Share room code: <span className="font-mono text-cyan-300">{room.code}</span></p>
      </div>
    );
  }
  if (!game) return <div className="p-8 text-center text-white">{message || 'Summoning the runes...'}</div>;

  const myIdx = game.playerIds.indexOf(user.uid);
  const myMark: TttMark | null = myIdx === 0 ? 'X' : myIdx === 1 ? 'O' : null;
  const playing = game.status === 'playing';
  const myTurn = playing && myMark === game.turn;
  const filled = game.board.split('').filter((c) => c !== '.').length;
  const turnName = nameOf(game.playerIds[game.turn === 'X' ? 0 : 1]);
  const winMark: TttMark | null = game.status === 'won' ? (game.playerIds[0] === game.winner ? 'X' : 'O') : null;

  const card = (idx: number) => {
    const mark: TttMark = idx === 0 ? 'X' : 'O';
    const uid = game.playerIds[idx];
    const active = playing && game.turn === mark;
    const wins = idx === 0 ? game.s0 : game.s1;
    return (
      <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-300 ${active ? 'scale-[1.03] bg-cyan-950/40' : 'border-slate-700 bg-slate-900'}`}
        style={active ? { borderColor: TTT_COLOR[mark], boxShadow: `0 0 18px ${TTT_COLOR[mark]}66` } : undefined}>
        <div className="h-9 w-9 shrink-0"><TttRune mark={mark} still /></div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{nameOf(uid)}{uid === user.uid && <span className="ml-1 text-[10px] text-cyan-400">(You)</span>}</div>
          <div className="text-[10px] text-slate-400">{mark === 'X' ? 'Flame rune' : 'Shadow rune'}</div>
        </div>
        <div className="text-2xl font-black" style={{ color: TTT_COLOR[mark] }}>{wins}</div>
      </div>
    );
  };

  const statusText =
    game.status === 'won' ? `${nameOf(game.winner)} claims the round!` :
      game.status === 'draw' ? 'The runes cancel out — draw!' :
        myTurn ? 'Your turn — place your rune' :
          myMark ? `${turnName} is choosing...` : `${turnName}'s turn`;

  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-2 text-white">
      <style>{TTT_CSS}</style>
      {winMark && game.winner === user.uid && <LudoConfetti />}

      <header className="text-center">
        <h2 className="text-3xl font-black tracking-tight"><span className="text-cyan-400">SHADOW</span> RUNES</h2>
        <p className="mt-1 text-xs text-slate-400">Round {game.round + 1} · first to align three runes</p>
      </header>

      {!myMark && (
        <div className="rounded-xl border border-yellow-700/50 bg-yellow-950/30 p-2 text-center text-xs text-yellow-300">
          Aap spectator ho — sirf 2 players khel sakte hain.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">{card(0)}{card(1)}</div>

      <div key={`${game.turn}-${game.status}-${game.round}`} className="ttt-pop rounded-full border border-cyan-500/40 bg-cyan-950/50 px-4 py-2 text-center text-sm font-bold text-cyan-200">
        {statusText}
      </div>

      <div className="relative mx-auto w-full max-w-[360px]">
        <div className="ttt-aura" style={{ background: winMark ? TTT_COLOR[winMark] + '55' : playing ? TTT_COLOR[game.turn] + '44' : 'transparent' }} />
        <div className="relative grid grid-cols-3 rounded-3xl border-2 border-slate-700 bg-[#030712] p-2.5" style={{ gap: '3%' }}>
          {Array.from({ length: 9 }, (_, i) => {
            const c = game.board[i];
            const isWinCell = game.line.includes(i);
            const playable = myTurn && c === '.' && !busy;
            return (
              <button key={i} type="button" disabled={!playable}
                onClick={() => place(i)}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                className={`ttt-cell ${playable ? 'ttt-playable' : ''} ${isWinCell ? 'ttt-win' : ''} ${!playing && game.status === 'won' && !isWinCell ? 'ttt-dim' : ''}`}
                style={isWinCell && winMark ? { borderColor: TTT_COLOR[winMark], boxShadow: `0 0 22px ${TTT_COLOR[winMark]}88, inset 0 0 18px ${TTT_COLOR[winMark]}33` } : undefined}>
                {c !== '.' && <TttRune key={`${game.round}-${i}-${c}`} mark={c as TttMark} />}
                {c === '.' && playable && hover === i && myMark && <TttRune mark={myMark} ghost />}
                {game.last === i && c !== '.' && (
                  <span key={`b${game.round}-${filled}`} className="ttt-burst" style={{ borderColor: TTT_COLOR[c as TttMark] }} />
                )}
              </button>
            );
          })}

          {game.status === 'won' && game.line.length === 3 && winMark && (
            <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-2.5 h-[calc(100%-20px)] w-[calc(100%-20px)]">
              <line key={`wl-${game.round}`}
                x1={TTT_CENTER[game.line[0] % 3]} y1={TTT_CENTER[Math.floor(game.line[0] / 3)]}
                x2={TTT_CENTER[game.line[2] % 3]} y2={TTT_CENTER[Math.floor(game.line[2] / 3)]}
                stroke="#fff" strokeWidth="22" strokeLinecap="round" pathLength={1}
                className="ttt-draw" style={{ animationDuration: '.5s', animationDelay: '.25s', filter: `drop-shadow(0 0 14px ${TTT_COLOR[winMark]})` }} />
            </svg>
          )}
        </div>
      </div>

      {!playing && (isHost || myMark) && (
        <div className="text-center">
          <button onClick={rematch} disabled={busy} className="rounded-full bg-white px-8 py-3 text-xs font-extrabold text-black transition hover:scale-105 disabled:opacity-50">
            REMATCH
          </button>
        </div>
      )}

      {message && <p className="text-center text-xs text-rose-300">{message}</p>}
      <p className="text-center text-[11px] text-slate-500">Starter har round mein badalta hai. Scores rematch mein bhi bante rehte hain.</p>
    </div>
  );
}


// ============================================================================
// SHADOW BOMB  —  2 to 6 players, hot-potato elimination
// ============================================================================

type BombPhase = 'lobby' | 'playing' | 'finished';

type BombState = {
  phase: BombPhase;
  playerIds: string[];
  alive: string[];
  out: string[];
  holder: string;
  prevHolder: string;
  round: number;
  explodeAt: number;
  freezeUntil: number;
  fuseMs: number;
  passN: number;
  boomN: number;
  boomUid: string;
  winner: string;
  wins: Record<string, number>;
};

const BB_MAX = 6;
const BB_FREEZE = 2800;
const BB_COLORS = ['#22d3ee', '#c084fc', '#f97316', '#22c55e', '#facc15', '#f43f5e'];
const BB_AVATARS = ['🦊', '🐺', '🦁', '🐙', '🦄', '🐲'];

const bbArr = (x: any): any[] => (Array.isArray(x) ? x : Object.values(x || {}));

function bbLobby(wins: Record<string, number> = {}): BombState {
  return {
    phase: 'lobby', playerIds: [], alive: [], out: [], holder: '', prevHolder: '',
    round: 0, explodeAt: 0, freezeUntil: 0, fuseMs: 10000, passN: 0, boomN: 0,
    boomUid: '', winner: '', wins,
  };
}

function bbNormalize(d: any): BombState {
  return {
    phase: d.phase || 'lobby',
    playerIds: bbArr(d.playerIds),
    alive: bbArr(d.alive),
    out: bbArr(d.out),
    holder: d.holder || '',
    prevHolder: d.prevHolder || '',
    round: d.round || 0,
    explodeAt: d.explodeAt || 0,
    freezeUntil: d.freezeUntil || 0,
    fuseMs: d.fuseMs || 10000,
    passN: d.passN || 0,
    boomN: d.boomN || 0,
    boomUid: d.boomUid || '',
    winner: d.winner || '',
    wins: d.wins || {},
  };
}

function bbStartRound(s: BombState, holder: string, now: number): BombState {
  const fuseMs = 8000 + Math.floor(Math.random() * 9000);
  const freezeUntil = now + BB_FREEZE;
  return { ...s, holder, prevHolder: '', round: s.round + 1, fuseMs, freezeUntil, explodeAt: freezeUntil + fuseMs };
}

function bbNext(playerIds: string[], alive: string[], from: string): string {
  const n = playerIds.length;
  const idx = playerIds.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const id = playerIds[(idx + k) % n];
    if (alive.includes(id)) return id;
  }
  return alive[0] || '';
}

function bbFinish(s: BombState): BombState {
  const w = s.alive[0] || '';
  const wins = { ...s.wins };
  if (w) wins[w] = (wins[w] || 0) + 1;
  return { ...s, phase: 'finished', winner: w, holder: '', wins };
}

const BB_CSS = `
@keyframes bbShake { 0%,100% { transform: translate(0,0) rotate(0deg); } 25% { transform: translate(-3%,2%) rotate(-7deg); } 50% { transform: translate(3%,-2%) rotate(6deg); } 75% { transform: translate(-2%,-3%) rotate(-5deg); } }
@keyframes bbSpin { to { transform: rotate(360deg); } }
@keyframes bbSpinRev { to { transform: rotate(-360deg); } }
@keyframes bbHolder { 0%,100% { box-shadow: 0 0 0 0 rgba(244,63,94,.85), 0 0 18px rgba(244,63,94,.6); } 50% { box-shadow: 0 0 0 12px rgba(244,63,94,0), 0 0 30px rgba(244,63,94,.9); } }
@keyframes bbTarget { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
@keyframes bbRing { 0% { transform: translate(-50%,-50%) scale(.2); opacity: .95; } 100% { transform: translate(-50%,-50%) scale(5); opacity: 0; } }
@keyframes bbCore { 0% { transform: translate(-50%,-50%) scale(.2); opacity: 1; } 40% { transform: translate(-50%,-50%) scale(2.2); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(3); opacity: 0; } }
@keyframes bbDebris { 0% { transform: translate(-50%,-50%) scale(1) rotate(0); opacity: 1; } 100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(.4) rotate(540deg); opacity: 0; } }
@keyframes bbFlash { 0% { opacity: .85; } 100% { opacity: 0; } }
@keyframes bbArenaShake { 0%,100% { transform: translate(0,0); } 15% { transform: translate(-7px,4px); } 30% { transform: translate(6px,-5px); } 45% { transform: translate(-5px,-3px); } 60% { transform: translate(5px,4px); } 80% { transform: translate(-2px,2px); } }
@keyframes bbPop { 0% { transform: translate(-50%,-50%) scale(.3); opacity: 0; } 30% { transform: translate(-50%,-50%) scale(1.25); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; } }
@keyframes bbDrop { 0% { transform: translateY(-260%) scale(.4); opacity: 0; } 60% { transform: translateY(8%) scale(1.15); opacity: 1; } 80% { transform: translateY(-6%) scale(.97); } 100% { transform: translateY(0) scale(1); } }
@keyframes bbSpark { 0%,100% { transform: scale(.6) rotate(0); opacity: .6; } 50% { transform: scale(1.4) rotate(90deg); opacity: 1; } }
@keyframes bbPulse { 0%,100% { opacity: .5; } 50% { opacity: 1; } }
@keyframes bbIn { 0% { transform: scale(.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes bbSkull { 0% { transform: scale(0) rotate(-40deg); } 70% { transform: scale(1.3) rotate(8deg); } 100% { transform: scale(1) rotate(0); } }
@keyframes ludoConfetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }

.bb-arena { position: relative; container-type: inline-size; width: 100%; max-width: 560px; margin: 0 auto; aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, #1a0b1f 0%, #0a1128 55%, #040a18 100%);
  border: 3px solid rgba(34,211,238,.35); box-shadow: 0 0 60px rgba(34,211,238,.12), inset 0 0 60px rgba(0,0,0,.7); }
.bb-shake { animation: bbArenaShake .5s ease-in-out; }
.bb-orbit { position: absolute; inset: 9%; border-radius: 50%; border: 2px dashed rgba(34,211,238,.25); animation: bbSpin 40s linear infinite; pointer-events: none; }
.bb-orbit2 { position: absolute; inset: 22%; border-radius: 50%; border: 1px dotted rgba(192,132,252,.3); animation: bbSpinRev 28s linear infinite; pointer-events: none; }
.bb-heat { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; background: radial-gradient(circle, rgba(244,63,94,.35), transparent 65%); transition: opacity .3s; }
.bb-avatar { position: relative; width: 100%; aspect-ratio: 1; border-radius: 50%; border: 3px solid; display: flex; align-items: center; justify-content: center; font-size: 7.5cqw; line-height: 1;
  background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.18), rgba(0,0,0,.55)), #0a1128; transition: transform .25s; }
.bb-holder { animation: bbHolder 1s ease-in-out infinite; }
.bb-target { animation: bbTarget .8s ease-in-out infinite; cursor: pointer; }
.bb-name { margin-top: 4px; font-size: clamp(9px, 2.2cqw, 13px); font-weight: 800; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-skull { position: absolute; right: -6%; bottom: -6%; font-size: 4cqw; animation: bbSkull .5s ease-out both; }
.bb-bomb { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 11cqw; line-height: 1; animation: bbShake .5s ease-in-out infinite; }
.bb-spark { position: absolute; top: 2%; right: 12%; font-size: 4cqw; color: #fde047; animation: bbSpark .3s ease-in-out infinite; text-shadow: 0 0 8px #f97316; }
.bb-drop { animation: bbDrop .6s cubic-bezier(.3,.8,.3,1) both; }
.bb-ring { position: absolute; left: 0; top: 0; width: 60px; height: 60px; border-radius: 50%; border: 4px solid #fbbf24; box-shadow: 0 0 20px #f97316; animation: bbRing .8s ease-out forwards; }
.bb-core { position: absolute; left: 0; top: 0; font-size: 12cqw; animation: bbCore .7s ease-out forwards; }
.bb-debris { position: absolute; left: 0; top: 0; font-size: 5cqw; animation: bbDebris .9s ease-out forwards; }
.bb-flash { background: radial-gradient(circle, #fff, rgba(251,146,60,.6) 50%, transparent 75%); border-radius: 50%; animation: bbFlash .45s ease-out forwards; }
.bb-count { position: absolute; left: 50%; top: 50%; font-size: 22cqw; font-weight: 900; color: #fff; text-shadow: 0 0 30px #22d3ee, 0 0 60px #22d3ee; animation: bbPop .5s ease-out both; z-index: 35; pointer-events: none; }
.bb-in { animation: bbIn .3s ease-out; }
.bb-pulse { animation: bbPulse 1.2s ease-in-out infinite; }
`;

function ShadowBombGame({ room, user }: any) {
  const allPlayers: { uid: string; name: string }[] = (room.players || []).filter((p: any) => Boolean(p.uid));
  const roomPlayers = allPlayers.slice(0, BB_MAX);
  const gamePath = `bomb/${room.id}/gameState`;
  const isHost = room.hostId === user.uid;
  const presentKey = roomPlayers.map((p) => p.uid).join('|');

  const [game, setGame] = useState<BombState | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [boomFx, setBoomFx] = useState<{ uid: string; n: number } | null>(null);
  const [shake, setShake] = useState(false);

  const offset = useRef(0);
  const prevBoom = useRef(-1);
  const prevPass = useRef(-1);
  const prevRound = useRef(-1);
  const tried = useRef(-1);

  const getNow = () => Date.now() + offset.current;
  const nameOf = (uid?: string) => allPlayers.find((p) => p.uid === uid)?.name || 'Player';

  const debris = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
        const d = 70 + Math.random() * 110;
        return { tx: Math.cos(a) * d, ty: Math.sin(a) * d, e: ['🔥', '✨', '💥', '⚡'][i % 4], delay: Math.random() * 0.08 };
      }),
    [boomFx?.n]
  );

  // server time offset
  useEffect(() => {
    const unsub = onValue(ref(rtdb, '.info/serverTimeOffset'), (s) => { offset.current = s.val() || 0; });
    return () => unsub();
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now() + offset.current), 100);
    return () => window.clearInterval(t);
  }, []);

  // Firebase sync + effects trigger
  useEffect(() => {
    const gameRef = ref(rtdb, gamePath);
    const unsub = onValue(
      gameRef,
      (snap) => {
        const data = snap.val();
        if (!data) {
          void runTransaction(gameRef, (cur) => cur ?? bbLobby()).catch((e) => {
            console.error('Bomb init failed:', e);
            setMessage('Game start nahi hua. Firebase rules check karo.');
          });
          return;
        }
        const g = bbNormalize(data);

        if (prevBoom.current >= 0 && g.boomN > prevBoom.current && g.boomUid) {
          setBoomFx({ uid: g.boomUid, n: g.boomN });
          setShake(true);
          soundFX._play('sawtooth', 220, 40, 0.5);
          window.setTimeout(() => soundFX._play('square', 120, 30, 0.4), 60);
          window.setTimeout(() => setShake(false), 520);
          window.setTimeout(() => setBoomFx(null), 1500);
        }
        if (prevPass.current >= 0 && g.passN > prevPass.current) soundFX._play('triangle', 400, 900, 0.12);
        if (g.round !== prevRound.current && g.phase === 'playing') {
          [0, 900, 1800].forEach((t) => window.setTimeout(() => soundFX.playClick(), t));
        }
        if (g.phase === 'finished' && g.winner) soundFX.playPortal();

        prevBoom.current = g.boomN;
        prevPass.current = g.passN;
        prevRound.current = g.round;
        setGame(g);
      },
      (err) => { console.error(err); setMessage('Database connection failed.'); }
    );
    return () => unsub();
  }, [gamePath]);

  const explode = (round: number) =>
    runTransaction(ref(rtdb, gamePath), (cur) => {
      if (!cur) return;
      const s = bbNormalize(cur);
      const now = Date.now() + offset.current;
      if (s.phase !== 'playing' || s.round !== round || now < s.explodeAt - 200) return;
      const victim = s.holder;
      s.alive = s.alive.filter((id) => id !== victim);
      s.out = [...s.out, victim];
      s.boomN += 1;
      s.boomUid = victim;
      if (s.alive.length <= 1) return bbFinish(s);
      return bbStartRound(s, bbNext(s.playerIds, s.alive, victim), now);
    });

  // bomb phatne ka detector (har alive client try karta hai, transaction ek hi baar commit hoga)
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    const inGame = game.alive.includes(user.uid);
    if (!inGame && !isHost) return;
    if (nowMs < game.explodeAt || tried.current === game.round) return;
    tried.current = game.round;
    void explode(game.round)
      .catch(console.error)
      .finally(() => window.setTimeout(() => { if (tried.current === game.round) tried.current = -1; }, 1200));
  }, [nowMs, game?.round, game?.phase]);

  // room chhodne wale players ko host game se hata de
  useEffect(() => {
    if (!game || game.phase !== 'playing' || !isHost) return;
    const present = roomPlayers.map((p) => p.uid);
    if (!game.alive.some((id) => !present.includes(id))) return;
    void runTransaction(ref(rtdb, gamePath), (cur) => {
      if (!cur) return;
      const s = bbNormalize(cur);
      if (s.phase !== 'playing') return;
      const gone = s.alive.filter((id) => !present.includes(id));
      if (!gone.length) return;
      const holderGone = gone.includes(s.holder);
      const oldHolder = s.holder;
      s.alive = s.alive.filter((id) => !gone.includes(id));
      s.out = [...s.out, ...gone];
      if (s.alive.length <= 1) return bbFinish(s);
      if (holderGone) return bbStartRound(s, bbNext(s.playerIds, s.alive, oldHolder), Date.now() + offset.current);
      return s;
    }).catch(console.error);
  }, [presentKey, game?.phase, game?.alive.length]);

  const startGame = async () => {
    if (busy || roomPlayers.length < 2) return;
    setBusy(true);
    setMessage('');
    const seated = roomPlayers.map((p) => p.uid);
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        const s = cur ? bbNormalize(cur) : bbLobby();
        if (s.phase === 'playing' || seated.length < 2) return;
        const holder = seated[Math.floor(Math.random() * seated.length)];
        return bbStartRound(
          { ...s, phase: 'playing', playerIds: seated, alive: seated, out: [], winner: '', boomUid: '', round: 0 },
          holder,
          Date.now() + offset.current
        );
      });
    } catch (e) {
      console.error(e);
      setMessage('Start nahi ho paya.');
    }
    setBusy(false);
  };

  const pass = async (target: string) => {
    if (busy || !game) return;
    setBusy(true);
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        if (!cur) return;
        const s = bbNormalize(cur);
        const now = Date.now() + offset.current;
        if (s.phase !== 'playing' || s.holder !== user.uid || now < s.freezeUntil || now >= s.explodeAt) return;
        if (!s.alive.includes(target) || target === user.uid) return;
        if (target === s.prevHolder && s.alive.length > 2) return;
        return { ...s, holder: target, prevHolder: user.uid, passN: s.passN + 1 };
      });
    } catch (e) {
      console.error(e);
      setMessage('Pass sync nahi hua.');
    }
    setBusy(false);
  };

  if (!game) return <div className="p-8 text-center text-white">{message || 'Arming the bomb...'}</div>;

  // ---------- derived ----------
  const playing = game.phase === 'playing';
  const finished = game.phase === 'finished';
  const inGame = game.playerIds.includes(user.uid);
  const amAlive = game.alive.includes(user.uid);
  const frozen = playing && nowMs < game.freezeUntil;
  const myTurn = playing && !frozen && game.holder === user.uid;
  const heat = playing && !frozen ? Math.min(1, Math.max(0, (nowMs - game.freezeUntil) / game.fuseMs)) : 0;
  const n = game.playerIds.length;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
  };
  const secsLeft = Math.ceil((game.freezeUntil - nowMs) / 1000);
  const canTargetUid = (uid: string) =>
    myTurn && !busy && game.alive.includes(uid) && uid !== user.uid && (uid !== game.prevHolder || game.alive.length <= 2);

  const turnText = finished
    ? 'Game over'
    : playing
      ? frozen
        ? 'Get ready...'
        : myTurn
          ? '💣 YOU HAVE THE BOMB — pass it!'
          : `${nameOf(game.holder)} has the bomb`
      : 'Lobby';

  // ---------- LOBBY ----------
  if (!playing && !finished) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-5 py-4 text-white">
        <style>{BB_CSS}</style>
        <header className="text-center">
          <h2 className="text-3xl font-black tracking-tight"><span className="text-rose-400">SHADOW</span> BOMB</h2>
          <p className="mt-1 text-sm text-slate-400">2–6 players · Pass the bomb · Last one standing wins</p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: BB_MAX }, (_, i) => {
            const p = roomPlayers[i];
            return (
              <div key={i} className={`bb-in flex flex-col items-center rounded-2xl border p-3 ${p ? 'bg-slate-900' : 'border-dashed border-slate-700 bg-slate-950/40'}`}
                style={p ? { borderColor: BB_COLORS[i], boxShadow: `0 0 14px ${BB_COLORS[i]}44` } : undefined}>
                <div className="text-4xl">{p ? BB_AVATARS[i] : <span className="bb-pulse text-slate-600">?</span>}</div>
                <div className="mt-1 max-w-full truncate text-xs font-bold" style={{ color: p ? BB_COLORS[i] : '#475569' }}>
                  {p ? p.name : 'Waiting...'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          {isHost ? (
            <button onClick={startGame} disabled={busy || roomPlayers.length < 2}
              className="rounded-full bg-rose-500 px-10 py-3 text-sm font-black text-white transition hover:scale-105 hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:hover:scale-100">
              {roomPlayers.length < 2 ? 'NEED 2+ PLAYERS' : '💣 START GAME'}
            </button>
          ) : (
            <p className="bb-pulse text-sm text-cyan-300">Waiting for host to start...</p>
          )}
          <p className="mt-3 text-xs text-slate-500">Room code: <span className="font-mono text-cyan-300">{room.code}</span></p>
          {message && <p className="mt-2 text-xs text-rose-300">{message}</p>}
        </div>
      </div>
    );
  }

  const boomIdx = boomFx ? game.playerIds.indexOf(boomFx.uid) : -1;
  const boomPos = boomIdx >= 0 ? pt(boomIdx, 38) : null;
  const holderIdx = game.playerIds.indexOf(game.holder);
  const bombPos = holderIdx >= 0 ? pt(holderIdx, 24) : null;
  const shakeDur = 0.55 - 0.47 * heat;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 text-white">
      <style>{BB_CSS}</style>
      {finished && game.winner === user.uid && <LudoConfetti />}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tight"><span className="text-rose-400">SHADOW</span> BOMB</h2>
          <p className="mt-1 text-sm text-slate-400">Round {game.round} · {game.alive.length} alive</p>
        </div>
        <div key={`${game.holder}-${game.phase}-${frozen}`}
          className="bb-in rounded-full border px-4 py-2 text-sm font-bold"
          style={{ borderColor: myTurn ? '#f43f5e' : 'rgba(34,211,238,.4)', background: myTurn ? 'rgba(244,63,94,.18)' : 'rgba(8,47,73,.5)', color: myTurn ? '#fda4af' : '#a5f3fc' }}>
          {turnText}
        </div>
      </header>

      {!inGame && (
        <div className="rounded-xl border border-yellow-700/50 bg-yellow-950/30 p-3 text-center text-xs text-yellow-300">
          Aap spectator ho — agla game start hone par seat milegi.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,560px)_1fr]">
        {/* ARENA */}
        <div className={`bb-arena ${shake ? 'bb-shake' : ''}`}>
          <div className="bb-orbit" />
          <div className="bb-orbit2" />
          <div className="bb-heat" style={{ opacity: heat * 0.9 }} />

          {/* players */}
          {game.playerIds.map((uid, i) => {
            const { x, y } = pt(i, 38);
            const out = !game.alive.includes(uid);
            const isHolder = playing && game.holder === uid && !out;
            const can = canTargetUid(uid);
            return (
              <button key={uid} disabled={!can} onClick={() => pass(uid)}
                className="absolute bg-transparent p-0"
                style={{
                  left: `${x}%`, top: `${y}%`, width: '18%', transform: `translate(-50%,-50%) scale(${out ? 0.85 : 1})`,
                  transition: 'transform .3s, filter .5s', filter: out ? 'grayscale(1) brightness(.45)' : 'none',
                  zIndex: isHolder ? 15 : 10, cursor: can ? 'pointer' : 'default',
                }}>
                <div className={`bb-avatar ${isHolder ? 'bb-holder' : ''} ${can ? 'bb-target' : ''}`}
                  style={{ borderColor: BB_COLORS[i], boxShadow: can ? `0 0 20px ${BB_COLORS[i]}` : undefined }}>
                  <span>{BB_AVATARS[i]}</span>
                  {out && <span className="bb-skull">💀</span>}
                </div>
                <div className="bb-name" style={{ color: out ? '#64748b' : BB_COLORS[i] }}>
                  {nameOf(uid)}{uid === user.uid ? ' (You)' : ''}
                </div>
              </button>
            );
          })}

          {/* bomb */}
          {playing && bombPos && (
            <div className="pointer-events-none absolute z-20"
              style={{
                left: `${bombPos.x}%`, top: `${bombPos.y}%`, width: '15%', aspectRatio: '1',
                transform: 'translate(-50%,-50%)',
                transition: 'left .5s cubic-bezier(.3,1.3,.5,1), top .5s cubic-bezier(.3,1.3,.5,1)',
              }}>
              <div key={game.round} className="bb-drop h-full w-full">
                <div className="h-full w-full" style={{
                  transform: `scale(${1 + 0.3 * heat})`,
                  filter: `drop-shadow(0 0 ${6 + 28 * heat}px rgba(255,${Math.round(140 - 120 * heat)},40,${0.45 + 0.55 * heat}))`,
                }}>
                  <div className="bb-bomb" style={{ animationDuration: `${frozen ? 0.9 : shakeDur}s` }}>
                    💣
                    <span className="bb-spark" style={{ animationDuration: `${0.15 + 0.35 * (1 - heat)}s` }}>✦</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* countdown */}
          {frozen && secsLeft > 0 && <div key={secsLeft} className="bb-count">{secsLeft}</div>}

          {/* explosion */}
          {boomFx && boomPos && (
            <>
              <div key={`f${boomFx.n}`} className="bb-flash pointer-events-none absolute inset-0 z-40" />
              <div key={`e${boomFx.n}`} className="pointer-events-none absolute z-30" style={{ left: `${boomPos.x}%`, top: `${boomPos.y}%` }}>
                <span className="bb-ring" />
                <span className="bb-ring" style={{ animationDelay: '.12s', borderColor: '#f43f5e' }} />
                <span className="bb-ring" style={{ animationDelay: '.24s', borderColor: '#fde047' }} />
                <span className="bb-core">💥</span>
                {debris.map((d, i) => (
                  <span key={i} className="bb-debris" style={{ ['--tx' as any]: `${d.tx}px`, ['--ty' as any]: `${d.ty}px`, animationDelay: `${d.delay}s` }}>{d.e}</span>
                ))}
              </div>
            </>
          )}

          {/* winner */}
          {finished && (
            <div className="absolute inset-0 z-40 flex items-center justify-center rounded-full bg-black/60">
              <div className="bb-in px-6 text-center">
                <div className="text-5xl">👑</div>
                <p className="mt-2 text-2xl font-black text-yellow-300">
                  {game.winner ? `${nameOf(game.winner)} survives!` : 'Everyone exploded!'}
                </p>
                {game.winner === user.uid && <p className="mt-1 text-xs text-slate-300">🏆 Last one standing!</p>}
                {(isHost || inGame) && (
                  <button onClick={startGame} disabled={busy || roomPlayers.length < 2}
                    className="mt-4 rounded-full bg-white px-7 py-2.5 text-xs font-extrabold text-black transition hover:scale-105 disabled:opacity-50">
                    PLAY AGAIN
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
            <p className="mb-3 text-xs tracking-[0.3em] text-slate-400">PLAYERS</p>
            <div className="space-y-2">
              {game.playerIds.map((uid, i) => {
                const out = !game.alive.includes(uid);
                const isHolder = playing && game.holder === uid;
                return (
                  <div key={uid} className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-all ${isHolder ? 'border-rose-500 bg-rose-950/30' : 'border-slate-700 bg-slate-900'} ${out ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{out ? '💀' : BB_AVATARS[i]}</span>
                      <span className="text-sm font-bold" style={{ color: BB_COLORS[i] }}>
                        {nameOf(uid)}{uid === user.uid && <span className="ml-1 text-[10px] text-cyan-400">(You)</span>}
                      </span>
                      {isHolder && !frozen && <span className="text-sm">💣</span>}
                    </div>
                    <span className="text-xs font-mono text-yellow-300">🏆 {game.wins[uid] || 0}</span>
                  </div>
                );
              })}
            </div>
            {message && <p className="mt-3 text-xs text-rose-300">{message}</p>}
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            Bomb ka fuse hidden hai. Jab tumhare paas bomb ho, kisi glowing player par tap karke pass karo.
            Jisne abhi tumhe pass kiya use wapas nahi de sakte (jab tak sirf 2 bache na hon).
            Jiske paas bomb phatta wo out. Last survivor jeetta hai.
          </p>
        </aside>
      </div>
    </div>
  );
}


// ============================================================================
// SHADOW UNO  —  2 to 6 players
// Card format: 2 chars = color + value.  R/Y/G/B + 0-9 | S(skip) | R(reverse) | D(+2)
//              Wild = 'WC', Wild +4 = 'W4'
// ============================================================================

type UnoPhase = 'lobby' | 'playing' | 'finished';

type UnoState = {
  phase: UnoPhase;
  playerIds: string[];
  hands: Record<string, string[]>;
  deck: string[];
  discard: string[];
  turn: number;
  dir: number;
  color: string;
  drew: boolean;
  turnN: number;
  turnEnd: number;
  freezeUntil: number;
  round: number;
  playN: number;
  drawN: number;
  evN: number;
  evT: string;
  evUid: string;
  unoN: number;
  unoUid: string;
  winner: string;
  wins: Record<string, number>;
};

const UNO_MAX = 6;
const UNO_TURN_MS = 30000;
const UN_FREEZE = 3200;
const UNO_COLORS: Record<string, string> = { R: '#ef4444', Y: '#facc15', G: '#22c55e', B: '#3b82f6', W: '#1e293b' };
const UNO_COLOR_NAMES: Record<string, string> = { R: 'Red', Y: 'Yellow', G: 'Green', B: 'Blue' };
const UNO_AVATARS = ['🦊', '🐺', '🦁', '🐙', '🦄', '🐲'];
const UNO_PCOL = ['#22d3ee', '#c084fc', '#f97316', '#22c55e', '#facc15', '#f43f5e'];
const UN_BANNER: Record<string, { text: string; color: string }> = {
  skip: { text: '⊘ SKIP!', color: '#f87171' },
  rev: { text: '⇄ REVERSE!', color: '#60a5fa' },
  p2: { text: '+2 CARDS!', color: '#facc15' },
  p4: { text: '+4 CARDS!', color: '#c084fc' },
  wild: { text: '🌈 WILD!', color: '#22d3ee' },
};

const unArr = (x: any): any[] => (Array.isArray(x) ? x.slice() : Object.values(x || {}));

function unShuffle(a: string[]): string[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function unDeck(): string[] {
  const d: string[] = [];
  ['R', 'Y', 'G', 'B'].forEach((c) => {
    d.push(c + '0');
    for (let n = 1; n <= 9; n++) d.push(c + n, c + n);
    ['S', 'R', 'D'].forEach((v) => d.push(c + v, c + v));
  });
  for (let i = 0; i < 4; i++) d.push('WC', 'W4');
  return unShuffle(d);
}

function unLabel(card: string) {
  const c = card[0], v = card[1];
  if (c === 'W') return v === '4' ? '+4' : '★';
  if (v === 'S') return '⊘';
  if (v === 'R') return '⇄';
  if (v === 'D') return '+2';
  return v;
}

const unCanPlay = (c: string, top: string, col: string) =>
  c[0] === 'W' || c[0] === col || (!!top && top[0] !== 'W' && c[1] === top[1]);

function unLobby(wins: Record<string, number> = {}): UnoState {
  return {
    phase: 'lobby', playerIds: [], hands: {}, deck: [], discard: [], turn: 0, dir: 1, color: 'R',
    drew: false, turnN: 0, turnEnd: 0, freezeUntil: 0, round: 0, playN: 0, drawN: 0,
    evN: 0, evT: '', evUid: '', unoN: 0, unoUid: '', winner: '', wins,
  };
}

function unNormalize(d: any): UnoState {
  const playerIds: string[] = unArr(d.playerIds);
  const hands: Record<string, string[]> = {};
  playerIds.forEach((id) => { hands[id] = unArr(d.hands?.[id]); });
  return {
    phase: d.phase || 'lobby',
    playerIds,
    hands,
    deck: unArr(d.deck),
    discard: unArr(d.discard),
    turn: d.turn || 0,
    dir: d.dir === -1 ? -1 : 1,
    color: d.color || 'R',
    drew: !!d.drew,
    turnN: d.turnN || 0,
    turnEnd: d.turnEnd || 0,
    freezeUntil: d.freezeUntil || 0,
    round: d.round || 0,
    playN: d.playN || 0,
    drawN: d.drawN || 0,
    evN: d.evN || 0,
    evT: d.evT || '',
    evUid: d.evUid || '',
    unoN: d.unoN || 0,
    unoUid: d.unoUid || '',
    winner: d.winner || '',
    wins: d.wins || {},
  };
}

function unStep(s: UnoState, from: number, steps: number) {
  const n = s.playerIds.length;
  return (((from + s.dir * steps) % n) + n) % n;
}

function unSetTurn(s: UnoState, idx: number, base: number) {
  s.turn = idx;
  s.drew = false;
  s.turnN += 1;
  s.turnEnd = base + UNO_TURN_MS;
}

function unTake(s: UnoState, uid: string, n: number) {
  if (!s.hands[uid]) s.hands[uid] = [];
  for (let i = 0; i < n; i++) {
    if (s.deck.length === 0) {
      if (s.discard.length <= 1) break;
      const top = s.discard[s.discard.length - 1];
      s.deck = unShuffle(s.discard.slice(0, -1));
      s.discard = [top];
    }
    const c = s.deck.pop();
    if (c) s.hands[uid].push(c);
  }
}

function unStart(s: UnoState, ids: string[], now: number): UnoState {
  const hands: Record<string, string[]> = {};
  ids.forEach((id) => { hands[id] = []; });
  const st: UnoState = {
    ...s, phase: 'playing', playerIds: ids, hands, deck: unDeck(), discard: [], dir: 1, color: 'R',
    drew: false, round: s.round + 1, winner: '', evT: '', evUid: '', unoUid: '',
    freezeUntil: now + UN_FREEZE,
  };
  for (let k = 0; k < 7; k++) ids.forEach((id) => unTake(st, id, 1));
  const idx = Math.max(0, st.deck.findIndex((c) => c[0] !== 'W' && /\d/.test(c[1])));
  const first = st.deck.splice(idx, 1)[0];
  st.discard = [first];
  st.color = first[0];
  unSetTurn(st, Math.floor(Math.random() * ids.length), now + UN_FREEZE);
  return st;
}

const UNO_CSS = `
@keyframes unDeal { 0% { transform: translate(0,-260px) scale(.4) rotate(140deg); opacity: 0; } 100% { transform: translate(0,0) scale(1) rotate(var(--rot)); opacity: 1; } }
@keyframes unLand { 0% { transform: translateY(240%) scale(.55) rotate(-45deg); opacity: 0; } 55% { opacity: 1; } 80% { transform: translateY(-4%) scale(1.09) rotate(5deg); } 100% { transform: none; opacity: 1; } }
@keyframes unGlow { 0%,100% { box-shadow: 0 0 0 0 var(--c), 0 0 14px var(--c); } 50% { box-shadow: 0 0 0 9px transparent, 0 0 28px var(--c); } }
@keyframes unSpin { to { transform: rotate(360deg); } }
@keyframes unBannerAnim { 0% { transform: translateY(20px) scale(.2) rotate(-14deg); opacity: 0; } 22% { transform: translateY(0) scale(1.3) rotate(4deg); opacity: 1; } 70% { transform: translateY(0) scale(1) rotate(0); opacity: 1; } 100% { transform: translateY(-50px) scale(1); opacity: 0; } }
@keyframes unPulse { 0%,100% { opacity: .5; } 50% { opacity: 1; } }
@keyframes unPop { 0% { transform: scale(.3); opacity: 0; } 60% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes unBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes unColorPop { 0% { transform: scale(.2) rotate(-90deg); } 70% { transform: scale(1.3) rotate(10deg); } 100% { transform: scale(1) rotate(0); } }
@keyframes unWinSpin { 0%,100% { transform: scale(1) rotate(-6deg); } 50% { transform: scale(1.15) rotate(6deg); } }
@keyframes ludoConfetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }

.uno-card { position: relative; container-type: inline-size; width: var(--w, clamp(48px, 11vw, 80px)); aspect-ratio: 2 / 3; border-radius: 12% / 8%; border: 3px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,.5); user-select: none; flex: none; overflow: hidden; }
.uno-oval { position: absolute; left: 11%; right: 11%; top: 12%; bottom: 12%; border-radius: 50%; transform: rotate(-24deg); box-shadow: inset 0 0 8px rgba(0,0,0,.25); }
.uno-mid { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 900; font-style: italic; line-height: 1; }
.uno-tl { position: absolute; top: 5%; left: 10%; font-size: 17cqw; font-weight: 900; color: #fff; line-height: 1; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.uno-br { position: absolute; bottom: 5%; right: 10%; font-size: 17cqw; font-weight: 900; color: #fff; line-height: 1; transform: rotate(180deg); text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.uno-back { background: #111827; }
.uno-back-oval { position: absolute; left: 8%; right: 8%; top: 22%; bottom: 22%; background: #ef4444; border-radius: 50%; transform: rotate(-24deg); display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 10px rgba(0,0,0,.35); }
.uno-back-oval span { transform: rotate(24deg); font-size: 26cqw; font-weight: 900; font-style: italic; color: #facc15; text-shadow: 2px 2px 0 #7f1d1d; }

.uno-hand { display: flex; width: max-content; margin: 0 auto; padding: 34px 14px 10px; }
.uno-hc { position: relative; flex: none; background: transparent; border: 0; padding: 0; cursor: default; transform: rotate(var(--rot)); transition: transform .18s ease, filter .2s; animation: unDeal .5s ease-out backwards; }
.uno-ok { cursor: pointer; transform: translateY(-16px) rotate(var(--rot)); filter: drop-shadow(0 0 10px rgba(34,211,238,.85)); }
.uno-ok:hover { transform: translateY(-32px) scale(1.14) rotate(0deg); z-index: 30; }
.uno-dim { filter: brightness(.5) saturate(.55); }

.un-table { position: relative; overflow: hidden; border-radius: 28px; border: 2px solid rgba(34,211,238,.25); background: #070e20; padding: 26px 12px 16px; box-shadow: 0 0 50px rgba(0,0,0,.6) inset; }
.un-glow { position: absolute; inset: -30% -10%; filter: blur(70px); opacity: .3; transition: background-color .5s; pointer-events: none; }
.un-ring { position: absolute; inset: 7% 3%; border-radius: 50%; border: 2px dashed rgba(255,255,255,.16); animation: unSpin 16s linear infinite; pointer-events: none; }
.un-arrow { position: absolute; top: -13px; left: 50%; margin-left: -9px; font-size: 20px; color: rgba(255,255,255,.55); }
.un-pile { position: relative; width: var(--w); aspect-ratio: 2 / 3; background: transparent; border: 0; padding: 0; }
.un-pile-on { animation: unBounce .9s ease-in-out infinite; cursor: pointer; filter: drop-shadow(0 0 14px #22d3ee); }
.un-pilecount { position: absolute; left: 50%; bottom: -22px; transform: translateX(-50%); font-size: 11px; font-weight: 800; color: #94a3b8; }
.un-discard { position: relative; width: var(--w); aspect-ratio: 2 / 3; }
.un-land { animation: unLand .5s cubic-bezier(.3,.8,.3,1) both; }
.un-colordot { width: 38px; height: 38px; border-radius: 9999px; border: 3px solid #fff; animation: unColorPop .45s ease-out; }

.un-chip { position: relative; display: flex; flex-direction: column; align-items: center; min-width: 96px; border-radius: 18px; border: 2px solid #334155; background: #0f172a; padding: 8px 12px; transition: transform .25s, opacity .3s; }
.un-active { animation: unGlow 1.2s ease-in-out infinite; border-color: var(--c); transform: scale(1.06); }
.un-mini { position: relative; width: 15px; height: 22px; border-radius: 3px; background: #111827; border: 1.5px solid #fff; margin-left: -9px; flex: none; }
.un-mini:first-child { margin-left: 0; }
.un-mini::after { content: ''; position: absolute; inset: 24% 14%; background: #ef4444; border-radius: 50%; }
.un-badge { position: absolute; top: -8px; right: -18px; background: #ef4444; color: #fff; font-size: 9px; font-weight: 900; padding: 1px 6px; border-radius: 9999px; animation: unPulse .7s ease-in-out infinite; }

.un-banner { display: inline-flex; flex-direction: column; align-items: center; font-size: clamp(28px, 8vw, 54px); font-weight: 900; font-style: italic; text-shadow: 0 0 24px currentColor, 0 4px 0 rgba(0,0,0,.6); animation: unBannerAnim 1.4s ease-out forwards; }
.un-banner small { font-size: 14px; font-style: normal; color: #e2e8f0; text-shadow: none; }
.un-unofx { font-size: clamp(20px, 5vw, 32px); font-weight: 900; color: #fff; background: #ef4444; padding: 6px 18px; border-radius: 9999px; box-shadow: 0 0 30px #ef4444; animation: unBannerAnim 1.6s ease-out forwards; }
.un-countnum { font-size: 96px; font-weight: 900; color: #fff; text-shadow: 0 0 30px #22d3ee, 0 0 60px #22d3ee; animation: unPop .5s ease-out both; }
.un-pop { animation: unPop .3s ease-out; }
.un-pulse { animation: unPulse 1.2s ease-in-out infinite; }
.un-pick { transition: transform .15s; }
.un-pick:hover { transform: scale(1.18) rotate(-4deg); }
`;

function UnoCard({ card, back }: { card?: string; back?: boolean }) {
  if (back || !card) {
    return (
      <div className="uno-card uno-back">
        <div className="uno-back-oval"><span>UNO</span></div>
      </div>
    );
  }
  const c = card[0];
  const wild = c === 'W';
  const label = unLabel(card);
  return (
    <div className="uno-card" style={{ background: wild ? '#0f172a' : UNO_COLORS[c] }}>
      <div
        className="uno-oval"
        style={{ background: wild ? 'conic-gradient(#ef4444 0 25%, #3b82f6 0 50%, #22c55e 0 75%, #facc15 0 100%)' : '#fff' }}
      />
      <span
        className="uno-mid"
        style={{
          color: wild ? '#fff' : UNO_COLORS[c],
          fontSize: label.length > 1 ? '30cqw' : '42cqw',
          textShadow: wild ? '0 2px 6px rgba(0,0,0,.8)' : '2px 2px 0 rgba(0,0,0,.28)',
        }}
      >
        {label}
      </span>
      <span className="uno-tl">{label}</span>
      <span className="uno-br">{label}</span>
    </div>
  );
}

function ShadowUnoGame({ room, user }: any) {
  const allPlayers: { uid: string; name: string }[] = (room.players || []).filter((p: any) => Boolean(p.uid));
  const roomPlayers = allPlayers.slice(0, UNO_MAX);
  const gamePath = `uno/${room.id}/gameState`;
  const isHost = room.hostId === user.uid;
  const presentKey = roomPlayers.map((p) => p.uid).join('|');

  const [game, setGame] = useState<UnoState | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ n: number; t: string; uid: string } | null>(null);
  const [unoFx, setUnoFx] = useState<{ n: number; uid: string } | null>(null);

  const offset = useRef(0);
  const tried = useRef(-1);
  const prev = useRef({ ev: -1, uno: -1, play: -1, draw: -1, round: -1, phase: '' });

  const nameOf = (uid?: string) => allPlayers.find((p) => p.uid === uid)?.name || 'Player';

  useEffect(() => {
    const unsub = onValue(ref(rtdb, '.info/serverTimeOffset'), (s) => { offset.current = s.val() || 0; });
    return () => unsub();
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now() + offset.current), 100);
    return () => window.clearInterval(t);
  }, []);

  // Firebase sync + sounds + banners
  useEffect(() => {
    const gameRef = ref(rtdb, gamePath);
    const unsub = onValue(
      gameRef,
      (snap) => {
        const data = snap.val();
        if (!data) {
          void runTransaction(gameRef, (cur) => cur ?? unLobby()).catch((e) => {
            console.error('Uno init failed:', e);
            setMessage('Game start nahi hua. Firebase rules check karo.');
          });
          return;
        }
        const g = unNormalize(data);
        const p = prev.current;

        if (p.play >= 0 && g.playN > p.play) soundFX._play('triangle', 450, 850, 0.1);
        if (p.draw >= 0 && g.drawN > p.draw) soundFX._play('sine', 260, 420, 0.09);
        if (p.ev >= 0 && g.evN > p.ev) {
          if (g.evT === 'skip' || g.evT === 'rev') soundFX._play('square', 500, 200, 0.18);
          if (g.evT === 'p2' || g.evT === 'p4') soundFX._play('sawtooth', 300, 90, 0.3);
          if (g.evT === 'wild') soundFX.playPortal();
          if (UN_BANNER[g.evT]) {
            setBanner({ n: g.evN, t: g.evT, uid: g.evUid });
            window.setTimeout(() => setBanner((b) => (b && b.n === g.evN ? null : b)), 1500);
          }
        }
        if (p.uno >= 0 && g.unoN > p.uno) {
          [0, 120, 240].forEach((t, i) =>
            window.setTimeout(() => soundFX._play('triangle', [523, 659, 784][i], [659, 784, 1047][i], 0.15), t));
          setUnoFx({ n: g.unoN, uid: g.unoUid });
          window.setTimeout(() => setUnoFx((u) => (u && u.n === g.unoN ? null : u)), 1700);
        }
        if (g.round !== p.round && g.phase === 'playing') {
          [0, 450, 900, 1350, 1800].forEach((t) => window.setTimeout(() => soundFX.playClick(), t));
        }
        if (p.ev >= 0 && g.phase === 'finished' && p.phase !== 'finished') soundFX.playPortal();

        prev.current = { ev: g.evN, uno: g.unoN, play: g.playN, draw: g.drawN, round: g.round, phase: g.phase };
        setGame(g);
      },
      (err) => { console.error(err); setMessage('Database connection failed.'); }
    );
    return () => unsub();
  }, [gamePath]);

  const doTimeout = (turnN: number) =>
    runTransaction(ref(rtdb, gamePath), (cur) => {
      if (!cur) return;
      const s = unNormalize(cur);
      const now = Date.now() + offset.current;
      if (s.phase !== 'playing' || s.turnN !== turnN || now < s.turnEnd - 200) return;
      const uid = s.playerIds[s.turn];
      if (!s.drew) {
        unTake(s, uid, 1);
        s.drawN += 1; s.evN += 1; s.evT = 'draw'; s.evUid = uid;
      }
      unSetTurn(s, unStep(s, s.turn, 1), now);
      return s;
    });

  // turn timeout detector
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    if (!game.playerIds.includes(user.uid)) return;
    if (nowMs < game.turnEnd + 300 || tried.current === game.turnN) return;
    const tn = game.turnN;
    tried.current = tn;
    void doTimeout(tn)
      .catch(console.error)
      .finally(() => window.setTimeout(() => { if (tried.current === tn) tried.current = -1; }, 1500));
  }, [nowMs, game?.turnN, game?.phase]);

  // host: room chhodne wale players ko game se hatao
  useEffect(() => {
    if (!game || game.phase !== 'playing' || !isHost) return;
    const present = roomPlayers.map((p) => p.uid);
    if (!game.playerIds.some((id) => !present.includes(id))) return;
    void runTransaction(ref(rtdb, gamePath), (cur) => {
      if (!cur) return;
      const s = unNormalize(cur);
      if (s.phase !== 'playing') return;
      const gone = s.playerIds.filter((id) => !present.includes(id));
      if (!gone.length) return;
      const now = Date.now() + offset.current;
      const oldIds = s.playerIds;
      const oldIdx = s.turn;
      const curUid = oldIds[oldIdx];
      const ids = oldIds.filter((id) => !gone.includes(id));
      gone.forEach((id) => {
        s.deck = unShuffle([...s.deck, ...(s.hands[id] || [])]);
        delete s.hands[id];
      });
      if (ids.length <= 1) {
        s.playerIds = ids;
        s.phase = 'finished';
        s.winner = ids[0] || '';
        if (s.winner) s.wins = { ...s.wins, [s.winner]: (s.wins[s.winner] || 0) + 1 };
        return s;
      }
      if (ids.includes(curUid)) {
        s.playerIds = ids;
        s.turn = ids.indexOf(curUid);
        return s;
      }
      const n = oldIds.length;
      let cand = ids[0];
      for (let k = 1; k <= n; k++) {
        const c = oldIds[(((oldIdx + s.dir * k) % n) + n) % n];
        if (ids.includes(c)) { cand = c; break; }
      }
      s.playerIds = ids;
      unSetTurn(s, ids.indexOf(cand), now);
      return s;
    }).catch(console.error);
  }, [presentKey, game?.phase, game?.playerIds.length]);

  const startGame = async () => {
    if (busy || roomPlayers.length < 2) return;
    setBusy(true);
    setMessage('');
    const seated = roomPlayers.map((p) => p.uid);
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        const s = cur ? unNormalize(cur) : unLobby();
        if (s.phase === 'playing' || seated.length < 2) return;
        return unStart(s, seated, Date.now() + offset.current);
      });
    } catch (e) {
      console.error(e);
      setMessage('Start nahi ho paya.');
    }
    setBusy(false);
  };

  const play = async (card: string, chosen: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        if (!cur) return;
        const s = unNormalize(cur);
        const now = Date.now() + offset.current;
        if (s.phase !== 'playing' || s.playerIds[s.turn] !== user.uid || now < s.freezeUntil) return;
        const hand = s.hands[user.uid];
        const hi = hand.indexOf(card);
        if (hi < 0) return;
        const top = s.discard[s.discard.length - 1];
        if (!unCanPlay(card, top, s.color)) return;
        if (card[0] === 'W' && !['R', 'Y', 'G', 'B'].includes(chosen)) return;

        hand.splice(hi, 1);
        s.discard.push(card);
        s.color = card[0] === 'W' ? chosen : card[0];
        s.playN += 1;
        s.evN += 1;
        s.evT = 'play';
        s.evUid = user.uid;

        if (hand.length === 0) {
          s.phase = 'finished';
          s.winner = user.uid;
          s.wins = { ...s.wins, [user.uid]: (s.wins[user.uid] || 0) + 1 };
          s.turnEnd = 0;
          return s;
        }
        if (hand.length === 1) { s.unoN += 1; s.unoUid = user.uid; }

        const n = s.playerIds.length;
        const v = card[1];
        let next = unStep(s, s.turn, 1);
        if (card === 'W4') {
          unTake(s, s.playerIds[unStep(s, s.turn, 1)], 4);
          s.evT = 'p4';
          next = unStep(s, s.turn, 2);
        } else if (card === 'WC') {
          s.evT = 'wild';
        } else if (v === 'S') {
          s.evT = 'skip';
          next = unStep(s, s.turn, 2);
        } else if (v === 'R') {
          s.dir = -s.dir;
          s.evT = 'rev';
          next = unStep(s, s.turn, n === 2 ? 2 : 1);
        } else if (v === 'D') {
          unTake(s, s.playerIds[unStep(s, s.turn, 1)], 2);
          s.evT = 'p2';
          next = unStep(s, s.turn, 2);
        }
        unSetTurn(s, next, now);
        return s;
      });
    } catch (e) {
      console.error(e);
      setMessage('Move sync nahi hua.');
    }
    setBusy(false);
  };

  const drawCard = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        if (!cur) return;
        const s = unNormalize(cur);
        const now = Date.now() + offset.current;
        if (s.phase !== 'playing' || s.playerIds[s.turn] !== user.uid || s.drew || now < s.freezeUntil) return;
        const hand = s.hands[user.uid];
        const before = hand.length;
        unTake(s, user.uid, 1);
        s.drawN += 1; s.evN += 1; s.evT = 'draw'; s.evUid = user.uid;
        const got = hand.length > before ? hand[hand.length - 1] : '';
        const top = s.discard[s.discard.length - 1];
        if (got && unCanPlay(got, top, s.color)) s.drew = true;
        else unSetTurn(s, unStep(s, s.turn, 1), now);
        return s;
      });
    } catch (e) {
      console.error(e);
      setMessage('Draw sync nahi hua.');
    }
    setBusy(false);
  };

  const passTurn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        if (!cur) return;
        const s = unNormalize(cur);
        if (s.phase !== 'playing' || s.playerIds[s.turn] !== user.uid || !s.drew) return;
        unSetTurn(s, unStep(s, s.turn, 1), Date.now() + offset.current);
        return s;
      });
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  };

  if (!game) return <div className="p-8 text-center text-white">{message || 'Shuffling the deck...'}</div>;

  // ---------- derived ----------
  const me = user.uid;
  const playing = game.phase === 'playing';
  const finished = game.phase === 'finished';
  const inGame = game.playerIds.includes(me);
  const frozen = playing && nowMs < game.freezeUntil;
  const curUid = game.playerIds[game.turn];
  const myTurn = playing && !frozen && curUid === me;
  const myHand = game.hands[me] || [];
  const top = game.discard[game.discard.length - 1] || '';
  const canPlayCard = (c: string) => myTurn && !busy && unCanPlay(c, top, game.color);
  const hasPlayable = myHand.some((c) => unCanPlay(c, top, game.color));
  const canDraw = myTurn && !game.drew && !busy;
  const timeFrac = playing && !frozen ? Math.min(1, Math.max(0, (game.turnEnd - nowMs) / UNO_TURN_MS)) : 1;
  const secs = Math.ceil((game.freezeUntil - nowMs) / 1000);

  const onCard = (c: string) => {
    if (!canPlayCard(c)) return;
    soundFX.playClick();
    if (c[0] === 'W') { setPick(c); return; }
    void play(c, '');
  };

  const turnText = finished
    ? 'Game over'
    : playing
      ? frozen
        ? 'Dealing cards...'
        : myTurn
          ? game.drew ? 'Play the drawn card or PASS' : '🃏 YOUR TURN'
          : `${nameOf(curUid)}'s turn`
      : 'Lobby';

  // ---------- LOBBY ----------
  if (!playing && !finished) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-5 py-4 text-white">
        <style>{UNO_CSS}</style>
        <header className="text-center">
          <h2 className="text-3xl font-black tracking-tight"><span className="text-rose-400">SHADOW</span> UNO</h2>
          <p className="mt-1 text-sm text-slate-400">2–6 players · Match colors · Empty your hand first</p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: UNO_MAX }, (_, i) => {
            const p = roomPlayers[i];
            return (
              <div key={i} className={`un-pop flex flex-col items-center rounded-2xl border p-3 ${p ? 'bg-slate-900' : 'border-dashed border-slate-700 bg-slate-950/40'}`}
                style={p ? { borderColor: UNO_PCOL[i], boxShadow: `0 0 14px ${UNO_PCOL[i]}44` } : undefined}>
                <div className="text-4xl">{p ? UNO_AVATARS[i] : <span className="un-pulse text-slate-600">?</span>}</div>
                <div className="mt-1 max-w-full truncate text-xs font-bold" style={{ color: p ? UNO_PCOL[i] : '#475569' }}>
                  {p ? p.name : 'Waiting...'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          {isHost ? (
            <button onClick={startGame} disabled={busy || roomPlayers.length < 2}
              className="rounded-full bg-rose-500 px-10 py-3 text-sm font-black text-white transition hover:scale-105 hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:hover:scale-100">
              {roomPlayers.length < 2 ? 'NEED 2+ PLAYERS' : '🃏 START GAME'}
            </button>
          ) : (
            <p className="un-pulse text-sm text-cyan-300">Waiting for host to start...</p>
          )}
          <p className="mt-3 text-xs text-slate-500">Room code: <span className="font-mono text-cyan-300">{room.code}</span></p>
          {message && <p className="mt-2 text-xs text-rose-300">{message}</p>}
        </div>
      </div>
    );
  }

  const len = myHand.length;
  const ov = len <= 7 ? 0.12 : len <= 12 ? 0.38 : 0.56;
  const occ: Record<string, number> = {};
  const pileW = 'clamp(62px, 15vw, 92px)';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 text-white">
      <style>{UNO_CSS}</style>
      {finished && game.winner === me && <LudoConfetti />}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tight"><span className="text-rose-400">SHADOW</span> UNO</h2>
          <p className="mt-1 text-sm text-slate-400">Round {game.round} · {game.playerIds.length} players</p>
        </div>
        <div key={`${curUid}-${game.phase}-${frozen}-${game.drew}`} className="un-pop rounded-full border px-4 py-2 text-sm font-bold"
          style={{ borderColor: myTurn ? '#f43f5e' : 'rgba(34,211,238,.4)', background: myTurn ? 'rgba(244,63,94,.18)' : 'rgba(8,47,73,.5)', color: myTurn ? '#fda4af' : '#a5f3fc' }}>
          {turnText}
        </div>
      </header>

      {!inGame && (
        <div className="rounded-xl border border-yellow-700/50 bg-yellow-950/30 p-3 text-center text-xs text-yellow-300">
          Aap spectator ho — agla game start hone par seat milegi.
        </div>
      )}

      {/* PLAYERS */}
      <div className="flex flex-wrap justify-center gap-3">
        {game.playerIds.map((uid, i) => {
          const cnt = (game.hands[uid] || []).length;
          const active = playing && !frozen && curUid === uid;
          return (
            <div key={uid} className={`un-chip ${active ? 'un-active' : ''}`} style={{ ['--c' as any]: UNO_PCOL[i] }}>
              <div className="relative text-3xl">
                {UNO_AVATARS[i]}
                {cnt === 1 && playing && <span className="un-badge">UNO!</span>}
              </div>
              <div className="mt-0.5 max-w-[96px] truncate text-xs font-bold" style={{ color: UNO_PCOL[i] }}>
                {nameOf(uid)}{uid === me && <span className="ml-1 text-[10px] text-cyan-400">(You)</span>}
              </div>
              <div className="mt-1.5 flex h-[22px] items-center">
                {Array.from({ length: Math.min(cnt, 8) }, (_, k) => <span key={k} className="un-mini" />)}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] font-mono">
                <span className="text-slate-300">🃏 {cnt}</span>
                <span className="text-yellow-300">🏆 {game.wins[uid] || 0}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* TABLE */}
      <div className="un-table">
        <div className="un-glow" style={{ backgroundColor: UNO_COLORS[game.color] }} />
        <div className="un-ring" style={{ animationDirection: game.dir === 1 ? 'normal' : 'reverse' }}>
          <span className="un-arrow" style={{ transform: game.dir === 1 ? 'none' : 'scaleX(-1)' }}>➤</span>
        </div>

        <div className="relative z-10 flex items-center justify-center gap-6 py-3 sm:gap-10">
          {/* draw pile */}
          <div className="flex flex-col items-center">
            <button onClick={drawCard} disabled={!canDraw} className={`un-pile ${canDraw ? 'un-pile-on' : ''}`} style={{ ['--w' as any]: pileW }}>
              <div className="absolute inset-0" style={{ transform: 'translate(-6px,-6px)' }}><UnoCard back /></div>
              <div className="absolute inset-0" style={{ transform: 'translate(-3px,-3px)' }}><UnoCard back /></div>
              <div className="absolute inset-0"><UnoCard back /></div>
              <span className="un-pilecount">DRAW · {game.deck.length}</span>
            </button>
          </div>

          {/* discard pile */}
          <div className="un-discard" style={{ ['--w' as any]: pileW }}>
            {game.discard.slice(-3).map((c, k, arr) => {
              const gi = game.discard.length - arr.length + k;
              const isTop = k === arr.length - 1;
              const rot = ((gi * 53) % 36) - 18;
              return (
                <div key={gi} className="absolute inset-0" style={{ transform: `rotate(${rot}deg)` }}>
                  <div className={isTop ? 'un-land h-full w-full' : 'h-full w-full'}><UnoCard card={c} /></div>
                </div>
              );
            })}
          </div>

          {/* current color */}
          <div className="flex flex-col items-center gap-1">
            <div key={game.color + game.playN} className="un-colordot" style={{ background: UNO_COLORS[game.color], boxShadow: `0 0 22px ${UNO_COLORS[game.color]}` }} />
            <span className="text-[10px] font-bold tracking-widest text-slate-400">{UNO_COLOR_NAMES[game.color]?.toUpperCase()}</span>
          </div>
        </div>

        {/* timer */}
        <div className="relative z-10 mx-auto mt-5 max-w-md">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div style={{ width: `${timeFrac * 100}%`, background: timeFrac < 0.3 ? '#f43f5e' : '#22d3ee', transition: 'width .1s linear, background .3s', height: '100%' }} />
          </div>
        </div>

        {/* effects */}
        {banner && UN_BANNER[banner.t] && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <span key={banner.n} className="un-banner" style={{ color: UN_BANNER[banner.t].color }}>
              {UN_BANNER[banner.t].text}
              <small>{nameOf(banner.uid)}</small>
            </span>
          </div>
        )}
        {unoFx && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center pb-4">
            <span key={unoFx.n} className="un-unofx">🔔 {nameOf(unoFx.uid)}: UNO!</span>
          </div>
        )}
        {frozen && secs > 0 && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/45">
            <span key={secs} className="un-countnum">{secs}</span>
          </div>
        )}

        {finished && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65">
            <div className="un-pop px-6 text-center">
              <div className="text-6xl" style={{ animation: 'unWinSpin 1.2s ease-in-out infinite' }}>👑</div>
              <p className="mt-2 text-2xl font-black text-yellow-300">{game.winner ? `${nameOf(game.winner)} wins!` : 'Game over'}</p>
              {game.winner === me && <p className="mt-1 text-xs text-slate-300">🏆 Hand khali — champion!</p>}
              {(isHost || inGame) && (
                <button onClick={startGame} disabled={busy || roomPlayers.length < 2}
                  className="mt-4 rounded-full bg-white px-7 py-2.5 text-xs font-extrabold text-black transition hover:scale-105 disabled:opacity-50">
                  PLAY AGAIN
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ACTIONS */}
      {inGame && playing && (
        <div className="flex min-h-[34px] items-center justify-center gap-3">
          {myTurn && !game.drew && !hasPlayable && <span className="un-pulse text-xs font-bold text-rose-300">Koi card nahi chal sakta — deck se DRAW karo!</span>}
          {myTurn && game.drew && (
            <button onClick={passTurn} disabled={busy} className="un-pop rounded-full border border-slate-500 bg-slate-900 px-6 py-1.5 text-xs font-extrabold text-slate-200 hover:bg-slate-800">
              PASS
            </button>
          )}
        </div>
      )}

      {/* MY HAND */}
      {inGame && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
          <div className="uno-hand" style={{ ['--w' as any]: 'clamp(46px, 10vw, 76px)' }}>
            {myHand.map((c, i) => {
              occ[c] = (occ[c] || 0) + 1;
              const ok = canPlayCard(c);
              const rot = (i - (len - 1) / 2) * (len > 10 ? 1 : 2.2);
              return (
                <button key={`${c}-${occ[c]}`} disabled={!ok} onClick={() => onCard(c)}
                  className={`uno-hc ${ok ? 'uno-ok' : ''} ${myTurn && !ok ? 'uno-dim' : ''}`}
                  style={{
                    ['--rot' as any]: `${rot}deg`,
                    marginLeft: i === 0 ? 0 : `calc(var(--w) * -${ov})`,
                    animationDelay: frozen ? `${i * 0.1}s` : '0s',
                  }}>
                  <UnoCard card={c} />
                </button>
              );
            })}
            {len === 0 && <div className="p-6 text-sm text-slate-500">No cards</div>}
          </div>
        </div>
      )}

      {message && <p className="text-center text-xs text-rose-300">{message}</p>}

      <p className="text-center text-[11px] leading-relaxed text-slate-500">
        Same color ya same number/symbol khelo. ⊘ Skip · ⇄ Reverse · +2 · ★ Wild · +4 Wild.
        Card na ho to deck se draw karo. 1 card bache to UNO auto-call hota hai. Har turn 30 sec ka hai.
      </p>

      {/* WILD COLOR PICKER */}
      {pick && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="un-pop rounded-3xl border border-cyan-500/40 bg-[#070e20] p-6 text-center">
            <p className="mb-4 text-sm font-bold">Choose a color</p>
            <div className="grid grid-cols-2 gap-4">
              {(['R', 'Y', 'G', 'B'] as const).map((c) => (
                <button key={c} onClick={() => { const card = pick; setPick(null); void play(card, c); }}
                  className="un-pick h-20 w-20 rounded-2xl border-4 border-white"
                  style={{ background: UNO_COLORS[c], boxShadow: `0 0 20px ${UNO_COLORS[c]}` }}>
                  <span className="sr-only">{UNO_COLOR_NAMES[c]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPick(null)} className="mt-4 text-xs text-slate-400 hover:text-white">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================================
// SHADOW SPY (Find the Spy)  —  3 to 5 players, secret roles + hints + voting
// PASTE THIS AT THE VERY BOTTOM OF App.tsx. Koi naya import nahi chahiye
// (useState, useEffect, useRef, useMemo, ref, onValue, runTransaction, rtdb,
//  soundFX, LudoConfetti sab already hain).
// ============================================================================

type SpyPhase = 'lobby' | 'reveal' | 'hint' | 'discuss' | 'vote' | 'result';

type SpyState = {
  phase: SpyPhase;
  playerIds: string[];
  spy: string;
  word: string;
  category: string;
  turn: number;
  hints: Record<string, string>;
  votes: Record<string, string>;
  tally: Record<string, number>;
  phaseStart: number;
  phaseEnd: number;
  phaseN: number;
  hintN: number;
  voteN: number;
  round: number;
  accused: string;
  winner: '' | 'crew' | 'spy';
  wins: Record<string, number>;
  note: string;
};

const SP_MIN = 3; // minimum players (4-5 best). Yahan change kar sakte ho
const SP_MAX = 5;
const SP_REVEAL = 15000;
const SP_HINT = 25000;
const SP_DISCUSS = 75000;
const SP_VOTE = 30000;
const SP_AVATARS = ['🦊', '🐺', '🦁', '🐙', '🦄'];
const SP_COLORS = ['#22d3ee', '#c084fc', '#f97316', '#22c55e', '#facc15'];
const SP_BANNER: Record<string, { text: string; color: string }> = {
  reveal: { text: '🎭 ROLES ASSIGNED', color: '#c084fc' },
  hint: { text: '💬 HINT ROUND', color: '#22d3ee' },
  discuss: { text: '🗣️ DISCUSSION', color: '#facc15' },
  vote: { text: '🗳️ VOTE NOW', color: '#f43f5e' },
};
const SP_STEPS: { id: SpyPhase; label: string }[] = [
  { id: 'reveal', label: 'Role' },
  { id: 'hint', label: 'Hints' },
  { id: 'discuss', label: 'Talk' },
  { id: 'vote', label: 'Vote' },
  { id: 'result', label: 'Result' },
];
const SP_WORDS: Record<string, string[]> = {
  '🍕 Food': ['Pizza', 'Biryani', 'Samosa', 'Burger', 'Maggi', 'Pani Puri', 'Ice Cream', 'Chai', 'Jalebi', 'Momos'],
  '📍 Place': ['Airport', 'Hospital', 'School', 'Cinema', 'Railway Station', 'Beach', 'Library', 'Temple', 'Gym', 'Zoo'],
  '🐾 Animal': ['Lion', 'Elephant', 'Monkey', 'Penguin', 'Camel', 'Dolphin', 'Peacock', 'Crocodile', 'Tiger', 'Parrot'],
  '🎒 Object': ['Mobile', 'Umbrella', 'Mirror', 'Bicycle', 'Watch', 'Helmet', 'Candle', 'Laptop', 'Spectacles', 'Remote'],
  '🎉 Fun': ['Cricket', 'Wedding', 'Birthday', 'Holi', 'Selfie', 'Karaoke', 'Magic Show', 'Picnic', 'Diwali', 'Road Trip'],
};

const spArr = (x: any): any[] => (Array.isArray(x) ? x.slice() : Object.values(x || {}));

function spShuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function spyLobby(wins: Record<string, number> = {}, note = '', round = 0, phaseN = 0): SpyState {
  return {
    phase: 'lobby', playerIds: [], spy: '', word: '', category: '', turn: 0, hints: {}, votes: {}, tally: {},
    phaseStart: 0, phaseEnd: 0, phaseN, hintN: 0, voteN: 0, round, accused: '', winner: '', wins, note,
  };
}

function spyNormalize(d: any): SpyState {
  return {
    phase: d.phase || 'lobby',
    playerIds: spArr(d.playerIds),
    spy: d.spy || '',
    word: d.word || '',
    category: d.category || '',
    turn: d.turn || 0,
    hints: d.hints || {},
    votes: d.votes || {},
    tally: d.tally || {},
    phaseStart: d.phaseStart || 0,
    phaseEnd: d.phaseEnd || 0,
    phaseN: d.phaseN || 0,
    hintN: d.hintN || 0,
    voteN: d.voteN || 0,
    round: d.round || 0,
    accused: d.accused || '',
    winner: d.winner || '',
    wins: d.wins || {},
    note: d.note || '',
  };
}

function spyGo(s: SpyState, phase: SpyPhase, now: number, dur: number) {
  s.phase = phase;
  s.phaseStart = now;
  s.phaseEnd = dur > 0 ? now + dur : 0;
  s.phaseN += 1;
}

function spyStart(s: SpyState, ids: string[], now: number): SpyState {
  const cats = Object.keys(SP_WORDS);
  const category = cats[Math.floor(Math.random() * cats.length)];
  const list = SP_WORDS[category];
  const order = spShuffle(ids);
  const st: SpyState = {
    ...s, playerIds: order, spy: order[Math.floor(Math.random() * order.length)],
    word: list[Math.floor(Math.random() * list.length)], category, turn: 0, hints: {}, votes: {}, tally: {},
    accused: '', winner: '', note: '', round: s.round + 1,
  };
  spyGo(st, 'reveal', now, SP_REVEAL);
  return st;
}

function spyAfterHint(s: SpyState, now: number) {
  s.turn += 1;
  if (s.turn >= s.playerIds.length) spyGo(s, 'discuss', now, SP_DISCUSS);
  else spyGo(s, 'hint', now, SP_HINT);
}

function spyTally(s: SpyState, now: number) {
  const counts: Record<string, number> = {};
  s.playerIds.forEach((id) => { counts[id] = 0; });
  (Object.values(s.votes) as string[]).forEach((t) => { if (counts[t] !== undefined) counts[t] += 1; });
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((k) => counts[k] === max);
  s.tally = counts;
  s.accused = max > 0 && top.length === 1 ? top[0] : '';
  const crewWin = s.accused === s.spy;
  s.winner = crewWin ? 'crew' : 'spy';
  const wins = { ...s.wins };
  if (crewWin) s.playerIds.forEach((id) => { if (id !== s.spy) wins[id] = (wins[id] || 0) + 1; });
  else wins[s.spy] = (wins[s.spy] || 0) + 1;
  s.wins = wins;
  spyGo(s, 'result', now, 0);
}

const SPY_CSS = `
@keyframes spFog { 0% { transform: translateX(-6%) scale(1); } 50% { transform: translateX(6%) scale(1.15); } 100% { transform: translateX(-6%) scale(1); } }
@keyframes spFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes spPop { 0% { transform: scale(.3); opacity: 0; } 60% { transform: scale(1.18); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes spIn { 0% { transform: translateY(14px) scale(.9); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes spBanner { 0% { transform: scale(.3) rotate(-8deg); opacity: 0; } 20% { transform: scale(1.2) rotate(3deg); opacity: 1; } 70% { transform: scale(1) rotate(0); opacity: 1; } 100% { transform: scale(1.1) translateY(-40px); opacity: 0; } }
@keyframes spGlow { 0%,100% { box-shadow: 0 0 0 0 var(--c), 0 0 14px var(--c); } 50% { box-shadow: 0 0 0 8px transparent, 0 0 28px var(--c); } }
@keyframes spPulse { 0%,100% { opacity: .5; } 50% { opacity: 1; } }
@keyframes spDots { 0%,80%,100% { transform: translateY(0); opacity: .4; } 40% { transform: translateY(-5px); opacity: 1; } }
@keyframes spGlitchA { 0% { clip-path: inset(0 0 85% 0); transform: translate(-3px,0); } 20% { clip-path: inset(40% 0 40% 0); transform: translate(3px,0); } 40% { clip-path: inset(75% 0 5% 0); transform: translate(-2px,0); } 60% { clip-path: inset(15% 0 65% 0); transform: translate(2px,0); } 80% { clip-path: inset(55% 0 25% 0); transform: translate(-3px,0); } 100% { clip-path: inset(0 0 85% 0); transform: translate(3px,0); } }
@keyframes spGlitchB { 0% { clip-path: inset(70% 0 10% 0); transform: translate(3px,0); } 25% { clip-path: inset(10% 0 70% 0); transform: translate(-3px,0); } 50% { clip-path: inset(50% 0 30% 0); transform: translate(2px,0); } 75% { clip-path: inset(85% 0 0 0); transform: translate(-2px,0); } 100% { clip-path: inset(70% 0 10% 0); transform: translate(3px,0); } }
@keyframes spScan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
@keyframes spStamp { 0% { transform: scale(3) rotate(-18deg); opacity: 0; } 60% { transform: scale(.92) rotate(-8deg); opacity: 1; } 100% { transform: scale(1) rotate(-8deg); opacity: 1; } }
@keyframes spDrum { 0%,100% { transform: scale(1); } 50% { transform: scale(1.18); } }
@keyframes spRing { 0% { transform: translate(-50%,-50%) scale(.3); opacity: .9; } 100% { transform: translate(-50%,-50%) scale(3.2); opacity: 0; } }
@keyframes spShake { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-6px,3px); } 40% { transform: translate(5px,-4px); } 60% { transform: translate(-4px,-2px); } 80% { transform: translate(4px,3px); } }
@keyframes spSpin { to { transform: rotate(360deg); } }
@keyframes ludoConfetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }

.sp-stage { position: relative; overflow: hidden; border-radius: 28px; border: 2px solid rgba(192,132,252,.25); background: radial-gradient(circle at 50% 0%, #1a0b2e 0%, #070e20 60%, #030712 100%); padding: 22px 14px 18px; box-shadow: inset 0 0 60px rgba(0,0,0,.65); }
.sp-fog { position: absolute; inset: -20% -20%; pointer-events: none; filter: blur(60px); opacity: .35; animation: spFog 14s ease-in-out infinite; background: radial-gradient(circle at 25% 30%, rgba(192,132,252,.5), transparent 40%), radial-gradient(circle at 75% 70%, rgba(244,63,94,.4), transparent 40%); }
.sp-scan { position: absolute; left: 0; right: 0; top: 0; height: 40%; pointer-events: none; opacity: .06; background: linear-gradient(transparent, #fff, transparent); animation: spScan 5s linear infinite; }
.sp-shake { animation: spShake .45s ease-in-out; }
.sp-banner { display: inline-block; font-size: clamp(26px, 7vw, 48px); font-weight: 900; font-style: italic; text-shadow: 0 0 26px currentColor, 0 4px 0 rgba(0,0,0,.6); animation: spBanner 1.5s ease-out forwards; }
.sp-in { animation: spIn .35s ease-out both; }
.sp-pop { animation: spPop .35s ease-out both; }
.sp-pulse { animation: spPulse 1.2s ease-in-out infinite; }
.sp-float { animation: spFloat 2.4s ease-in-out infinite; }
.sp-active { animation: spGlow 1.2s ease-in-out infinite; border-color: var(--c) !important; }
.sp-dot { display: inline-block; width: 6px; height: 6px; margin: 0 2px; border-radius: 9999px; background: #94a3b8; animation: spDots 1s ease-in-out infinite; }
.sp-bubble { position: relative; display: inline-block; max-width: 100%; padding: 4px 12px; border-radius: 14px 14px 14px 3px; font-size: 13px; font-weight: 800; color: #0f172a; background: #e2e8f0; animation: spPop .4s ease-out both; word-break: break-word; }
.sp-card { perspective: 900px; width: min(250px, 68vw); aspect-ratio: 3 / 4; margin: 0 auto; user-select: none; -webkit-user-select: none; touch-action: none; cursor: pointer; }
.sp-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .6s cubic-bezier(.2,.8,.2,1); }
.sp-flip { transform: rotateY(180deg); }
.sp-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 16px; border: 3px solid rgba(255,255,255,.8); overflow: hidden; }
.sp-front { background: repeating-linear-gradient(45deg, #1e1b4b 0 10px, #17143d 10px 20px); box-shadow: 0 0 30px rgba(192,132,252,.35); }
.sp-back { transform: rotateY(180deg); }
.sp-glitch { position: relative; display: inline-block; font-weight: 900; color: #fff; }
.sp-glitch::before, .sp-glitch::after { content: attr(data-text); position: absolute; left: 0; top: 0; width: 100%; }
.sp-glitch::before { color: #f43f5e; animation: spGlitchA .9s steps(2) infinite; }
.sp-glitch::after { color: #22d3ee; animation: spGlitchB .7s steps(2) infinite; }
.sp-stamp { position: absolute; right: -4px; top: -10px; padding: 2px 10px; border: 3px solid #f43f5e; color: #f43f5e; font-size: 12px; font-weight: 900; border-radius: 8px; background: rgba(3,7,18,.85); animation: spStamp .4s ease-out both; z-index: 5; }
.sp-vote { position: relative; border-radius: 18px; border: 2px solid #334155; background: #0f172a; padding: 12px 8px; transition: transform .2s, border-color .2s, box-shadow .2s; }
.sp-vote-ok { cursor: pointer; }
.sp-vote-ok:hover { transform: translateY(-4px) scale(1.04); border-color: #f43f5e; box-shadow: 0 0 20px rgba(244,63,94,.45); }
.sp-drum { animation: spDrum .45s ease-in-out infinite; }
.sp-wring { position: absolute; left: 50%; top: 50%; width: 120px; height: 120px; border-radius: 9999px; border: 4px solid; animation: spRing 1.1s ease-out infinite; pointer-events: none; }
.sp-verdict { font-size: clamp(24px, 6vw, 40px); font-weight: 900; font-style: italic; }
`;

function SpyRoleFace({ isSpy, word, category, show }: { isSpy: boolean; word: string; category: string; show: boolean }) {
  return (
    <div className="sp-card">
      <div className={`sp-inner ${show ? 'sp-flip' : ''}`}>
        <div className="sp-face sp-front">
          <div className="sp-float text-6xl">🎭</div>
          <p className="mt-4 text-xs font-black tracking-[0.3em] text-violet-200">SECRET ROLE</p>
          <p className="sp-pulse mt-2 text-[11px] font-bold text-violet-300">HOLD TO REVEAL</p>
        </div>
        <div className="sp-face sp-back"
          style={isSpy
            ? { background: 'radial-gradient(circle at 50% 30%, #7f1d1d, #1c0508)', boxShadow: '0 0 40px rgba(244,63,94,.6)' }
            : { background: 'radial-gradient(circle at 50% 30%, #312e81, #0b1030)', boxShadow: '0 0 40px rgba(34,211,238,.45)' }}>
          {isSpy ? (
            <>
              <div className="text-6xl">🕵️</div>
              <p className="sp-glitch mt-3 text-2xl" data-text="YOU ARE THE SPY">YOU ARE THE SPY</p>
              <p className="mt-3 text-xs leading-relaxed text-rose-200">Tumhe word nahi pata. Hints sun ke blend in karo!</p>
              <p className="mt-2 text-[11px] font-bold text-rose-300">Category: {category}</p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold tracking-widest text-cyan-300">{category}</p>
              <p className="mt-3 text-3xl font-black text-white" style={{ textShadow: '0 0 20px #22d3ee' }}>{word}</p>
              <p className="mt-4 text-xs leading-relaxed text-slate-300">Spy ko pata na chale! Hint aisa do jo sab samjhein par spy nahi.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ShadowSpyGame({ room, user }: any) {
  const allPlayers: { uid: string; name: string }[] = (room.players || []).filter((p: any) => Boolean(p.uid));
  const roomPlayers = allPlayers.slice(0, SP_MAX);
  const gamePath = `spy/${room.id}/gameState`;
  const isHost = room.hostId === user.uid;
  const presentKey = roomPlayers.map((p) => p.uid).join('|');
  const me = user.uid;

  const [game, setGame] = useState<SpyState | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [peek, setPeek] = useState(false);
  const [hintText, setHintText] = useState('');
  const [banner, setBanner] = useState<{ n: number; t: string } | null>(null);
  const [shake, setShake] = useState(false);

  const offset = useRef(0);
  const tried = useRef(-1);
  const prev = useRef({ phaseN: -1, hintN: -1, voteN: -1 });

  const nameOf = (uid?: string) => allPlayers.find((p) => p.uid === uid)?.name || 'Player';

  useEffect(() => {
    const unsub = onValue(ref(rtdb, '.info/serverTimeOffset'), (s) => { offset.current = s.val() || 0; });
    return () => unsub();
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now() + offset.current), 100);
    return () => window.clearInterval(t);
  }, []);

  // Firebase sync + sounds + banners
  useEffect(() => {
    const gameRef = ref(rtdb, gamePath);
    const unsub = onValue(
      gameRef,
      (snap) => {
        const data = snap.val();
        if (!data) {
          void runTransaction(gameRef, (cur) => cur ?? spyLobby()).catch((e) => {
            console.error('Spy init failed:', e);
            setMessage('Game start nahi hua. Firebase rules check karo.');
          });
          return;
        }
        const g = spyNormalize(data);
        const p = prev.current;

        if (p.phaseN >= 0 && g.phaseN !== p.phaseN && g.phase !== 'lobby') {
          if (SP_BANNER[g.phase]) {
            setBanner({ n: g.phaseN, t: g.phase });
            window.setTimeout(() => setBanner((b) => (b && b.n === g.phaseN ? null : b)), 1500);
            soundFX._play('triangle', 300, 700, 0.18);
          }
          if (g.phase === 'result') {
            [0, 300, 600, 900, 1200, 1500].forEach((t) => window.setTimeout(() => soundFX._play('sine', 120, 90, 0.12), t));
            window.setTimeout(() => {
              setShake(true);
              window.setTimeout(() => setShake(false), 460);
              const iAmSpy = g.spy === user.uid;
              const iWin = (g.winner === 'spy') === iAmSpy;
              if (iWin) [0, 130, 260].forEach((t, i) => window.setTimeout(() => soundFX._play('triangle', [523, 659, 784][i], [659, 784, 1047][i], 0.22), t));
              else window.setTimeout(() => soundFX._play('sawtooth', 300, 100, 0.45), 0);
            }, 4200);
          }
        }
        if (p.hintN >= 0 && g.hintN > p.hintN) soundFX._play('sine', 400, 900, 0.1);
        if (p.voteN >= 0 && g.voteN > p.voteN) soundFX._play('square', 300, 200, 0.07);

        prev.current = { phaseN: g.phaseN, hintN: g.hintN, voteN: g.voteN };
        setGame(g);
      },
      (err) => { console.error(err); setMessage('Database connection failed.'); }
    );
    return () => unsub();
  }, [gamePath]);

  const advance = (phaseN: number, force = false) =>
    runTransaction(ref(rtdb, gamePath), (cur) => {
      if (!cur) return;
      const s = spyNormalize(cur);
      const now = Date.now() + offset.current;
      if (s.phaseN !== phaseN || s.phase === 'lobby' || s.phase === 'result') return;
      if (!force && now < s.phaseEnd - 200) return;
      if (s.phase === 'reveal') {
        s.turn = 0;
        spyGo(s, 'hint', now, SP_HINT);
      } else if (s.phase === 'hint') {
        const uid = s.playerIds[s.turn];
        if (!s.hints[uid]) s.hints[uid] = '— (skipped)';
        spyAfterHint(s, now);
      } else if (s.phase === 'discuss') {
        spyGo(s, 'vote', now, SP_VOTE);
      } else if (s.phase === 'vote') {
        spyTally(s, now);
      }
      return s;
    });

  // timer detector (har seated client try karta hai, transaction ek hi baar commit hoga)
  useEffect(() => {
    if (!game || game.phaseEnd <= 0) return;
    if (!game.playerIds.includes(me) && !isHost) return;
    if (nowMs < game.phaseEnd + 300 || tried.current === game.phaseN) return;
    const pn = game.phaseN;
    tried.current = pn;
    void advance(pn)
      .catch(console.error)
      .finally(() => window.setTimeout(() => { if (tried.current === pn) tried.current = -1; }, 1500));
  }, [nowMs, game?.phaseN]);

  // host: koi player room chhod de to round abort
  useEffect(() => {
    if (!game || !isHost) return;
    if (game.phase === 'lobby' || game.phase === 'result') return;
    const present = roomPlayers.map((p) => p.uid);
    if (!game.playerIds.some((id) => !present.includes(id))) return;
    void runTransaction(ref(rtdb, gamePath), (cur) => {
      if (!cur) return;
      const s = spyNormalize(cur);
      if (s.phase === 'lobby' || s.phase === 'result') return;
      if (!s.playerIds.some((id) => !present.includes(id))) return;
      return spyLobby(s.wins, 'Ek player room chhod gaya — round cancel ho gaya.', s.round, s.phaseN + 1);
    }).catch(console.error);
  }, [presentKey, game?.phase]);

  useEffect(() => { setPeek(false); }, [game?.round]);
  useEffect(() => { setHintText(''); }, [game?.turn, game?.round]);

  const startGame = async () => {
    if (busy || roomPlayers.length < SP_MIN) return;
    setBusy(true);
    setMessage('');
    const seated = roomPlayers.map((p) => p.uid);
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        const s = cur ? spyNormalize(cur) : spyLobby();
        if ((s.phase !== 'lobby' && s.phase !== 'result') || seated.length < SP_MIN) return;
        return spyStart(s, seated, Date.now() + offset.current);
      });
    } catch (e) {
      console.error(e);
      setMessage('Start nahi ho paya.');
    }
    setBusy(false);
  };

  const sendHint = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = hintText.trim().split(/\s+/)[0]?.slice(0, 20);
    if (!text || busy) return;
    setBusy(true);
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        if (!cur) return;
        const s = spyNormalize(cur);
        if (s.phase !== 'hint' || s.playerIds[s.turn] !== me || s.hints[me]) return;
        s.hints[me] = text;
        s.hintN += 1;
        spyAfterHint(s, Date.now() + offset.current);
        return s;
      });
      setHintText('');
    } catch (err) {
      console.error(err);
      setMessage('Hint sync nahi hua.');
    }
    setBusy(false);
  };

  const castVote = async (target: string) => {
    if (busy) return;
    setBusy(true);
    soundFX.playClick();
    try {
      await runTransaction(ref(rtdb, gamePath), (cur) => {
        if (!cur) return;
        const s = spyNormalize(cur);
        if (s.phase !== 'vote' || !s.playerIds.includes(me) || !s.playerIds.includes(target) || target === me) return;
        s.votes[me] = target;
        s.voteN += 1;
        if (s.playerIds.every((id) => s.votes[id])) spyTally(s, Date.now() + offset.current);
        return s;
      });
    } catch (err) {
      console.error(err);
      setMessage('Vote sync nahi hua.');
    }
    setBusy(false);
  };

  const skip = () => { if (game) void advance(game.phaseN, true).catch(console.error); };

  if (!game) return <div className="p-8 text-center text-white">{message || 'Gathering the suspects...'}</div>;

  // ---------- derived ----------
  const inGame = game.playerIds.includes(me);
  const isSpy = game.spy === me;
  const active = game.phase !== 'lobby' && game.phase !== 'result';
  const myTurnHint = game.phase === 'hint' && game.playerIds[game.turn] === me && !game.hints[me];
  const dur = game.phaseEnd - game.phaseStart;
  const timeFrac = game.phaseEnd > 0 && dur > 0 ? Math.min(1, Math.max(0, (game.phaseEnd - nowMs) / dur)) : 1;
  const secsLeft = game.phaseEnd > 0 ? Math.max(0, Math.ceil((game.phaseEnd - nowMs) / 1000)) : 0;
  const since = nowMs - game.phaseStart;
  const stage = game.phase === 'result' ? (since < 1800 ? 0 : since < 4200 ? 1 : 2) : 0;
  const myVote = game.votes[me];
  const voted = game.playerIds.filter((id) => game.votes[id]).length;
  const crewWon = game.winner === 'crew';
  const iWon = game.phase === 'result' && inGame && (game.winner === 'spy') === isSpy;
  const turnUid = game.playerIds[game.turn];
  const colorOf = (uid: string) => SP_COLORS[Math.max(0, game.playerIds.indexOf(uid)) % SP_COLORS.length];
  const avatarOf = (uid: string) => SP_AVATARS[Math.max(0, game.playerIds.indexOf(uid)) % SP_AVATARS.length];

  const turnText =
    game.phase === 'reveal' ? 'Apna role dekho 🤫'
      : game.phase === 'hint' ? (myTurnHint ? '✍️ YOUR HINT!' : `${nameOf(turnUid)} hint de raha hai`)
        : game.phase === 'discuss' ? 'Discuss karo — Room Chat use karo'
          : game.phase === 'vote' ? (myVote ? 'Vote lock! Baaki ka wait...' : 'Spy ko vote karo!')
            : 'Result';

  // ---------- LOBBY ----------
  if (game.phase === 'lobby') {
    return (
      <div className="mx-auto w-full max-w-xl space-y-5 py-4 text-white">
        <style>{SPY_CSS}</style>
        <header className="text-center">
          <h2 className="text-3xl font-black tracking-tight"><span className="text-violet-400">FIND THE</span> SPY</h2>
          <p className="mt-1 text-sm text-slate-400">{SP_MIN}–{SP_MAX} players · Hints · Discussion · Vote</p>
        </header>

        {game.note && <div className="sp-in rounded-xl border border-yellow-700/50 bg-yellow-950/30 p-2 text-center text-xs text-yellow-300">{game.note}</div>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: SP_MAX }, (_, i) => {
            const p = roomPlayers[i];
            return (
              <div key={i} className={`sp-in flex flex-col items-center rounded-2xl border p-3 ${p ? 'bg-slate-900' : 'border-dashed border-slate-700 bg-slate-950/40'}`}
                style={{ animationDelay: `${i * 0.06}s`, ...(p ? { borderColor: SP_COLORS[i], boxShadow: `0 0 14px ${SP_COLORS[i]}44` } : {}) }}>
                <div className={`text-4xl ${p ? 'sp-float' : ''}`} style={{ animationDelay: `${i * 0.3}s` }}>{p ? SP_AVATARS[i] : <span className="sp-pulse text-slate-600">?</span>}</div>
                <div className="mt-1 max-w-full truncate text-xs font-bold" style={{ color: p ? SP_COLORS[i] : '#475569' }}>{p ? p.name : 'Waiting...'}</div>
                {p && <div className="text-[10px] font-mono text-yellow-300">🏆 {game.wins[p.uid] || 0}</div>}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-[12px] leading-relaxed text-slate-400">
          <p>🎭 Sabko secret role milega. Normal players ko <b className="text-cyan-300">same word</b>, Spy ko <b className="text-rose-300">word nahi</b>.</p>
          <p className="mt-1">💬 Sab ek-ek word ka hint denge → 🗣️ discussion → 🗳️ vote. Spy pakda gaya to crew jeeta, warna Spy jeeta! 😈</p>
        </div>

        <div className="text-center">
          {isHost ? (
            <button onClick={startGame} disabled={busy || roomPlayers.length < SP_MIN}
              className="rounded-full bg-violet-500 px-10 py-3 text-sm font-black text-white transition hover:scale-105 hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:hover:scale-100">
              {roomPlayers.length < SP_MIN ? `NEED ${SP_MIN}+ PLAYERS` : '🕵️ START GAME'}
            </button>
          ) : (
            <p className="sp-pulse text-sm text-cyan-300">Waiting for host to start...</p>
          )}
          <p className="mt-3 text-xs text-slate-500">Room code: <span className="font-mono text-cyan-300">{room.code}</span></p>
          {message && <p className="mt-2 text-xs text-rose-300">{message}</p>}
        </div>
      </div>
    );
  }

  // ---------- hints board ----------
  const board = (
    <div className="relative z-10 mx-auto max-w-md space-y-2">
      {game.playerIds.map((uid, i) => {
        const h = game.hints[uid];
        const isTurn = game.phase === 'hint' && game.turn === i;
        const col = colorOf(uid);
        return (
          <div key={uid} className={`sp-in flex items-center gap-3 rounded-2xl border bg-slate-900/80 px-3 py-2 ${isTurn ? 'sp-active' : 'border-slate-700'}`}
            style={{ ['--c' as any]: col, animationDelay: `${i * 0.05}s` }}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-xl" style={{ borderColor: col }}>{avatarOf(uid)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold" style={{ color: col }}>
                {nameOf(uid)}{uid === me && <span className="ml-1 text-[10px] text-cyan-400">(You)</span>}
              </div>
              <div className="mt-0.5 min-h-[26px]">
                {h ? <span key={h} className="sp-bubble">{h}</span>
                  : isTurn ? <span><i className="sp-dot" /><i className="sp-dot" style={{ animationDelay: '.15s' }} /><i className="sp-dot" style={{ animationDelay: '.3s' }} /></span>
                    : <span className="text-[11px] text-slate-600">waiting…</span>}
              </div>
            </div>
            <span className="text-xs font-mono text-yellow-300">🏆 {game.wins[uid] || 0}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={`mx-auto w-full max-w-3xl space-y-4 text-white ${shake ? 'sp-shake' : ''}`}>
      <style>{SPY_CSS}</style>
      {iWon && stage === 2 && <LudoConfetti />}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tight"><span className="text-violet-400">FIND THE</span> SPY</h2>
          <p className="mt-1 text-sm text-slate-400">Round {game.round} · {game.playerIds.length} players · {game.category}</p>
        </div>
        <div key={`${game.phase}-${game.turn}-${!!myVote}`} className="sp-pop rounded-full border px-4 py-2 text-sm font-bold"
          style={{ borderColor: myTurnHint ? '#f43f5e' : 'rgba(192,132,252,.45)', background: myTurnHint ? 'rgba(244,63,94,.18)' : 'rgba(46,16,101,.45)', color: myTurnHint ? '#fda4af' : '#ddd6fe' }}>
          {turnText}
        </div>
      </header>

      {/* step bar */}
      <div className="flex items-center justify-center gap-1.5">
        {SP_STEPS.map((st, i) => {
          const idx = SP_STEPS.findIndex((x) => x.id === game.phase);
          const done = i < idx, cur = i === idx;
          return (
            <div key={st.id} className="flex items-center gap-1.5">
              <div className={`rounded-full px-3 py-1 text-[10px] font-black tracking-wider transition-all ${cur ? 'sp-pulse bg-violet-500 text-white' : done ? 'bg-violet-950 text-violet-300' : 'bg-slate-900 text-slate-600'}`}>{st.label}</div>
              {i < SP_STEPS.length - 1 && <span className={`h-px w-3 ${done ? 'bg-violet-500' : 'bg-slate-700'}`} />}
            </div>
          );
        })}
      </div>

      {!inGame && (
        <div className="rounded-xl border border-yellow-700/50 bg-yellow-950/30 p-3 text-center text-xs text-yellow-300">
          Aap spectator ho — agla game start hone par seat milegi.
        </div>
      )}

      <div className="sp-stage">
        <div className="sp-fog" />
        <div className="sp-scan" />

        {/* timer */}
        {active && game.phaseEnd > 0 && (
          <div className="relative z-10 mx-auto mb-4 max-w-md">
            <div className="mb-1 flex justify-between text-[10px] font-mono text-slate-400"><span>TIME</span><span className={secsLeft <= 5 ? 'font-black text-rose-400' : ''}>{secsLeft}s</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div style={{ width: `${timeFrac * 100}%`, height: '100%', background: timeFrac < 0.25 ? '#f43f5e' : '#a78bfa', transition: 'width .1s linear, background .3s' }} />
            </div>
          </div>
        )}

        {/* REVEAL */}
        {game.phase === 'reveal' && (
          <div className="relative z-10 space-y-5 text-center">
            {inGame ? (
              <>
                <div onPointerDown={() => { setPeek(true); soundFX.playClick(); }} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onPointerCancel={() => setPeek(false)}>
                  <SpyRoleFace isSpy={isSpy} word={game.word} category={game.category} show={peek} />
                </div>
                <p className="text-xs text-slate-400">Card ko <b className="text-violet-300">dabake rakho</b> role dekhne ke liye. Chhodte hi chhup jayega 🤫</p>
              </>
            ) : <p className="py-10 text-sm text-slate-400">Players apna role dekh rahe hain...</p>}
            {isHost && <button onClick={skip} className="rounded-full border border-slate-600 bg-slate-900 px-5 py-1.5 text-[11px] font-bold text-slate-300">SKIP →</button>}
          </div>
        )}

        {/* HINT */}
        {game.phase === 'hint' && (
          <div className="relative z-10 space-y-4">
            {board}
            {myTurnHint && (
              <form onSubmit={sendHint} className="sp-pop mx-auto flex max-w-md gap-2">
                <input autoFocus value={hintText} onChange={(e) => setHintText(e.target.value)} maxLength={20} placeholder="Sirf ek word ka hint..."
                  className="flex-1 rounded-xl border border-rose-500/60 bg-black px-4 py-2.5 text-sm text-white outline-none focus:border-rose-400" />
                <button type="submit" disabled={busy || !hintText.trim()} className="rounded-xl bg-rose-500 px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">SEND</button>
              </form>
            )}
            <p className="text-center text-[11px] text-slate-500">{isSpy && inGame ? '🕵️ Tum spy ho — pichhle hints se word guess karke blend in karo!' : 'Hint itna clear na ho ki spy samajh jaye!'}</p>
          </div>
        )}

        {/* DISCUSS */}
        {game.phase === 'discuss' && (
          <div className="relative z-10 space-y-4">
            {board}
            <p className="sp-pulse text-center text-sm font-bold text-yellow-300">💬 Neeche Room Chat mein discuss karo — kaun spy hai?</p>
            {isHost && <div className="text-center"><button onClick={skip} className="rounded-full bg-white px-6 py-2 text-xs font-extrabold text-black transition hover:scale-105">START VOTING →</button></div>}
          </div>
        )}

        {/* VOTE */}
        {game.phase === 'vote' && (
          <div className="relative z-10 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {game.playerIds.map((uid) => {
                const can = inGame && !busy && uid !== me;
                const mine = myVote === uid;
                const col = colorOf(uid);
                return (
                  <button key={uid} disabled={!can} onClick={() => castVote(uid)}
                    className={`sp-vote sp-in text-center ${can ? 'sp-vote-ok' : ''}`}
                    style={mine ? { borderColor: '#f43f5e', boxShadow: '0 0 22px rgba(244,63,94,.6)' } : undefined}>
                    {mine && <span className="sp-stamp">SUSPECT</span>}
                    <div className="text-4xl">{avatarOf(uid)}</div>
                    <div className="mt-1 truncate text-xs font-bold" style={{ color: col }}>{nameOf(uid)}{uid === me && ' (You)'}</div>
                    <div className="mt-1 min-h-[16px] truncate text-[11px] font-bold text-slate-300">{game.hints[uid] || ''}</div>
                    {game.votes[uid] && <div className="sp-pop mt-1 text-[10px] text-emerald-400">✔ voted</div>}
                  </button>
                );
              })}
            </div>
            <p className="text-center text-xs text-slate-400">{voted}/{game.playerIds.length} votes in · tie hua to Spy bach jayega 😈</p>
          </div>
        )}

        {/* RESULT */}
        {game.phase === 'result' && (
          <div className="relative z-10 min-h-[320px] space-y-4 text-center">
            {stage === 0 && (
              <div className="relative flex min-h-[300px] flex-col items-center justify-center">
                <span className="sp-wring" style={{ borderColor: '#a78bfa' }} />
                <span className="sp-wring" style={{ borderColor: '#f43f5e', animationDelay: '.35s' }} />
                <div className="sp-drum text-6xl">🥁</div>
                <p className="sp-pulse mt-4 text-xl font-black text-violet-200">Votes ginn rahe hain...</p>
              </div>
            )}
            {stage === 1 && (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
                {game.accused ? (
                  <>
                    <p className="text-sm font-bold text-slate-300">Group ne chuna...</p>
                    <div className="sp-pop flex h-28 w-28 items-center justify-center rounded-full border-4 text-6xl" style={{ borderColor: colorOf(game.accused), boxShadow: `0 0 40px ${colorOf(game.accused)}88` }}>{avatarOf(game.accused)}</div>
                    <p className="sp-pop text-2xl font-black" style={{ color: colorOf(game.accused) }}>{nameOf(game.accused)}</p>
                    <p className="sp-pulse text-sm font-bold text-rose-300">Kya yehi Spy hai? 😰</p>
                  </>
                ) : (
                  <>
                    <div className="sp-pop text-6xl">🤝</div>
                    <p className="sp-pop text-2xl font-black text-yellow-300">Votes tie ho gaye!</p>
                  </>
                )}
              </div>
            )}
            {stage === 2 && (
              <div className="space-y-4">
                <div className="sp-pop">
                  <div className="text-6xl" style={{ animation: 'spFloat 1.6s ease-in-out infinite' }}>{crewWon ? '🎉' : '😈'}</div>
                  <p className="sp-verdict mt-1" style={{ color: crewWon ? '#4ade80' : '#fb7185', textShadow: `0 0 24px ${crewWon ? '#22c55e' : '#f43f5e'}` }}>
                    {crewWon ? 'SPY CAUGHT! CREW WINS' : 'SPY ESCAPED! SPY WINS'}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {game.accused
                      ? crewWon ? `${nameOf(game.accused)} hi Spy tha!` : `${nameOf(game.accused)} to innocent tha...`
                      : 'Koi clear majority nahi mili.'}
                  </p>
                </div>

                <div className="sp-in mx-auto flex max-w-sm items-center justify-center gap-4 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 text-4xl" style={{ borderColor: colorOf(game.spy) }}>{avatarOf(game.spy)}</div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold tracking-widest text-rose-300">THE SPY WAS</p>
                    <p className="sp-glitch text-xl" data-text={nameOf(game.spy)}>{nameOf(game.spy)}</p>
                    <p className="mt-1 text-xs text-slate-300">Secret word: <b className="text-cyan-300">{game.word}</b></p>
                  </div>
                </div>

                <div className="sp-in mx-auto flex max-w-md flex-wrap justify-center gap-2">
                  {game.playerIds.map((uid) => (
                    <span key={uid} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px]">
                      <b style={{ color: colorOf(uid) }}>{nameOf(uid)}</b>
                      <span className="text-slate-500"> → </span>
                      <span className="text-slate-300">{game.votes[uid] ? nameOf(game.votes[uid]) : 'no vote'}</span>
                      <span className="ml-1 text-yellow-300">({game.tally[uid] || 0})</span>
                    </span>
                  ))}
                </div>

                {inGame && (
                  <p className="text-xs font-bold" style={{ color: iWon ? '#4ade80' : '#fb7185' }}>{iWon ? '🏆 Tum jeet gaye!' : 'Agli baar better luck!'}</p>
                )}
                {(isHost || inGame) && (
                  <button onClick={startGame} disabled={busy || roomPlayers.length < SP_MIN}
                    className="rounded-full bg-white px-8 py-2.5 text-xs font-extrabold text-black transition hover:scale-105 disabled:opacity-50">PLAY AGAIN</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* phase banner */}
        {banner && SP_BANNER[banner.t] && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/35">
            <span key={banner.n} className="sp-banner" style={{ color: SP_BANNER[banner.t].color }}>{SP_BANNER[banner.t].text}</span>
          </div>
        )}
      </div>

      {/* my role (hold to peek) */}
      {inGame && active && game.phase !== 'reveal' && (
        <div className="flex flex-col items-center gap-3">
          {peek && <div className="sp-pop"><SpyRoleFace isSpy={isSpy} word={game.word} category={game.category} show /></div>}
          <button
            onPointerDown={() => { setPeek(true); soundFX.playClick(); }} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onPointerCancel={() => setPeek(false)}
            className="select-none rounded-full border border-violet-500/50 bg-violet-950/50 px-6 py-2 text-xs font-bold text-violet-200 transition active:scale-95"
            style={{ touchAction: 'none' }}>
            👁️ HOLD TO SEE MY ROLE
          </button>
        </div>
      )}

      {message && <p className="text-center text-xs text-rose-300">{message}</p>}
    </div>
  );
}


// ============================================================================
// WORDLE BATTLE  —  2 to 5 players, same secret 5-letter word, race to solve
// PASTE THIS AT THE VERY BOTTOM OF App.tsx. Koi naya import nahi chahiye
// (useState, useEffect, useRef, ref, onValue, runTransaction, rtdb, soundFX,
//  LudoConfetti sab already hain).
// ============================================================================

type WdPhase = 'lobby' | 'playing' | 'finished';

type WdState = {
  phase: WdPhase;
  playerIds: string[];
  word: string;
  guesses: Record<string, string[]>;
  guessN: number;
  round: number;
  winner: string;
  finishedAt: number;
  wins: Record<string, number>;
  note: string;
};

const WD_MIN = 2;
const WD_MAX = 5;
const WD_LEN = 5;
const WD_TRIES = 25;
const WD_AVATARS = ['🦊', '🐺', '🦁', '🐙', '🦄'];
const WD_PCOL = ['#22d3ee', '#c084fc', '#f97316', '#22c55e', '#facc15'];
const WD_BG: Record<string, string> = { g: '#22c55e', y: '#facc15', r: '#dc2626' };
const WD_KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const WD_WORDS = (
  'apple brick chair dance eagle flame grape house image joker knife lemon mango night ocean piano queen river snake tiger ' +
  'uncle voice water young zebra beach bread candy cloud crown dream earth fruit ghost heart juice light money music paint ' +
  'plant pizza radio shirt smile sport storm sugar table tooth train truck watch whale world youth angel baker camel diary ' +
  'fairy giant honey input jelly koala lunch magic noble olive peach quiet robot salad tulip urban vivid wagon xerox yacht ' +
  'zesty actor bacon cabin daisy elbow fever glass habit icing jewel kitty ladder medal nurse orbit panda quilt rival scarf ' +
  'tower unity vault wheel yummy bonus cable drama enjoy flute grain hobby ivory jolly lemon maple novel onion pearl quest ' +
  'ranch spice trail umbra video woman agent blaze charm denim ember frost grace happy ideal juicy lucky minor nylon opera ' +
  'prize quote reign solar tango unite vigor waltz crisp brave clean drink flash front green house inbox laugh march ocean ' +
  'party quick round shine think usual voter world yield'
).toUpperCase().split(' ').filter((w, i, a) => w.length === 5 && a.indexOf(w) === i);

const wdArr = (x: any): any[] => (Array.isArray(x) ? x.slice() : Object.values(x || {}));

function wdPattern(guess: string, word: string): string {
  const res: string[] = Array(WD_LEN).fill('r');
  const left: Record<string, number> = {};
  for (let i = 0; i < WD_LEN; i++) {
    if (guess[i] === word[i]) res[i] = 'g';
    else left[word[i]] = (left[word[i]] || 0) + 1;
  }
  for (let i = 0; i < WD_LEN; i++) {
    if (res[i] !== 'g' && left[guess[i]] > 0) { res[i] = 'y'; left[guess[i]]--; }
  }
  return res.join('');
}

function wdLobby(wins: Record<string, number> = {}, note = '', round = 0, guessN = 0): WdState {
  return { phase: 'lobby', playerIds: [], word: '', guesses: {}, guessN, round, winner: '', finishedAt: 0, wins, note };
}

function wdNormalize(d: any): WdState {
  const playerIds: string[] = wdArr(d.playerIds);
  const guesses: Record<string, string[]> = {};
  playerIds.forEach((id) => { guesses[id] = wdArr(d.guesses?.[id]); });
  return {
    phase: d.phase || 'lobby', playerIds, word: d.word || '', guesses, guessN: d.guessN || 0, round: d.round || 0,
    winner: d.winner || '', finishedAt: d.finishedAt || 0, wins: d.wins || {}, note: d.note || '',
  };
}

function wdStart(s: WdState, ids: string[]): WdState {
  const guesses: Record<string, string[]> = {};
  ids.forEach((id) => { guesses[id] = []; });
  return {
    ...s, phase: 'playing', playerIds: ids, word: WD_WORDS[Math.floor(Math.random() * WD_WORDS.length)],
    guesses, round: s.round + 1, winner: '', finishedAt: 0, note: '',
  };
}

const wdExhausted = (s: WdState) => s.playerIds.every((id) => (s.guesses[id] || []).length >= WD_TRIES);

const WD_CSS = `
@keyframes wdFlip { 0% { transform: rotateX(0); background: #0f172a; } 49% { transform: rotateX(90deg); background: #0f172a; } 50% { transform: rotateX(90deg); background: var(--bg); } 100% { transform: rotateX(0); background: var(--bg); } }
@keyframes wdPop { 0% { transform: scale(.8); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes wdShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-7px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
@keyframes wdDance { 0%,100% { transform: translateY(0); } 30% { transform: translateY(-14px) scale(1.12); } 60% { transform: translateY(2px); } }
@keyframes wdIn { 0% { transform: translateY(12px) scale(.92); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes wdToast { 0% { transform: translateY(-20px) scale(.8); opacity: 0; } 15% { transform: none; opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(-10px); opacity: 0; } }
@keyframes wdPulse { 0%,100% { opacity: .5; } 50% { opacity: 1; } }
@keyframes wdFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes wdGlow { 0%,100% { box-shadow: 0 0 0 0 var(--c), 0 0 12px var(--c); } 50% { box-shadow: 0 0 0 7px transparent, 0 0 24px var(--c); } }
@keyframes wdVictory { 0%,100% { transform: scale(1) rotate(-5deg); } 50% { transform: scale(1.18) rotate(5deg); } }
@keyframes ludoConfetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }

.wd-row { display: flex; gap: 6px; justify-content: center; }
.wd-shake { animation: wdShake .4s ease-in-out; }
.wd-tile { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-size: 22px; font-weight: 900; color: #fff; border: 2px solid #334155; background: #0f172a; text-shadow: 0 1px 2px rgba(0,0,0,.5); }
.wd-done { background: var(--bg); border-color: transparent; }
.wd-flip { animation: wdFlip .6s ease both; border-color: transparent; }
.wd-typed { border-color: #94a3b8; animation: wdPop .12s ease-out; }
.wd-dance { animation: wdDance .8s ease-in-out infinite; }
.wd-mini { width: 21px; height: 21px; border-radius: 5px; background: var(--bg); font-size: 12px; font-weight: 900; color: #fff; display: flex; align-items: center; justify-content: center; }
.wd-key { height: 46px; min-width: 0; flex: 1; border-radius: 8px; border: 0; font-weight: 900; font-size: 14px; color: #fff; background: #334155; cursor: pointer; transition: transform .08s, background .25s; }
.wd-key:active { transform: scale(.9); }
.wd-key-wide { flex: 1.5; font-size: 11px; }
.wd-in { animation: wdIn .35s ease-out both; }
.wd-toast { animation: wdToast 2.4s ease-out forwards; }
.wd-pulse { animation: wdPulse 1.2s ease-in-out infinite; }
.wd-float { animation: wdFloat 2.4s ease-in-out infinite; }
.wd-active { animation: wdGlow 1.4s ease-in-out infinite; border-color: var(--c) !important; }
.wd-victory { animation: wdVictory 1s ease-in-out infinite; }
@media (max-width: 400px) { .wd-tile { width: 38px; height: 38px; font-size: 19px; } }
`;

function WdMini({ guesses, word, reveal }: { guesses: string[]; word: string; reveal: boolean }) {
  return (
    <div className="space-y-[3px]">
      {guesses.map((g, r) => (
        <div key={r} className="flex gap-[3px]">
          {wdPattern(g, word).split('').map((p, i) => (
            <span key={i} className="wd-mini" style={{ ['--bg' as any]: WD_BG[p] }}>{reveal ? g[i] : ''}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function WordleBattleGame({ room, user }: any) {
  const allPlayers: { uid: string; name: string }[] = (room.players || []).filter((p: any) => Boolean(p.uid));
  const roomPlayers = allPlayers.slice(0, WD_MAX);
  const gamePath = `wordle/${room.id}/gameState`;
  const isHost = room.hostId === user.uid;
  const presentKey = roomPlayers.map((p) => p.uid).join('|');
  const me = user.uid;

  const [game, setGame] = useState<WdState | null>(null);
  const [cur, setCur] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [shakeRow, setShakeRow] = useState(false);
  const [toast, setToast] = useState<{ n: number; text: string } | null>(null);
  const [shake, setShake] = useState(false);

  const offset = useRef(0);
  const prev = useRef<{ guessN: number; phase: string; lens: Record<string, number> } | null>(null);
  const animFrom = useRef<Record<string, number>>({});
  const boardRef = useRef<HTMLDivElement>(null);

  const nameOf = (uid?: string) => allPlayers.find((p) => p.uid === uid)?.name || 'Player';

  useEffect(() => {
    const unsub = onValue(ref(rtdb, '.info/serverTimeOffset'), (s) => { offset.current = s.val() || 0; });
    return () => unsub();
  }, []);

  // Firebase sync + sounds + close-call toast
  useEffect(() => {
    const gameRef = ref(rtdb, gamePath);
    const unsub = onValue(
      gameRef,
      (snap) => {
        const data = snap.val();
        if (!data) {
          void runTransaction(gameRef, (c) => c ?? wdLobby()).catch((e) => {
            console.error('Wordle init failed:', e);
            setMessage('Game start nahi hua. Firebase rules check karo.');
          });
          return;
        }
        const g = wdNormalize(data);
        const p = prev.current;
        const lens: Record<string, number> = {};
        g.playerIds.forEach((id) => { lens[id] = (g.guesses[id] || []).length; });

        if (p) {
          if (g.phase === 'playing' && g.guessN > p.guessN) {
            g.playerIds.forEach((id) => {
              if (id === me || (lens[id] || 0) <= (p.lens[id] || 0)) return;
              const last = g.guesses[id][g.guesses[id].length - 1];
              const greens = wdPattern(last, g.word).split('').filter((x) => x === 'g').length;
              soundFX._play('sine', 350, 600, 0.07);
              if (greens >= 4) {
                const n = g.guessN;
                setToast({ n, text: `⚠️ ${allPlayers.find((a) => a.uid === id)?.name || 'Player'} sirf 1 letter door hai!` });
                window.setTimeout(() => setToast((t) => (t && t.n === n ? null : t)), 2400);
                soundFX._play('square', 300, 500, 0.15);
              }
            });
          }
          if (p.phase === 'playing' && g.phase === 'finished') {
            if (g.winner === me) {
              [0, 130, 260, 400].forEach((t, i) => window.setTimeout(() => soundFX._play('triangle', [523, 659, 784, 1047][i], [659, 784, 1047, 1318][i], 0.22), t));
            } else if (g.winner) {
              window.setTimeout(() => soundFX._play('sawtooth', 300, 100, 0.45), 100);
              setShake(true);
              window.setTimeout(() => setShake(false), 450);
            } else {
              window.setTimeout(() => soundFX._play('sine', 300, 200, 0.4), 100);
            }
          }
          if (p.phase !== 'playing' && g.phase === 'playing') soundFX.playPortal();
        }
        prev.current = { guessN: g.guessN, phase: g.phase, lens };
        setGame(g);
      },
      (err) => { console.error(err); setMessage('Database connection failed.'); }
    );
    return () => unsub();
  }, [gamePath]);

  // host: koi player room chhod de to usko game se hatao
  useEffect(() => {
    if (!game || !isHost || game.phase !== 'playing') return;
    const present = roomPlayers.map((p) => p.uid);
    if (!game.playerIds.some((id) => !present.includes(id))) return;
    void runTransaction(ref(rtdb, gamePath), (c) => {
      if (!c) return;
      const s = wdNormalize(c);
      if (s.phase !== 'playing') return;
      const ids = s.playerIds.filter((id) => present.includes(id));
      if (ids.length === s.playerIds.length) return;
      if (ids.length < WD_MIN) return wdLobby(s.wins, 'Players kam reh gaye — round cancel ho gaya.', s.round, s.guessN + 1);
      s.playerIds = ids;
      if (wdExhausted(s)) { s.phase = 'finished'; s.winner = ''; s.finishedAt = Date.now() + offset.current; }
      return s;
    }).catch(console.error);
  }, [presentKey, game?.phase]);

  useEffect(() => { setCur(''); setMessage(''); }, [game?.round]);

  const myList = game ? game.guesses[me] || [] : [];
  useEffect(() => {
    if (boardRef.current) boardRef.current.scrollTop = boardRef.current.scrollHeight;
  }, [myList.length, cur.length]);

  const inGame = !!game && game.playerIds.includes(me);
  const playing = game?.phase === 'playing';
  const canType = !!game && playing && inGame && myList.length < WD_TRIES && !busy;

  const submit = async () => {
    if (!game || !canType) return;
    if (cur.length < WD_LEN) {
      setShakeRow(true);
      window.setTimeout(() => setShakeRow(false), 420);
      setMessage('5 letters chahiye!');
      return;
    }
    if (myList.includes(cur)) {
      setShakeRow(true);
      window.setTimeout(() => setShakeRow(false), 420);
      setMessage('Ye word pehle try ho chuka hai.');
      return;
    }
    const g = cur;
    setBusy(true);
    setMessage('');
    try {
      await runTransaction(ref(rtdb, gamePath), (c) => {
        if (!c) return;
        const s = wdNormalize(c);
        if (s.phase !== 'playing' || !s.playerIds.includes(me)) return;
        const list = s.guesses[me];
        if (list.length >= WD_TRIES || list.includes(g)) return;
        list.push(g);
        s.guessN += 1;
        const now = Date.now() + offset.current;
        if (g === s.word) {
          s.phase = 'finished';
          s.winner = me;
          s.finishedAt = now;
          s.wins = { ...s.wins, [me]: (s.wins[me] || 0) + 1 };
        } else if (wdExhausted(s)) {
          s.phase = 'finished';
          s.winner = '';
          s.finishedAt = now;
        }
        return s;
      });
      [0, 150, 300, 450, 600].forEach((t, i) => window.setTimeout(() => soundFX._play('sine', 300 + i * 80, 380 + i * 80, 0.06), t));
      setCur('');
    } catch (e) {
      console.error(e);
      setMessage('Guess sync nahi hua.');
    }
    setBusy(false);
  };

  const press = (k: string) => {
    if (!canType) return;
    if (k === 'ENTER') { void submit(); return; }
    if (k === 'BACK') { setCur((c) => c.slice(0, -1)); return; }
    if (/^[A-Z]$/.test(k)) {
      soundFX._play('sine', 500, 560, 0.03);
      setCur((c) => (c.length < WD_LEN ? c + k : c));
    }
  };

  // physical keyboard (room chat input ko disturb nahi karta)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); press('ENTER'); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('BACK'); }
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const startGame = async () => {
    if (busy || roomPlayers.length < WD_MIN) return;
    setBusy(true);
    setMessage('');
    const seated = roomPlayers.map((p) => p.uid);
    try {
      await runTransaction(ref(rtdb, gamePath), (c) => {
        const s = c ? wdNormalize(c) : wdLobby();
        if (s.phase === 'playing' || seated.length < WD_MIN) return;
        return wdStart(s, seated);
      });
    } catch (e) {
      console.error(e);
      setMessage('Start nahi ho paya.');
    }
    setBusy(false);
  };

  const endAsDraw = () => {
    if (!window.confirm('Game draw karke khatam karna hai?')) return;
    void runTransaction(ref(rtdb, gamePath), (c) => {
      if (!c) return;
      const s = wdNormalize(c);
      if (s.phase !== 'playing') return;
      s.phase = 'finished';
      s.winner = '';
      s.finishedAt = Date.now() + offset.current;
      return s;
    }).catch(console.error);
  };

  if (!game) return <div className="p-8 text-center text-white">{message || 'Picking a secret word...'}</div>;

  // ---------- derived ----------
  const finished = game.phase === 'finished';
  const iWon = finished && game.winner === me;
  const draw = finished && !game.winner;
  // SHARED INTEL: sab players ke guesses se milne wali info sabko dikhti hai
  const allGuesses: string[] = game.playerIds.flatMap((id) => game.guesses[id] || []);
  const keyStatus: Record<string, string> = {};
  const found: string[] = Array(WD_LEN).fill('');
  const yellowSet = new Set<string>();
  const absentSet = new Set<string>();
  allGuesses.forEach((g) => {
    wdPattern(g, game.word).split('').forEach((p, i) => {
      const L = g[i];
      const old = keyStatus[L];
      if (!old || (old === 'r' && p !== 'r') || (old === 'y' && p === 'g')) keyStatus[L] = p;
      if (p === 'g') found[i] = L;
      else if (p === 'y') yellowSet.add(L);
      else if (!game.word.includes(L)) absentSet.add(L);
    });
  });
  const yellowOnly = Array.from(yellowSet).filter((L) => !found.includes(L)).sort();
  const absentList = Array.from(absentSet).sort();
  const aKey = `${game.round}-${me}`;
  if (animFrom.current[aKey] === undefined) animFrom.current[aKey] = myList.length;
  const colorOf = (uid: string) => WD_PCOL[Math.max(0, game.playerIds.indexOf(uid)) % WD_PCOL.length];
  const avatarOf = (uid: string) => WD_AVATARS[Math.max(0, game.playerIds.indexOf(uid)) % WD_AVATARS.length];
  const others = game.playerIds.filter((id) => id !== me);

  // ---------- LOBBY ----------
  if (game.phase === 'lobby') {
    return (
      <div className="mx-auto w-full max-w-xl space-y-5 py-4 text-white">
        <style>{WD_CSS}</style>
        <header className="text-center">
          <h2 className="text-3xl font-black tracking-tight"><span className="text-emerald-400">WORDLE</span> BATTLE</h2>
          <p className="mt-1 text-sm text-slate-400">{WD_MIN}–{WD_MAX} players · Same word · Pehle guess karne wala jeetega</p>
        </header>

        {game.note && <div className="wd-in rounded-xl border border-yellow-700/50 bg-yellow-950/30 p-2 text-center text-xs text-yellow-300">{game.note}</div>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: WD_MAX }, (_, i) => {
            const p = roomPlayers[i];
            return (
              <div key={i} className={`wd-in flex flex-col items-center rounded-2xl border p-3 ${p ? 'bg-slate-900' : 'border-dashed border-slate-700 bg-slate-950/40'}`}
                style={{ animationDelay: `${i * 0.06}s`, ...(p ? { borderColor: WD_PCOL[i], boxShadow: `0 0 14px ${WD_PCOL[i]}44` } : {}) }}>
                <div className={`text-4xl ${p ? 'wd-float' : ''}`} style={{ animationDelay: `${i * 0.3}s` }}>{p ? WD_AVATARS[i] : <span className="wd-pulse text-slate-600">?</span>}</div>
                <div className="mt-1 max-w-full truncate text-xs font-bold" style={{ color: p ? WD_PCOL[i] : '#475569' }}>{p ? p.name : 'Waiting...'}</div>
                {p && <div className="text-[10px] font-mono text-yellow-300">🏆 {game.wins[p.uid] || 0}</div>}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-[12px] leading-relaxed text-slate-400">
          <p className="mb-2 text-center text-lg">🟩 🟨 🟥</p>
          <p>🟩 sahi letter, sahi jagah · 🟨 sahi letter, galat jagah · 🟥 letter word mein nahi hai.</p>
          <p className="mt-1">Sabko <b className="text-emerald-300">same random 5-letter word</b> guess karna hai. Har player ke paas max <b className="text-emerald-300">{WD_TRIES} guesses</b>. Jo sabse pehle guess kare wo winner, koi na kar paye to draw 🤝</p>
          <p className="mt-1">🔎 Kisi ne bhi koi letter dhundha to wo <b className="text-emerald-300">sabko live dikhega</b> — clues shared hain, speed se jeeto!</p>
        </div>

        <div className="text-center">
          {isHost ? (
            <button onClick={startGame} disabled={busy || roomPlayers.length < WD_MIN}
              className="rounded-full bg-emerald-500 px-10 py-3 text-sm font-black text-black transition hover:scale-105 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:hover:scale-100">
              {roomPlayers.length < WD_MIN ? `NEED ${WD_MIN}+ PLAYERS` : '🎮 START BATTLE'}
            </button>
          ) : (
            <p className="wd-pulse text-sm text-cyan-300">Waiting for host to start...</p>
          )}
          <p className="mt-3 text-xs text-slate-500">Room code: <span className="font-mono text-cyan-300">{room.code}</span></p>
          {message && <p className="mt-2 text-xs text-rose-300">{message}</p>}
        </div>
      </div>
    );
  }

  const renderTile = (letter: string, status: string | null, key: number, rowIdx: number, kind: 'old' | 'new' | 'typed' | 'empty', danceDelay = 0) => {
    const style: any = status ? { ['--bg' as any]: WD_BG[status] } : {};
    if (kind === 'new') style.animationDelay = `${key * 0.18}s`;
    if (kind === 'old' && iWon && rowIdx === myList.length - 1) style.animationDelay = `${key * 0.1 + danceDelay}s`;
    const cls =
      kind === 'new' ? 'wd-flip'
        : kind === 'old' ? `wd-done ${iWon && rowIdx === myList.length - 1 ? 'wd-dance' : ''}`
          : kind === 'typed' ? 'wd-typed' : '';
    return <div key={key} className={`wd-tile ${cls}`} style={style}>{letter}</div>;
  };

  return (
    <div className={`mx-auto w-full max-w-4xl space-y-4 text-white ${shake ? 'wd-shake' : ''}`}>
      <style>{WD_CSS}</style>
      {iWon && <LudoConfetti />}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tight"><span className="text-emerald-400">WORDLE</span> BATTLE</h2>
          <p className="mt-1 text-sm text-slate-400">Round {game.round} · {game.playerIds.length} players · max {WD_TRIES} guesses</p>
        </div>
        <div className="rounded-full border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-sm font-bold text-emerald-200">
          {finished ? 'Game over' : inGame ? `Guess ${Math.min(myList.length + 1, WD_TRIES)}/${WD_TRIES}` : 'Spectating'}
        </div>
      </header>

      {!inGame && (
        <div className="rounded-xl border border-yellow-700/50 bg-yellow-950/30 p-3 text-center text-xs text-yellow-300">
          Aap spectator ho — agla game start hone par seat milegi.
        </div>
      )}

      {/* result card */}
      {finished && (
        <div className="wd-in relative rounded-2xl border p-5 text-center"
          style={{ borderColor: draw ? '#94a3b8' : iWon ? '#22c55e' : '#f43f5e', background: draw ? 'rgba(30,41,59,.6)' : iWon ? 'rgba(5,46,22,.6)' : 'rgba(76,5,25,.45)' }}>
          <div className="wd-victory text-5xl">{draw ? '🤝' : iWon ? '🏆' : '😮'}</div>
          <p className="mt-2 text-2xl font-black" style={{ color: draw ? '#e2e8f0' : iWon ? '#4ade80' : '#fda4af' }}>
            {draw ? 'DRAW! Kisi ne guess nahi kiya' : iWon ? 'TUM JEET GAYE!' : `${nameOf(game.winner)} jeet gaya!`}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Word tha: <span className="rounded-lg bg-black px-3 py-1 font-mono text-lg font-black tracking-widest text-emerald-300">{game.word}</span>
          </p>
          {game.winner && <p className="mt-1 text-xs text-slate-400">{(game.guesses[game.winner] || []).length} guess mein solve kiya</p>}
          {(isHost || inGame) && (
            <button onClick={startGame} disabled={busy || roomPlayers.length < WD_MIN}
              className="mt-4 rounded-full bg-white px-8 py-2.5 text-xs font-extrabold text-black transition hover:scale-105 disabled:opacity-50">PLAY AGAIN</button>
          )}
        </div>
      )}

      {/* SHARED INTEL — sabke guesses se mile letters */}
      <div className="rounded-2xl border border-emerald-900/50 bg-slate-950 p-3">
        <p className="mb-2 text-center text-[10px] font-bold tracking-[0.3em] text-emerald-400">🔎 SHARED CLUES · SABKE GUESSES SE</p>
        <div className="wd-row">
          {found.map((L, i) => (
            <div key={`${i}-${L}`} className={`wd-tile ${L ? 'wd-done' : ''}`}
              style={{ ...(L ? { ['--bg' as any]: WD_BG.g, animation: 'wdPop .4s ease-out' } : {}), borderStyle: L ? 'solid' : 'dashed' }}>
              {L || '?'}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]">
          <span className="text-slate-400">🟨 Word mein hain:{' '}
            {yellowOnly.length ? yellowOnly.map((L) => <b key={L} className="mx-0.5 rounded bg-yellow-400 px-1.5 py-0.5 text-black">{L}</b>) : <span className="text-slate-600">—</span>}
          </span>
          <span className="text-slate-400">🟥 Nahi hain:{' '}
            {absentList.length ? absentList.map((L) => <b key={L} className="mx-0.5 rounded bg-red-700 px-1.5 py-0.5 text-white">{L}</b>) : <span className="text-slate-600">—</span>}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* MY BOARD + KEYBOARD */}
        {inGame ? (
          <div className="space-y-3 rounded-3xl border border-slate-800 bg-[#070e20] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest text-slate-400">YOUR BOARD</span>
              <span className="font-mono text-xs text-yellow-300">{myList.length}/{WD_TRIES}</span>
            </div>

            <div ref={boardRef} className="max-h-[300px] space-y-1.5 overflow-y-auto py-1 pr-1">
              {myList.map((g, r) => {
                const pat = wdPattern(g, game.word);
                const isNew = r >= (animFrom.current[aKey] ?? 0);
                return (
                  <div key={r} className="wd-row">
                    {g.split('').map((L, i) => renderTile(L, pat[i], i, r, isNew ? 'new' : 'old'))}
                  </div>
                );
              })}
              {playing && myList.length < WD_TRIES && (
                <div className={`wd-row ${shakeRow ? 'wd-shake' : ''}`}>
                  {Array.from({ length: WD_LEN }, (_, i) => renderTile(cur[i] || '', null, i, -1, cur[i] ? 'typed' : 'empty'))}
                </div>
              )}
              {myList.length >= WD_TRIES && !finished && <p className="wd-pulse py-2 text-center text-xs text-rose-300">Tumhare saare guesses khatam! Baaki players ka wait karo...</p>}
            </div>

            <p className="h-4 text-center text-xs text-rose-300">{message}</p>

            <div className="space-y-1.5">
              {WD_KEYS.map((row, ri) => (
                <div key={ri} className="flex gap-1.5">
                  {ri === 2 && <button className="wd-key wd-key-wide" onClick={() => press('ENTER')}>ENTER</button>}
                  {row.split('').map((k) => {
                    const st = keyStatus[k];
                    return (
                      <button key={k} className="wd-key" onClick={() => press(k)}
                        style={st ? { background: WD_BG[st], color: st === 'y' ? '#1c1917' : '#fff', opacity: st === 'r' ? 0.55 : 1 } : undefined}>{k}</button>
                    );
                  })}
                  {ri === 2 && <button className="wd-key wd-key-wide" onClick={() => press('BACK')}>⌫</button>}
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-slate-500">Keyboard colors sabke guesses se update hote hain. Physical keyboard bhi chalega (chat box mein na ho tab).</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-800 bg-[#070e20] p-6 text-center text-sm text-slate-400">Players race kar rahe hain... 👀</div>
        )}

        {/* OPPONENTS */}
        <aside className="space-y-3">
          {(inGame ? others : game.playerIds).map((uid) => {
            const list = game.guesses[uid] || [];
            const last = list[list.length - 1];
            const greens = last ? wdPattern(last, game.word).split('').filter((x) => x === 'g').length : 0;
            const col = colorOf(uid);
            const isWinner = finished && game.winner === uid;
            return (
              <div key={uid} className={`wd-in rounded-2xl border bg-slate-950 p-3 ${isWinner ? 'wd-active' : 'border-slate-700'}`} style={{ ['--c' as any]: col }}>
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xl">{isWinner ? '👑' : avatarOf(uid)}</span>
                    <span className="truncate text-sm font-bold" style={{ color: col }}>{nameOf(uid)}</span>
                  </div>
                  <span className="font-mono text-[11px] text-yellow-300">🏆 {game.wins[uid] || 0}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{list.length}/{WD_TRIES} guesses</span>
                  {playing && greens >= 3 && <span className="wd-pulse font-bold text-emerald-400">🔥 {greens}/5 🟩</span>}
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto">
                  {list.length === 0 ? <p className="text-[11px] text-slate-600">abhi koi guess nahi...</p> : <WdMini guesses={list} word={game.word} reveal />}
                </div>
              </div>
            );
          })}
          {isHost && playing && (
            <button onClick={endAsDraw} className="w-full rounded-full border border-slate-600 bg-slate-900 py-2 text-[11px] font-bold text-slate-300">END GAME (DRAW)</button>
          )}
        </aside>
      </div>

      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-[70] -translate-x-1/2">
          <div key={toast.n} className="wd-toast rounded-full border border-yellow-500/60 bg-black/90 px-5 py-2 text-sm font-black text-yellow-300 shadow-2xl">{toast.text}</div>
        </div>
      )}
    </div>
  );
}
