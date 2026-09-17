// Shared type definitions for the portfolio website

export interface ProjectCover {
  type: 'image' | 'video';
  src: string;
  // width / height of the cover asset itself (post-crop), so the banner can
  // reserve its box up front instead of jumping once the media loads.
  ratio: number;
}

export interface ProjectBase {
  id: string;
  title: string;
  github: boolean;
  images: string[];
  cover?: ProjectCover;
  // Locks the gallery viewport to a 16/9 box regardless of device size,
  // cropping images to fill it instead of letterboxing them.
  landscapeGallery?: boolean;
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

export type PopupType = 'text' | 'about' | 'project' | 'gallery' | 'memories' | 'groove';

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
