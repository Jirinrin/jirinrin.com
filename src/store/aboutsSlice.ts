import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import objectsData from '../assets/objects';
import type { AboutObject } from '../types';
import type { RootState } from './index';

// Module-level glob for markdown files (Vite replaces require())
const aboutMarkdown = import.meta.glob<string>(
  '../assets/objects/*.md',
  { eager: true, query: '?raw', import: 'default' }
);

export const getAboutMarkdown = (id: string): string | undefined =>
  aboutMarkdown[`../assets/objects/${id}.md`];

export const fetchAboutTexts = createAsyncThunk(
  'abouts/fetchTexts',
  (_arg, { getState }) => {
    const abouts = (getState() as RootState).abouts;
    const newAbouts: Record<string, { text: string }> = {};
    Object.values(abouts)
      .filter(about => about.hasText)
      .forEach(about => {
        const text = getAboutMarkdown(about.id);
        if (text) newAbouts[about.id] = { text };
      });
    return newAbouts;
  }
);

const aboutsSlice = createSlice({
  name: 'abouts',
  initialState: objectsData as Record<string, AboutObject>,
  reducers: {
    setAboutText: (state, action: PayloadAction<{ id: string; text: string }>) => {
      if (state[action.payload.id]) state[action.payload.id].text = action.payload.text;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchAboutTexts.fulfilled, (state, action) => {
      Object.entries(action.payload).forEach(([id, val]) => {
        if (state[id]) state[id].text = val.text;
      });
    });
  },
});

export const { setAboutText } = aboutsSlice.actions;
export default aboutsSlice.reducer;
