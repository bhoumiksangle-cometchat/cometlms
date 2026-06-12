export declare function createChatRoom(input: {
    roomId: string;
    name: string;
    ownerId: string;
    type?: 'GROUP' | 'DM';
}): any;
export declare function addRoomMember(input: {
    roomId: string;
    userId: string;
    role?: string;
}): any;
export declare function removeRoomMember(input: {
    roomId: string;
    userId: string;
}): any;
//# sourceMappingURL=groups.d.ts.map