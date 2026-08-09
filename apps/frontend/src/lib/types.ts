export type Role = "Admin" | "User";

export interface Session {
  token: string;
  userId: string;
  role: Role;
  username: string;
}

export interface Element {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  static: boolean;
}

export interface Avatar {
  id: string;
  imageUrl: string;
  name: string;
}

export interface SpaceSummary {
  id: string;
  name: string;
  thumbnail: string | null;
  dimensions: string;
}

export interface SpaceElement {
  id: string;
  element: Element;
  x: number;
  y: number;
}

export interface SpaceDetail {
  dimensions: string;
  elements: SpaceElement[];
}

export interface CreateSpaceInput {
  name: string;
  dimensions: string;
  mapId?: string;
}

export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export interface PlayerVisual {
  userId: string;
  color: string;
  name: string;
}
