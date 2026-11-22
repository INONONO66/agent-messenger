export declare class ThriftCompactWriter {
    private bytes;
    private parentFieldStack;
    private lastFieldId;
    bool(id: number, value: boolean): this;
    byte(id: number, value: number): this;
    i16(id: number, value: number): this;
    i32(id: number, value: number): this;
    i64(id: number, value: number | bigint): this;
    binary(id: number, value: string | Buffer): this;
    listOfI32(id: number, values: number[]): this;
    listOfBinary(id: number, values: string[]): this;
    mapBinaryBinary(id: number, entries: Record<string, string>): this;
    structStart(id: number): this;
    structEnd(): this;
    finish(): Buffer;
    private writeFieldHeader;
    private writeListHeader;
    private writeBinaryValue;
    private writeVarint;
}
//# sourceMappingURL=thrift.d.ts.map