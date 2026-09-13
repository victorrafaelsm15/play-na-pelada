import type { AppNotification, Friendship, Game, Invitation, Participant, PeladaEvent, Rotation, Team, User } from '@/types';
import { buildSeed } from './seed';

export interface Credential { userId: string; password: string }

export interface MockDB {
  version: number;
  users: User[];
  credentials: Credential[];
  friendships: Friendship[];
  events: PeladaEvent[];
  participants: Participant[];
  invitations: Invitation[];
  teams: Team[];
  rotations: Rotation[];
  games: Game[];
  notifications: AppNotification[];
}

const KEY = 'racha:mockdb';
const VERSION = 1;
let cache: MockDB | null = null;

function load(): MockDB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDB;
      if (parsed.version === VERSION) return (cache = parsed);
    }
  } catch {
    /* dados corrompidos: recria */
  }
  cache = buildSeed(VERSION);
  persist();
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* armazenamento cheio ou indisponível */
  }
}

export const db = {
  read<T>(fn: (d: MockDB) => T): T {
    return structuredClone(fn(load()));
  },
  write<T>(fn: (d: MockDB) => T): T {
    const d = load();
    const result = fn(d);
    persist();
    return structuredClone(result);
  },
  reset() {
    cache = buildSeed(VERSION);
    persist();
  }
};

/** Latência simulada para exercitar estados de carregamento. */
export const latency = (ms = 280) => new Promise((r) => setTimeout(r, ms));
