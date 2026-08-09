export type OutgoingMessage =
  | {
      type: "space-joined";
      payload: {
        spawn: { x: number; y: number };
        users: {
          id: string;
          userId: string;
          name: string;
          avatarId: string | null;
          x: number;
          y: number;
        }[];
      };
    }
  | {
      type: "user-joined";
      payload: {
        userId: string;
        name: string;
        avatarId: string | null;
        x: number;
        y: number;
      };
    }
  | {
      type: "movement";
      payload: { userId: string; x: number; y: number };
    }
  | {
      type: "movement-rejected";
      payload: { x: number; y: number };
    }
  | { type: "user-left"; payload: { userId: string } }
  | {
      type: "chat";
      payload: { userId: string; name: string; text: string; ts: number };
    }
  | {
      type: "emote";
      payload: { userId: string; name: string; emote: string; ts: number };
    }
  | {
      type: "status";
      payload: { userId: string; status: "online" | "away" };
    };
