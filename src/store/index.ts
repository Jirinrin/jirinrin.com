import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import viewLanguageReducer from './viewLanguageSlice';
import githubCodeReducer from './githubCodeSlice';
import projectsReducer from './projectsSlice';
import currentPageReducer, { changePage } from './currentPageSlice';
import aboutsReducer from './aboutsSlice';

const store = configureStore({
  reducer: {
    viewLanguage: viewLanguageReducer,
    githubCode: githubCodeReducer,
    projects: projectsReducer,
    currentPage: currentPageReducer,
    abouts: aboutsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export default store;

// aboutsSlice eagerly globs every object's markdown, so by default a Vite HMR
// update to any *.md file has no accepting boundary and falls back to a full
// page reload — which reset the URL and dropped whatever popup was open.
// Accept the update here instead (this module is a natural boundary: it's
// where aboutsSlice's reducer is wired into the live `store`) and patch the
// changed text directly into `abouts`, and into the currently open popup (if
// it's showing that object), so editing a markdown file updates the open
// popup's text in place without reloading or losing any state.
if (import.meta.hot) {
  import.meta.hot.accept('./aboutsSlice', (newAboutsModule) => {
    if (!newAboutsModule) return;
    const state = store.getState();
    Object.values(state.abouts)
      .filter(about => about.hasText)
      .forEach(about => {
        const text = newAboutsModule.getAboutMarkdown(about.id);
        if (!text) return;
        store.dispatch(newAboutsModule.setAboutText({ id: about.id, text }));
        const { popup } = store.getState().currentPage;
        if (popup?.id === about.id && popup.text !== undefined) {
          store.dispatch(changePage({ popup: { ...popup, text } }));
        }
      });
  });
}
