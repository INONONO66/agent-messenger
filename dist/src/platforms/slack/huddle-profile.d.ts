export declare const huddleProfileRoot: string;
export declare function warnHuddleProfile(code: 'huddle_profile_sweep_failed' | 'huddle_profile_remove_failed', path: string): void;
export declare function createHuddleProfile(root?: string): Promise<string>;
export declare function removeHuddleProfile(profile: string): Promise<void>;
/** Recovers profiles whose owner died with its host. Failures warn and never fail a join. */
export declare function sweepHuddleProfiles(root?: string, now?: number): Promise<void>;
//# sourceMappingURL=huddle-profile.d.ts.map