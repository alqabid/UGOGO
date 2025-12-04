
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { 
  Ghost, MapPin, Calendar, Plus, User as UserIcon, Search, ArrowLeft, Users, 
  Sparkles, MessageCircle, CheckCircle2, Image as ImageIcon, Clock, ShieldCheck, 
  LogOut, X, Mail, Lock, Smartphone, ChevronRight, Settings, Camera, Edit3, 
  Bell, HelpCircle, FileText, Eye, EyeOff, Moon, Volume2, Home, Check, Send, 
  Filter, CreditCard, Ticket, Zap, Radar, DollarSign, AlertTriangle, MessageSquare,
  Share, ExternalLink, Navigation
} from 'lucide-react';
import { User, Event, ViewState } from './types';
import { MOCK_USERS, CURRENT_USER, INITIAL_EVENTS } from './constants';

// --- Utilities ---
const formatDate = (isoString: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
};

const formatTime = (isoString: string) => {
  if (!isoString) return '';
  // Check if it's a full ISO string or just HH:mm
  if (isoString.includes('T')) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  // Handle HH:mm format from input type="time"
  const [hours, minutes] = isoString.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const triggerHaptic = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(10); // Light vibration
  }
};

// --- Simulated Cloud Database (Services) ---
const DB_USERS_KEY = 'ugogo_users_db_v1';
const DB_EVENTS_KEY = 'ugogo_events_db_v1';

const AuthService = {
  init: () => {
    if (!localStorage.getItem(DB_USERS_KEY)) {
      const initialData = MOCK_USERS.map(u => ({
        ...u,
        email: `${u.name.split(' ')[0].toLowerCase()}@example.com`,
        password: 'password',
        phone: '555-0000'
      }));
      initialData.push({
        ...CURRENT_USER,
        email: 'alex@example.com',
        password: 'password',
        phone: '555-1234'
      });
      localStorage.setItem(DB_USERS_KEY, JSON.stringify(initialData));
    }
  },

  login: (identifier: string, password: string): User | null => {
    const db = JSON.parse(localStorage.getItem(DB_USERS_KEY) || '[]');
    const user = db.find((u: any) => 
      (u.email === identifier || u.phone === identifier) && u.password === password
    );
    if (user) {
      const { password: _, ...safeUser } = user;
      return safeUser;
    }
    return null;
  },

  register: (user: Partial<User> & { password: string, email: string }) => {
    const db = JSON.parse(localStorage.getItem(DB_USERS_KEY) || '[]');
    if (db.some((u: any) => u.email === user.email)) {
      throw new Error("User already exists");
    }
    const newUser = {
      ...user,
      id: Math.random().toString(36).substr(2, 9),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}&backgroundColor=b6e3f4`,
      isVerified: true,
    };
    db.push(newUser);
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(db));
    const { password: _, ...safeUser } = newUser;
    return safeUser;
  },

  updateUser: (updatedUser: User) => {
    const db = JSON.parse(localStorage.getItem(DB_USERS_KEY) || '[]');
    const index = db.findIndex((u: User) => u.id === updatedUser.id);
    if (index !== -1) {
      db[index] = { ...db[index], ...updatedUser };
      localStorage.setItem(DB_USERS_KEY, JSON.stringify(db));
    }
  }
};

const EventService = {
  init: () => {
    if (!localStorage.getItem(DB_EVENTS_KEY)) {
      localStorage.setItem(DB_EVENTS_KEY, JSON.stringify(INITIAL_EVENTS));
    }
  },

  getEvents: (): Event[] => {
    return JSON.parse(localStorage.getItem(DB_EVENTS_KEY) || '[]');
  },

  saveEvent: (event: Event) => {
    const events = EventService.getEvents();
    events.unshift(event);
    localStorage.setItem(DB_EVENTS_KEY, JSON.stringify(events));
    return events;
  },

  updateEvent: (updatedEvent: Event) => {
    const events = EventService.getEvents();
    const index = events.findIndex(e => e.id === updatedEvent.id);
    if (index !== -1) {
      events[index] = updatedEvent;
      localStorage.setItem(DB_EVENTS_KEY, JSON.stringify(events));
    }
    return events;
  },
  
  syncUserUpdates: (user: User) => {
    let events = EventService.getEvents();
    events = events.map(e => ({
      ...e,
      attendees: e.attendees.map(a => a.id === user.id ? user : a)
    }));
    localStorage.setItem(DB_EVENTS_KEY, JSON.stringify(events));
    return events;
  }
};

// --- AI Functions ---
async function generateIcebreaker(targetName: string, eventTitle: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a fun, short (max 15 words) icebreaker message to send to ${targetName} on Snapchat about going to the event "${eventTitle}". It should be casual and friendly using Gen Z slang.`,
    });
    return response.text || `Hey ${targetName}, see you at ${eventTitle}?`;
  } catch (error) {
    console.error("AI Error:", error);
    return `Hey ${targetName}, are you going to ${eventTitle}?`;
  }
}

async function generateEventDescription(title: string, location: string, vibe: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a catchy, short (2 sentences max) event description for an event called "${title}" at "${location}". The vibe is "${vibe}". Use emojis. If possible, mention a specific cool detail about the location based on real maps data.`,
      config: {
        tools: [{ googleMaps: {} }],
      }
    });
    return response.text || `Join us for ${title} at ${location}! It's going to be a ${vibe} time.`;
  } catch (error) {
    console.error("AI Error:", error);
    return `Come through to ${title} at ${location}! It's gonna be lit.`;
  }
}

// --- Components ---

