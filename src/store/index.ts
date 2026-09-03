import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import viewLanguageReducer from './viewLanguageSlice';
import githubCodeReducer from './githubCodeSlice';
import projectsReducer from './projectsSlice';
import currentPageReducer from './currentPageSlice';
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
