
import React, { useState } from 'react';
import { generateImage, editImage, analyzeImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { DownloadIcon, LoaderIcon, UploadIcon, Wand2Icon } from './Icons';

type ImageMode = 'Generieren' | 'Bearbeiten' | 'Analysieren';
type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export const ImagePanel: React.FC = () => {
  const [mode, setMode] = useState<ImageMode>('Generieren');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setGeneratedImage(null); // Clear previous results
      setAnalysis('');
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    setAnalysis('');

    try {
      if (mode === 'Generieren') {
        const imageB64 = await generateImage(prompt, aspectRatio);
        setGeneratedImage(`data:image/jpeg;base64,${imageB64}`);
      } else if (mode === 'Bearbeiten' && imageFile) {
        const base64Data = await fileToBase64(imageFile);
        const editedImageB64 = await editImage(base64Data, imageFile.type, prompt);
        setGeneratedImage(`data:image/png;base64,${editedImageB64}`);
      } else if (mode === 'Analysieren' && imageFile) {
        const base64Data = await fileToBase64(imageFile);
        const analysisText = await analyzeImage(base64Data, imageFile.type, prompt || "Beschreiben Sie dieses Bild im Detail.");
        setAnalysis(analysisText);
      }
    } catch (err) {
      console.error(err);
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = isLoading || !prompt || (mode !== 'Generieren' && !imageFile);
  
  const ModeButton = ({ currentMode, label }: { currentMode: ImageMode, label: ImageMode}) => (
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
      <h2 className="text-2xl font-bold mb-1">Bildstudio</h2>
      <p className="text-gray-400 mb-6">Erstellen, bearbeiten und verstehen Sie Bilder mit KI.</p>
      
      <div className="flex space-x-2 mb-6">
        <ModeButton currentMode={mode} label="Generieren" />
        <ModeButton currentMode={mode} label="Bearbeiten" />
        <ModeButton currentMode={mode} label="Analysieren" />
      </div>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="flex flex-col space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === 'Generieren' ? 'z.B., Ein Foto eines Astronauten, der auf dem Mars ein Pferd reitet' :
              mode === 'Bearbeiten' ? 'z.B., Fügen Sie eine futuristische Stadt im Hintergrund hinzu' :
              'z.B., Was ist das Hauptmotiv dieses Bildes?'
            }
            className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none resize-none flex-grow"
            rows={5}
          />
          {mode === 'Generieren' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Seitenverhältnis</label>
              <select 
                value={aspectRatio} 
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="w-full p-2 bg-gray-700 rounded-lg"
              >
                <option value="1:1">Quadrat (1:1)</option>
                <option value="16:9">Landschaft (16:9)</option>
                <option value="9:16">Porträt (9:16)</option>
                <option value="4:3">Standard (4:3)</option>
                <option value="3:4">Hochformat (3:4)</option>
              </select>
            </div>
          )}

          {(mode === 'Bearbeiten' || mode === 'Analysieren') && (
            <div className="w-full">
              <label htmlFor="file-upload" className="cursor-pointer w-full flex justify-center items-center p-4 bg-gray-700 rounded-lg border-2 border-dashed border-gray-600 hover:border-blue-500 transition-colors">
                <UploadIcon className="h-6 w-6 mr-2" />
                <span>{imageFile ? imageFile.name : 'Bild hochladen'}</span>
              </label>
              <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          )}
          
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="w-full flex justify-center items-center py-3 px-4 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <LoaderIcon className="animate-spin h-5 w-5" /> : <Wand2Icon className="h-5 w-5 mr-2" />}
            {mode}
          </button>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>

        {/* Output */}
        <div className="bg-gray-900 rounded-lg flex items-center justify-center p-4 min-h-[300px]">
          {isLoading && <LoaderIcon className="animate-spin h-12 w-12 text-blue-500" />}
          {!isLoading && (
            <>
              {generatedImage && (
                <div className="relative group">
                    <img src={generatedImage} alt="Generated" className="max-h-[400px] object-contain rounded-lg shadow-lg"/>
                    <a href={generatedImage} download="generated-image.jpg" className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <DownloadIcon className="h-5 w-5"/>
                    </a>
                </div>
              )}
              {analysis && <p className="text-gray-300 p-4">{analysis}</p>}
              {imagePreview && !generatedImage && !analysis && (
                <img src={imagePreview} alt="Preview" className="max-h-[400px] object-contain rounded-lg"/>
              )}
              {!generatedImage && !analysis && !imagePreview && mode !== 'Generieren' && (
                <p className="text-gray-500">Laden Sie ein Bild hoch, um zu beginnen.</p>
              )}
              {!generatedImage && !analysis && mode === 'Generieren' && (
                 <p className="text-gray-500">Ihr generiertes Bild wird hier angezeigt.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};