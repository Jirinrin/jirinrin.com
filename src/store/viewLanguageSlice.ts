import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const viewLanguageSlice = createSlice({
  name: 'viewLanguage',
  initialState: 'en-EN' as string,
  reducers: {
    changeLanguage: (_state, action: PayloadAction<string>) => action.payload,
  },
});

export const { changeLanguage } = viewLanguageSlice.actions;
export default viewLanguageSlice.reducer;