const Toast = ({ message, type = 'success', onClose }: { message: string, type?: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in slide-in-from-top duration-300 ${type === 'success' ? 'bg-black text-white' : 'bg-red-500 text-white'}`}>
      {type === 'success' ? <CheckCircle2 size={18} className="text-snap-yellow" /> : <X size={18} />}
      <span className="font-bold text-sm">{message}</span>
    </div>
  );
};

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false,
  icon: Icon
}: { 
  children?: React.ReactNode; 
  onClick?: (e?: any) => void; 
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'black' | 'success';
  className?: string;
  disabled?: boolean;
  icon?: React.ElementType;
}) => {
  const baseStyles = "w-full py-4 rounded-2xl font-bold text-lg transition-transform active:scale-95 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-snap-yellow text-black shadow-lg shadow-yellow-200/50 hover:brightness-105",
    secondary: "bg-snap-blue text-white shadow-lg shadow-blue-200/50",
    black: "bg-black text-white shadow-lg shadow-gray-400/50",
    ghost: "bg-gray-100 text-gray-800 hover:bg-gray-200",
    outline: "border-2 border-gray-200 text-gray-800 hover:bg-gray-50",
    danger: "bg-red-50 text-red-600 border border-red-100",
    success: "bg-green-500 text-white shadow-lg shadow-green-200"
  };

  const handleClick = (e: any) => {
    triggerHaptic();
    onClick?.(e);
  }

  return (
    <button 
      onClick={handleClick} 
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {Icon && <Icon size={24} />}
      {children}
    </button>
  );
};

const Input = ({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = "text", 
  multiline = false,
  icon: Icon,
  maxLength,
  ...rest
}: { 
  label: string; 
  value: string; 
  onChange: (e: any) => void; 
  placeholder?: string; 
  type?: string; 
  multiline?: boolean;
  icon?: React.ElementType;
  maxLength?: number;
  [key: string]: any;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleContainerClick = () => {
    if (type === 'date' || type === 'time') {
      try {
        inputRef.current?.showPicker();
      } catch (e) {
        inputRef.current?.focus();
      }
    }
  };

  // Custom UI for Date/Time to make them clearly visible
  if (type === 'date' || type === 'time') {
    return (
      <div className="flex flex-col gap-2 w-full">
        <label className="text-sm font-bold text-gray-600 uppercase tracking-wider ml-1">{label}</label>
        <div 
          onClick={handleContainerClick}
          className="relative w-full bg-gray-100 hover:bg-gray-200 p-4 rounded-2xl cursor-pointer transition-colors flex items-center justify-between border border-transparent hover:border-gray-300"
        >
          <div className="flex items-center gap-3">
             {Icon ? <Icon size={20} className="text-gray-500" /> : (type === 'date' ? <Calendar size={20} className="text-gray-500" /> : <Clock size={20} className="text-gray-500" />)}
             <span className={`font-bold text-lg ${value ? 'text-black' : 'text-gray-400'}`}>
               {value ? (type === 'time' ? formatTime(value) : formatDate(value)) : (placeholder || `Select ${label}`)}
             </span>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
          
          {/* Hidden but functional input */}
          <input
            ref={inputRef}
            type={type}
            value={value}
            onChange={onChange}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            {...rest}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-sm font-bold text-gray-600 uppercase tracking-wider ml-1">{label}</label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            <Icon size={20} />
          </div>
        )}
        {multiline ? (
          <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            maxLength={maxLength}
            className={`w-full bg-white p-4 rounded-2xl text-lg text-gray-900 font-medium outline-none focus:ring-4 focus:ring-snap-yellow/50 transition-all border border-gray-200 resize-none h-32 ${Icon ? 'pl-12' : ''} placeholder:text-gray-400`}
            {...rest}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            maxLength={maxLength}
            className={`w-full bg-white p-4 rounded-2xl text-lg text-gray-900 font-medium outline-none focus:ring-4 focus:ring-snap-yellow/50 transition-all border border-gray-200 ${Icon ? 'pl-12' : ''} placeholder:text-gray-400`}
            {...rest}
          />
        )}
      </div>
    </div>
  );
};

const ToggleRow = ({ icon: Icon, label, checked, onChange, colorClass = "bg-green-500" }: any) => {
  const handleToggle = () => {
    triggerHaptic();
    onChange(!checked);
  };

  return (
    <button 
      onClick={handleToggle}
      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
    >
       <div className="flex items-center gap-3">
         <div className={`w-8 h-8 rounded-full flex items-center justify-center ${checked ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
           <Icon size={16} />
         </div>
         <span className="font-bold text-gray-800 text-left">{label}</span>
       </div>
       <div className={`w-12 h-7 rounded-full transition-colors relative ${checked ? colorClass : 'bg-gray-200'}`}>
         <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'left-6' : 'left-1'}`} />
       </div>
    </button>
  );
};

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button 
    onClick={() => { triggerHaptic(); onClick(); }} 
    className="absolute top-6 left-6 p-3 bg-white rounded-full shadow-lg text-black hover:bg-gray-50 transition-all z-20 border border-gray-100"
    aria-label="Go Back"
  >
    <ArrowLeft size={24} />
  </button>
);

// --- Auth Views ---

const LoginView = ({ onLogin }: { onLogin: (userData: User) => void }) => {
  const [viewState, setViewState] = useState<'landing' | 'login' | 'register_details' | 'register_otp'>('landing');
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [generatedOTP, setGeneratedOTP] = useState('');
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regSnapchat, setRegSnapchat] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');

  useEffect(() => {
    AuthService.init();
    EventService.init(); // Initialize event persistence too
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  };

  const handleLoginSubmit = () => {
    if (!loginEmail || !loginPassword) {
      showToast("Please fill in all fields", "error");
      return;
    }
    const user = AuthService.login(loginEmail, loginPassword);
    if (user) {
      showToast("Welcome back!", "success");
      triggerHaptic();
      setTimeout(() => onLogin(user), 500);
    } else {
      triggerHaptic(); // Error haptic
      showToast("User not found or incorrect password", "error");
    }
  };

  const handleRegisterStart = () => {
    if (!regName || !regSnapchat || !regEmail || !regPassword) {
      showToast("Please fill in all details", "error");
      return;
    }
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOTP(otp);
    setViewState('register_otp');
    setTimeout(() => {
      showToast(`Your verification code is: ${otp}`, "success");
    }, 1000);
  };

  const handleVerifyOTP = () => {
    if (otpInput === generatedOTP) {
      try {
        const newUser = AuthService.register({
          name: regName,
          snapchatHandle: regSnapchat,
          email: regEmail,
          password: regPassword,
          bio: "New to the vibe ✨"
        });
        showToast("Account Verified & Created!", "success");
        triggerHaptic();
        setTimeout(() => onLogin(newUser as User), 1000);
      } catch (e: any) {
        showToast(e.message, "error");
        setViewState('register_details');
      }
    } else {
      triggerHaptic();
      showToast("Invalid code. Try again.", "error");
    }
  };

  if (viewState === 'register_otp') {
    return (
      <div className="h-screen w-full bg-white p-6 flex flex-col items-center pt-24 animate-in slide-in-from-right relative">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <BackButton onClick={() => setViewState('register_details')} />
        <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center text-snap-yellow mb-6 border-4 border-yellow-100">
          <Smartphone size={40} className="text-black" />
        </div>
        <h2 className="text-3xl font-extrabold text-black mb-2">Verification</h2>
        <p className="text-gray-500 text-center mb-10 px-4">
          Enter the 4-digit code sent to <br/><span className="font-bold text-black">{regEmail}</span>
        </p>
        <div className="w-full max-w-xs space-y-6">
           <input 
              type="text" 
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.slice(0, 4))}
              placeholder="0000"
              className="w-full text-center text-5xl font-black tracking-[1rem] py-4 border-b-4 border-gray-200 focus:border-black outline-none transition-colors text-black placeholder:text-gray-300"
              autoFocus
           />
           <Button onClick={handleVerifyOTP} disabled={otpInput.length !== 4} variant="black">
             Verify & Create Account
           </Button>
           <button onClick={() => showToast(`Resent code: ${generatedOTP}`, 'success')} className="w-full text-center text-gray-400 font-bold text-sm mt-4 hover:text-black">
             Resend Code
           </button>
        </div>
      </div>
    );
  }

  if (viewState === 'register_details') {
    return (
      <div className="h-screen w-full bg-gray-50 flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right relative">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <BackButton onClick={() => setViewState('landing')} />
        <div className="pt-20">
          <h2 className="text-3xl font-extrabold text-black mb-6">New Account</h2>
          <div className="space-y-4">
            <Input label="Full Name" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Jane Doe" icon={UserIcon} />
            <Input label="Snapchat Handle" value={regSnapchat} onChange={(e) => setRegSnapchat(e.target.value)} placeholder="jane.vibes" icon={Ghost} />
            <Input label="Email or Phone" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="hello@example.com" icon={Mail} />
            <Input label="Create Password" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="••••••••" icon={Lock} />
          </div>
          <div className="mt-8 mb-10">
            <Button onClick={handleRegisterStart} variant="black">
              Send Verification Code <ChevronRight size={20} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'login') {
    return (
      <div className="h-screen w-full bg-gray-50 flex flex-col p-6 pt-10 animate-in slide-in-from-right relative">
         {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
         <BackButton onClick={() => setViewState('landing')} />
        <div className="pt-20">
          <h2 className="text-3xl font-extrabold text-black mb-2">Welcome Back</h2>
          <p className="text-gray-500 mb-8">Sign in to check your vibes.</p>
          <div className="space-y-6">
            <Input label="Email or Phone" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="hello@example.com" icon={Mail} />
            <Input label="Password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" icon={Lock} />
            <Button onClick={handleLoginSubmit} variant="black" className="mt-4">Log In</Button>
          </div>
          <div className="mt-auto text-center py-6">
            <p className="text-gray-400 text-sm">Forgot Password?</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col relative overflow-hidden">
      <div className="bg-snap-yellow h-[45%] rounded-b-[3rem] flex items-center justify-center relative shadow-card z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center animate-in zoom-in duration-700">
            <h1 className="text-6xl font-black text-black tracking-tighter mb-2">UGOGO</h1>
            <p className="text-black font-bold text-xl opacity-80 tracking-widest">CONNECT. VIBE. GO.</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col px-8 pt-12 pb-8 space-y-4">
        <Button onClick={() => setViewState('login')} variant="ghost" className="bg-white border-2 border-gray-100 hover:bg-gray-50">I have an account</Button>
        <Button onClick={() => setViewState('register_details')} variant="black">Get Started</Button>
        <div className="mt-auto pt-8 text-center">
            <p className="text-xs text-gray-400 font-medium leading-relaxed px-8">
                By tapping Get Started, you agree to our Terms. Learn how we process your data in our Privacy Policy.
            </p>
        </div>
      </div>
    </div>
  );
};

// --- App Views ---

interface EventCardProps {
  event: Event;
  onClick: () => void;
  mini?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({ event, onClick, mini = false }) => (
  <div 
    onClick={() => { triggerHaptic(); onClick(); }}
    className={`bg-white rounded-[2rem] overflow-hidden shadow-card active:scale-[0.98] transition-all cursor-pointer group border border-gray-100 ${mini ? 'mb-4 flex gap-4 p-3' : 'mb-6'}`}
  >
    <div className={`relative overflow-hidden ${mini ? 'w-24 h-24 rounded-2xl shrink-0' : 'h-64'}`}>
      <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      {!mini && (
        <>
            <div className="absolute top-4 right-4 flex gap-2">
                <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-full font-bold text-sm shadow-sm flex items-center gap-2 text-gray-900 border border-gray-200">
                    <Users size={14} className="text-snap-blue" />
                    {event.attendees.length}
                </div>
                {event.price && event.price > 0 ? (
                  <div className="bg-green-500/95 backdrop-blur-md px-4 py-2 rounded-full font-bold text-sm shadow-sm text-white">
                    ${event.price}
                  </div>
                ) : null}
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-24">
                <div className="inline-block px-3 py-1 bg-snap-yellow text-black text-xs font-bold rounded-full mb-2 uppercase tracking-wide">
                    {event.category}
                </div>
                <h3 className="text-2xl font-black text-white leading-tight mb-2">{event.title}</h3>
                <div className="flex items-center text-white/90 text-sm font-medium">
                    <Calendar size={16} className="mr-2" />
                    {formatDate(event.date)}
                    <span className="mx-2 opacity-50">•</span>
                    <Clock size={16} className="mr-2" />
                    {formatTime(event.date)}
                </div>
            </div>
        </>
      )}
    </div>
    {mini && (
      <div className="flex-1 py-1">
         <h4 className="font-bold text-gray-900 text-lg leading-tight mb-1">{event.title}</h4>
         <p className="text-gray-500 text-sm mb-2">{formatDate(event.date)} at {formatTime(event.date)}</p>
         <div className="flex items-center gap-1 text-xs font-bold text-gray-400">
            <MapPin size={12} /> {event.location}
         </div>
         {event.price && event.price > 0 && <div className="mt-2 text-green-600 font-bold text-sm">${event.price} Ticket</div>}
      </div>
    )}
  </div>
);

// --- Radar Component ---
const RadarView = ({ attendees, onUserSelect }: { attendees: User[], onUserSelect: (u: User) => void }) => {
  return (
    <div className="relative w-full aspect-square bg-gray-900 rounded-full overflow-hidden border-4 border-gray-800 shadow-inner">
      {/* Radar Rings */}
      <div className="absolute inset-0 border-[1px] border-green-500/30 rounded-full m-12"></div>
      <div className="absolute inset-0 border-[1px] border-green-500/20 rounded-full m-24"></div>
      <div className="absolute inset-0 border-[1px] border-green-500/10 rounded-full m-36"></div>
      
      {/* Scanning Line */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/20 to-transparent w-full h-full animate-[spin_4s_linear_infinite] origin-center opacity-50" style={{clipPath: 'polygon(50% 50%, 100% 0, 100% 50%)'}}></div>

      {/* Center User */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-4 h-4 bg-snap-blue rounded-full shadow-[0_0_15px_rgba(0,184,255,0.8)] animate-pulse"></div>
      </div>

      {/* Scattered Users */}
      {attendees.map((user, i) => {
        // Deterministic random position based on index
        const angle = (i * 137.5) * (Math.PI / 180);
        const r = 30 + (i * 15) % 40; // distance from center %
        const top = 50 + r * Math.sin(angle);
        const left = 50 + r * Math.cos(angle);
        
        return (
          <button
            key={user.id}
            onClick={() => { triggerHaptic(); onUserSelect(user); }}
            className="absolute w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden hover:scale-125 transition-transform z-10"
            style={{ top: `${top}%`, left: `${left}%` }}
          >
            <img src={user.avatar} alt={user.name} className="w-full h-full bg-gray-200" />
          </button>
        );
      })}
    </div>
  );
};

// --- Modals ---
const BondingModal = ({ user, onClose }: { user: User, onClose: () => void }) => {
  const [status, setStatus] = useState<'idle' | 'zapping' | 'bonded'>('idle');

  const handleZap = () => {
    triggerHaptic();
    setStatus('zapping');
    setTimeout(() => {
      triggerHaptic();
      setStatus('bonded');
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 text-center relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X/></button>
        
        <div className="relative mx-auto w-32 h-32 mb-6">
          <img src={user.avatar} className="w-full h-full rounded-full object-cover border-4 border-white shadow-xl" />
          {status === 'bonded' && (
            <div className="absolute -bottom-2 -right-2 bg-snap-yellow p-2 rounded-full border-4 border-white animate-in zoom-in">
              <Ghost size={24} className="text-black" />
            </div>
          )}
        </div>

        <h3 className="text-2xl font-black mb-1">{user.name}</h3>
        <p className="text-gray-500 mb-6">{user.bio}</p>

        {status === 'idle' && (
          <Button onClick={handleZap} variant="primary" icon={Zap} className="bg-snap-yellow">
            Zap to Connect
          </Button>
        )}

        {status === 'zapping' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <Zap className="text-snap-yellow w-12 h-12 animate-bounce" />
            <p className="font-bold text-gray-400">Sending vibe...</p>
          </div>
        )}

        {status === 'bonded' && (
          <div className="animate-in zoom-in duration-300">
            <div className="bg-gray-100 rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-500 font-bold uppercase mb-1">Snapchat Handle</p>
              <p className="text-xl font-black text-black select-all">@{user.snapchatHandle}</p>
            </div>
            <Button onClick={() => window.open(`https://snapchat.com/add/${user.snapchatHandle}`)} variant="black" icon={Ghost}>
              Open Snapchat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const PaymentModal = ({ event, onClose, onComplete }: { event: Event, onClose: () => void, onComplete: () => void }) => {
  const [status, setStatus] = useState<'details' | 'processing' | 'success'>('details');

  const handlePay = () => {
    triggerHaptic();
    setStatus('processing');
    setTimeout(() => {
      setStatus('success');
      triggerHaptic();
      setTimeout(onComplete, 1500);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in">
      <div className="bg-white w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-8 pb-12 sm:pb-8 text-center relative shadow-2xl">
        
        {status === 'details' && (
          <>
             <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X/></button>
             <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
               <Ticket size={32} />
             </div>
             <h3 className="text-2xl font-black mb-2">Purchase Ticket</h3>
             <p className="text-gray-500 mb-6">For {event.title}</p>
             
             <div className="flex justify-between items-center py-4 border-t border-b border-gray-100 mb-8">
               <span className="text-gray-600 font-medium">Total Price</span>
               <span className="text-3xl font-black text-black">${event.price}</span>
             </div>

             <Button onClick={handlePay} variant="black" icon={CreditCard}>
               Pay with Card
             </Button>
          </>
        )}

        {status === 'processing' && (
          <div className="py-12 flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-6"></div>
            <p className="font-bold text-gray-600">Processing payment...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-8 flex flex-col items-center animate-in zoom-in">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-6 shadow-lg shadow-green-200">
              <Check size={40} strokeWidth={4} />
            </div>
            <h3 className="text-2xl font-black mb-2">You're In!</h3>
            <p className="text-gray-500">Ticket added to your wallet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Support Chat & Report Components ---

const SupportChat = ({ onBack, currentUser }: { onBack: () => void, currentUser: User | null }) => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: `Hey ${currentUser?.name.split(' ')[0] || 'there'}! I'm the UGOGO support bot. How can I help you today? I can help with tickets, account issues, or just how to use the app!` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: `You are a helpful customer support agent for the app 'UGOGO'. The user's name is ${currentUser?.name || 'User'}. UGOGO is a social event app where users find events, buy tickets, and use a radar to find attendees to 'Zap' (bond) with on Snapchat. Keep answers short, friendly, and helpful. If it's a technical bug, ask them to use the Report feature.`
        }
      });
      
      const prompt = `User asked: "${userMsg}". History: ${JSON.stringify(messages.slice(-3))}`;
      const result = await chat.sendMessage({ message: prompt });
      
      setMessages(prev => [...prev, { role: 'model', text: result.text }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting. Please check your internet or try again later." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-[60] flex flex-col animate-in slide-in-from-right">
      <div className="p-4 bg-white shadow-sm flex items-center gap-4 z-10">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft /></button>
        <div>
          <h2 className="text-xl font-black">UGOGO Support</h2>
          <p className="text-xs text-green-500 font-bold flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/> Online</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-black text-white rounded-br-none' : 'bg-white text-gray-800 shadow-sm rounded-bl-none border border-gray-100'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
             <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-gray-100 flex gap-1">
               <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
               <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
               <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
        <input 
          className="flex-1 bg-gray-100 rounded-full px-6 py-3 outline-none focus:ring-2 focus:ring-snap-yellow transition-all"
          placeholder="Type your question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} disabled={!input.trim()} className="bg-snap-blue text-white p-3 rounded-full disabled:opacity-50 hover:scale-105 transition-all">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

const ReportIssue = ({ onBack, onSubmit }: { onBack: () => void, onSubmit: () => void }) => {
  const [subject, setSubject] = useState('Bug');
  const [desc, setDesc] = useState('');

  const handleSubmit = () => {
    if (!desc.trim()) return;
    triggerHaptic();
    onSubmit();
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-[60] flex flex-col animate-in slide-in-from-right">
      <div className="p-4 bg-white shadow-sm flex items-center gap-4 z-10">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft /></button>
        <h2 className="text-xl font-black">Report Issue</h2>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 flex gap-3 text-yellow-800 text-sm">
          <AlertTriangle className="shrink-0" />
          <p>We take reports seriously. Please provide as much detail as possible so we can help.</p>
        </div>

        <div>
          <label className="text-sm font-bold text-gray-600 uppercase tracking-wider ml-1 mb-2 block">Issue Type</label>
          <select 
            value={subject} 
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-white p-4 rounded-2xl text-lg font-bold outline-none border border-gray-200"
          >
            <option>Bug / App Error</option>
            <option>User Report (Behavior)</option>
            <option>Scam / Fake Event</option>
            <option>Other</option>
          </select>
        </div>

        <Input label="Description" multiline value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What happened?" />

        <Button onClick={handleSubmit} variant="black" className="mt-8">Submit Report</Button>
      </div>
    </div>
  );
};

const PrivacyView = ({ onBack }: { onBack: () => void }) => (
  <div className="fixed inset-0 bg-gray-50 z-[60] flex flex-col animate-in slide-in-from-right">
    <div className="p-4 bg-white shadow-sm flex items-center gap-4 z-10">
      <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft /></button>
      <h2 className="text-xl font-black">Privacy Policy</h2>
    </div>
    <div className="p-6 overflow-y-auto">
      <div className="prose prose-sm">
        <h3 className="font-bold text-lg mb-2">1. Data Collection</h3>
        <p className="text-gray-600 mb-4">We collect minimal data to make the app work, including your name, email, and location for the radar feature.</p>
        <h3 className="font-bold text-lg mb-2">2. Snapchat Integration</h3>
        <p className="text-gray-600 mb-4">We do not store your private Snapchat messages. We only store your handle to allow other users to connect with you.</p>
        <h3 className="font-bold text-lg mb-2">3. Location Services</h3>
        <p className="text-gray-600 mb-4">Your location is only shared on the Radar when you check in to an event.</p>
      </div>
    </div>
  </div>
);


const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'discover' | 'create' | 'profile'>('discover');
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [reminderPrompt, setReminderPrompt] = useState(false);

  // Create Event State
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventImage, setNewEventImage] = useState('');
  const [newEventCategory, setNewEventCategory] = useState<'Party' | 'Chill' | 'Sports' | 'Art' | 'Concert'>('Party');
  const [newEventPrice, setNewEventPrice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSnap, setEditSnap] = useState('');
  const [editAvatar, setEditAvatar] = useState('');

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSubView, setSettingsSubView] = useState<'main' | 'help_chat' | 'report' | 'privacy'>('main');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [ghostMode, setGhostMode] = useState(false);

  // Radar/Bonding
  const [radarUser, setRadarUser] = useState<User | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  // --- Effects ---
  useEffect(() => {
    AuthService.init();
    EventService.init();
    // Load events from storage
    setEvents(EventService.getEvents());
  }, []);

  const selectedEvent = useMemo(() => 
    events.find(e => e.id === selectedEventId), 
  [events, selectedEventId]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            e.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || e.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, activeCategory]);

  // --- Handlers ---

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setViewState('discover');
  };

  const handleLogout = () => {
    triggerHaptic();
    setCurrentUser(null);
    setViewState('login');
    setShowSettings(false);
    setActiveTab('discover');
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoGenerateDesc = async () => {
    if (!newEventTitle || !newEventLocation) {
      triggerHaptic(); // error haptic
      showToast("Enter title and location first", "error");
      return;
    }
    triggerHaptic();
    setIsGenerating(true);
    const desc = await generateEventDescription(newEventTitle, newEventLocation, newEventCategory);
    setNewEventDesc(desc);
    setIsGenerating(false);
  };

  const handlePostEvent = () => {
    if (!newEventTitle || !newEventDate || !newEventTime || !newEventLocation || !currentUser) {
      showToast("Please fill in required fields", "error");
      return;
    }

    triggerHaptic();
    const dateTime = new Date(`${newEventDate}T${newEventTime}`);
    
    const newEvent: Event = {
      id: Math.random().toString(36).substr(2, 9),
      title: newEventTitle,
      date: dateTime.toISOString(),
      location: newEventLocation,
      imageUrl: newEventImage || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800',
      description: newEventDesc,
      attendees: [currentUser],
      category: newEventCategory,
      hostId: currentUser.id,
      price: newEventPrice ? parseFloat(newEventPrice) : 0
    };

    const updatedEvents = EventService.saveEvent(newEvent);
    setEvents(updatedEvents);
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventTime('');
    setNewEventLocation('');
    setNewEventDesc('');
    setNewEventImage('');
    setNewEventPrice('');
    
    setActiveTab('discover');
    showToast("Event Posted Successfully!", "success");
  };

  const handleJoinEvent = () => {
    if (!selectedEvent || !currentUser) return;
    
    triggerHaptic();
    // If priced and not joined, show payment
    const isAttending = selectedEvent.attendees.some(u => u.id === currentUser.id);
    if (selectedEvent.price > 0 && !isAttending) {
      setShowPayment(true);
      return;
    }

    processJoin();
  };

  const processJoin = () => {
    if (!selectedEvent || !currentUser) return;

    const isAttending = selectedEvent.attendees.some(u => u.id === currentUser.id);
    let updatedAttendees;

    if (isAttending) {
      updatedAttendees = selectedEvent.attendees.filter(u => u.id !== currentUser.id);
      showToast("You left the event.");
    } else {
      updatedAttendees = [...selectedEvent.attendees, currentUser];
      setReminderPrompt(true); // Trigger notification prompt
    }

    const updatedEvent = { ...selectedEvent, attendees: updatedAttendees };
    const allEvents = EventService.updateEvent(updatedEvent);
    setEvents(allEvents);
  };

  const handleSetReminder = async () => {
    setReminderPrompt(false);
    triggerHaptic();
    if (!("Notification" in window)) {
      showToast("Notifications not supported", "error");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      showToast("Reminder set for 1 hour before!", "success");
      // In a real app, schedule local notification here
    }
  };

  const handleUpdateProfile = () => {
    if (!currentUser) return;
    triggerHaptic();
    const updatedUser = {
      ...currentUser,
      name: editName || currentUser.name,
      bio: editBio || currentUser.bio,
      snapchatHandle: editSnap || currentUser.snapchatHandle,
      avatar: editAvatar || currentUser.avatar
    };
    
    AuthService.updateUser(updatedUser);
    EventService.syncUserUpdates(updatedUser);
    
    setCurrentUser(updatedUser);
    // Refresh events to reflect new avatar/name in attendees lists
    setEvents(EventService.getEvents());
    
    setIsEditingProfile(false);
    showToast("Profile Updated", "success");
  };

  const handleShareEvent = async () => {
    if (!selectedEvent) return;
    triggerHaptic();
    if (navigator.share) {
      try {
        await navigator.share({
          title: selectedEvent.title,
          text: `Check out ${selectedEvent.title} on UGOGO! It's gonna be a vibe.`,
          url: window.location.href,
        });
      } catch (e) {
        console.log('Error sharing', e);
      }
    } else {
      // Fallback
      navigator.clipboard.writeText(`Check out ${selectedEvent.title} at ${selectedEvent.location}`);
      showToast("Link copied to clipboard!", "success");
    }
  }

  // --- Views ---

  if (viewState === 'login') return <LoginView onLogin={handleLogin} />;

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-50 relative overflow-hidden flex flex-col shadow-2xl">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Reminder Prompt Modal */}
      {reminderPrompt && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-xl text-center">
              <div className="w-16 h-16 bg-snap-blue/10 text-snap-blue rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell size={32} />
              </div>
              <h3 className="text-xl font-black mb-2">Set a Reminder?</h3>
              <p className="text-gray-500 mb-6">We can notify you 1 hour before the event starts so you don't miss the vibe.</p>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setReminderPrompt(false)}>No thanks</Button>
                <Button variant="secondary" onClick={handleSetReminder}>Notify Me</Button>
              </div>
           </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && selectedEvent && (
        <PaymentModal 
          event={selectedEvent} 
          onClose={() => setShowPayment(false)} 
          onComplete={() => {
            setShowPayment(false);
            processJoin();
            showToast("Ticket Purchased!", "success");
          }} 
        />
      )}

      {/* Bonding Modal */}
      {radarUser && (
        <BondingModal user={radarUser} onClose={() => setRadarUser(null)} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 relative">
        
        {/* DISCOVER VIEW */}
        {activeTab === 'discover' && (
          <div className="p-6 pt-12 animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-black text-black">Discover</h1>
                <p className="text-gray-500 font-medium">Find your next vibe</p>
              </div>
              <div className="flex gap-2">
                 {showSearch ? (
                   <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm border border-gray-100 animate-in slide-in-from-right w-full">
                     <Search size={18} className="text-gray-400 mr-2" />
                     <input 
                       autoFocus
                       className="outline-none text-sm font-medium w-32 text-black" 
                       placeholder="Search..." 
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       onBlur={() => !searchQuery && setShowSearch(false)}
                     />
                     <button onClick={() => {setSearchQuery(''); setShowSearch(false)}}><X size={14} className="text-gray-400"/></button>
                   </div>
                 ) : (
                    <button onClick={() => setShowSearch(true)} className="p-3 bg-white rounded-full shadow-sm text-black hover:bg-gray-100 transition-colors">
                      <Search size={24} />
                    </button>
                 )}
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-2 snap-x scroll-smooth touch-pan-x">
              {['All', 'Party', 'Chill', 'Sports', 'Art'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => { triggerHaptic(); setActiveCategory(cat); }}
                  className={`px-6 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all snap-start ${activeCategory === cat ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-100'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {filteredEvents.length > 0 ? (
              filteredEvents.map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  onClick={() => { setSelectedEventId(event.id); setViewState('event_details'); }} 
                />
              ))
            ) : (
              <div className="text-center py-20 opacity-50">
                <Ghost size={48} className="mx-auto mb-4" />
                <p className="font-bold">No vibes found.</p>
              </div>
            )}
          </div>
        )}

        {/* CREATE VIEW */}
        {activeTab === 'create' && (
          <div className="p-6 pt-12 animate-in slide-in-from-bottom">
            <h1 className="text-3xl font-black text-black mb-8">New Event</h1>
            <div className="space-y-6">
              {/* Image Upload */}
              <div className="w-full h-48 bg-gray-100 rounded-[2rem] border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden group hover:border-snap-yellow transition-colors cursor-pointer">
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleLocalImageUpload(e, setNewEventImage)} accept="image/*" />
                {newEventImage ? (
                  <img src={newEventImage} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera size={32} className="mb-2 group-hover:text-snap-yellow transition-colors" />
                    <span className="font-bold text-sm">Upload Cover Photo</span>
                  </>
                )}
              </div>

              <Input label="Event Title" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="e.g. Neon Rooftop Party" />
              
              <div className="flex gap-4">
                 <Input 
                  label="Date" 
                  type="date" 
                  value={newEventDate} 
                  onChange={(e) => setNewEventDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} // Prevent past dates
                 />
                 <Input label="Time" type="time" value={newEventTime} onChange={(e) => setNewEventTime(e.target.value)} />
              </div>

              <Input label="Location" value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} placeholder="Add location" icon={MapPin} />
              
              <div className="flex gap-4">
                 <div className="flex-1">
                    <label className="text-sm font-bold text-gray-600 uppercase tracking-wider ml-1 mb-2 block">Category</label>
                    <select 
                      value={newEventCategory} 
                      onChange={(e: any) => setNewEventCategory(e.target.value)}
                      className="w-full bg-white p-4 rounded-2xl text-lg font-bold outline-none border border-gray-200 text-black appearance-none"
                    >
                      <option>Party</option>
                      <option>Chill</option>
                      <option>Sports</option>
                      <option>Art</option>
                      <option>Concert</option>
                    </select>
                 </div>
                 <div className="w-1/3">
                    <Input label="Price ($)" type="number" value={newEventPrice} onChange={(e) => setNewEventPrice(e.target.value)} placeholder="0" icon={DollarSign} />
                 </div>
              </div>

              <div className="relative">
                <Input label="Description" multiline value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} placeholder="What's the vibe?" />
                <button 
                  onClick={handleAutoGenerateDesc}
                  disabled={isGenerating}
                  className="absolute bottom-4 right-4 bg-snap-blue text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-md hover:brightness-110 disabled:opacity-50"
                >
                  <Sparkles size={12} /> {isGenerating ? 'Thinking...' : 'AI Generate'}
                </button>
              </div>

              <div className="pt-4 pb-20">
                <Button onClick={handlePostEvent} variant="primary">Post Event</Button>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE VIEW */}
        {activeTab === 'profile' && currentUser && (
          <div className="p-6 pt-12 animate-in slide-in-from-right">
             <div className="flex justify-between items-start mb-6">
                <h1 className="text-3xl font-black text-black">My Profile</h1>
                <button onClick={() => { setShowSettings(true); setSettingsSubView('main'); }} className="p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-black hover:rotate-90 transition-all">
                  <Settings size={24} />
                </button>
             </div>
            
            <div className="bg-white rounded-[2rem] p-6 shadow-card mb-8 text-center relative overflow-hidden">
               {currentUser.isVerified && (
                 <div className="absolute top-0 left-0 w-full h-2 bg-snap-blue" />
               )}
               <div className="relative w-24 h-24 mx-auto mb-4 group cursor-pointer" onClick={() => {setEditName(currentUser.name); setEditBio(currentUser.bio); setEditSnap(currentUser.snapchatHandle); setEditAvatar(currentUser.avatar); setIsEditingProfile(true);}}>
                  <img src={currentUser.avatar} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-gray-50 shadow-lg" />
                  <div className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full shadow-md border border-gray-100">
                    <Edit3 size={14} className="text-gray-600" />
                  </div>
               </div>
               
               <h2 className="text-2xl font-black flex items-center justify-center gap-2 text-black">
                 {currentUser.name} 
                 {currentUser.isVerified && <div className="bg-snap-blue text-white p-0.5 rounded-full"><Check size={12} strokeWidth={4} /></div>}
               </h2>
               <p className="text-gray-500 font-medium mb-4">@{currentUser.snapchatHandle}</p>
               <div className="bg-gray-50 p-4 rounded-2xl text-sm text-gray-600 italic">
                 "{currentUser.bio}"
               </div>
            </div>

            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Clock size={20} /> My Vibes</h3>
            <div className="space-y-4 pb-20">
              {events.filter(e => e.attendees.some(a => a.id === currentUser.id)).length > 0 ? (
                events.filter(e => e.attendees.some(a => a.id === currentUser.id)).map(event => (
                  <EventCard key={event.id} event={event} onClick={() => {setSelectedEventId(event.id); setViewState('event_details')}} mini />
                ))
              ) : (
                <div className="text-center py-10 text-gray-400 font-medium bg-white rounded-3xl border border-dashed border-gray-200">
                  You haven't joined any vibes yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* EVENT DETAILS VIEW OVERLAY */}
      {viewState === 'event_details' && selectedEvent && (
        <div className="fixed inset-0 bg-gray-50 z-40 overflow-y-auto animate-in slide-in-from-right no-scrollbar">
           <div className="relative h-96">
             <img src={selectedEvent.imageUrl} className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-black/30"></div>
             <BackButton onClick={() => setViewState('discover')} />
             
             {/* Map Preview Badge (Interactive) */}
             <a 
               href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.location)}`}
               target="_blank"
               rel="noopener noreferrer"
               className="absolute -bottom-16 right-6 w-32 h-32 bg-white p-1 rounded-2xl shadow-xl rotate-3 z-10 transition-transform hover:scale-105 hover:rotate-0"
             >
                <div className="w-full h-full rounded-xl bg-gray-100 overflow-hidden relative">
                   <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/-122.404,37.781,14,0/300x300?access_token=pk.mock')] bg-cover opacity-50 bg-center" />
                   <div className="absolute inset-0 flex items-center justify-center">
                     <MapPin className="text-red-500 drop-shadow-md" size={32} fill="currentColor" />
                   </div>
                   <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-bold text-gray-500 bg-white/80 mx-2 rounded">Tap for Directions</div>
                </div>
             </a>
           </div>

           <div className="px-6 -mt-12 relative z-10 pb-24">
              <div className="flex justify-between items-start">
                  <h1 className="text-4xl font-black text-black mb-2 leading-tight flex-1">{selectedEvent.title}</h1>
                  <button onClick={handleShareEvent} className="p-3 bg-gray-100 rounded-full text-black hover:bg-gray-200 transition-colors">
                    <Share size={20} />
                  </button>
              </div>
              
              <div className="flex flex-wrap gap-3 mb-6 mt-2">
                <div className="bg-white px-4 py-2 rounded-full font-bold text-sm shadow-sm flex items-center gap-2 text-gray-800">
                  <Calendar size={16} className="text-snap-blue" />
                  {formatDate(selectedEvent.date)}
                </div>
                <div className="bg-white px-4 py-2 rounded-full font-bold text-sm shadow-sm flex items-center gap-2 text-gray-800">
                  <Clock size={16} className="text-snap-yellow fill-black" />
                  {formatTime(selectedEvent.date)}
                </div>
                <div className="bg-white px-4 py-2 rounded-full font-bold text-sm shadow-sm flex items-center gap-2 text-gray-800">
                  <MapPin size={16} className="text-red-500" />
                  {selectedEvent.location}
                </div>
              </div>

              {/* TABS within Details */}
              <div className="mb-6 border-b border-gray-200">
                 <div className="flex gap-6">
                   <button className="py-2 border-b-2 border-black font-bold text-black">Details</button>
                   <button className="py-2 border-b-2 border-transparent font-medium text-gray-400">Radar <span className="bg-green-100 text-green-600 text-[10px] px-1.5 rounded-full ml-1">NEW</span></button>
                 </div>
              </div>

              <p className="text-gray-600 text-lg leading-relaxed mb-8 bg-white p-6 rounded-[2rem] shadow-sm">
                {selectedEvent.description}
              </p>

              {/* Attendees Section / Radar Toggle */}
              <div className="mb-24">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-xl font-bold flex items-center gap-2">
                     Who's Going <span className="bg-black text-white text-xs px-2 py-0.5 rounded-full">{selectedEvent.attendees.length}</span>
                   </h3>
                </div>

                {/* Always show Radar View here for engagement */}
                <div className="bg-black rounded-[2rem] p-4 text-white mb-6">
                   <div className="flex items-center gap-2 mb-4">
                     <Radar className="text-green-400" size={20} />
                     <span className="font-bold text-sm text-green-400 uppercase tracking-widest">Live Radar</span>
                   </div>
                   <div className="w-full max-w-[300px] mx-auto">
                     <RadarView 
                       attendees={selectedEvent.attendees} 
                       onUserSelect={(u) => setRadarUser(u)} 
                     />
                   </div>
                   <p className="text-center text-gray-500 text-xs mt-4">Tap a user to bond with them</p>
                </div>

                {/* List View fallback */}
                <div className="space-y-3">
                  {selectedEvent.attendees.map(user => (
                    <div key={user.id} className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                       <div className="flex items-center gap-3">
                         <img src={user.avatar} className="w-10 h-10 rounded-full bg-gray-100" />
                         <div>
                            <p className="font-bold text-sm text-black">{user.name}</p>
                            <p className="text-xs text-gray-400 truncate w-32">{user.bio}</p>
                         </div>
                       </div>
                       {currentUser && user.id !== currentUser.id && (
                         <button 
                           onClick={() => setRadarUser(user)}
                           className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:bg-snap-yellow hover:text-black transition-colors"
                         >
                           <Zap size={16} />
                         </button>
                       )}
                    </div>
                  ))}
                </div>
              </div>
           </div>

           {/* Sticky Join/Buy Button */}
           <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent z-50 max-w-md mx-auto">
              <Button 
                onClick={handleJoinEvent} 
                variant={selectedEvent.attendees.some(u => u.id === currentUser?.id) ? 'outline' : 'primary'}
                className={selectedEvent.attendees.some(u => u.id === currentUser?.id) ? 'border-red-200 text-red-500 bg-white' : ''}
              >
                {selectedEvent.attendees.some(u => u.id === currentUser?.id) 
                  ? 'Leave Event' 
                  : selectedEvent.price > 0 
                     ? `Buy Ticket • $${selectedEvent.price}` 
                     : 'Join the Vibe'
                }
              </Button>
           </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-bottom">
           <div className="p-6 border-b border-gray-100 flex items-center justify-between">
             <button onClick={() => setIsEditingProfile(false)} className="text-lg font-medium text-gray-500">Cancel</button>
             <h2 className="text-lg font-bold text-black">Edit Profile</h2>
             <button onClick={handleUpdateProfile} className="text-lg font-bold text-snap-blue">Done</button>
           </div>
           <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="flex flex-col items-center">
                 <div className="w-24 h-24 rounded-full bg-gray-100 mb-4 relative overflow-hidden group">
                   <img src={editAvatar} className="w-full h-full object-cover opacity-80" />
                   <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleLocalImageUpload(e, setEditAvatar)} />
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <Camera className="text-gray-600" />
                   </div>
                 </div>
                 <p className="text-snap-blue font-bold text-sm">Change Photo</p>
              </div>
              <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Input label="Snapchat Handle" value={editSnap} onChange={(e) => setEditSnap(e.target.value)} icon={Ghost} />
              <Input label="Bio" multiline value={editBio} onChange={(e) => setEditBio(e.target.value)} />
           </div>
        </div>
      )}

      {/* SETTINGS PAGE (With Sub-Navigation) */}
      {showSettings && (
        <>
          {settingsSubView === 'main' && (
            <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col animate-in slide-in-from-right">
               <div className="p-6 flex items-center gap-4 bg-white shadow-sm z-10">
                 <button onClick={() => setShowSettings(false)} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft /></button>
                 <h2 className="text-xl font-black text-black">Settings</h2>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-100 font-bold text-gray-400 text-xs uppercase tracking-wider">Account</div>
                    <ToggleRow icon={Bell} label="Notifications" checked={notificationsEnabled} onChange={setNotificationsEnabled} />
                    <ToggleRow icon={EyeOff} label="Ghost Mode" checked={ghostMode} onChange={setGhostMode} colorClass="bg-gray-800" />
                  </div>

                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                     <div className="p-4 border-b border-gray-100 font-bold text-gray-400 text-xs uppercase tracking-wider">More</div>
                     <button onClick={() => setSettingsSubView('help_chat')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3"><HelpCircle size={16} /><span className="font-bold text-gray-800">I Need Help</span></div>
                        <ChevronRight size={16} className="text-gray-400" />
                     </button>
                     <button onClick={() => setSettingsSubView('report')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3"><AlertTriangle size={16} /><span className="font-bold text-gray-800">Report an Issue</span></div>
                        <ChevronRight size={16} className="text-gray-400" />
                     </button>
                     <button onClick={() => setSettingsSubView('privacy')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3"><FileText size={16} /><span className="font-bold text-gray-800">Privacy Policy</span></div>
                        <ChevronRight size={16} className="text-gray-400" />
                     </button>
                  </div>

                  <Button onClick={handleLogout} variant="danger" icon={LogOut}>Log Out</Button>
                  
                  <div className="text-center">
                     <p className="text-xs text-gray-400 font-medium">UGOGO v1.0.0</p>
                     <p className="text-xs text-gray-300">Made with 💛 for vibes</p>
                  </div>
               </div>
            </div>
          )}
          
          {settingsSubView === 'help_chat' && <SupportChat onBack={() => setSettingsSubView('main')} currentUser={currentUser} />}
          {settingsSubView === 'report' && <ReportIssue onBack={() => setSettingsSubView('main')} onSubmit={() => {setSettingsSubView('main'); showToast("Report received. We're on it!", "success")}} />}
          {settingsSubView === 'privacy' && <PrivacyView onBack={() => setSettingsSubView('main')} />}
        </>
      )}

      {/* BOTTOM NAVIGATION */}
      {viewState !== 'event_details' && (
        <div className="h-20 bg-white/95 backdrop-blur-md border-t border-gray-200 flex justify-around items-center px-2 z-30 absolute bottom-0 w-full">
          <button onClick={() => { triggerHaptic(); setActiveTab('discover'); }} className={`p-4 rounded-full transition-all flex flex-col items-center gap-1 ${activeTab === 'discover' ? 'text-black scale-110' : 'text-gray-400 hover:text-gray-600'}`}>
            <Home size={28} strokeWidth={activeTab === 'discover' ? 3 : 2} />
          </button>
          <button onClick={() => { triggerHaptic(); setActiveTab('create'); }} className={`p-4 rounded-full transition-all flex flex-col items-center gap-1 ${activeTab === 'create' ? 'bg-black text-white shadow-lg shadow-gray-400/50 -translate-y-4' : 'text-gray-400 hover:text-gray-600'}`}>
            <Plus size={32} strokeWidth={3} />
          </button>
          <button onClick={() => { triggerHaptic(); setActiveTab('profile'); }} className={`p-4 rounded-full transition-all flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-black scale-110' : 'text-gray-400 hover:text-gray-600'}`}>
            <div className={`w-8 h-8 rounded-full overflow-hidden border-2 ${activeTab === 'profile' ? 'border-black' : 'border-transparent'}`}>
              <img src={currentUser?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest'} className="w-full h-full" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
