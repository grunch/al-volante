import { createContext } from 'react';
import type { RendererFactory } from './SceneCanvas.tsx';

/** Lets tests swap the WebGL renderer for a fake; undefined means "use THREE.WebGLRenderer". */
export const RendererContext = createContext<RendererFactory | undefined>(undefined);
