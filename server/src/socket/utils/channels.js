"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChannels = getChannels;
exports.getChannelPermissions = getChannelPermissions;
function getChannels() {
    // get channels from database
    return {
        "1": {
            name: "Channel #1",
            type: "voice",
            permissions: {
                canJoinRole: "*",
                canSpeakRole: "*",
                canStreamRole: "*",
            },
        },
    };
}
function getChannelPermissions(channelID) {
    const channels = getChannels();
    // get channel permissions from database
    return channels[channelID].permissions;
}
