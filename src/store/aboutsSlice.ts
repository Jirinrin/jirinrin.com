import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import objectsData from '../assets/objects';
import type { AboutObject } from '../types';
import type { RootState } from './index';

// Module-level glob for markdown files (Vite replaces require())
const aboutMarkdown = import.meta.glob<string>(
  '../assets/objects/*.md',
  { eager: true, query: '?raw', import: 'default' }
);

export const fetchAboutTexts = createAsyncThunk(
  'abouts/fetchTexts',
  (_arg, { getState }) => {
    const abouts = (getState() as RootState).abouts;
    const newAbouts: Record<string, { text: string }> = {};
    Object.values(abouts)
      .filter(about => about.hasText)
      .forEach(about => {
        const key = `../assets/objects/${about.id}.md`;
        const text = aboutMarkdown[key];
        if (text) newAbouts[about.id] = { text };
      });
    return newAbouts;
  }
);

const aboutsSlice = createSlice({
  name: 'abouts',
  initialState: objectsData as Record<string, AboutObject>,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchAboutTexts.fulfilled, (state, action) => {
      Object.entries(action.payload).forEach(([id, val]) => {
        if (state[id]) state[id].text = val.text;
      });
    });
  },
});

export default aboutsSlice.reducer;
