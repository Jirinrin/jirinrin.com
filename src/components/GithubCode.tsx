import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { duotoneForest as duotone } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { GithubCodeLine } from '../types';
import './GithubCode.scss';

const LANGUAGE_REFERENCE: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  css: 'css', scss: 'scss', html: 'markup',
  java: 'java', c: 'c', cpp: 'cpp', h: 'cpp', cs: 'csharp',
  py: 'python', lua: 'lua', md: 'markdown'
};

function shuffleArr<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface GithubCodeProps {
  code: GithubCodeLine[] | null;
}

function GithubCode({ code }: GithubCodeProps) {
  if (!code) return null;
  const shuffledCode = shuffleArr(code);
  return (
    <div className="GithubCode">
      {shuffledCode.map(c => {
        const splittedPath = c.filePath.split('.');
        return (
          <a
            key={c.code + c.filePath + c.lineNo + c.repo}
            href={`https://github.com/Jirinrin/${c.repo}/blob/master/${c.filePath}`}
            rel="noopener noreferrer" target="_blank"
          >
            <SyntaxHighlighter
              style={duotone}
              language={LANGUAGE_REFERENCE[splittedPath[splittedPath.length - 1]]}
            >
              {c.code}
            </SyntaxHighlighter>
          </a>
        );
      })}
    </div>
  );
}

export default GithubCode;
