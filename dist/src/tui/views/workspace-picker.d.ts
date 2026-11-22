import blessed from 'blessed';
import type { Workspace } from '../adapters/types.js';
export declare class WorkspacePicker {
    private screen;
    private overlay;
    private searchInput;
    private resultsList;
    private allWorkspaces;
    private filteredWorkspaces;
    private onSelectCallback;
    private active;
    constructor(screen: blessed.Widgets.Screen);
    open(workspaces: Workspace[], onSelect: (workspace: Workspace) => void): void;
    close(): void;
    isActive(): boolean;
    private filterWorkspaces;
}
//# sourceMappingURL=workspace-picker.d.ts.map