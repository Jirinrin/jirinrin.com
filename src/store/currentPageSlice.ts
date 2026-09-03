import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CurrentPage, Popup } from '../types';

export interface ChangePagePayload {
  landscape?: 1 | 2;
  popup?: Popup | null;
  showPopup?: boolean;
  forceLoad?: boolean | number | null;
}

const initialState: CurrentPage = {
  landscape: 1,
  popup: null,
  showPopup: false,
  forceLoad: null,
};

const currentPageSlice = createSlice({
  name: 'currentPage',
  initialState,
  reducers: {
    changePage: (state, action: PayloadAction<ChangePagePayload>) => {
      const { landscape, popup, showPopup, forceLoad } = action.payload;
      return {
        landscape: landscape ?? state.landscape,
        popup: popup !== undefined ? (popup ?? null) : state.popup,
        // auto-set showPopup when a popup is provided; explicit showPopup overrides
        showPopup: popup ? true : (showPopup !== undefined ? showPopup : state.showPopup),
        // any truthy forceLoad → generate a new random value
        forceLoad: forceLoad ? Math.random() : state.forceLoad,
      };
    },
  },
});

export const { changePage } = currentPageSlice.actions;
export default currentPageSlice.reducer;
