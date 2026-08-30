// Shared type definitions for the portfolio website

export interface ProjectBase {
  id: string;
  title: string;
  github: boolean;
  images: string[];
}

export interface ProjectBook {
  yOffset: number;
  tintDeviation: number;
  width: number;
  xOffset: number;
}

export interface Project extends ProjectBase {
  description?: string;
  book: ProjectBook;
}

export interface AboutObject {
  id: string;
  name: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  hasText: boolean;
  extension: string;
  text?: string;
}

export type PopupType = 'text' | 'about' | 'project' | 'gallery';

export interface Popup {
  type: PopupType;
  id?: string;
  text?: string;
  project?: Project;
}

export interface CurrentPage {
  landscape: 1 | 2;
  popup: Popup | null;
  showPopup: boolean;
  forceLoad: number | null;
}

export interface GithubFile {
  repo: string;
  filePath: string;
  code: string;
}

export interface GithubCodeState {
  indexing: Record<string, string[]> | null;
  code: GithubFile[];
}

export interface GithubCodeLine {
  repo: string;
  filePath: string;
  lineNo: number;
  code: string;
}
