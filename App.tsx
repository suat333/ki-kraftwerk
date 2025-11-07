
import React, { useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { ImagePanel } from './components/ImagePanel';
import { VideoPanel } from './components/VideoPanel';
import { AudioPanel } from './components/AudioPanel';
import { BrainCircuitIcon, ImageIcon, MessageSquareIcon, VideoIcon, Volume2Icon } from './components/Icons';

type Feature = 'Chat & Suche' | 'Bildstudio' | 'Video-Zentrum' | 'Audio-Suite';

const App: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<Feature>('Chat & Suche');

  const renderFeature = () => {
    switch (activeFeature) {
      case 'Chat & Suche':
        return <ChatPanel />;
      case 'Bildstudio':
        return <ImagePanel />;
      case 'Video-Zentrum':
        return <VideoPanel />;
      case 'Audio-Suite':
        return <AudioPanel />;
      default:
        return <ChatPanel />;
    }
  };

  const NavItem = ({ feature, icon }: { feature: Feature, icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveFeature(feature)}
      className={`flex items-center w-full text-left px-4 py-3 rounded-lg transition-colors duration-200 ${
        activeFeature === feature
          ? 'bg-blue-600 text-white shadow-lg'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {icon}
      <span className="ml-3">{feature}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-900 font-sans">
      <aside className="w-64 bg-gray-800 text-white p-4 flex flex-col">
        <div className="flex items-center mb-8">
          <BrainCircuitIcon className="h-8 w-8 text-blue-400" />
          <h1 className="text-xl font-bold ml-2">KI-Kraftwerk</h1>
        </div>
        <nav className="flex flex-col space-y-2">
          <NavItem feature="Chat & Suche" icon={<MessageSquareIcon className="h-5 w-5" />} />
          <NavItem feature="Bildstudio" icon={<ImageIcon className="h-5 w-5" />} />
          <NavItem feature="Video-Zentrum" icon={<VideoIcon className="h-5 w-5" />} />
          <NavItem feature="Audio-Suite" icon={<Volume2Icon className="h-5 w-5" />} />
        </nav>
      </aside>
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {renderFeature()}
      </main>
    </div>
  );
};

export default App;