export type UserId = string;

export type PlayerPosition =
  | 'goleiro' | 'zagueiro' | 'lateral' | 'volante' | 'meia' | 'ponta' | 'atacante' | 'coringa';

export type DominantFoot = 'direito' | 'esquerdo' | 'ambos';

export interface SocialLink {
  id: string;
  label: string;
  url: string;
}

export interface SocialLinks {
  instagram?: string;
  whatsapp?: string;
  others: SocialLink[];
}

export interface Title {
  id: string;
  name: string;
  year?: number;
  description?: string;
}

export interface VideoLink {
  id: string;
  title: string;
  url: string;
}

export interface User {
  id: UserId;
  /** ID numérico público, único, usado para busca (ex.: 48291) */
  publicId: string;
  /** @handle único, sem o @ */
  username: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  position?: PlayerPosition;
  dominantFoot?: DominantFoot;
  city?: string;
  socialLinks: SocialLinks;
  titles: Title[];
  videos: VideoLink[];
  /** Reservado para sorteio equilibrado (1–5). Não exposto na UI na v1. */
  skill?: number;
  createdAt: string;
}

/** Visão pública de um usuário (sem dados de contato sensíveis) */
export type PublicUser = Omit<User, 'email'>;

export type FriendshipStatus = 'pending' | 'accepted';

export interface Friendship {
  id: string;
  requesterId: UserId;
  addresseeId: UserId;
  status: FriendshipStatus;
  createdAt: string;
}
