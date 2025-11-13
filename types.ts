import type { User as FirebaseUser } from 'firebase/auth';
// FIX: Changed import type to regular import to fix module resolution issue for Timestamp.
import { Timestamp } from 'firebase/firestore';

export enum Page {
  Home = 'home',
  Portfolio = 'portfolio',
  Chat = 'chat',
  Community = 'community',
  Profile = 'profile',
}

export type User = FirebaseUser | null;

export interface UserProfile {
  id?: string; // Optional because it's the doc ID, not in the doc data itself
  username: string;
  bio: string;
  email: string;
  photoURL?: string | null;
  projectStatus?: 'Pending' | 'In Process' | 'Finalizing' | 'Success';
  projectStatusUpdatedAt?: Timestamp;
  gender?: 'male' | 'female' | 'other' | 'not-specified';
}

export interface ChatMessage {
  id: string;
  text: string;
  role: 'user' | 'ai';
  createdAt: Timestamp;
  imageUrls?: string[];
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  analysisFile?: {
    name: string;
    type: string;
  };
  analysisResult?: {
    url: string;
    name: string;
    type: string;
  };
  isStopMessage?: boolean;
  isAnalysisResponse?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- NEW TYPES FOR COMMUNITY PAGE ---

export interface Author {
  id: string;
  email: string;
  username: string;
  photoURL?: string | null;
}

export interface RepostedPost {
  id: string;
  author: Author;
  text: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video' | 'audio' | 'mixed';
  audioUrl?: string;
  poll?: Poll;
  createdAt: Timestamp;
}

export interface PollOption {
  text: string;
  votes: number;
}

export interface Poll {
  options: PollOption[];
  voters: { [userId: string]: number }; // Maps user ID to the index of their chosen option
}

export interface CommunityPost {
  id: string;
  author: Author;
  text: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video' | 'audio' | 'mixed';
  audioUrl?: string;
  poll?: Poll;
  createdAt: Timestamp;
  commentCount: number;
  likeCount?: number;
  repostCount?: number;
  aiReply?: {
      text: string;
      createdAt: Timestamp;
      audioUrl?: string;
  };
  isAiPost?: boolean;
  repostedPost?: RepostedPost;
}

export interface Comment {
    id: string;
    author: Author;
    text: string;
    createdAt: Timestamp;
    postId: string;
    replyCount: number;
    audioUrl?: string;
}

export interface Reply {
    id:string;
    author: Author;
    text: string;
    createdAt: Timestamp;
    postId: string;
    commentId: string;
    audioUrl?: string;
}