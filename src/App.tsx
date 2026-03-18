/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Clock, RefreshCw, AlertCircle, Activity, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

interface SignalData {
  pair: string;
  signal: string;
  buyerPressure: number;
  sellerPressure: number;
  timestamp: string;
  analysis?: string;
}

export default function App() {
  const [signalData, setSignalData] = useState<SignalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [candleTimer, setCandleTimer] = useState<string>('00:00');

  const fetchSignal = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/latest');
      if (!response.ok) throw new Error('Failed to fetch signal');
      const data = await response.json();
      setSignalData(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('Connection error. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const analyzeMarket = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Analyze the current EUR/JPY forex market live. Provide a BUY or SELL signal based on the latest technical indicators (RSI, MACD, Price Action) found via search. Also estimate buyer and seller pressure as percentages.",
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              signal: { type: Type.STRING, description: "BUY, SELL, or NEUTRAL" },
              buyerPressure: { type: Type.NUMBER, description: "Percentage of buyer pressure (0-100)" },
              sellerPressure: { type: Type.NUMBER, description: "Percentage of seller pressure (0-100)" },
              analysis: { type: Type.STRING, description: "Short 1-sentence explanation of the analysis" }
            },
            required: ["signal", "buyerPressure", "sellerPressure", "analysis"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      // Update the backend with the AI signal
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair: 'EURJPY',
          signal: result.signal,
          buyerPressure: result.buyerPressure,
          sellerPressure: result.sellerPressure
        })
      });

      setSignalData(prev => ({
        ...prev!,
        ...result,
        timestamp: new Date().toISOString()
      }));
      
    } catch (err) {
      setError('AI Analysis failed. Please try again.');
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchSignal();
    const interval = setInterval(fetchSignal, 30000); // Auto-refresh every 30s
    
    // Candle Timer logic (1m interval)
    const timerInterval = setInterval(() => {
      const now = new Date();
      const seconds = now.getSeconds();
      const remaining = 60 - seconds;
      const displaySeconds = remaining === 60 ? 0 : remaining;
      setCandleTimer(`00:${displaySeconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
    };
  }, []);

  const getSignalColor = (signal: string) => {
    switch (signal.toUpperCase()) {
      case 'BUY': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'SELL': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
    }
  };

  const getSignalIcon = (signal: string) => {
    switch (signal.toUpperCase()) {
      case 'BUY': return <TrendingUp className="w-8 h-8" />;
      case 'SELL': return <TrendingDown className="w-8 h-8" />;
      default: return <Clock className="w-8 h-8" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Activity className="text-black w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">SignalPro <span className="text-zinc-500 font-normal">EUR/JPY</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500 font-mono">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE MARKET DATA
            </div>
            <button 
              onClick={fetchSignal}
              disabled={loading}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">EURJPY</span>
                  <span className="text-xs text-zinc-500 px-1.5 py-0.5 bg-zinc-800 rounded">1m</span>
                </div>
                <div className="text-xs text-zinc-500 font-mono italic">
                  Powered by TradingView
                </div>
              </div>
              <div className="aspect-video w-full bg-black">
                <iframe 
                  src="https://www.tradingview.com/widgetembed/?symbol=FX:EURJPY&interval=1&theme=dark&style=1&timezone=Etc%2FUTC" 
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  allowFullScreen
                ></iframe>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Candle Close', value: candleTimer, color: 'text-emerald-400 font-mono' },
                { label: 'Volatility', value: 'High', color: 'text-orange-400' },
                { label: 'Trend', value: 'Bullish', color: 'text-emerald-400' },
                { label: 'RSI (14)', value: '58.4', color: 'text-zinc-300' },
                { label: 'Volume', value: '2.4M', color: 'text-zinc-300' },
              ].map((stat, i) => (
                <div key={i} className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{stat.label}</div>
                  <div className={`text-sm font-semibold ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Signal Sidebar */}
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Activity className="w-24 h-24" />
              </div>

              <h2 className="text-sm font-medium text-zinc-400 mb-6 flex items-center gap-2 italic">
                Active Signal
              </h2>

              <AnimatePresence mode="wait">
                {error ? (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
                    <p className="text-sm text-zinc-400">{error}</p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key={signalData?.signal || 'loading'}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="flex flex-col items-center justify-center py-4"
                  >
                    <div className={`p-6 rounded-3xl border-2 mb-6 transition-all duration-500 ${signalData ? getSignalColor(signalData.signal) : 'text-zinc-700 border-zinc-800 bg-zinc-800/20'}`}>
                      {getSignalIcon(signalData?.signal || 'WAITING')}
                    </div>
                    
                    <div className="text-center">
                      <div className="text-4xl font-black tracking-tighter mb-1 uppercase">
                        {signalData?.signal || 'WAITING'}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {signalData ? `Last updated: ${new Date(signalData.timestamp).toLocaleTimeString()}` : 'Initializing...'}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-8 pt-6 border-t border-zinc-800 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                    <span className="text-emerald-500">Buyer Power</span>
                    <span className="text-rose-500">Seller Power</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                    <motion.div 
                      initial={{ width: '50%' }}
                      animate={{ width: `${signalData?.buyerPressure || 50}%` }}
                      className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    />
                    <motion.div 
                      initial={{ width: '50%' }}
                      animate={{ width: `${signalData?.sellerPressure || 50}%` }}
                      className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-emerald-400">{signalData?.buyerPressure || 50}%</span>
                    <span className="text-rose-400">{signalData?.sellerPressure || 50}%</span>
                  </div>
                </div>

                <button 
                  onClick={fetchSignal}
                  className="w-full py-3 bg-zinc-100 text-black font-bold rounded-xl hover:bg-white transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  REFRESH SIGNAL
                </button>

                <button 
                  onClick={analyzeMarket}
                  disabled={analyzing}
                  className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <BrainCircuit className={`w-5 h-5 ${analyzing ? 'animate-pulse' : ''}`} />
                  {analyzing ? 'ANALYZING MARKET...' : 'AI LIVE ANALYSIS'}
                </button>

                {signalData?.analysis && (
                  <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                    <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                      <span className="text-emerald-500 font-bold not-italic mr-1">AI Logic:</span>
                      {signalData.analysis}
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                  Signals are generated based on technical analysis. Trading involves risk. Use at your own discretion.
                </p>
              </div>
            </motion.div>

            {/* Webhook Info */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6">
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-3">Webhook Integration</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Connect your TradingView alerts to this dashboard using our secure webhook endpoint.
              </p>
              <div className="bg-black/40 rounded-lg p-3 font-mono text-[10px] text-emerald-400 border border-emerald-500/20 break-all">
                {window.location.origin}/api/signal
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-[10px] text-zinc-500 uppercase font-bold">Payload Template:</div>
                <pre className="bg-black/20 p-2 rounded text-[9px] text-zinc-400">
                  {`{\n  "pair": "EURJPY",\n  "signal": "BUY",\n  "buyerPressure": 80,\n  "sellerPressure": 20\n}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-zinc-800/50 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-xs text-zinc-500 font-mono">
            &copy; 2026 SIGNALPRO TERMINAL. ALL SYSTEMS OPERATIONAL.
          </div>
          <div className="flex gap-6 text-xs text-zinc-500 uppercase tracking-widest font-bold">
            <a href="#" className="hover:text-zinc-100 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-100 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-100 transition-colors">API Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
