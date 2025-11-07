
import React, { useState, useEffect, useCallback } from 'react';
import { generateVideo } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { LoaderIcon, UploadIcon, Wand2Icon, KeyIcon } from './Icons';

type AspectRatio = "16:9" | "9:16";

const loadingMessages = [
    "Die virtuellen Kameras werden aufgewärmt...",
    "Pixel werden choreografiert...",
    "Digitales Sternenlicht wird gerendert...",
    "Dies kann einige Minuten dauern, vielen Dank für Ihre Geduld.",
    "Die letzten Szenen werden zusammengestellt...",
    "Fast fertig, die letzten Schliffe werden hinzugefügt...",
];

export const VideoPanel: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);

    const checkApiKey = useCallback(async () => {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
        }
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);
    
    useEffect(() => {
        let interval: number;
        if (isLoading) {
            interval = setInterval(() => {
                setLoadingMessage(prev => {
                    const currentIndex = loadingMessages.indexOf(prev);
                    return loadingMessages[(currentIndex + 1) % loadingMessages.length];
                });
            }, 4000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isLoading]);

    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            await window.aistudio.openSelectKey();
            // Assume success to improve UX, as hasSelectedApiKey might have a delay
            setApiKeySelected(true);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setError(null);
        setGeneratedVideoUrl(null);
        setLoadingMessage(loadingMessages[0]);
        
        let base64Data: string | null = null;
        let mimeType: string | null = null;
        if (imageFile) {
            base64Data = await fileToBase64(imageFile);
            mimeType = imageFile.type;
        }

        try {
            const videoUrl = await generateVideo(prompt, aspectRatio, base64Data, mimeType);
            setGeneratedVideoUrl(videoUrl);
        } catch (err: any) {
            console.error(err);
            let errorMessage = 'Während der Videogenerierung ist ein Fehler aufgetreten.';
            if (err.message && err.message.includes("Requested entity was not found.")) {
                errorMessage = "API-Schlüssel ungültig. Bitte wählen Sie einen gültigen API-Schlüssel.";
                setApiKeySelected(false);
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!apiKeySelected) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-800 rounded-xl p-6 text-center">
                 <KeyIcon className="h-16 w-16 text-yellow-400 mb-4"/>
                <h2 className="text-2xl font-bold mb-2">API-Schlüssel erforderlich</h2>
                <p className="text-gray-400 mb-6 max-w-md">Die Veo-Videogenerierung erfordert die Auswahl eines API-Schlüssels. Dies gewährleistet eine korrekte Abrechnung und den Zugriff auf den Dienst.</p>
                <button onClick={handleSelectKey} className="px-6 py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                    API-Schlüssel auswählen
                </button>
                 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline mt-4">
                    Mehr über die Abrechnung erfahren
                </a>
            </div>
        )
    }

    return (
        <div className="bg-gray-800 rounded-xl shadow-2xl p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-1">Video-Zentrum</h2>
            <p className="text-gray-400 mb-6">Generieren Sie beeindruckende Videos aus Text und Bildern mit Veo.</p>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="z.B., Ein majestätischer Adler, der durch ein Gewitter fliegt"
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none resize-none flex-grow"
                        rows={5}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Seitenverhältnis</label>
                            <select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                                className="w-full p-2 bg-gray-700 rounded-lg"
                            >
                                <option value="16:9">Landschaft (16:9)</option>
                                <option value="9:16">Porträt (9:16)</option>
                            </select>
                        </div>
                        <div className="w-full">
                           <label className="block text-sm font-medium text-gray-300 mb-2">Optionales Startbild</label>
                            <label htmlFor="video-file-upload" className="cursor-pointer w-full flex justify-center items-center p-2 bg-gray-700 rounded-lg border-2 border-dashed border-gray-600 hover:border-blue-500 transition-colors text-sm truncate">
                                <UploadIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                                <span className="truncate">{imageFile ? imageFile.name : 'Bild hochladen'}</span>
                            </label>
                            <input id="video-file-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </div>
                    </div>
                    
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !prompt}
                        className="w-full flex justify-center items-center py-3 px-4 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                         {isLoading ? <LoaderIcon className="animate-spin h-5 w-5" /> : <Wand2Icon className="h-5 w-5 mr-2" />}
                         Video generieren
                    </button>
                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                </div>
                
                <div className="bg-gray-900 rounded-lg flex items-center justify-center p-4 min-h-[300px]">
                    {isLoading && (
                        <div className="text-center">
                            <LoaderIcon className="animate-spin h-12 w-12 text-blue-500 mx-auto" />
                            <p className="mt-4 text-gray-300">{loadingMessage}</p>
                        </div>
                    )}
                    {!isLoading && generatedVideoUrl && (
                        <video controls autoPlay loop src={generatedVideoUrl} className="max-h-full max-w-full rounded-lg" />
                    )}
                    {!isLoading && !generatedVideoUrl && imagePreview && (
                         <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg"/>
                    )}
                    {!isLoading && !generatedVideoUrl && !imagePreview && (
                        <p className="text-gray-500">Ihr generiertes Video wird hier angezeigt.</p>
                    )}
                </div>
            </div>
        </div>
    );
};