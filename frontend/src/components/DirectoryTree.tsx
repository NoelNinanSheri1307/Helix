"use client";

import React, { useMemo, useState } from 'react';
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react';

interface TreeNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children: TreeNode[];
}

function buildTree(directories: string[], files: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'directory', children: [] };

  const addPath = (path: string, type: TreeNode['type']) => {
    const parts = path.split('/').filter(Boolean);
    let parent = root;
    parts.forEach((part, index) => {
      const nodeType = index === parts.length - 1 ? type : 'directory';
      let child = parent.children.find(node => node.name === part);
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          type: nodeType,
          children: [],
        };
        parent.children.push(child);
      }
      parent = child;
    });
  };

  directories.forEach(path => addPath(path, 'directory'));
  files.forEach(path => addPath(path, 'file'));
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(node => sort(node.children));
  };
  sort(root.children);
  return root.children;
}

function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDirectory = node.type === 'directory';

  return (
    <li>
      <button
        type="button"
        onClick={() => isDirectory && setExpanded(value => !value)}
        className="w-full flex items-center gap-2 py-1.5 pr-3 text-left text-xs text-zinc-400 hover:text-ivory hover:bg-zinc-900/60 rounded transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        title={node.path}
      >
        {isDirectory ? (
          <>
            <ChevronRight size={12} className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            {expanded ? <FolderOpen size={14} className="text-gold/80 shrink-0" /> : <Folder size={14} className="text-gold/60 shrink-0" />}
          </>
        ) : (
          <>
            <span className="w-3" />
            <File size={13} className="text-zinc-600 shrink-0" />
          </>
        )}
        <span className="truncate font-mono-ui">{node.name}</span>
      </button>
      {isDirectory && expanded && node.children.length > 0 && (
        <ul>{node.children.map(child => <TreeItem key={`${child.type}:${child.path}`} node={child} depth={depth + 1} />)}</ul>
      )}
    </li>
  );
}

export function DirectoryTree({ directories, files }: { directories: string[]; files: string[] }) {
  const tree = useMemo(() => buildTree(directories, files), [directories, files]);
  return <ul>{tree.map(node => <TreeItem key={`${node.type}:${node.path}`} node={node} depth={0} />)}</ul>;
}
