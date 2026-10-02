"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Terminal, X, Minimize2, Maximize2, Send, PlayCircle, Loader2 } from 'lucide-react';
import { useMusicContext } from '@/components/MusicContext';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AudioState {
  isPlaying: boolean;
  url: string | null;
  title: string | null;
  artist: string | null;
  image: string | null;
}

export default function AITerminal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Terminal initialized. State your query.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    url: null,
    title: null,
    artist: null,
    image: null
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();
  const { pauseBgMusic, resumeBgMusic } = useMusicContext();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isMinimized]);

  useEffect(() => {
    if (audioState.url) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioState.url);
      } else {
        audioRef.current.src = audioState.url;
      }
      // Pause the site's background music before AI song starts
      pauseBgMusic();
      audioRef.current.play();
    }
  }, [audioState.url]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (audioState.isPlaying) {
        audioRef.current.pause();
        setAudioState(prev => ({ ...prev, isPlaying: false }));
        resumeBgMusic();
      } else {
        pauseBgMusic();
        audioRef.current.play();
        setAudioState(prev => ({ ...prev, isPlaying: true }));
      }
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onplay = () => setAudioState(prev => ({ ...prev, isPlaying: true }));
      audioRef.current.onpause = () => {
        setAudioState(prev => ({ ...prev, isPlaying: false }));
        resumeBgMusic();
      };
      audioRef.current.onended = () => {
        setAudioState(prev => ({ ...prev, isPlaying: false, url: null }));
        resumeBgMusic();
      };
    }
  }, [audioRef.current]);

  const handleToolCall = async (toolCall: any) => {
    const { name, arguments: argsString } = toolCall.function;
    const args = JSON.parse(argsString || '{}');

    if (name === 'play_song') {
      try {
        const res = await fetch(`/api/music?query=${encodeURIComponent(args.query)}`);
        const data = await res.json();
        if (data.streamUrl) {
          setAudioState({
            isPlaying: true,
            url: data.streamUrl,
            title: data.title,
            artist: data.artist,
            image: data.image
          });
        }
      } catch (err) {
        console.error("Failed to play song", err);
      }
    } else if (name === 'navigate') {
      router.push(args.route);
    } else if (name === 'trigger_glitch') {
      document.body.classList.add('glitch-effect');
      setTimeout(() => {
        document.body.classList.remove('glitch-effect');
      }, 1500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }));
      
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory })
      });

      const data = await res.json();
      const choice = data.choices[0];
      const aiMessage = choice.message;

      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        // Execute tool calls
        for (const toolCall of aiMessage.tool_calls) {
          await handleToolCall(toolCall);
        }
      }

      if (aiMessage.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: aiMessage.content }]);
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'System error. Connection refused.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-black/80 backdrop-blur-md border border-zinc-800/50 text-zinc-400 p-4 rounded-full hover:bg-zinc-900/40 hover:text-zinc-300 transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.1)] group"
      >
        <Terminal className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  return (
    <div className={`fixed z-50 transition-all duration-300 ease-in-out ${
      isMinimized 
        ? 'bottom-6 right-6 w-[calc(100vw-3rem)] sm:w-80 h-14' 
        : 'bottom-6 right-6 w-[calc(100vw-3rem)] sm:w-[400px] h-[55vh] sm:h-[550px]'
    }`}>
      <div className="flex flex-col h-full bg-black/95 backdrop-blur-xl border border-zinc-800/50 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.05)]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-black">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-400 text-xs font-mono font-bold tracking-widest uppercase">Void OS // root@system</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-400/70">
            <button onClick={() => setIsMinimized(!isMinimized)} className="hover:text-zinc-300 transition-colors">
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button onClick={() => setIsOpen(false)} className="hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Audio Player (if playing) */}
            {audioState.url && (
              <div className="px-4 py-2 border-b border-zinc-800/30 bg-zinc-900/10 flex items-center gap-3">
                {audioState.image && (
                  <img src={audioState.image} alt="cover" className="w-8 h-8 rounded-sm object-cover opacity-80" />
                )}
                <div className="flex-1 overflow-hidden">
                  <div className="text-zinc-300 text-xs font-mono truncate">{audioState.title}</div>
                  <div className="text-zinc-400/60 text-[10px] font-mono truncate">{audioState.artist}</div>
                </div>
                <button onClick={togglePlay} className="text-zinc-400 hover:text-zinc-300">
                  <PlayCircle className={`w-5 h-5 ${audioState.isPlaying ? 'animate-pulse text-zinc-300' : ''}`} />
                </button>
              </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`text-[10px] uppercase tracking-widest mb-1 opacity-50 ${
                    msg.role === 'user' ? 'text-gray-400' : 'text-zinc-400'
                  }`}>
                    {msg.role === 'user' ? 'guest' : 'system'}
                  </div>
                  <div className={`max-w-[85%] rounded p-3 ${
                    msg.role === 'user' 
                      ? 'bg-zinc-900 text-gray-300 border border-zinc-800' 
                      : 'bg-zinc-900/20 text-zinc-300 border border-zinc-800/30'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex flex-col items-start">
                  <div className="text-[10px] uppercase tracking-widest mb-1 opacity-50 text-zinc-400">system</div>
                  <div className="bg-zinc-900/20 text-zinc-300 border border-zinc-800/30 rounded p-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800/50 bg-black">
              <div className="relative flex items-center">
                <span className="absolute left-3 text-zinc-500/50 font-mono text-sm">{'>'}</span>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter command..."
                  className="w-full bg-zinc-950 border border-zinc-800/30 rounded text-zinc-100 placeholder-zinc-700/40 text-base font-mono pl-8 pr-10 py-2 focus:outline-none focus:border-zinc-500/50 transition-colors"
                />
                <button 
                  type="submit" 
                  disabled={isLoading || !input.trim()}
                  className="absolute right-2 p-1 text-zinc-400/70 hover:text-zinc-300 disabled:opacity-50 disabled:hover:text-zinc-400/70 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
