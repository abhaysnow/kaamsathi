/** Money math is done in integer paise to avoid floating-point drift (0.1 + 0.2 problem). */
export const toPaise = (rupees: number): number => Math.round(rupees * 100);
export const fromPaise = (paise: number): number => paise / 100;
