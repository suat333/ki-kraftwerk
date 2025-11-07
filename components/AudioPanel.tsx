
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { generateSpeech } from '../services/geminiService';
import { LoaderIcon, MicIcon, MicOffIcon, PlayIcon, Volume2Icon } from './Icons';

// Polyfill for webkitAudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

type AudioMode = 'Gespräch' | 'TTS';

export const AudioPanel: React.FC = () => {
    const [mode, setMode] = useState<AudioMode>('Gespräch');
    const [isLive, setIsLive] = useState(false);
    const [transcription, setTranscription] = useState<{ user: string; model: string }[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [currentOutput, setCurrentOutput] = useState('');
    
    const [ttsText, setTtsText] = useState('');
    const [isTtsLoading, setIsTtsLoading] = useState(false);
    const [ttsError, setTtsError] = useState('');

    const sessionRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const stopLiveSession = useCallback(() => {
        setIsLive(false);

        if (sessionRef.current) {
            sessionRef.current.then(session => session.close());
            sessionRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        
        // Finalize transcription log
        if(currentInput || currentOutput) {
             setTranscription(prev => [...prev, { user: currentInput, model: currentOutput }]);
        }
        setCurrentInput('');
        setCurrentOutput('');

    }, [currentInput, currentOutput]);
    
    const startLiveSession = async () => {
        if (isLive) return;
        setIsLive(true);
        setTranscription([]);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            sessionRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
                },
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            if (sessionRef.current) {
                                sessionRef.current.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                            }
                        };
                        source.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            setCurrentInput(prev => prev + message.serverContent.inputTranscription.text);
                        }
                        if (message.serverContent?.outputTranscription) {
                            setCurrentOutput(prev => prev + message.serverContent.outputTranscription.text);
                        }
                        if(message.serverContent?.turnComplete) {
                            setTranscription(prev => [...prev, { user: currentInput, model: currentOutput }]);
                            setCurrentInput('');
                            setCurrentOutput('');
                        }
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && outputAudioContextRef.current) {
                           const outputCtx = outputAudioContextRef.current;
                           nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                           const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                           const source = outputCtx.createBufferSource();
                           source.buffer = audioBuffer;
                           source.connect(outputCtx.destination);
                           source.addEventListener('ended', () => sourcesRef.current.delete(source));
                           source.start(nextStartTimeRef.current);
                           nextStartTimeRef.current += audioBuffer.duration;
                           sourcesRef.current.add(source);
                        }
                         if (message.serverContent?.interrupted) {
                            sourcesRef.current.forEach(source => source.stop());
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e) => {
                        console.error('Live session error:', e);
                        stopLiveSession();
                    },
                    onclose: () => {
                        stopLiveSession();
                    }
                }
            });
        } catch (error) {
            console.error('Failed to start live session:', error);
            setIsLive(false);
        }
    };
    
    useEffect(() => {
        return () => {
            stopLiveSession();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleTtsSubmit = async () => {
        if (!ttsText.trim() || isTtsLoading) return;
        setIsTtsLoading(true);
        setTtsError('');
        try {
            const audioData = await generateSpeech(ttsText);
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            const audioBuffer = await decodeAudioData(decode(audioData), audioContext, 24000, 1);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
        } catch (err) {
            console.error(err);
            setTtsError('Spracherzeugung fehlgeschlagen. Bitte versuchen Sie es erneut.');
        } finally {
            setIsTtsLoading(false);
        }
    };

    const ModeButton = ({ currentMode, label }: { currentMode: AudioMode, label: AudioMode}) => (
        <button
          onClick={() => setMode(label)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === label ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {label}
        </button>
    );
    
    return (
        <div className="bg-gray-800 rounded-xl shadow-2xl p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-1">Audio-Suite</h2>
            <p className="text-gray-400 mb-6">Führen Sie Echtzeitgespräche oder generieren Sie Sprache aus Text.</p>
             <div className="flex space-x-2 mb-6">
                <ModeButton currentMode={mode} label="Gespräch"/>
                <ModeButton currentMode={mode} label="TTS"/>
             </div>

            {mode === 'Gespräch' && (
                <div className="flex flex-col flex-grow">
                    <div className="flex-grow bg-gray-900 rounded-lg p-4 overflow-y-auto mb-4">
                        {transcription.map((t, i) => (
                            <div key={i}>
                                {t.user && <p><strong className="text-blue-400">Sie:</strong> {t.user}</p>}
                                {t.model && <p><strong className="text-green-400">KI:</strong> {t.model}</p>}
                            </div>
                        ))}
                        {isLive && (
                           <>
                             {currentInput && <p><strong className="text-blue-400">Sie:</strong> {currentInput}<span className="inline-block w-2 h-2 ml-1 bg-gray-400 rounded-full animate-pulse"></span></p>}
                             {currentOutput && <p><strong className="text-green-400">KI:</strong> {currentOutput}<span className="inline-block w-2 h-2 ml-1 bg-gray-400 rounded-full animate-pulse"></span></p>}
                           </>
                        )}
                        {!isLive && transcription.length === 0 && <p className="text-gray-500">Drücken Sie das Mikrofon, um das Gespräch zu starten.</p>}
                    </div>
                    <button
                        onClick={isLive ? stopLiveSession : startLiveSession}
                        className={`w-16 h-16 rounded-full flex items-center justify-center self-center transition-colors ${
                            isLive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                       {isLive ? <MicOffIcon className="h-8 w-8 text-white"/> : <MicIcon className="h-8 w-8 text-white"/>}
                    </button>
                </div>
            )}

            {mode === 'TTS' && (
                <div className="flex flex-col flex-grow space-y-4">
                    <textarea
                        value={ttsText}
                        onChange={(e) => setTtsText(e.target.value)}
                        placeholder="Geben Sie hier Text ein, um ihn in Sprache umzuwandeln..."
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none resize-none flex-grow"
                        rows={8}
                    />
                    <button
                        onClick={handleTtsSubmit}
                        disabled={isTtsLoading || !ttsText.trim()}
                        className="w-full flex justify-center items-center py-3 px-4 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                       {isTtsLoading ? <LoaderIcon className="animate-spin h-5 w-5" /> : <PlayIcon className="h-5 w-5 mr-2" />}
                       Generieren & Abspielen
                    </button>
                    {ttsError && <p className="text-red-400 text-sm text-center">{ttsError}</p>}
                </div>
            )}
        </div>
    );
};