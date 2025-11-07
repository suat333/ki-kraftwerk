
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { ChatMode, GroundingSource } from '../types';

// This file contains a simplified API key handling for demonstration.
// In a real application, this should be handled securely on a backend server.
const getApiKey = () => {
    const key = process.env.API_KEY;
    if (!key) {
        // This is a fallback for development and will not work in a deployed environment
        // where process.env is not available on the client.
        // The Veo flow with window.aistudio is the correct pattern for client-side key selection.
        console.warn("API_KEY environment variable not found.");
        return "YOUR_API_KEY"; // Should be replaced by user input or secure mechanism
    }
    return key;
};


export const sendChatMessage = async (
  message: string,
  mode: ChatMode
): Promise<{ text: string; sources?: GroundingSource[] }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  let modelName = 'gemini-2.5-flash';
  let config: any = {};
  
  switch (mode) {
    case ChatMode.LowLatency:
      modelName = 'gemini-flash-lite-latest';
      break;
    case ChatMode.Complex:
      modelName = 'gemini-2.5-pro';
      config = { thinkingConfig: { thinkingBudget: 32768 } };
      break;
    case ChatMode.Search:
      config = { tools: [{ googleSearch: {} }] };
      break;
    case ChatMode.Maps:
      // A default location is provided. In a real app, this should be obtained from the user.
       config = {
        tools: [{googleMaps: {}}],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: 37.78193,
              longitude: -122.40476
            }
          }
        }
      };
      break;
    case ChatMode.Chat:
    default:
      modelName = 'gemini-2.5-flash';
      break;
  }
  
  const response = await ai.models.generateContent({
      model: modelName,
      contents: message,
      config: Object.keys(config).length > 0 ? config : undefined,
  });

  const text = response.text;
  const rawSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  const sources: GroundingSource[] = rawSources
      ? rawSources
          .map((chunk: any) => ({
              uri: chunk.web?.uri || chunk.maps?.uri,
              title: chunk.web?.title || chunk.maps?.title,
          }))
          .filter((source: any) => source.uri)
      : [];

  return { text, sources };
};

export const generateImage = async (prompt: string, aspectRatio: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        },
    });

    return response.generatedImages[0].image.imageBytes;
};

export const editImage = async (base64Data: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: prompt },
            ],
        },
        config: { responseModalities: [Modality.IMAGE] },
    });
    
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData) {
        return part.inlineData.data;
    }
    throw new Error('No image data found in response.');
};

export const analyzeImage = async (base64Data: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: prompt },
            ],
        },
    });
    return response.text;
};


export const generateVideo = async (
    prompt: string, 
    aspectRatio: "16:9" | "9:16", 
    imageBase64: string | null,
    mimeType: string | null
): Promise<string> => {
    // For Veo, we MUST instantiate the client right before the call to ensure the latest key is used.
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: imageBase64 && mimeType ? { imageBytes: imageBase64, mimeType } : undefined,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation failed or returned no URI.");
    }

    // The API key must be appended to the download URI
    const response = await fetch(`${downloadLink}&key=${getApiKey()}`);
    if (!response.ok) {
        throw new Error("Failed to download video from generated URI.");
    }
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};

export const generateSpeech = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
        throw new Error("No audio data returned from TTS API.");
    }
    return audioData;
}