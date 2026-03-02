import { io, Socket } from 'socket.io-client';

// Use the current origin for the socket connection
const URL = window.location.origin;

export const socket: Socket = io(URL, {
  autoConnect: false,
});
