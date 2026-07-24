export interface HelperToggle {
    axes?: boolean;
    grid?: boolean;
    boundingBox?: boolean;
}
export declare class HelperController {
    toggles: HelperToggle;
    constructor(toggles?: HelperToggle);
    setToggle(key: keyof HelperToggle, value: boolean): void;
}
//# sourceMappingURL=HelperController.d.ts.map