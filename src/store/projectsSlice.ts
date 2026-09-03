import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import projectsData from '../assets/projects';
import type { Project } from '../types';
import type { RootState } from './index';

// Module-level glob for markdown files (Vite replaces require())
const projectMarkdown = import.meta.glob<string>(
  '../assets/projects/*.md',
  { eager: true, query: '?raw', import: 'default' }
);

const BOOK_STACK_WIDTH_LIMIT = 9;
const MINIMUM_BOOK_OVERLAP = 1.5;

const getXOffsets = (widths: number[]): number[] => {
  const offsets: number[] = [];
  widths.forEach((width, i) => {
    if (i === 0) {
      offsets.push(-width / 2);
    } else {
      let range = [offsets[i - 1] - width + MINIMUM_BOOK_OVERLAP, widths[i - 1] + offsets[i - 1] - MINIMUM_BOOK_OVERLAP];
      if (range[0] < -BOOK_STACK_WIDTH_LIMIT) range[0] = -BOOK_STACK_WIDTH_LIMIT;
      if (range[1] + width > BOOK_STACK_WIDTH_LIMIT) range[1] = BOOK_STACK_WIDTH_LIMIT - width;
      offsets.push(Math.random() * (range[1] - range[0]) + range[0]);
    }
  });
  return offsets;
};

const initialState: Project[] = projectsData.map((p, i) => ({
  ...p,
  book: {
    yOffset: projectsData.length - 1 - i,
    tintDeviation: 10 ** (Math.random() * 0.5),
    width: 1,
    xOffset: 0,
  },
}));

export const fetchProjectDescriptions = createAsyncThunk(
  'projects/fetchDescriptions',
  (_arg, { getState }) => {
    const projects = (getState() as RootState).projects;
    const descriptions = projects.map(p => {
      const key = `../assets/projects/${p.id}.md`;
      return projectMarkdown[key] ?? '';
    });
    return descriptions;
  }
);

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    updateWidths: (state, action: PayloadAction<(number | null)[]>) => {
      const xOffsets = getXOffsets(action.payload.map(w => w ?? 1));
      state.forEach((p, i) => {
        p.book.width = action.payload[i] ?? 1;
        p.book.xOffset = xOffsets[i];
      });
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchProjectDescriptions.fulfilled, (state, action) => {
      state.forEach((p, i) => {
        p.description = action.payload[i];
      });
    });
  },
});

export const { updateWidths } = projectsSlice.actions;
export default projectsSlice.reducer;
