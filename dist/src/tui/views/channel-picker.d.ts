import blessed from 'blessed';
import type { UnifiedChannel } from '../adapters/types.js';
export declare class ChannelPicker {
    private screen;
    private overlay;
    private searchInput;
    private resultsList;
    private allChannels;
    private filteredChannels;
    private onSelectCallback;
    private active;
    constructor(screen: blessed.Widgets.Screen);
    open(channels: UnifiedChannel[], onSelect: (channel: UnifiedChannel) => void): void;
    close(): void;
    isActive(): boolean;
    private filterChannels;
}
//# sourceMappingURL=channel-picker.d.ts.map