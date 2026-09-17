import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { GithubCodeState, GithubFile } from '../types';
import type { RootState } from './index';
import { shuffle } from '../constants';

const USER_NAME    = 'Jirinrin';
const BASE_URL     = `https://api.github.com/repos/${USER_NAME}`;
const BASE_URL_RAW = `https://raw.githubusercontent.com/${USER_NAME}`;
const INDEX_DEPTH = 3;
const ALLOWED_FILE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'java', 'json', 'c', 'cpp', 'h', 'cs', 'py', 'lua', 'md', 'txt'];

const initialState: GithubCodeState = {
  indexing: null,
  code: [],
};

export const indexGithub = createAsyncThunk(
  'githubCode/index',
  async (_arg, { getState }) => {
    const projects = (getState() as RootState).projects;
    if (!projects) return {};

    const indexing: Record<string, string[]> = {};

    await Promise.all(
      projects.map(async p => {
        if (!p.github) return;

        const branchRes = await fetch(`${BASE_URL}/${p.id}/branches/master`);
        const branchData = await branchRes.json() as { commit: { commit: { tree: { sha: string } } } };
        const treeSha = branchData.commit.commit.tree.sha;

        const treeRes = await fetch(`${BASE_URL}/${p.id}/git/trees/${treeSha}?recursive=${INDEX_DEPTH}`);
        const treeData = await treeRes.json() as { tree: Array<{ type: string; size: number; path: string }> };
        indexing[p.id] = treeData.tree
          .filter(obj => obj.type === 'blob' && obj.size < 10000 && ALLOWED_FILE_EXTENSIONS.find(ext => obj.path.endsWith(`.${ext}`)))
          .map(obj => obj.path);
      })
    );

    return indexing;
  }
);

export const loadGithubCode = createAsyncThunk(
  'githubCode/loadCode',
  async ({ allProjects = false, numberOfProjects = 1 }: { allProjects?: boolean; numberOfProjects?: number }, { getState }) => {
    const projects = (getState() as RootState).projects;
    const indexing = (getState() as RootState).githubCode.indexing;
    if (!projects || !indexing) return [];

    if (allProjects) {
      const selectedProjects = shuffle(projects.filter(p => p.github)).slice(0, numberOfProjects);
      const results = await Promise.all(
        selectedProjects.map(async p => {
          const files = indexing[p.id];
          if (!files || files.length === 0) return null;
          const filePath = files[Math.round(Math.random() * (files.length) - 0.5)];
          const res = await fetch(`${BASE_URL_RAW}/${p.id}/master/${filePath}`);
          const code = await res.text();
          return { repo: p.id, filePath, code } as GithubFile;
        })
      );
      return results.filter((r): r is GithubFile => r !== null);
    } else {
      const repos = Object.keys(indexing);
      const repo = repos[Math.round(Math.random() * repos.length - 0.5)];
      const files = indexing[repo];
      if (!files || files.length === 0) return [];
      const filePath = files[Math.round(Math.random() * files.length - 0.5)];
      const res = await fetch(`${BASE_URL_RAW}/${repo}/master/${filePath}`);
      const code = await res.text();
      return [{ repo, filePath, code }] as GithubFile[];
    }
  }
);

const githubCodeSlice = createSlice({
  name: 'githubCode',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(indexGithub.fulfilled, (state, action) => {
      state.indexing = action.payload;
    });
    builder.addCase(loadGithubCode.fulfilled, (state, action) => {
      const newCode = action.payload;
      state.code.push(...newCode);
      if (state.indexing) {
        newCode.forEach(c => {
          if (state.indexing![c.repo]) {
            state.indexing![c.repo] = state.indexing![c.repo].filter(file => file !== c.filePath);
            if (state.indexing![c.repo].length === 0) {
              delete state.indexing![c.repo];
            }
          }
        });
      }
    });
  },
});

export default githubCodeSlice.reducer;
