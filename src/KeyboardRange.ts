import { createContext } from 'react';

export const BLOG_KEYBOARD_RANGE = [36, 84] as const; // C2–C6, shared by every blog demo.
export const KeyboardRange = createContext<readonly [number, number] | undefined>(undefined);
