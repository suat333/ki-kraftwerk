
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: GroundingSource[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export enum ChatMode {
  Chat = 'Chat (Flash)',
  LowLatency = 'Schnell (Flash Lite)',
  Complex = 'Komplex (Pro Thinking)',
  Search = 'Suche (Flash)',
  Maps = 'Maps Grounded (Flash)',
}