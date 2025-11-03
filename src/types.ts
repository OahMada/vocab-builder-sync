export interface AppData {
  id: string;
  note: string | null;
  sentence: string;
  pieces: {
    id: string;
    word: string;
    IPA: string;
    index: number;
  }[];
  translation: string;
  audioUrl: string;
}
